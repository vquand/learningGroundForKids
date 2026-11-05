import {useEffect,useMemo,useRef,useState} from 'react';
import type {Entity} from '../../../../server/src/town-building/game';
import {OPTIONAL_TOWN_FILES,townArtKey,townImageFiles,townImageUrl} from './townImageFiles';
import {installScaledDrawImage,registerArtScale} from './townArtScale';
import {useArtTier} from './townArtStore';
import type {ArtTier} from './townArtTier';

installScaledDrawImage();
export function loadImage(file:string,tier:ArtTier='l'):Promise<HTMLImageElement> {
    return new Promise((resolve,reject)=>{
        const image=new Image();
        image.onload=()=>{void image.decode().then(()=>{registerArtScale(image,townArtKey(file));resolve(image);},reject);};
        image.onerror=()=>reject(new Error('Town artwork could not load.'));
        image.src=townImageUrl(file,tier);
    });
}
/** Cache belongs to this mounted profile session, not a cross-family singleton. */
export function useTownArtwork(entities:readonly Entity[],guests:number,enabled:boolean) {
    const fileKey=JSON.stringify(enabled?townImageFiles(entities,guests):[]);
    const files=useMemo<string[]>(()=>JSON.parse(fileKey),[fileKey]);
    const tier=useArtTier();
    const pending=useRef(new Map<string,Promise<HTMLImageElement>>());
    const [images,setImages]=useState(new Map<string,HTMLImageElement>());
    const [error,setError]=useState(false),[attempt,setAttempt]=useState(0);
    useEffect(()=>{
        if(!files.length)return;
        let alive=true;setError(false);
        const loads=files.map(async file=>{
            const slot=`${file}@${tier}`;let image=pending.current.get(slot);
            if(!image){image=loadImage(file,tier);pending.current.set(slot,image);void image.catch(()=>{if(pending.current.get(slot)===image)pending.current.delete(slot);});}
            try{return [file,await image] as const;}catch(error){if(OPTIONAL_TOWN_FILES.has(file))return null;throw error;}
        });
        void Promise.all(loads).then(entries=>{if(alive)setImages(previous=>new Map([...previous,...entries.filter(entry=>entry!==null)]));},()=>{if(alive)setError(true);});
        return()=>{alive=false;};
    },[files,attempt,tier]);
    return {images,error,ready:enabled&&files.length>0&&files.every(file=>images.has(file)||OPTIONAL_TOWN_FILES.has(file)),retry:()=>setAttempt(value=>value+1)};
}
