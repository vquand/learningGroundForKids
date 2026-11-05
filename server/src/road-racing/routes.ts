import type { Context } from 'hono';
import { z } from 'zod';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
import { RACING_DIFFICULTIES } from './game.js';
import { ANIMALS } from './questions.js';
const revision=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),raceId=z.string().uuid();
export const roadSettingsSchema=z.object({animal:z.enum(ANIMALS),language:z.enum(['en','vi']),difficulty:z.enum(RACING_DIFFICULTIES)}).strict();
export const roadActionSchema=z.discriminatedUnion('type',[
  z.object({type:z.enum(['tick','leave'])}).strict(),
  z.object({type:z.literal('answer'),questionId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),choice:z.number().int().min(0).max(2)}).strict(),
]);
export function registerRoadRacingRoutes(app:App,db:AppDatabase,maxBodyBytes:number,owned:(c:Context,db:AppDatabase,id:string)=>Promise<unknown>) {
  for(const suffix of ['', '/start','/action','/leave'])app.all(`/api/v1/profiles/:profileId/road-racing${suffix}`,async c=>{
    const id=parsePathId(c.req.param('profileId'));await owned(c,db,id);
    if(c.req.method!==(suffix?'POST':'GET'))throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
    if(!db.roadRacing)throw new AppError(503,'ROAD_RACING_UNAVAILABLE','Road Racing is not available.');
    if(!suffix)return c.json(await db.roadRacing.get(id));
    if(suffix==='/start'){
      const input=await parseJson(c.req.raw,z.object({revision,settings:roadSettingsSchema}).strict(),maxBodyBytes);
      return c.json(await db.roadRacing.mutate(id,input));
    }
    if(suffix==='/leave'){
      const input=await parseJson(c.req.raw,z.object({raceId}).strict(),maxBodyBytes);
      return c.json(await db.roadRacing.mutate(id,{...input,leave:true}));
    }
    const input=await parseJson(c.req.raw,z.object({revision,raceId,action:roadActionSchema}).strict(),maxBodyBytes);
    return c.json(await db.roadRacing.mutate(id,input));
  });
}
