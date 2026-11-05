import { z } from 'zod';
import type { Context } from 'hono';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { parseJson,parsePathId } from '../input.js';
import { cookingActionSchema,burgerActionSchema } from './repository.js';
export function registerKitchenRoutes(app:App,db:AppDatabase,config:AppConfig,owned:(c:Context,db:AppDatabase,id:string)=>Promise<unknown>){
  app.all('/api/v1/profiles/:profileId/kitchen-completions',async c=>{
    if(c.req.method!=='GET')throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
    const profileId=parsePathId(c.req.param('profileId'));
    await owned(c,db,profileId);
    if(!db.kitchen)throw new AppError(503,'KITCHEN_UNAVAILABLE','Your recipe is temporarily unavailable.');
    return c.json(await db.kitchen.completions(profileId));
  });
  for(const suffix of ['','/action'])app.all(`/api/v1/profiles/:profileId/kitchen/:recipeId${suffix}`,async c=>{
    if(c.req.method!==(suffix?'POST':'GET'))throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
    const profileId=parsePathId(c.req.param('profileId')),recipeId=parsePathId(c.req.param('recipeId'));
    await owned(c,db,profileId);
    if(!db.kitchen)throw new AppError(503,'KITCHEN_UNAVAILABLE','Your recipe is temporarily unavailable.');
    if(!suffix)return c.json(await db.kitchen.get(profileId,recipeId));
    const input=await parseJson(c.req.raw,z.object({revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),action:recipeId==='burger'?burgerActionSchema:cookingActionSchema}).strict(),config.maxBodyBytes);
    return c.json(await db.kitchen.mutate(profileId,recipeId,input.revision,input.action));
  });
}
