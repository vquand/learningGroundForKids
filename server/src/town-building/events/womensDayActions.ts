import {z} from 'zod';
import {WOMENS_DAY_VISITORS} from './womensDay2026Model.js';
export const womensDayCommandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('visit')}).strict(),
 z.object({type:z.literal('dismiss-intro')}).strict(),
 z.object({type:z.literal('greet'),visitorId:z.string().min(1).max(30).refine(id=>WOMENS_DAY_VISITORS.some(v=>v.id===id))}).strict(),
]);
