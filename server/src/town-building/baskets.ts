import type {Pool,PoolClient} from 'pg';
import {AppError} from '../errors.js';
import {recordRiverEvent} from './riverEvents.js';
import {lockFriendship,visibleFriendProfilesSql as visible} from './friendship.js';
import {BASKET_LIMIT,DECORATION_MS,BASKET_COOLDOWN_MS,type BasketSend,type BasketInbox,type BasketVisitor,type BasketScene,type OpenedBasketGift,type BasketDecoration} from './basketModel.js';
type Reader=Pick<PoolClient,'query'>;
interface GiftRow {id:string;sender_profile_id:string;recipient_profile_id:string;sender_name?:string;decoration:BasketDecoration;message:number;created_at:Date;opened_at:Date|null}
export interface TownBasketsRepository {
  inbox(family:string,owner:string,offset:number):Promise<BasketInbox>;
  visitor(family:string,viewer:string,target:string):Promise<BasketVisitor>;
  send(family:string,viewer:string,target:string,input:BasketSend):Promise<BasketVisitor>;
  open(family:string,owner:string,id:string):Promise<{gift:OpenedBasketGift;basket:BasketInbox}>;
}
const unavailable=()=>new AppError(404,'TOWN_BASKET_NOT_FOUND','This surprise is not available.');
export function createTownBasketsRepository(pool:Pool,clock=Date.now):TownBasketsRepository {
  async function owner(db:Reader,family:string,id:string){if(!(await db.query('SELECT id FROM profiles WHERE id=$1 AND family_id=$2',[id,family])).rowCount)throw unavailable();}
  async function lockBasket(db:Reader,id:string){await db.query("SELECT pg_advisory_xact_lock(hashtextextended('town-basket:'||$1,0))",[id]);}
  async function scene(db:Reader,id:string,now:number):Promise<BasketScene>{
    const result=await db.query<GiftRow>('SELECT id,decoration,created_at FROM town_basket_gifts WHERE recipient_profile_id=$1 AND created_at>$2 ORDER BY created_at,id LIMIT 50',[id,new Date(now-DECORATION_MS)]);
    return {serverNow:now,decorations:result.rows.map(g=>({id:g.id,decoration:g.decoration,expiresAt:g.created_at.getTime()+DECORATION_MS}))};
  }
  async function capacity(db:Reader,family:string,id:string,now:number){
    const count=await db.query<{count:number}>(`WITH visible AS (${visible}) SELECT COUNT(*)::int AS count FROM town_basket_gifts g JOIN visible p ON p.id=g.sender_profile_id WHERE g.recipient_profile_id=$2 AND g.opened_at IS NULL AND g.created_at>$3`,[family,id,new Date(now-DECORATION_MS)]);
    return count.rows[0]!.count;
  }
  async function visitorState(db:Reader,viewer:string,target:string,targetFamily:string,now:number):Promise<BasketVisitor>{
    const result=await db.query<{waiting:boolean;last_at:Date|null}>('SELECT COALESCE(bool_or(opened_at IS NULL AND created_at>$3),false) AS waiting,MAX(created_at) AS last_at FROM town_basket_gifts WHERE sender_profile_id=$1 AND recipient_profile_id=$2',[viewer,target,new Date(now-DECORATION_MS)]);
    const row=result.rows[0]!,nextSendAt=row.last_at?row.last_at.getTime()+BASKET_COOLDOWN_MS:null;
    const reason=row.waiting?'waiting':nextSendAt!==null&&nextSendAt>now?'cooldown':await capacity(db,targetFamily,target,now)>=BASKET_LIMIT?'full':null;
    return {...await scene(db,target,now),canSend:reason===null,reason,nextSendAt};
  }
  async function inboxState(db:Reader,family:string,id:string,offset:number,now:number):Promise<BasketInbox>{
    await owner(db,family,id);
    const result=await db.query<{pending:{id:string;senderId:string;senderName:string}[];unopened_count:number}>(`WITH visible AS (${visible}), pending AS MATERIALIZED (
      SELECT g.id,g.created_at,p.id AS sender_id,p.name AS sender_name FROM town_basket_gifts g JOIN visible p ON p.id=g.sender_profile_id
      WHERE g.recipient_profile_id=$2 AND g.opened_at IS NULL AND g.created_at>$4), page AS (SELECT * FROM pending ORDER BY created_at,id LIMIT 6 OFFSET $3)
      SELECT (SELECT COUNT(*)::int FROM pending) AS unopened_count,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'senderId',sender_id,'senderName',sender_name) ORDER BY created_at,id) FROM page),'[]'::jsonb) AS pending`,[family,id,offset,new Date(now-DECORATION_MS)]);
    const row=result.rows[0]!;
    return {...await scene(db,id,now),pending:row.pending.slice(0,5),unopenedCount:row.unopened_count,nextOffset:row.pending.length>5?offset+5:null};
  }
  async function transaction<T>(action:(db:PoolClient,now:number)=>Promise<T>):Promise<T>{
    const db=await pool.connect();
    try{await db.query('BEGIN');const result=await action(db,clock());await db.query('COMMIT');return result;}
    catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  }
  return {
    inbox:(family,id,offset)=>inboxState(pool,family,id,offset,clock()),
    visitor:(family,viewer,target)=>transaction(async(db,now)=>{const targetFamily=await lockFriendship(db,family,viewer,target);return visitorState(db,viewer,target,targetFamily,now);}),
    send:(family,viewer,target,input)=>transaction(async(db,now)=>{
      const targetFamily=await lockFriendship(db,family,viewer,target);await lockBasket(db,target);
      const existing=await db.query<GiftRow>('SELECT * FROM town_basket_gifts WHERE id=$1',[input.requestId]);
      if(existing.rows[0]){
        const g=existing.rows[0];if(g.sender_profile_id!==viewer||g.recipient_profile_id!==target||g.decoration!==input.decoration||g.message!==input.message)throw new AppError(409,'TOWN_BASKET_CHANGED','This surprise request changed. Please try again.');
        return visitorState(db,viewer,target,targetFamily,now);
      }
      // Expired contents can be discarded; durable delivery receipts prevent resurrection.
      if((await db.query('SELECT 1 FROM town_river_events WHERE event_key=$1',[`gift:${input.requestId}`])).rowCount)throw unavailable();
      await db.query('DELETE FROM town_basket_gifts WHERE recipient_profile_id=$1 AND created_at<=$2',[target,new Date(now-DECORATION_MS)]);
      const state=await visitorState(db,viewer,target,targetFamily,now);
      if(!state.canSend)throw new AppError(409,'TOWN_BASKET_WAIT',state.reason==='waiting'?'Your surprise is still waiting to be opened.':state.reason==='full'?'This basket is full. Try another day.':'You can leave another surprise tomorrow.');
      await db.query('INSERT INTO town_basket_gifts(id,sender_profile_id,recipient_profile_id,decoration,message,created_at) VALUES($1,$2,$3,$4,$5,$6)',[input.requestId,viewer,target,input.decoration,input.message,new Date(now)]);
      await recordRiverEvent(db,target,viewer,`gift:${input.requestId}`,'gift',{decoration:input.decoration},0,now);
      return visitorState(db,viewer,target,targetFamily,now);
    }),
    open:(family,id,giftId)=>transaction(async(db,now)=>{
      await owner(db,family,id);
      const read=await db.query<GiftRow>('SELECT * FROM town_basket_gifts WHERE id=$1 AND recipient_profile_id=$2 AND created_at>$3',[giftId,id,new Date(now-DECORATION_MS)]);
      if(!read.rows[0])throw unavailable();
      await lockFriendship(db,family,id,read.rows[0].sender_profile_id);await lockBasket(db,id);
      const result=await db.query<GiftRow>(`UPDATE town_basket_gifts SET opened_at=COALESCE(opened_at,$3) WHERE id=$1 AND recipient_profile_id=$2 AND created_at>$4 RETURNING *, (SELECT name FROM profiles WHERE id=sender_profile_id) AS sender_name`,[giftId,id,new Date(now),new Date(now-DECORATION_MS)]);
      const g=result.rows[0];if(!g)throw unavailable();
      const openedAt=g.opened_at!.getTime();
      return {gift:{id:g.id,senderId:g.sender_profile_id,senderName:g.sender_name!,decoration:g.decoration,message:g.message,openedAt,expiresAt:g.created_at.getTime()+DECORATION_MS},basket:await inboxState(db,family,id,0,now)};
    }),
  };
}
