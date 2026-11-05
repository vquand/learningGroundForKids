import {useSyncExternalStore} from 'react';
import {tierForDevicePxPerTile,upgradeTier,type ArtTier} from './townArtTier.ts';

/** Starts small: the canvas (letterboxed, smaller than the window) reports its real density on its first frame and upgrades if needed. */
let current:ArtTier='s';
if((import.meta as unknown as {env?:Record<string,string>}).env?.VITE_DEV_MODE==='true'&&typeof window!=='undefined')(window as unknown as {__townArtTier?:ArtTier}).__townArtTier=current;
const listeners=new Set<()=>void>();
/** The canvas reports its device pixels per tile; the tier only ever upgrades within a page session. */
export function reportArtDensity(px:number){
    const next=upgradeTier(current,tierForDevicePxPerTile(px));
    if(next!==current){current=next;if((import.meta as unknown as {env?:Record<string,string>}).env?.VITE_DEV_MODE==='true')(window as unknown as {__townArtTier?:ArtTier}).__townArtTier=next;for(const listener of listeners)listener();}
}
export const useArtTier=()=>useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>current,()=>'s' as ArtTier);
export const getArtTier=():ArtTier=>current;
