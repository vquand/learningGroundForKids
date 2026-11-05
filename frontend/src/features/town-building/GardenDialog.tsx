import { useEffect, useRef } from 'react';
import { CROPS, cropMayGrow } from '../../../../server/src/town-building/garden';
import type { Entity, Season, TownCommand } from '../../../../server/src/town-building/game';
import { uiText, uiMessage } from '../../i18n/uiText';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { Sprite } from './TownArt';
import { LockIcon } from './TownActionIcons';
/** One crop type for the entire turf, like choosing one animal type for a farmhouse. */
export function GardenDialog({entity,season,localDate,open,busy,error,onClose,onCommand}:{entity:Entity|undefined;season:Season|null;localDate?:string;open:boolean;busy:boolean;error:string;onClose:()=>void;onCommand:(command:TownCommand)=>void}) {
    useUiLanguage();
    const ref=useRef<HTMLDialogElement>(null);
    useEffect(()=>{if(open&&entity&&!ref.current?.open)ref.current?.showModal();else if(!open||!entity)ref.current?.close();},[open,entity]);
    return <dialog className="town-garden-dialog" ref={ref} aria-labelledby="garden-title" onClose={onClose} onCancel={event=>{if(busy)event.preventDefault();}}>
        <div className="town-garden-heading"><h2 id="garden-title">{uiText('What will grow here?')}</h2><button disabled={busy} aria-label={uiText('Close garden')} onClick={onClose}>×</button></div>
        <p className="town-garden-intro">{uiText('One crop for the whole turf. Changing crops starts growth again.')}</p>
        {entity?.garden?.slots.some(slot=>slot.withered)&&<p className="town-garden-status">{uiText('Withered crops replant when you harvest.')}</p>}
        <p className="town-garden-status">{season?uiMessage('Growing season: {season}',{season:uiText(season)}):uiText('Ask a parent to set your home city to grow crops.')}</p>
        <div className="town-crop-choices" role="group" aria-label={uiText('Choose a crop')}>{CROPS.map((crop,index)=><button key={crop.id} disabled={busy||!cropMayGrow(crop.id,season,localDate)} aria-label={uiText(crop.name)} aria-pressed={entity?.garden?.crop===crop.id} onClick={()=>entity&&onCommand({type:'plant',entityId:entity.id,generation:entity.garden?.generation??0,crop:crop.id})}>
            <Sprite file="crop-growth" index={index*4+3} columns={4} rows={8}/><strong>{uiText(crop.name)}</strong><span>{!cropMayGrow(crop.id,season,localDate)&&<LockIcon/>}{uiText(crop.id==='pumpkin'&&crop.season!==season&&cropMayGrow(crop.id,season,localDate)?'Halloween pumpkin':crop.season)}</span>
        </button>)}</div>
        {error&&<p role="alert" className="town-garden-error">{uiText(error)}</p>}
        <div className="town-garden-footer"><button disabled={busy} onClick={onClose}>{uiText('Cancel')}</button></div>
    </dialog>;
}
