import {shopTradeSchema} from './shopSchema.ts';
import {registerShopQuoteRoutes} from './shopRoutes.ts';
import {harvestAllForMap} from './harvestSchema.ts';
import {womensDayCommandSchema} from './events/womensDayActions.js';
import { CROP_IDS } from './garden.js';
import { drinkCommandSchema } from './drinks.js';
import { cabbageRollCommandSchema } from './cabbage-rolls.js';
import { z } from 'zod';
import type { Context } from 'hono';
import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import type { AppConfig } from '../config.js';
import { getSessionToken, hashSessionToken } from '../auth.js';
import { AppError } from '../errors.js';
import { parseJson, parsePathId } from '../input.js';
import { BLUEPRINTS, TOWN_BADGES, TOWN_ADJECTIVES, TOWN_NOUNS, TOWN_ANIMALS, TOWN_PETS, MAX_LINE_TILES, DIRECTIONS } from './game.js';
import { createEnvironmentService, visitorEnvironment } from './environment.js';
import { townCommandNeedsWeather } from './environmentCommands.ts';
import {registerBasketRoutes} from './basketRoutes.js';
import {registerRaftRoutes} from './raftRoutes.js';
import {townDevelopmentProject,lakeDevelopmentProject} from './development.ts';
import {townPayload} from './presentation.ts';
import {registerLakeRoutes} from './maps/lake/routes.ts';
const coordinate = z.number().int().min(0).max(39);
export const townCommandSchema = z.discriminatedUnion('type', [
    z.object({type:z.literal('harvest-eggs'),entityId:z.string().min(1).max(100),generation:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).strict(),
    z.object({type:z.literal('collect-barn'),entityId:z.string().min(1).max(100),generation:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).strict(),
    z.object({type:z.literal('feed-animals'),entityId:z.string().min(1).max(100)}).strict(),
    z.object({type:z.literal('help-neighbor'),entityId:z.string().min(1).max(100),step:z.number().int().min(0).max(2)}).strict(),
    z.object({type:z.literal('wrap-fence'),entityId:z.string().min(1).max(100)}).strict(),
    z.object({type:z.literal('plant'),entityId:z.string().min(1).max(100),generation:z.number().int().nonnegative(),crop:z.enum(CROP_IDS)}).strict(),
    z.object({type:z.literal('harvest'),entityId:z.string().min(1).max(100),generation:z.number().int().nonnegative()}).strict(),
    z.object({ type:z.literal('set-pets'), entityId:z.string().min(1).max(100), pets:z.array(z.enum(TOWN_PETS)).max(3) }).strict(),
    z.object({ type:z.literal('rename'), adjective:z.enum(TOWN_ADJECTIVES), noun:z.enum(TOWN_NOUNS) }).strict(),
    z.object({ type:z.literal('set-animal'), entityId:z.string().max(100), animal:z.enum(TOWN_ANIMALS) }).strict(),
    z.object({ type: z.literal('build'), blueprintId: z.string().max(40), x: coordinate, y: coordinate, direction: z.enum(DIRECTIONS).optional() }).strict(),
    z.object({ type: z.literal('move'), entityId: z.string().max(100), x: coordinate, y: coordinate, direction: z.enum(DIRECTIONS).optional() }).strict(),
    z.object({ type: z.literal('remove'), entityId: z.string().max(100), confirmLoss:z.boolean().optional(), lossConfirmation:z.string().max(20000).optional() }).strict(),
    z.object({ type: z.literal('remove-line'), entityId: z.string().min(1).max(100) }).strict(),
    z.object({ type: z.literal('make-gate'), entityId: z.string().min(1).max(100) }).strict(),
    z.object({ type: z.literal('build-line'), blueprintId: z.string().max(40), tiles: z.array(z.object({ x: coordinate, y: coordinate }).strict()).min(1).max(MAX_LINE_TILES) }).strict(),
]);
/** The Town action accepts harvest-all for `town` only; nested Lake land actions never can. */
export const townActionSchema = z.union([shopTradeSchema, harvestAllForMap('town'), townCommandSchema]);
export const previewSchema = z.union([z.object({ reset: z.literal(true) }).strict(), z.object({ season: z.enum(['spring', 'summer', 'autumn', 'winter']), precipitation: z.enum(['none', 'rain', 'snow']), snowCover: z.boolean() }).strict()]);
export function previewAllowed(config: AppConfig, role: string): boolean { return config.nodeEnv === 'test' && config.townEnvironmentPreviewEnabled === true && role === 'admin'; }
export function registerTownRoutes(app: App, db: AppDatabase, config: AppConfig, owned: (c: Context, db: AppDatabase, id: string) => Promise<unknown>) {
    const environment = createEnvironmentService();
    registerShopQuoteRoutes(app,db,owned,environment);
    registerBasketRoutes(app,db,config,owned);
    registerRaftRoutes(app,db,config,owned);
    app.all('/api/v1/profiles/:profileId/town/friends',async c=>{
        const id=parsePathId(c.req.param('profileId'));await owned(c,db,id);
        if(c.req.method!=='GET')throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
        if(!db.townVisits)throw new AppError(503,'TOWN_UNAVAILABLE','Friend towns are not available yet.');
        const parsed=z.object({offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().safeParse(c.req.query());
        if(!parsed.success)throw new AppError(422,'INVALID_QUERY','Invalid town page.');
        return c.json(await db.townVisits.list(c.get('family').id,id,parsed.data.offset));
    });
    app.all('/api/v1/profiles/:profileId/town/friends/:friendId',async c=>{
        const id=parsePathId(c.req.param('profileId'));await owned(c,db,id);
        if(c.req.method!=='GET')throw new AppError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
        if(!db.townVisits)throw new AppError(503,'TOWN_UNAVAILABLE','Friend towns are not available yet.');
        const target=parsePathId(c.req.param('friendId'));
        const {homeCity,homeCountry,...town}=await db.townVisits.get(c.get('family').id,id,target,(city,country)=>environment.peek(target,city??undefined,country??undefined).localDate);
        const live=environment.peek(target,homeCity??undefined,homeCountry??undefined);
        return c.json({...town,environment:visitorEnvironment(live)});
    });
    registerLakeRoutes(app,db,config,owned,environment,townCommandSchema);
    for (const suffix of ['', '/action'])
        app.all(`/api/v1/profiles/:profileId/cabbage-rolls${suffix}`, async (c) => {
            const id = parsePathId(c.req.param('profileId'));
            await owned(c, db, id);
            if (c.req.method !== (suffix ? 'POST' : 'GET'))
                throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
            if (!db.cabbageRolls)
                throw new AppError(503, 'CABBAGE_ROLLS_UNAVAILABLE', 'Cabbage-roll verification is unavailable.');
            if (!suffix)
                return c.json(await db.cabbageRolls.get(id));
            const input = await parseJson(c.req.raw, z.object({
                revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
                command: cabbageRollCommandSchema,
            }).strict(), config.maxBodyBytes);
            return c.json(await db.cabbageRolls.mutate(id, input.revision, input.command));
        });
    for (const suffix of ['', '/action'])
        app.all(`/api/v1/profiles/:profileId/drinks${suffix}`, async (c) => {
            const id = parsePathId(c.req.param('profileId'));
            await owned(c, db, id);
            if (c.req.method !== (suffix ? 'POST' : 'GET'))
                throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
            if (!db.drinks)
                throw new AppError(503, 'DRINKS_UNAVAILABLE', 'Recipe verification is unavailable.');
            if (!suffix)
                return c.json(await db.drinks.get(id));
            const input = await parseJson(c.req.raw, z.object({ revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), command: drinkCommandSchema }).strict(), config.maxBodyBytes);
            return c.json(await db.drinks.mutate(id, input.revision, input.command));
        });
    for (const suffix of ['/name', '', '/action', '/garden/tick', '/garden/checkpoint', '/events/womens-day/action', '/environment', '/environment/preview', '/development'])
        app.all(`/api/v1/profiles/:profileId/town${suffix}`, async (c) => {
            const id = parsePathId(c.req.param('profileId'));
            const profile = await owned(c, db, id) as {
                native_city?: string;
                native_country_code?: string;
            };
            if (!db.town)
                throw new AppError(503, 'TOWN_UNAVAILABLE', 'Your town is not available yet.');
            const expected = suffix === '/action' || suffix === '/garden/tick' || suffix === '/garden/checkpoint' || suffix === '/events/womens-day/action' || suffix === '/environment/preview' ? 'POST' : 'GET';
            if (c.req.method !== expected)
                throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
            if(suffix==='/events/womens-day/action'){
                const command=await parseJson(c.req.raw,womensDayCommandSchema,config.maxBodyBytes);
                if(!db.town.celebrate)throw new AppError(503,'TOWN_EVENT_UNAVAILABLE','This celebration is not available.');
                const live=environment.peek(id,profile.native_city,profile.native_country_code);
                return c.json(townPayload(await db.town.celebrate(id,command,live)));
            }
            if (suffix === '/name') return c.json({ townName:await db.town.getName(id) });
            if (suffix === '/development') {
                const live=environment.peek(id,profile.native_city,profile.native_country_code);
                const state=await db.town.get(id,live);
                return c.json({town:townDevelopmentProject(state),...(state.maps?.lake?{lake:lakeDevelopmentProject(state)}:{})});
            }
            if (!suffix) {
                const live=environment.peek(id,profile.native_city,profile.native_country_code);
                return c.json(townPayload(await db.town.get(id,live)));
            }
            if(suffix==='/garden/checkpoint') {
                await parseJson(c.req.raw,z.object({}).strict(),config.maxBodyBytes);
                if(!db.town.checkpoint)throw new AppError(503,'GARDEN_UNAVAILABLE','Gardening is unavailable.');
                const live=environment.peek(id,profile.native_city,profile.native_country_code);
                return c.json(townPayload(await db.town.checkpoint(id,live)));
            }
            if(suffix==='/garden/tick') {
                const input=await parseJson(c.req.raw,z.object({resume:z.boolean()}).strict(),config.maxBodyBytes);
                if(!db.town.tick)throw new AppError(503,'GARDEN_UNAVAILABLE','Gardening is unavailable.');
                const live=await environment.get(id,profile.native_city,profile.native_country_code,'',false);
                return c.json(townPayload(await db.town.tick(id,'town',live,input.resume)));
            }
            if (suffix === '/action') {
                const input = await parseJson(c.req.raw, z.object({ revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), command: townActionSchema }).strict(), config.maxBodyBytes);
                if(input.command.type==='shop-trade'){
                    if(!db.town.shopTrade)throw new AppError(503,'TOWN_UNAVAILABLE','Trading is unavailable.');
                    const outcome=await db.town.shopTrade(id,'town',input.revision,input.command,environment.peek(id,profile.native_city,profile.native_country_code));
                    return c.json({...townPayload(outcome.state),shopReceipt:outcome.receipt});
                }
                if (input.command.type === 'harvest-all') {
                    // Only the owner reaches this (ownership checked above); the clock is the trusted home clock.
                    if (!db.town.harvestAll) throw new AppError(503, 'TOWN_UNAVAILABLE', 'Harvesting is not available yet.');
                    const outcome = await db.town.harvestAll(id, input.revision, input.command, environment.peek(id, profile.native_city, profile.native_country_code));
                    return c.json({ ...townPayload(outcome.state, 'town'), harvestReceipt: outcome.receipt });
                }
                const canPreview = previewAllowed(config, c.get('family').role);
                const live=townCommandNeedsWeather(input.command) ? await environment.get(id,profile.native_city,profile.native_country_code,'',false) : environment.peek(id,profile.native_city,profile.native_country_code);
                return c.json(townPayload(await db.town.mutate(id, input.revision, input.command,live.timeOfDay?live.season:null,{...live,allowPreview:canPreview})));
            }
            const canPreview = previewAllowed(config, c.get('family').role);
            const key = `${hashSessionToken(getSessionToken(c, config)!)}:${id}`;
            if (suffix === '/environment/preview') {
                if (!canPreview)
                    throw new AppError(403, 'TOWN_PREVIEW_DISABLED', 'Environment previews are only available to admins on an enabled test server.');
                const input = await parseJson(c.req.raw, previewSchema, config.maxBodyBytes);
                environment.preview(key, 'reset' in input ? null : input);
            }
            return c.json(await environment.get(id, profile.native_city, profile.native_country_code, key, canPreview));
        });
}
