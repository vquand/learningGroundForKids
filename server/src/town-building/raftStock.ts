import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {FISH,type FishId} from '../fishing/catalog.js';
import {RAFT_CAPACITY,riverDayStart,type RaftItemKind} from './raftCatalog.js';
import {GROW_SECONDS} from './garden.js';
import type {TownState} from './game.js';
export async function lockRaft(client:PoolClient,id:string){
 await client.query('INSERT INTO town_raft_progress(profile_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
 await client.query('SELECT profile_id FROM town_raft_progress WHERE profile_id=$1 FOR UPDATE',[id]);
}
type RaftStock={key:string;kind:RaftItemKind;itemId:string;stamina:number};
export async function stockRaftItem(client:PoolClient,id:string,key:string,kind:RaftItemKind,itemId:string,stamina:number,now:number){
 await stockRaftItems(client,id,[{key,kind,itemId,stamina}],now);
}
/** One lock, one expiry sweep and one insert for a whole batch. New sources fill the
 * remaining capacity in order; sources already stocked never use a slot. */
async function stockRaftItems(client:PoolClient,id:string,items:readonly RaftStock[],now:number){
 if(!items.length)return;
 await lockRaft(client,id);
 await client.query('DELETE FROM town_raft_items WHERE provider_id=$1 AND produced_at<$2',[id,new Date(riverDayStart(now)-86400000)]);
 await client.query(`INSERT INTO town_raft_items(id,provider_id,source_key,kind,item_id,stamina,produced_at)
 SELECT stock.id,$1,stock.source_key,stock.kind,stock.item_id,stock.stamina,$2
 FROM unnest($3::text[],$4::text[],$5::text[],$6::text[],$7::int[]) WITH ORDINALITY AS stock(id,source_key,kind,item_id,stamina,position)
 WHERE NOT EXISTS (SELECT 1 FROM town_raft_items existing WHERE existing.provider_id=$1 AND existing.source_key=stock.source_key)
 ORDER BY stock.position
 LIMIT GREATEST(0,$8-(SELECT COUNT(*) FROM town_raft_items WHERE provider_id=$1 AND picked_at IS NULL))
 ON CONFLICT(provider_id,source_key) DO NOTHING`,[id,new Date(now),items.map(()=>randomUUID()),items.map(i=>i.key),items.map(i=>i.kind),items.map(i=>i.itemId),items.map(i=>i.stamina),RAFT_CAPACITY]);
}
/** Only call after the unique new cast provenance insert in its transaction.
 * Never reconstruct this counter from historical inventory or cast ledgers. */
export async function stockRaftCatch(client:PoolClient,id:string,castId:string,fish:FishId|null,now:number){
 if(!fish||fish==='T1')return;
 await lockRaft(client,id);
 await client.query('UPDATE town_raft_progress SET fish_caught=LEAST(50,fish_caught+1) WHERE profile_id=$1',[id]);
 await stockRaftItem(client,id,`fish:${castId}`,'fish',fish,FISH[fish].stamina,now);
}
/** Manual, committed harvests only; cosmetic/automatic helpers never qualify. */
export async function stockRaftHarvest(client:PoolClient,id:string,before:TownState,after:TownState,now:number){
 // Every map's crops share the friend takeaway raft; manual harvests count on any map.
 const eggs=(s:TownState)=>s.poultry?.harvested??0,stock:RaftStock[]=[];
 for(let n=eggs(before)+1;n<=eggs(after);n++)stock.push({key:`egg:${n}`,kind:'egg',itemId:'egg',stamina:1});
 const harvests=(s:TownState)=>(s.gardening?.harvests??0)+(s.maps?.lake?.land.gardening?.harvests??0);
 if(harvests(after)>harvests(before)){
  const land=(s:TownState)=>[...s.entities,...(s.maps?.lake?.land.entities??[])],afterLand=land(after);
  for(const e of land(before)){const next=afterLand.find(n=>n.id===e.id);
   if(!e.garden||!next?.garden)continue;
   for(const [index,slot]of e.garden.slots.entries())if(slot.crop&&!slot.withered&&slot.growth>=GROW_SECONDS&&next.garden.slots[index]!.generation>slot.generation)
    stock.push({key:`vegetable:${e.id}:${e.garden.generation}:${index}`,kind:'vegetable',itemId:slot.crop,stamina:2});
  }
 }
 await stockRaftItems(client,id,stock,now);
}
