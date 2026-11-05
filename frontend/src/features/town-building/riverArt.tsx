import {FISH,type FishId} from '../../../../server/src/fishing/catalog';
import {CROPS} from '../../../../server/src/town-building/garden';
import {CatchArt} from '../fishing/FishingArt';
import {EggIcon} from './PoultryUi';
import type {RaftItemKind} from '../../../../server/src/town-building/raftCatalog';
const ROOT='/minigames/town-building/friend-baskets/';
const GIFTS=[[84,98,391,361],[565,98,412,366],[1061,112,426,342],[94,523,391,434],[604,527,313,427],[1097,632,336,248]] as const;
const ICONS=[[32,155,488,302],[563,134,408,335],[1042,180,469,224],[60,602,437,352],[640,581,292,360],[1095,609,353,308]] as const;
export function RiverArt({index,className=''}:{index:number;className?:string}){return <svg className={`town-river-art ${className}`} viewBox={ICONS[index]!.join(' ')} aria-hidden="true"><image href={ROOT+'river-icons-v1.png'} width="1536" height="1024"/></svg>;}
export function GiftArt({index,className=''}:{index:number;className?:string}){return <svg className={`town-river-art ${className}`} viewBox={GIFTS[index]!.join(' ')} aria-hidden="true"><image href={ROOT+'sprites-v1.png'} width="1536" height="1024"/></svg>;}
export const giftArtIndex={flowers:2,balloons:3,gnome:4} as const;

export function RiverItemArt({kind,itemId}:{kind:RaftItemKind;itemId:string}){return kind==='fish'?<CatchArt fishId={itemId as FishId}/>:kind==='egg'?<EggIcon/>:<RiverArt index={3}/>;}
export function riverItemName(kind:RaftItemKind,id:string){return kind==='egg'?'Egg':kind==='fish'?FISH[id as FishId]?.name??'Fish':CROPS.find(c=>c.id===id)?.name??'Vegetables';}

/** Reuse the generated sprites as one filled basket silhouette. */
export function FilledBasketArt({decoration}:{decoration:keyof typeof giftArtIndex}){
 return <span className={`town-filled-basket town-filled-basket-${decoration}`}><GiftArt index={1}/><GiftArt className="town-basket-contents" index={giftArtIndex[decoration]}/></span>;
}
