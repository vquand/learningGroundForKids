import type {Pool,PoolClient} from 'pg';
import {AppError} from '../errors.js';
import {creditTown,lockTown} from './repository.js';
import {lockRaft} from './raftStock.js';
import {lockFriendship} from './friendship.js';
import {lockRiver,recordRiverEvent} from './riverEvents.js';
import {emptyRiverReport,riverReport,riverDays} from './riverReport.js';
import {RAFT_DAILY_LIMIT,RAFT_UNLOCK_FISH,riverDayStart,splitRaftStamina,type RaftState,type RaftPickup,type RiverReport,type RaftItem,type RaftItemKind} from './raftCatalog.js';
type Reader=Pick<PoolClient,'query'>;
interface StockRow {id:string;provider_id:string;kind:RaftItemKind;item_id:string;stamina:number;picker_id:string|null;pickup_request_id:string|null}
export interface TownRaftRepository {
 get(family:string,viewer:string,target?:string):Promise<RaftState>;
 visit(family:string,viewer:string,target:string,requestId:string):Promise<void>;
 arrive(family:string,owner:string,requestId:string):Promise<RaftState & {hasNew:boolean}>;
 pick(family:string,viewer:string,target:string,input:RaftPickup):Promise<{state:RaftState;receipt:{id:string;stamina:number};newlyPicked:boolean;providerStamina:number}>;
}
const unavailable=()=>new AppError(404,'TOWN_RAFT_UNAVAILABLE','This river item is not available.');
export function createTownRaftRepository(pool:Pool,clock=Date.now):TownRaftRepository {
 async function owned(db:Reader,family:string,viewer:string){if(!(await db.query('SELECT id FROM profiles WHERE id=$1 AND family_id=$2',[viewer,family])).rowCount)throw unavailable();}
 async function remaining(db:Reader,id:string,now:number){const r=await db.query<{n:number}>('SELECT COUNT(*)::int AS n FROM town_raft_items WHERE picker_id=$1 AND picked_at>=$2',[id,new Date(riverDayStart(now))]);return Math.max(0,RAFT_DAILY_LIMIT-r.rows[0]!.n);}
 async function state(db:Reader,viewer:string,target:string,now:number):Promise<RaftState>{
  const progress=await db.query<{fish_caught:number}>('SELECT fish_caught FROM town_raft_progress WHERE profile_id=$1',[target]);
  const fishCaught=progress.rows[0]?.fish_caught??0,unlocked=fishCaught>=RAFT_UNLOCK_FISH;
  const stock=unlocked?await db.query<StockRow>('SELECT id,kind,item_id,stamina FROM town_raft_items WHERE provider_id=$1 AND picked_at IS NULL AND produced_at>=$2 ORDER BY produced_at,id LIMIT 10',[target,new Date(riverDayStart(now)-86400000)]):{rows:[]};
  const own=viewer===target;
  const report=own?await db.query<{last_report:RiverReport|null}>('SELECT last_report FROM town_river_inbox WHERE profile_id=$1',[viewer]):{rows:[]};
  return {unlocked,fishCaught,items:stock.rows.map(r=>({id:r.id,kind:r.kind,itemId:r.item_id,stamina:r.stamina}) satisfies RaftItem),remainingToday:await remaining(db,viewer,now),serverNow:now,report:report.rows[0]?.last_report??emptyRiverReport(),days:own?await riverDays(db,viewer,now):[]};
 }
 async function transaction<T>(fn:(db:PoolClient,now:number)=>Promise<T>){const db=await pool.connect();try{await db.query('BEGIN');const value=await fn(db,clock());await db.query('COMMIT');return value;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 return {
  get:(family,viewer,target)=>transaction(async(db,now)=>{if(target)await lockFriendship(db,family,viewer,target);else await owned(db,family,viewer);return state(db,viewer,target??viewer,now);}),
  visit:(family,viewer,target,requestId)=>transaction(async(db,now)=>{
   await lockFriendship(db,family,viewer,target);await lockRiver(db,target);
   await recordRiverEvent(db,target,viewer,`visit:${target}:${viewer}:${requestId}`,'visit',{},0,now);
  }),
  arrive:(family,id,requestId)=>transaction(async(db,now)=>{
   await owned(db,family,id);await lockRiver(db,id);
   await db.query('INSERT INTO town_river_inbox(profile_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
   const previous=(await db.query<{last_sequence:string;last_arrival_id:string|null;last_arrival_new:boolean}>('SELECT last_sequence,last_arrival_id,last_arrival_new FROM town_river_inbox WHERE profile_id=$1 FOR UPDATE',[id])).rows[0]!;
   if(previous.last_arrival_id===requestId)return {...await state(db,id,id,now),hasNew:previous.last_arrival_new};
   const max=await db.query<{seq:string}>('SELECT COALESCE(MAX(sequence),0)::text AS seq FROM town_river_events WHERE owner_id=$1',[id]);
   const seq=Number(max.rows[0]!.seq),hasNew=seq>Number(previous.last_sequence);
   if(hasNew){const report=await riverReport(db,id,Number(previous.last_sequence),seq);await db.query('UPDATE town_river_inbox SET last_sequence=$2,last_arrival_id=$3,last_arrival_new=true,last_report=$4 WHERE profile_id=$1',[id,seq,requestId,JSON.stringify(report)]);}
   else await db.query('UPDATE town_river_inbox SET last_arrival_id=$2,last_arrival_new=false WHERE profile_id=$1',[id,requestId]);
   return {...await state(db,id,id,now),hasNew};
  }),
  pick:(family,viewer,target,input)=>transaction(async(db,now)=>{
   await lockFriendship(db,family,viewer,target);
   await db.query("SELECT pg_advisory_xact_lock(hashtextextended('raft-picker:'||$1,0))",[viewer]);
   const unlocked=await db.query('SELECT 1 FROM town_raft_progress WHERE profile_id=$1 AND fish_caught>=50',[target]);
   if(!unlocked.rowCount)throw new AppError(409,'TOWN_RAFT_LOCKED','This raft unlocks after 50 new fish catches.');
   for(const id of [viewer,target].sort())await lockTown(db,id);
   await lockRaft(db,target);
   const ids=('itemIds'in input?[...input.itemIds]:[input.itemId]).sort();
   if(ids.length<1||ids.length>5||new Set(ids).size!==ids.length)throw new AppError(422,'TOWN_RAFT_SELECTION','Choose between one and five items.');
   await db.query("SELECT pg_advisory_xact_lock(hashtextextended('raft-request:'||$1,0))",[input.requestId]);
   const receiptId='itemId'in input?ids[0]!:input.requestId;
   const previous=(await db.query<{owner_id:string;visitor_id:string;data:{itemIds:string[];pickerStamina:number;providerStamina:number;receiptId:string}}>('SELECT owner_id,visitor_id,data FROM town_river_events WHERE event_key=$1',[`pickup-request:${input.requestId}`])).rows[0];
   if(previous){
    if(previous.owner_id!==target||previous.visitor_id!==viewer||JSON.stringify(previous.data.itemIds)!==JSON.stringify(ids))throw unavailable();
    return {state:await state(db,viewer,target,now),receipt:{id:previous.data.receiptId,stamina:previous.data.pickerStamina},providerStamina:previous.data.providerStamina,newlyPicked:false};
   }
   // Preserve retries for single-item receipts committed before batch pickup existed.
   const repeated=(await db.query<StockRow>('SELECT * FROM town_raft_items WHERE pickup_request_id=$1',[input.requestId])).rows[0];
   if(repeated){if(ids.length!==1||repeated.id!==ids[0]||repeated.picker_id!==viewer||repeated.provider_id!==target)throw unavailable();const reward=splitRaftStamina(repeated.stamina);return {state:await state(db,viewer,target,now),receipt:{id:repeated.id,stamina:reward.picker},providerStamina:reward.provider,newlyPicked:false};}
   const rows=(await db.query<StockRow>('SELECT * FROM town_raft_items WHERE id=ANY($1::text[]) AND provider_id=$2 AND picked_at IS NULL AND produced_at>=$3 ORDER BY id FOR UPDATE',[ids,target,new Date(riverDayStart(now)-86400000)])).rows;
   if(rows.length!==ids.length)throw unavailable();
   const quota=await remaining(db,viewer,now);
   if(quota<ids.length)throw new AppError(409,'TOWN_RAFT_DAILY_LIMIT',quota===0?'You have collected 30 river items today. Come back tomorrow!':'You do not have enough river pickups left today.');
   const totals=rows.reduce((sum,row)=>{const reward=splitRaftStamina(row.stamina);return {picker:sum.picker+reward.picker,provider:sum.provider+reward.provider};},{picker:0,provider:0});
   for(const [index,row]of rows.entries()){
    const reward=splitRaftStamina(row.stamina);
    await db.query('UPDATE town_raft_items SET picker_id=$2,picked_at=$3,pickup_request_id=$4 WHERE id=$1',[row.id,viewer,new Date(now),'itemId'in input?input.requestId:`${input.requestId}:${row.id}`]);
    await creditTown(db,viewer,`raft:${row.id}:picker`,{stamina:reward.picker});await creditTown(db,target,`raft:${row.id}:provider`,{stamina:reward.provider});
    await recordRiverEvent(db,target,viewer,index===0?`pickup-request:${input.requestId}`:`pickup:${row.id}`,'pickup',{kind:row.kind,itemId:row.item_id,...(index===0?{itemIds:ids,pickerStamina:totals.picker,providerStamina:totals.provider,receiptId}:{pickerStamina:reward.picker})},reward.provider,now);
   }
   await db.query('DELETE FROM town_raft_items WHERE provider_id=$1 AND produced_at<$2',[target,new Date(riverDayStart(now)-86400000)]);
   return {state:await state(db,viewer,target,now),receipt:{id:receiptId,stamina:totals.picker},providerStamina:totals.provider,newlyPicked:true};
  }),
 };
}
