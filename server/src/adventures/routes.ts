import { z } from 'zod';
import type { Context } from 'hono';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parsePathId } from '../input.js';
import type { AdventureCursor } from './types.js';
const timeZoneSchema=z.string().min(1).max(100).refine(value=>{
  if(!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value))return false;
  try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}
},'Choose a valid timezone.').default('UTC');
const querySchema=z.object({scope:z.enum(['mine','friends']).default('mine'),limit:z.coerce.number().int().min(1).max(50).default(20),cursor:z.string().min(1).max(1024).optional(),lang:z.enum(['en','vi']).default('en'),tz:timeZoneSchema}).strict();
const cursorSchema=z.object({at:z.string().datetime({offset:true}),id:z.string().min(1).max(300)}).strict();
export function registerAdventureRoutes(app:App,db:AppDatabase,owned:(c:Context,db:AppDatabase,id:string)=>Promise<unknown>) {
  app.get('/api/v1/profiles/:profileId/adventures',async c=>{
    const profileId=parsePathId(c.req.param('profileId'));
    await owned(c,db,profileId);
    const parsed=querySchema.safeParse(c.req.query());
    if(!parsed.success)throw new AppError(422,'INVALID_ADVENTURE_QUERY','Choose a valid adventure page.');
    const {scope,limit,lang,tz}=parsed.data;
    let cursor:AdventureCursor|null=null;
    if(parsed.data.cursor) {
      try{cursor=cursorSchema.parse(JSON.parse(Buffer.from(parsed.data.cursor,'base64url').toString('utf8')));}
      catch{throw new AppError(422,'INVALID_ADVENTURE_CURSOR','Choose a valid adventure page.');}
    }
    if(!db.adventures)throw new AppError(503,'ADVENTURES_UNAVAILABLE','Your adventures are temporarily unavailable.');
    return c.json(await db.adventures.list(c.get('family').id,profileId,scope,limit,cursor,lang,tz));
  });
}
