import {habitScenery} from './animalHabits.ts';
import type {Pool} from 'pg';
import {AppError} from '../errors.js';
import {prosperityStage} from './civ.js';
import {DEFAULT_TOWN_NAME,eventBuildingExpired,type Entity,type TownName,type TownState} from './game.js';
import type {LakeRaft} from './water/types.js';

export interface TownFriendProfile {
  id:string;name:string;emoji:string;color:string;
  avatar_type:'emoji'|'default'|'custom'|null;avatar_url:string|null;avatar_frame:string|null;
}
export interface FriendTown {
  profile:TownFriendProfile;townName:TownName;prosperityStage:0|1|2|3;lakeStage:0|1|2|null;
}
export interface FriendTownPage {towns:FriendTown[];nextOffset:number|null}
export interface FriendTownScene {entities:Entity[];rafts:LakeRaft[];civActiveMs:number;droppings?:TownState['droppings'];bushes?:TownState['bushes']}
export interface FriendTownVisit extends FriendTown,FriendTownScene {}
interface FriendRow {profile:TownFriendProfile;state:TownState|null;home_city:string|null;home_country:string|null}
export type VisitHomeDate = (city: string | null, country: string | null) => string | undefined;
export interface TownVisitsRepository {
  list(familyId:string,viewerId:string,offset:number):Promise<FriendTownPage>;
  get(familyId:string,viewerId:string,targetId:string,homeDate?:VisitHomeDate):Promise<FriendTownVisit & {homeCity:string|null;homeCountry:string|null}>;
  avatar(familyId:string,viewerId:string,targetId:string):Promise<string|null>;
}

import {visibleFriendProfilesSql as visible} from './friendship.js';
const profileJson=`jsonb_build_object('id',p.id,'name',p.name,'emoji',p.emoji,'color',p.color,
  'avatar_type',p.avatar_type,'avatar_url',p.avatar_url,'avatar_frame',p.avatar_frame)`;
const unavailable=()=>new AppError(404,'FRIEND_TOWN_NOT_FOUND','This town is not available.');

/** One public entity projection, shared by Town and Lake visits. */
export const publicTownEntity=(e:Entity):Entity=>({
    id:e.id,blueprintId:e.blueprintId,x:e.x,y:e.y,paidCost:{},...(e.direction?{direction:e.direction}:{}),
    ...(e.animal?{animal:e.animal}:{}),...(e.pets?{pets:[...e.pets]}:{}),
    ...(e.civ?{civ:{phase:e.civ.phase,elapsedMs:e.civ.elapsedMs,routeKey:e.civ.routeKey,helpStep:0,helpAfterMs:0}}:{}),
    ...(e.garden?{garden:{...(e.garden.poop?{poop:{slot:e.garden.poop.slot,at:0}}:{}),crop:e.garden.crop,generation:0,slots:e.garden.slots.map(s=>({crop:s.crop,growth:s.growth,generation:0,...(s.withered?{withered:true}:{})})),boost:0,biteCooldown:0,lastBiteSlot:null}}:{}),
});
/** Expire seasonal scenery before redacting its occurrence; never mutate saved state. */
export const publicTownEntities=(entities:readonly Entity[],homeDate?:string):Entity[]=>
  entities.filter(e=>!eventBuildingExpired(e,homeDate??'')).map(publicTownEntity);
export function visitScene(state:TownState|null,homeDate?:string):FriendTownScene {
  // Public scenery only; never expose ownership recipes, private clocks or contact history.
  return {...habitScenery(state),civActiveMs:state?.civ?.activeMs??0,rafts:(state?.rafts??[]).map(r=>({...r,paidCost:{}})),entities:publicTownEntities(state?.entities??[],homeDate)};
}

function summary(row:FriendRow,viewerId:string):FriendTown {
  const profile={...row.profile};
  // Uploaded avatars remain on the existing authenticated media reader, with
  // viewer-specific friendship checks rather than family-wide access.
  if(profile.avatar_type==='custom'&&profile.avatar_url?.startsWith('/media/profile-avatars/')){
    profile.avatar_url+=`?townVisitor=${encodeURIComponent(viewerId)}`;
  }else if(profile.avatar_type==='custom'){
    // Legacy external avatar URLs must not add direct provider calls to visits.
    profile.avatar_type='emoji';profile.avatar_url=null;
  }
  return {profile,townName:row.state?.townName??DEFAULT_TOWN_NAME,prosperityStage:row.state?prosperityStage(row.state):0,lakeStage:row.state?.maps?.lake?.stage??null};
}
export function createTownVisitsRepository(pool:Pool):TownVisitsRepository {
  async function find(family:string,viewer:string,target:string):Promise<FriendRow|undefined>{
    const result=await pool.query<FriendRow>(`WITH visible AS (${visible})
      SELECT ${profileJson} AS profile,t.state,p.native_city AS home_city,p.native_country_code AS home_country
      FROM visible p LEFT JOIN town_state t ON t.profile_id=p.id WHERE p.id=$3`,[family,viewer,target]);
    return result.rows[0];
  }
  return {
    async list(family,viewer,offset){
      const result=await pool.query<FriendRow>(`WITH visible AS MATERIALIZED (${visible})
        SELECT ${profileJson} AS profile,t.state FROM visible p LEFT JOIN town_state t ON t.profile_id=p.id
        ORDER BY GREATEST(t.updated_at,
          (SELECT MAX(created_at) FROM adventure_events WHERE profile_id=p.id),
          (SELECT MAX(done_at) FROM profile_progress WHERE profile_id=p.id),
          (SELECT MAX(completed_at) FROM quiz_attempts WHERE profile_id=p.id),
          (SELECT updated_at FROM road_racing_progress WHERE profile_id=p.id),
          (SELECT updated_at FROM fishing_progress WHERE profile_id=p.id),
          (SELECT updated_at FROM ufo_progress WHERE profile_id=p.id),
          (SELECT updated_at FROM math_wall_progress WHERE profile_id=p.id),
          (SELECT updated_at FROM infinidrill_progress WHERE profile_id=p.id),
          (SELECT updated_at FROM miniku_progress WHERE profile_id=p.id)
        ) DESC NULLS LAST,lower(p.name),p.id LIMIT 7 OFFSET $3`,[family,viewer,offset]);
      return {towns:result.rows.slice(0,6).map(row=>summary(row,viewer)),nextOffset:result.rows.length>6?offset+6:null};
    },
    async get(family,viewer,target,homeDate){
      const row=await find(family,viewer,target);if(!row)throw unavailable();
      return {...summary(row,viewer),...visitScene(row.state,homeDate?.(row.home_city,row.home_country)),homeCity:row.home_city,homeCountry:row.home_country};
    },
    async avatar(family,viewer,target){return (await find(family,viewer,target))?.profile.avatar_url??null;},
  };
}
