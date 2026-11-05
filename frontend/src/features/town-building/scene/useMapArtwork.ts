import {useEffect,useMemo,useState} from 'react';
import type {Entity} from '../../../../../server/src/town-building/game';
import {useTownArtwork} from '../useTownArtwork';

const LAKE_FILES=['structures-v1','fish-v1','floating-garden-empty-v1','floating-garden-plants-v1'] as const;
const LAKE_KEY:Record<typeof LAKE_FILES[number],string>={'structures-v1':'lake-structures','fish-v1':'lake-fish','floating-garden-empty-v1':'lake-garden','floating-garden-plants-v1':'lake-plants'};
/** Every image a map scene can draw: the shared town set, plus water art once the lake is open. */
export function useMapArtwork(entities:readonly Entity[],prosperityStage:number,enabled:boolean,withWater:boolean){
    const town=useTownArtwork(entities,prosperityStage,enabled),[images,setImages]=useState(new Map<string,HTMLImageElement>()),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
    useEffect(()=>{
        if(!withWater)return;
        let alive=true;setError(false);
        void Promise.all(LAKE_FILES.map(file=>new Promise<[string,HTMLImageElement]>((resolve,reject)=>{const image=new Image();image.onload=()=>{void image.decode().then(()=>resolve([LAKE_KEY[file],image]),reject);};image.onerror=reject;image.src=`/minigames/town-building/lake/${file}.png`;})))
            .then(entries=>{if(alive)setImages(new Map(entries));},()=>{if(alive)setError(true);});
        return()=>{alive=false;};
    },[withWater,attempt]);
    const combined=useMemo(()=>new Map([...town.images,...images]),[town.images,images]);
    return{images:combined,ready:town.ready&&(!withWater||images.size===LAKE_FILES.length),error:town.error||error,retry:()=>{town.retry();setAttempt(n=>n+1);}};
}
