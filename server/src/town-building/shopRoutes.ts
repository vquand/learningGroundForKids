import type {Context} from 'hono';
import type {App} from '../contracts/app.ts';
import type {AppDatabase} from '../contracts/db.ts';
import {AppError} from '../errors.ts';
import {parsePathId} from '../input.ts';
import type {createEnvironmentService} from './environment.ts';
import {shopQuoteSchema} from './shopSchema.ts';
/** Both quote routes share the owner guard; visits have no trade or quote capability. */
export function registerShopQuoteRoutes(app:App,db:AppDatabase,owned:(c:Context,db:AppDatabase,id:string)=>Promise<unknown>,environment:ReturnType<typeof createEnvironmentService>):void {
    for(const mapId of ['town','lake'] as const){
        const base=mapId==='town'?'/town':'/town/maps/lake';
        app.all(`/api/v1/profiles/:profileId${base}/shop/quote`,async c=>{
            const id=parsePathId(c.req.param('profileId'));
            const profile=await owned(c,db,id) as {native_city?:string;native_country_code?:string};
            if(c.req.method!=='GET')throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
            const parsed=shopQuoteSchema.safeParse(c.req.query());
            if(!parsed.success)throw new AppError(422,'INVALID_QUERY','Choose a crop and a quantity from 1 to 10.');
            if(!db.town?.shopQuote)throw new AppError(503,'TOWN_UNAVAILABLE','Trading is unavailable.');
            return c.json(await db.town.shopQuote(id,mapId,parsed.data,environment.peek(id,profile.native_city,profile.native_country_code)));
        });
    }
}
