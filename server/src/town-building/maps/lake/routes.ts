import {z} from 'zod';
import type {Context} from 'hono';
import type {App} from '../../../contracts/app.ts';
import type {AppDatabase} from '../../../contracts/db.ts';
import type {AppConfig} from '../../../config.ts';
import {AppError} from '../../../errors.ts';
import {parseJson,parsePathId} from '../../../input.ts';
import type {TownState,TownCommand} from '../../game.ts';
import {visitorEnvironment,type createEnvironmentService} from '../../environment.ts';
import {townPayload} from '../../presentation.ts';
import {townCommandNeedsWeather} from '../../environmentCommands.ts';
import {previewAllowed} from '../../routes.ts';
import {lakeActionSchema} from './commands.ts';

export function registerLakeRoutes(app:App,db:AppDatabase,config:AppConfig,owned:(c:Context,db:AppDatabase,id:string)=>Promise<unknown>,environment:ReturnType<typeof createEnvironmentService>,townSchema:z.ZodType<TownCommand>) {
    app.get('/api/v1/profiles/:profileId/town/maps/lake/friends',async c=>{
        const viewer=parsePathId(c.req.param('profileId'));await owned(c,db,viewer);
        if(!db.town?.lakeFriends)throw new AppError(503,'LAKE_UNAVAILABLE','Lake visits are not available yet.');
        return c.json(await db.town.lakeFriends(c.get('family').id,viewer));
    });
    app.get('/api/v1/profiles/:profileId/town/maps/lake/visits/:ownerId',async c=>{
        const viewer=parsePathId(c.req.param('profileId')),owner=parsePathId(c.req.param('ownerId'));await owned(c,db,viewer);
        if(!db.town?.readLakeVisit)throw new AppError(503,'LAKE_UNAVAILABLE','Lake visits are not available yet.');
        const {location,...visit}=await db.town.readLakeVisit(c.get('family').id,viewer,owner,(city,country)=>environment.peek(owner,city,country).localDate);
        const live=environment.peek(owner,location.city,location.country);
        return c.json({...visit,environment:visitorEnvironment(live)});
    });
    for(const suffix of ['','/action','/tick','/pause'])app.all(`/api/v1/profiles/:profileId/town/maps/lake${suffix}`,async c=>{
        const id=parsePathId(c.req.param('profileId'));
        const profile=await owned(c,db,id) as {name:string;native_city?:string;native_country_code?:string};
        const payload=(state:TownState)=>({...townPayload(state,'lake'),lakeOwnerName:profile.name});
        if(c.req.method!==(suffix?'POST':'GET'))throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
        const town=db.town;
        if(!town?.getLake||!town.mutateLake||!town.tickLake||!town.pauseLake)throw new AppError(503,'LAKE_UNAVAILABLE','The lake is not available yet.');
        if(!suffix){const live=environment.peek(id,profile.native_city,profile.native_country_code);return c.json(payload(await town.getLake(id,live)));}
        if(suffix==='/pause') {
            await parseJson(c.req.raw,z.object({}).strict(),config.maxBodyBytes);
            const live=environment.peek(id,profile.native_city,profile.native_country_code);
            return c.json(payload(await town.pauseLake(id,live)));
        }
        if(suffix==='/tick') {
            const input=await parseJson(c.req.raw,z.object({resume:z.boolean()}).strict(),config.maxBodyBytes);
            const live=await environment.get(id,profile.native_city,profile.native_country_code,'',false);
            return c.json(payload(await town.tickLake(id,live,input.resume)));
        }
        const input=await parseJson(c.req.raw,z.object({revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),command:lakeActionSchema(townSchema)}).strict(),config.maxBodyBytes);
        if(input.command.type==='shop-trade'){
            if(!town.shopTrade)throw new AppError(503,'LAKE_UNAVAILABLE','Trading is unavailable.');
            const outcome=await town.shopTrade(id,'lake',input.revision,input.command,environment.peek(id,profile.native_city,profile.native_country_code));
            return c.json({...payload(outcome.state),shopReceipt:outcome.receipt});
        }
        if(input.command.type==='harvest-all'){
            // Same shared batch as Town's; the Lake's verified catches are applied inside the repository.
            if(!town.harvestAll)throw new AppError(503,'LAKE_UNAVAILABLE','The lake is not available yet.');
            const outcome=await town.harvestAll(id,input.revision,input.command,environment.peek(id,profile.native_city,profile.native_country_code));
            return c.json({...payload(outcome.state),harvestReceipt:outcome.receipt});
        }
        const needsWeather=input.command.type==='plant'||(input.command.type==='land-action'&&townCommandNeedsWeather(input.command.command));
        const canPreview=previewAllowed(config,c.get('family').role);
        const live=needsWeather ? await environment.get(id,profile.native_city,profile.native_country_code,'',false) : environment.peek(id,profile.native_city,profile.native_country_code);
        return c.json(payload(await town.mutateLake(id,input.revision,input.command,{...live,allowPreview:canPreview})));
    });
}
