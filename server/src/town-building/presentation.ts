import {BLUEPRINTS,TOWN_BADGES,type TownState} from './game.ts';
import {prosperityStage} from './civ.ts';
import {mapHarvestReady} from './harvestReadiness.ts';
import type {MapId} from './maps/types.ts';

/** Saved Town fields for any reader. Private retry ledgers (`harvestReceipts`, `shopReceipts`) never leaves the server. */
export function townStatePayload(state:TownState) {
    const {harvestReceipts:_,shopReceipts:_shop,...publicState}=state;
    return {...publicState,prosperityStage:prosperityStage(state),blueprints:BLUEPRINTS,badges:TOWN_BADGES};
}
/** The owner's own Town or Lake read: saved fields plus the server-derived harvest flags of that map.
 * Visits and other readers use `townStatePayload`, so readiness is never sent about another child. */
export function townPayload(state:TownState,mapId:MapId='town') {
    return {...townStatePayload(state),harvestReady:mapHarvestReady(state,mapId)};
}
