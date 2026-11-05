import type {PoolClient} from 'pg';
export async function lockRiver(client:PoolClient,id:string){await client.query("SELECT pg_advisory_xact_lock(hashtextextended('town-river:'||$1,0))",[id]);}
export async function recordRiverEvent(client:PoolClient,owner:string,visitor:string,key:string,kind:'visit'|'gift'|'pickup',data:Record<string,unknown>,stamina:number,now:number){
  await lockRiver(client,owner);
  await client.query(`INSERT INTO town_river_events(event_key,owner_id,visitor_id,kind,data,stamina,created_at)
    SELECT $1,$2,$3,$4,$5::jsonb||jsonb_build_object('actor',jsonb_build_object('id',p.id,'name',p.name,'emoji',p.emoji,'color',p.color)),$6,$7 FROM profiles p WHERE p.id=$3
    ON CONFLICT(event_key) DO NOTHING`,[key,owner,visitor,kind,JSON.stringify(data),stamina,new Date(now)]);
}
