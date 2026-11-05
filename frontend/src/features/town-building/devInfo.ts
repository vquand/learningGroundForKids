import {useSyncExternalStore} from 'react';

/** Local debugging aid: IDs over every building, raft, animal and person on the map.
 * Only in Vite dev builds with `VITE_DEV_MODE=true` in a local `.env` file; never shipped. */
export const DEV_INFO_ENABLED=import.meta.env.DEV&&import.meta.env.VITE_DEV_MODE==='true';

let on=false;const listeners=new Set<()=>void>();
export function toggleDevInfo(){on=!on;for(const listener of listeners)listener();}
export const devInfoOn=()=>DEV_INFO_ENABLED&&on;
export function useDevInfo():boolean{return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},devInfoOn,()=>false);}

export interface DevInfoItem{id:string;label:string;/** Screen position of the label's bottom centre, in canvas CSS pixels. */x:number;y:number;kind:'building'|'raft'|'animal'|'person'}
/** The copied line, ready to paste into a bug report. */
export const devInfoLine=(profileId:string,itemId:string,env:unknown)=>`profileID: ${profileId}; itemID: ${itemId}; envSettings: ${JSON.stringify(env)}`;

async function copy(text:string){
    try{await navigator.clipboard.writeText(text);return;}catch{/* fall back for non-secure origins (an iPad on the LAN) */}
    const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove();
}
/** Absolutely positioned labels over the canvas, updated imperatively from the frame loop. */
export class DevInfoLayer{
    private nodes=new Map<string,HTMLButtonElement>();
    constructor(private host:HTMLElement,private context:()=>{profileId:string;env:unknown}){}
    paint(items:readonly DevInfoItem[],offset:{left:number;top:number}){
        const seen=new Set<string>();
        for(const item of items){
            seen.add(item.id);
            let node=this.nodes.get(item.id);
            if(!node){
                node=document.createElement('button');node.type='button';node.className=`town-dev-info town-dev-info-${item.kind}`;
                const id=item.id;node.addEventListener('pointerdown',event=>event.stopPropagation());
                node.addEventListener('click',event=>{event.stopPropagation();const {profileId,env}=this.context();void copy(devInfoLine(profileId,id,env)).then(()=>{node!.dataset.copied='true';setTimeout(()=>{delete node!.dataset.copied;},900);});});
                this.host.append(node);this.nodes.set(item.id,node);
            }
            if(node.textContent!==item.label){node.textContent=item.label;node.title=item.id;}
            node.style.transform=`translate(${Math.round(offset.left+item.x)}px,${Math.round(offset.top+item.y)}px) translate(-50%,-100%)`;
        }
        for(const [id,node] of this.nodes)if(!seen.has(id)){node.remove();this.nodes.delete(id);}
    }
    clear(){for(const node of this.nodes.values())node.remove();this.nodes.clear();}
}
