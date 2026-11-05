import type {StorageLoss,StorageRemovalReceipt} from '../../../../server/src/town-building/storage';
import {CROPS} from '../../../../server/src/town-building/garden';
import type {Material} from '../../../../server/src/town-building/game';
import {LAKE_FISH,type LakeFishId} from '../../../../server/src/town-building/water/catalog';
import {TownMapDialog} from './TownMapLayout';
import {MaterialArt,Sprite} from './TownArt';
import {LakeArt} from './maps/lake/LakeArt';
import {MilkIcon,YarnIcon,WoolIcon} from './BarnUi';
import {uiText,uiMessage} from '../../i18n/uiText';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import './storageRemoval.css';
function product(loss:StorageLoss){
 const crop=CROPS.find(c=>c.id===loss.id),fish=LAKE_FISH[loss.id as LakeFishId];
 if(loss.kind==='crop'&&crop)return {label:crop.name,icon:<Sprite file="crop-growth" index={CROPS.indexOf(crop)*4+3} columns={4} rows={8}/>};
 if(loss.kind==='fish'&&fish)return {label:fish.name,icon:<LakeArt fish index={fish.art*4+2}/>};
 if(loss.kind==='milk')return {label:'Milk',icon:<MilkIcon/>};
 if(loss.kind==='item'&&loss.id==='wool')return {label:'Wool',icon:<WoolIcon/>};
 if(loss.kind==='yarn')return {label:'Yarn',icon:<YarnIcon/>};
 return {label:loss.id.charAt(0).toUpperCase()+loss.id.slice(1),icon:<MaterialArt material={loss.id as Material}/>};
}
export function StorageRemovalDialog({receipt,busy,onClose,onConfirm,completed=false}:{receipt:StorageRemovalReceipt|undefined;busy:boolean;onClose:()=>void;onConfirm:()=>void;completed?:boolean}){
 useUiLanguage();
 return <TownMapDialog open={!!receipt} title={uiText(completed?'Storage removed':'Remove Town Storage?')} busy={busy} error="" onClose={onClose} className="storage-loss-dialog" footer={<><button className="town-dialog-secondary" disabled={busy} onClick={onClose}>{uiText(completed?'Close':'Cancel')}</button>{!completed&&<button className="town-dialog-primary" disabled={busy} onClick={onConfirm}>{uiText('Remove')}</button>}</>}>
 {receipt&&<><p>{uiMessage('Item limit: {old} → {next}',{old:receipt.oldItemLimit,next:receipt.newItemLimit})}</p>{!completed&&receipt.lastStorage&&<p><strong>{uiText('This is your only storage. Everything above 10 of each item and 2000 of each material will be lost.')}</strong></p>}<p>{uiText(completed?'These goods were discarded:':'These goods will be lost:')}</p><ul className="storage-loss-grid">{receipt.losses.map(loss=>{const p=product(loss);return <li key={`${loss.kind}:${loss.id}`}><span className="storage-loss-art">{p.icon}</span><span>{uiText(p.label)}</span><strong>×{loss.amount}</strong></li>;})}</ul></>}
 </TownMapDialog>;
}
