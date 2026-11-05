import { coreRequest } from './core';
import type { Blueprint, TownCommand, TownState, Cost } from '../../../server/src/town-building/game';
import type { Environment } from '../../../server/src/town-building/environment';
import type { DrinkCommand, DrinkSession } from '../../../server/src/town-building/drinks';
import type { HarvestAllCommand, HarvestReceipt, HarvestReady } from '../../../server/src/town-building/harvestTypes';
import type { ShopQuote, ShopQuoteInput, ShopReceipt, ShopTradeCommand } from '../../../server/src/town-building/shopTypes';
import type { MapId } from '../../../server/src/town-building/maps/types';
export type TownResponse = TownState & {
    lakeOwnerName?:string;
    prosperityStage?: 0|1|2|3;
    blueprints: Blueprint[];
    badges: {
        id: string;
        name: string;
        description: string;
        difficulty: string;
    }[];
    harvestReady?: HarvestReady;
    harvestReceipt?: HarvestReceipt;
    shopReceipt?: ShopReceipt;
};
const base = (id: string) => `/api/v1/profiles/${encodeURIComponent(id)}/town`;
export const fetchTown = (id: string) => coreRequest<TownResponse>(base(id));
export const actTown = (id: string, revision: number, command: TownCommand|HarvestAllCommand|ShopTradeCommand) => coreRequest<TownResponse>(`${base(id)}/action`, { method: 'POST', body: JSON.stringify({ revision, command }) });
const shopQuery = (input: ShopQuoteInput) => `?entityId=${encodeURIComponent(input.entityId)}&crop=${encodeURIComponent(input.crop)}&quantity=${input.quantity}`;
export const fetchTownShopQuote = (id: string, input: ShopQuoteInput) => coreRequest<ShopQuote>(`${base(id)}/shop/quote${shopQuery(input)}`);
export const fetchTownEnvironment = (id: string) => coreRequest<Environment>(`${base(id)}/environment`);
export const previewTownEnvironment = (id: string, value: Pick<Environment, 'season' | 'precipitation' | 'snowCover'> | {
    reset: true;
}) => coreRequest<Environment>(`${base(id)}/environment/preview`, { method: 'POST', body: JSON.stringify(value) });
export const fetchDrink = (id: string) => coreRequest<DrinkSession>(`/api/v1/profiles/${encodeURIComponent(id)}/drinks`);
export const actDrink = (id: string, revision: number, command: DrinkCommand) => coreRequest<DrinkSession & {
    townReward: Cost;
}>(`/api/v1/profiles/${encodeURIComponent(id)}/drinks/action`, { method: 'POST', body: JSON.stringify({ revision, command }) });

export const fetchTownName = (id:string) => coreRequest<{ townName: import('../../../server/src/town-building/game').TownName }>(`${base(id)}/name`);

export const tickTownGarden=(id:string,resume:boolean)=>coreRequest<TownResponse>(`${base(id)}/garden/tick`,{method:'POST',body:JSON.stringify({resume})});
export const checkpointTownGarden=(id:string)=>coreRequest<TownResponse>(`${base(id)}/garden/checkpoint`,{method:'POST',body:'{}',keepalive:true});
export const fetchLake=(id:string)=>coreRequest<TownResponse>(`${base(id)}/maps/lake`);
export const actLake=(id:string,revision:number,command:import('../../../server/src/town-building/maps/lake/repository').LakeAction|HarvestAllCommand|ShopTradeCommand)=>coreRequest<TownResponse>(`${base(id)}/maps/lake/action`,{method:'POST',body:JSON.stringify({revision,command})});
export const fetchLakeShopQuote = (id: string, input: ShopQuoteInput) => coreRequest<ShopQuote>(`${base(id)}/maps/lake/shop/quote${shopQuery(input)}`);
export const tickLake=(id:string,resume:boolean)=>coreRequest<TownResponse>(`${base(id)}/maps/lake/tick`,{method:'POST',body:JSON.stringify({resume})});
export const pauseLake=(id:string)=>coreRequest<TownResponse>(`${base(id)}/maps/lake/pause`,{method:'POST',body:'{}',keepalive:true});
export type LakeFriend=import('../../../server/src/town-building/maps/lake/visits').LakeFriend;
export type LakeVisit=import('../../../server/src/town-building/maps/lake/visits').LakeVisitSnapshot&{environment:Environment};
export const fetchLakeFriends=(id:string)=>coreRequest<LakeFriend[]>(`${base(id)}/maps/lake/friends`);
export const fetchLakeVisit=(id:string,owner:string)=>coreRequest<LakeVisit>(`${base(id)}/maps/lake/visits/${encodeURIComponent(owner)}`);

export const actWomensDay=(id:string,command:import('../../../server/src/town-building/events/womensDay2026Model').WomensDayCommand)=>coreRequest<TownResponse>(`${base(id)}/events/womens-day/action`,{method:'POST',body:JSON.stringify(command)});

export interface ShopTradeAction {type:'shop-trade';mapId:MapId;revision:number;command:ShopTradeCommand}
