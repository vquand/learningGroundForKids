import {z} from 'zod';
import type {Context} from 'hono';
import type {App} from '../contracts/app.js';
import type {AppDatabase} from '../contracts/db.js';
import type {AppConfig} from '../config.js';
import {AppError} from '../errors.js';
import {parseJson,parsePathId} from '../input.js';
const requestSchema=z.object({requestId:z.string().uuid()}).strict();
export function registerRaftRoutes(app:App,db:AppDatabase,config:AppConfig,owned:(c:Context,db:AppDatabase,id:string)=>Promise<unknown>){
 const base='/api/v1/profiles/:profileId/town';
 for(const suffix of ['/raft','/river/arrive','/friends/:friendId/raft','/friends/:friendId/visit'])app.all(base+suffix,async c=>{
  const id=parsePathId(c.req.param('profileId')!);await owned(c,db,id);
  const rawTarget=c.req.param('friendId'),target=rawTarget?parsePathId(rawTarget):undefined;
  const post=suffix.endsWith('/arrive')||suffix.endsWith('/visit');
  if(post?c.req.method!=='POST':!['GET',...(target?['POST']:[])].includes(c.req.method))throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
  if(!db.townRaft)throw new AppError(503,'TOWN_RAFT_UNAVAILABLE','The river raft is not available yet.');
  const family=c.get('family').id;
  if(suffix.endsWith('/arrive')){const input=await parseJson(c.req.raw,requestSchema,config.maxBodyBytes);return c.json(await db.townRaft.arrive(family,id,input.requestId));}
  if(suffix.endsWith('/visit')){const input=await parseJson(c.req.raw,requestSchema,config.maxBodyBytes);await db.townRaft.visit(family,id,target!,input.requestId);return c.json({visited:true});}
  if(c.req.method==='GET')return c.json(await db.townRaft.get(family,id,target));
  const input=await parseJson(c.req.raw,z.union([requestSchema.extend({itemId:z.string().uuid()}).strict(),requestSchema.extend({itemIds:z.array(z.string().uuid()).min(1).max(5).refine(ids=>new Set(ids).size===ids.length)}).strict()]),config.maxBodyBytes);
  return c.json(await db.townRaft.pick(family,id,target!,input));
 });
}
