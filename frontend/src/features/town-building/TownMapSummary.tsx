import {BLUEPRINTS,type TownState} from '../../../../server/src/town-building/game';
import {LAKE_BLUEPRINTS} from '../../../../server/src/town-building/water/catalog';
import type {MapId} from '../../../../server/src/town-building/maps/types';
import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiMessage,uiText} from '../../i18n/uiText';
import {capSummaryKinds,calculateSummaryIconOverlap,mapSummary,type MapSummary,type SummaryKind} from './mapSummary';
import {BlueprintArt} from './TownArt';
import {LakeArt} from './maps/lake/LakeArt';

function SummaryArt({id}:{id:string}){
    const blueprint=BLUEPRINTS.find(item=>item.id===id);
    if(blueprint)return <BlueprintArt blueprint={blueprint}/>;
    const raft=LAKE_BLUEPRINTS.find(item=>item.id===id);
    return raft?<LakeArt garden={raft.id==='floating-garden'} index={raft.art}/>:null;
}

type SummaryRow={key:string;label:string;count:number;visible:SummaryKind[];hidden:SummaryKind[]};
function summaryRows(summary:MapSummary):SummaryRow[]{
    return [
        {key:'buildings',label:uiMessage('Buildings: {count}',{count:summary.buildings}),count:summary.buildings,kinds:summary.buildingKinds},
        {key:'plant-plots',label:uiMessage('Plant plots: {count}',{count:summary.plantPlots}),count:summary.plantPlots,kinds:summary.plantKinds},
        {key:'roads',label:uiMessage('Roads: {count} tiles',{count:summary.roadTiles}),count:summary.roadTiles,kinds:summary.roadKinds},
        {key:'bridges',label:uiMessage('Bridges: {count} tiles',{count:summary.bridgeTiles}),count:summary.bridgeTiles,kinds:summary.bridgeKinds},
        {key:'animal-houses',label:uiMessage('Animal houses: {count}',{count:summary.animalHouses}),count:summary.animalHouses,kinds:summary.animalHouseKinds},
        {key:'fish-houses',label:uiMessage('Fish houses: {count}',{count:summary.fishHouses}),count:summary.fishHouses,kinds:summary.fishHouseKinds},
    ].filter(row=>row.count>0).map(row=>({
        key:row.key,
        label:`${row.label} — ${uiMessage('Kinds: {kinds}',{kinds:row.kinds.map(kindLabel).join(', ')})}`,
        count:row.count,
        ...capSummaryKinds(row.kinds),
    }));
}

function summaryKindName(id:string):string {
    const blueprint=BLUEPRINTS.find(item=>item.id===id)??LAKE_BLUEPRINTS.find(item=>item.id===id);
    return blueprint?uiText(blueprint.name):id;
}

function kindLabel(kind:SummaryKind):string {
    return `${summaryKindName(kind.id)} × ${kind.count}`;
}

function SummaryIcons({visible,hidden}:{visible:SummaryKind[];hidden:SummaryKind[]}){
    const ref=useRef<HTMLSpanElement>(null);
    const itemCount=visible.length+(hidden.length>0?1:0);
    const [availableWidth,setAvailableWidth]=useState(0);
    useLayoutEffect(()=>{
        const node=ref.current;
        if(!node)return;
        const update=()=>setAvailableWidth(node.clientWidth);
        update();
        if(typeof ResizeObserver==='undefined')return;
        const observer=new ResizeObserver(update);
        observer.observe(node);
        return()=>observer.disconnect();
    },[]);
    const overlap=calculateSummaryIconOverlap(itemCount,availableWidth);
    const style={'--scale-overlap':`${overlap}px`} as CSSProperties;
    return <span ref={ref} className="town-map-summary-icons" style={style}>
        {visible.map((kind,index)=><span key={kind.id} className="town-map-summary-icon" style={{zIndex:index+1}} aria-hidden="true"><SummaryArt id={kind.id}/></span>)}
        {hidden.length>0&&<span className="town-map-summary-more" style={{zIndex:visible.length+1}} aria-label={uiMessage('More kinds: {kinds}',{kinds:hidden.map(kindLabel).join(', ')})} title={uiMessage('More kinds: {kinds}',{kinds:hidden.map(kindLabel).join(', ')})}>+{hidden.length}</span>}
    </span>;
}

/** Read-only saved-state overview. Zero-value rows stay out of the child-facing panel. */
export function TownMapSummary({state,mapId}:{state:TownState;mapId:MapId}){
    useUiLanguage();
    const rows=summaryRows(mapSummary(state,mapId));
    return <section className="town-map-summary" aria-label={uiText('Map overview')}>
        <h2>{uiText('Map overview')}</h2>
        {rows.length?<ul className="town-map-summary-list">
            {rows.map(row=><li key={row.key} className="town-map-summary-row" aria-label={row.label} title={row.label}>
                <SummaryIcons visible={row.visible} hidden={row.hidden}/>
                <span className="town-map-summary-count">× {row.count}</span>
            </li>)}
        </ul>:<p className="town-map-summary-empty" role="status">{uiText('This map is ready for its first little steps.')}</p>}
    </section>;
}

export {summaryRows};
