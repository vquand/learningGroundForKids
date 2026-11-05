import {publicTownEntities} from '../../visits.ts';
import {habitScenery} from '../../animalHabits.ts';
import type {Pool,PoolClient} from 'pg';
import {AppError} from '../../../errors.ts';
import {farmProjection} from '../../barn.ts';
import {townStatePayload} from '../../presentation.ts';
import type {TownState} from '../../game.ts';
import type {LakeState} from './types.ts';
import {DEFAULT_LAKE_ADJECTIVE} from './name.ts';
export interface LakeFriend{id:string;name:string;emoji:string;color:string}
interface Owner extends LakeFriend{native_city?:string;native_country_code?:string}
export interface LakeVisitSnapshot{owner:LakeFriend;state:ReturnType<typeof townStatePayload>&{lakeOwnerName:string}}
const friendship=`f.status='accepted' AND (
 (f.requesting_family_id=v.family_id AND (f.requesting_scope='family' OR f.requesting_profile_id=v.id)
  AND f.target_family_id=p.family_id AND (f.target_scope='family' OR f.target_profile_id=p.id)) OR
 (f.target_family_id=v.family_id AND (f.target_scope='family' OR f.target_profile_id=v.id)
  AND f.requesting_family_id=p.family_id AND (f.requesting_scope='family' OR f.requesting_profile_id=p.id)))`;

/** Public scenery only; private balances, catch history, reserves, awards and
 * learning progress always belong to the visiting child. */
function snapshot(owner:LakeFriend,host:TownState,viewer:TownState,homeDate?:string):LakeVisitSnapshot{
 const source=host.maps?.lake;if(!source)throw new AppError(404,'LAKE_NOT_FOUND','This lake is not open yet.');
 const lake:LakeState={adjective:source.adjective??DEFAULT_LAKE_ADJECTIVE,unlockedAt:source.unlockedAt,stage:source.stage,
  rafts:source.rafts.map(r=>({...r,paidCost:{}})),land:{...habitScenery(source.land),entities:publicTownEntities(source.land.entities,homeDate),...(source.land.civ?{civ:source.land.civ}:{}),
   ...(source.land.gardening?{gardening:{activeSeconds:source.land.gardening.activeSeconds,season:source.land.gardening.season,harvests:0,animals:[],lastTick:0}}:{})},
  harvested:0,collections:0,plantsHarvested:0,boostedSeconds:0,reserve:{},catches:{},settled:[],built:[],earned:{}};
 return{owner:{id:owner.id,name:owner.name,emoji:owner.emoji,color:owner.color},state:{...townStatePayload(viewer),maps:{lake},lakeOwnerName:owner.name}};
}
export function createLakeVisitService(pool:Pool,now=Date.now){
 async function authorize(db:Pool|PoolClient,familyId:string,viewerId:string,ownerId:string):Promise<Owner>{
  const result=await db.query<Owner>(`SELECT p.id,p.name,p.emoji,p.color,p.native_city,p.native_country_code FROM profiles v
   JOIN profiles p ON p.id=$3 AND p.family_id<>v.family_id
   JOIN friend_requests f ON ${friendship}
   WHERE v.id=$2 AND v.family_id=$1`,[familyId,viewerId,ownerId]);
  if(!result.rows[0])throw new AppError(404,'LAKE_FRIEND_NOT_FOUND','This friend’s lake is not available.');
  return result.rows[0];
 }
 return{
  async lakeFriends(familyId:string,viewerId:string):Promise<LakeFriend[]>{
   const result=await pool.query<LakeFriend>(`SELECT DISTINCT p.id,p.name,p.emoji,p.color FROM profiles v
    JOIN profiles p ON p.family_id<>v.family_id JOIN friend_requests f ON ${friendship}
    JOIN town_state t ON t.profile_id=p.id AND t.state->'maps'->'lake' IS NOT NULL
    WHERE v.id=$2 AND v.family_id=$1 ORDER BY p.name,p.id LIMIT 100`,[familyId,viewerId]);return result.rows;
  },
  async readLakeVisit(familyId:string,viewerId:string,ownerId:string,homeDate?:(city?:string,country?:string)=>string|undefined){
   const owner=await authorize(pool,familyId,viewerId,ownerId),rows=await pool.query<{profile_id:string;state:TownState}>('SELECT profile_id,state FROM town_state WHERE profile_id=ANY($1::text[])',[[viewerId,ownerId]]);
   const host=rows.rows.find(r=>r.profile_id===ownerId)?.state,viewer=rows.rows.find(r=>r.profile_id===viewerId)?.state;
   if(!host?.maps?.lake||!viewer)throw new AppError(404,'LAKE_NOT_FOUND','This lake is not open yet.');
   return{...snapshot(owner,farmProjection(host,now()),farmProjection(viewer,now()),homeDate?.(owner.native_city,owner.native_country_code)),location:{city:owner.native_city,country:owner.native_country_code}};
  },
 };
}
