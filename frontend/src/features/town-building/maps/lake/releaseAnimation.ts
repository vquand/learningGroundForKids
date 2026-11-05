import type {LakeRaft} from '../../../../../../server/src/town-building/maps/lake/types.ts';
import {mapDefinition} from '../../../../../../server/src/town-building/maps/registry.ts';
import {terrainKind} from '../../../../../../server/src/town-building/areaOfEffect.ts';
import type {MapId} from '../../../../../../server/src/town-building/maps/types.ts';
export interface LakeRelease{receipt:string;raft:LakeRaft;mapId?:MapId}
export const RELEASE_SECONDS=2.8;
/** A committed action starts one cosmetic release. Reads/repeated snapshots
 * cannot replay it; no inventory, rewards or persistent wildlife are created. */
export class LakeReleaseClock{
 private lastReceipt='';private active:{event:LakeRelease;age:number}[]=[];
 step(event:LakeRelease|undefined,seconds:number){
  if(event&&event.receipt!==this.lastReceipt){this.lastReceipt=event.receipt;this.active.push({event,age:0});this.active=this.active.slice(-4);}
  for(const item of this.active)item.age+=Math.max(0,Math.min(.1,seconds));
  this.active=this.active.filter(item=>item.age<RELEASE_SECONDS);return this.active;
 }
}
export function releasePose(raft:LakeRaft,index:number,count:number,age:number,reduced=false,mapId:MapId='lake'){
 const map=mapDefinition(mapId),isWater=(x:number,y:number)=>x>=0&&y>=0&&x<map.rows&&y<map.columns&&terrainKind(map.terrainAt(x,y))==='water';
 const p=Math.max(0,Math.min(1,age/RELEASE_SECONDS)),x=raft.x+1,y=raft.y+1.5,angle=(index+.5)*Math.PI*2/Math.max(1,count);
 let distance=reduced?0:2.5*p;
 while(distance>.01){const tx=x+Math.sin(angle)*distance,ty=y+Math.cos(angle)*distance;let water=true;for(let i=0;i<=10;i++){const f=i/10;if(!isWater(Math.floor(x+(tx-x)*f),Math.floor(y+(ty-y)*f))){water=false;break;}}if(water)break;distance*=.8;}
 return{x:x+Math.sin(angle)*distance,y:y+Math.cos(angle)*distance,alpha:Math.max(0,1-Math.max(0,p-.25)/.75)};
}
