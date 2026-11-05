import tiers from './townArtTiers.json' with {type:'json'};
import {WORLD_COLUMNS,WORLD_ROWS} from './forestWorld.ts';

export type ArtTier='s'|'m'|'l';
export const ART_TIERS:readonly ArtTier[]=['s','m','l'];
export interface ArtManifestEntry {baseWidth:number;baseHeight:number;pxPerTile:number;tiers:Partial<Record<ArtTier,number>>;aliases?:Partial<Record<ArtTier,ArtTier>>}
export type ArtManifest=Record<string,ArtManifestEntry>;

/** Device pixels covered by one map tile; the device pixel ratio is capped at 2 like the canvas itself. */
export function devicePxPerTile(width:number,height:number,zoom:number,ratio:number):number {
    if(!(width>0)||!(height>0))return 0;
    return Math.min(width/WORLD_COLUMNS,height/WORLD_ROWS)*(Number.isFinite(zoom)?zoom:1)*Math.min(Math.max(ratio||1,1),2);
}
export function tierForDevicePxPerTile(px:number):ArtTier {return px<=tiers.maxDevicePxPerTile.s?'s':px<=tiers.maxDevicePxPerTile.m?'m':'l';}
export const tierRank=(tier:ArtTier)=>ART_TIERS.indexOf(tier);
/** Upgrade-only: a resize or zoom never drops back to a smaller tier within a session. */
export const upgradeTier=(current:ArtTier,wanted:ArtTier):ArtTier=>tierRank(wanted)>tierRank(current)?wanted:current;
/** Width of a tier's variant for an asset: scaled to the tier target and never upscaled past the source. */
export function variantWidth(baseWidth:number,pxPerTile:number,tier:ArtTier):number {
    const scale=Math.min(1,tiers.targetPxPerTile[tier]/pxPerTile);
    return Math.max(1,Math.round(baseWidth*scale));
}
/** Served file name of a variant (e.g. `buildings-v2@m.webp`); tiers that equal a larger one are aliased in the manifest. */
export function variantFile(key:string,tier:ArtTier,manifest:ArtManifest):string|null {
    const entry=manifest[key];if(!entry)return null;
    const resolved=entry.aliases?.[tier]??tier;
    return `${key}@${resolved}.webp`;
}
