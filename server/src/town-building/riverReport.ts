import type {PoolClient} from 'pg';
import type {RiverReport,RiverDay,RiverVisitSummary} from './raftCatalog.js';
import {riverDayStart} from './raftCatalog.js';
type Reader=Pick<PoolClient,'query'>;
export const emptyRiverReport=():RiverReport=>({visitors:[],stamina:0,items:0});
export async function riverReport(db:Reader,id:string,after:number,through:number):Promise<RiverReport>{
 const result=await db.query<{summary:RiverVisitSummary}>(`WITH events AS MATERIALIZED (
   SELECT * FROM town_river_events WHERE owner_id=$1 AND sequence>$2 AND sequence<=$3
 ), actors AS (SELECT DISTINCT ON(visitor_id) visitor_id,data->'actor' AS actor FROM events ORDER BY visitor_id,sequence DESC), items AS (
   SELECT visitor_id,data->>'kind' AS kind,data->>'itemId' AS item_id,COUNT(*)::int AS count FROM events WHERE kind='pickup' GROUP BY visitor_id,data->>'kind',data->>'itemId'
 ) SELECT jsonb_build_object('visitor',a.actor,'visits',(SELECT COUNT(*)::int FROM events e WHERE e.visitor_id=a.visitor_id AND kind='visit'),
   'gifts',(SELECT COUNT(*)::int FROM events e WHERE e.visitor_id=a.visitor_id AND kind='gift'),
   'giftDecorations',COALESCE((SELECT jsonb_agg(data->>'decoration') FROM events e WHERE e.visitor_id=a.visitor_id AND kind='gift'),'[]'::jsonb),
   'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',kind,'itemId',item_id,'count',count)) FROM items i WHERE i.visitor_id=a.visitor_id),'[]'::jsonb),
   'stamina',COALESCE((SELECT SUM(stamina)::int FROM events e WHERE e.visitor_id=a.visitor_id),0)) AS summary
 FROM actors a ORDER BY (SELECT MAX(sequence) FROM events e WHERE e.visitor_id=a.visitor_id) DESC`,[id,after,through]);
 const visitors=result.rows.map(r=>r.summary);
 return {visitors,stamina:visitors.reduce((n,v)=>n+v.stamina,0),items:visitors.reduce((n,v)=>n+v.items.reduce((s,i)=>s+i.count,0),0)};
}
export async function riverDays(db:Reader,id:string,now:number):Promise<RiverDay[]>{
 const start=riverDayStart(now)-6*86400000;
 const result=await db.query<RiverDay>(`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,
   COALESCE(SUM(stamina),0)::int AS stamina,COUNT(*) FILTER(WHERE kind='pickup')::int AS items,
   COUNT(*) FILTER(WHERE kind='visit')::int AS visits,COUNT(*) FILTER(WHERE kind='gift')::int AS gifts
   FROM town_river_events WHERE owner_id=$1 AND created_at>=$2 GROUP BY 1`,[id,new Date(start)]);
 return Array.from({length:7},(_,i)=>{const day=new Date(start+i*86400000).toISOString().slice(0,10);return result.rows.find(r=>r.day===day)??{day,stamina:0,items:0,visits:0,gifts:0};});
}
