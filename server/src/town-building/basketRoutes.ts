import {z} from 'zod';
import type {Context} from 'hono';
import type {App} from '../contracts/app.js';
import type {AppDatabase} from '../contracts/db.js';
import type {AppConfig} from '../config.js';
import {AppError} from '../errors.js';
import {parseJson,parsePathId} from '../input.js';
import {basketSendSchema} from './basketModel.js';
export function registerBasketRoutes(app:App,db:AppDatabase,config:AppConfig,owned:(c:Context,db:AppDatabase,id:string)=>Promise<unknown>){
  const base='/api/v1/profiles/:profileId/town';
  app.all(`${base}/basket`,async c=>{
    const id=parsePathId(c.req.param('profileId'));await owned(c,db,id);
    if(c.req.method!=='GET')throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
    if(!db.townBaskets)throw new AppError(503,'TOWN_BASKET_UNAVAILABLE','The river basket is not available yet.');
    const page=z.object({offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().safeParse(c.req.query());
    if(!page.success)throw new AppError(422,'INVALID_QUERY','Invalid basket page.');
    return c.json(await db.townBaskets.inbox(c.get('family').id,id,page.data.offset));
  });
  app.all(`${base}/basket/:giftId/open`,async c=>{
    const id=parsePathId(c.req.param('profileId'));await owned(c,db,id);
    if(c.req.method!=='POST')throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
    if(!db.townBaskets)throw new AppError(503,'TOWN_BASKET_UNAVAILABLE','The river basket is not available yet.');
    const giftId=z.string().uuid().safeParse(c.req.param('giftId'));
    if(!giftId.success)throw new AppError(422,'INVALID_INPUT','Invalid surprise.');
    await parseJson(c.req.raw,z.object({}).strict(),config.maxBodyBytes);
    return c.json(await db.townBaskets.open(c.get('family').id,id,giftId.data));
  });
  app.all(`${base}/friends/:friendId/basket`,async c=>{
    const id=parsePathId(c.req.param('profileId'));await owned(c,db,id);
    if(!['GET','POST'].includes(c.req.method))throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
    if(!db.townBaskets)throw new AppError(503,'TOWN_BASKET_UNAVAILABLE','The river basket is not available yet.');
    const target=parsePathId(c.req.param('friendId'));
    if(c.req.method==='GET')return c.json(await db.townBaskets.visitor(c.get('family').id,id,target));
    const input=await parseJson(c.req.raw,basketSendSchema,config.maxBodyBytes);
    return c.json(await db.townBaskets.send(c.get('family').id,id,target,input));
  });
}
