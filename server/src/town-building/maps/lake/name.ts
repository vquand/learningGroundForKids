import {TOWN_ADJECTIVES} from '../../game.ts';

export const LAKE_ADJECTIVES=TOWN_ADJECTIVES;
export type LakeAdjective=typeof LAKE_ADJECTIVES[number];
export const DEFAULT_LAKE_ADJECTIVE:LakeAdjective='Sunny';
/** The owner comes from the authenticated child profile, never from a rename command. */
export function lakeDisplayName(ownerName:string,adjective:LakeAdjective=DEFAULT_LAKE_ADJECTIVE):string {
    return `${ownerName}'s ${adjective} lake`;
}
