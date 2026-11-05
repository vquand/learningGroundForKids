import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {uiText} from '../../i18n/uiText';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {LockIcon} from './TownActionIcons';
import {BuildingDetailCard,type BuildingDetail} from './BuildingDetailCard';
import {TownMapDialog} from './TownMapDialog';
import './buildingPanel.css';

export interface TownPaletteItem {id:string;name:string;art:ReactNode;locked?:boolean;disabled?:boolean;disabledReason?:string;selected?:boolean;detail?:BuildingDetail;onChoose:()=>void}
export interface TownPaletteGroup {id:string;name:string;icon?:ReactNode;items:TownPaletteItem[]}

const PAGER=44;
/** How many tiles fit the space left above the detail card; pages only when needed. */
function useTilesPerPage(total:number){
    const area=useRef<HTMLDivElement>(null),[fit,setFit]=useState({columns:4,perPage:8}),remeasure=useRef<()=>void>(()=>{});
    // Re-measure before every paint too: a taller detail card (a newly picked blueprint) shrinks the
    // area in the same commit, and waiting for the ResizeObserver would show a frame of tiles under the pager.
    useLayoutEffect(()=>remeasure.current());
    useLayoutEffect(()=>{
        const node=area.current;if(!node)return;
        const measure=remeasure.current=()=>{
            const grid=node.querySelector<HTMLElement>('.town-blueprints');if(!grid)return;
            const style=getComputedStyle(node),gridStyle=getComputedStyle(grid),tile=parseFloat(gridStyle.gridTemplateColumns)||54,gap=parseFloat(gridStyle.gap)||6;
            const width=node.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=node.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),columns=Math.max(1,Math.floor((width+gap)/(tile+gap)));
            const rows=(h:number)=>Math.max(1,Math.floor((h+gap)/(tile+gap)));
            const all=columns*rows(height),perPage=total<=all?all:columns*rows(height-PAGER);
            setFit(old=>old.columns===columns&&old.perPage===perPage?old:{columns,perPage});
        };
        const observer=new ResizeObserver(measure);observer.observe(node);measure();
        return()=>observer.disconnect();
    },[total]);
    return [area,fit] as const;
}
function BookIcon(){return <svg className="town-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7q6-3 11 1v18q-5-4-11-1Z" fill="#fff1d5" stroke="#70513b" strokeWidth="2.2" strokeLinejoin="round"/><path d="M27 7q-6-3-11 1v18q5-4 11-1Z" fill="#f4d3a4" stroke="#70513b" strokeWidth="2.2" strokeLinejoin="round"/><path d="M8 12q3-1 5 1m-5 4q3-1 5 1m6-6q2-2 5-1" fill="none" stroke="#b08664" strokeWidth="1.6" strokeLinecap="round"/></svg>;}
function ItemButton({item,disabled,selected,onClick}:{item:TownPaletteItem;disabled:boolean;selected:boolean;onClick:()=>void}){
    const isDisabled=disabled||item.disabled;
    const label=`${uiText(item.name)}${item.locked?uiText(' · Locked'):''}${item.disabled&&item.disabledReason?` · ${uiText(item.disabledReason)}`:''}`;
    const title=item.disabled&&item.disabledReason?uiText(item.disabledReason):uiText(item.name);
    return <button type="button" disabled={isDisabled} className={`town-blueprint ${selected?'is-selected':''}`} aria-label={label} title={title} aria-pressed={selected} onClick={onClick}>{item.art}{item.locked&&<span className="town-blueprint-lock"><LockIcon/></span>}</button>;
}
/** A fancy item selector: every group in sections, the shared detail card and a Build button. */
function BuildingBook({open,groups,onClose,onBuild}:{open:boolean;groups:TownPaletteGroup[];onClose:()=>void;onBuild:(group:TownPaletteGroup,item:TownPaletteItem)=>void}){
    const [choice,setChoice]=useState<{group:string;item:string}|null>(null);
    useLayoutEffect(()=>{if(open){const group=groups.find(g=>g.items.some(i=>i.selected)),item=group?.items.find(i=>i.selected);setChoice(group&&item?{group:group.id,item:item.id}:null);}},[open]);
    const group=groups.find(g=>g.id===choice?.group),item=group?.items.find(i=>i.id===choice?.item);
    return <TownMapDialog open={open} title={uiText('Building book')} className="town-building-book" onClose={onClose} footer={<><button type="button" onClick={onClose}>{uiText('Close')}</button><button type="button" className="town-book-build" disabled={!item||item.locked||item.disabled} onClick={()=>group&&item&&onBuild(group,item)}>{uiText('Build')}</button></>}>
        <div className="town-book-layout">
            <div className="town-book-sections">{groups.filter(g=>g.items.length).map(g=><section key={g.id} aria-label={uiText(g.name)}>
                <h3><span className="town-book-section-icon">{g.icon??g.items[0]?.art}</span>{uiText(g.name)}</h3>
                <div className="town-book-items">{g.items.map(i=><button key={i.id} type="button" className={`town-book-item ${choice?.group===g.id&&choice.item===i.id?'is-selected':''}`} aria-pressed={choice?.group===g.id&&choice.item===i.id} onClick={()=>setChoice({group:g.id,item:i.id})}><span className="town-book-item-art">{i.art}{i.locked&&<span className="town-blueprint-lock"><LockIcon/></span>}</span><span>{uiText(i.name)}</span></button>)}</div>
            </section>)}</div>
            <BuildingDetailCard detail={item?.detail??null} empty={{title:'Pick a building',text:'Tap a building in the book to learn about it.'}}/>
        </div>
    </TownMapDialog>;
}
/** Shared side panel: icon group tabs, a building book, responsive pages of
 * blueprints, and the static detail card pinned to the bottom (≤60% height). */
export function TownBuildingPalette({groups,disabled=false,detail,onDialog}:{groups:TownPaletteGroup[];disabled?:boolean;detail?:ReactNode;onDialog?:(open:boolean)=>void}){
    useUiLanguage();
    const [groupId,setGroupId]=useState(groups[0]?.id??''),[page,setPage]=useState(0),[book,setBook]=useState(false);
    const group=groups.find(g=>g.id===groupId)??groups[0],items=group?.items??[];
    const [area,{perPage}]=useTilesPerPage(items.length);
    const pages=Math.max(1,Math.ceil(items.length/perPage)),current=Math.min(page,pages-1);
    const openBook=(next:boolean)=>{setBook(next);onDialog?.(next);};
    return <div className="town-building-panel">
        <div className="town-map-catalog">
            <div className="town-group-tabs" role="group" aria-label={uiText('Construction choices')}>
                <button type="button" disabled={disabled} className="town-group-tab town-book-tab" aria-label={uiText('Building book')} title={uiText('Building book')} onClick={()=>openBook(true)}><BookIcon/></button>
                {groups.map(g=><button key={g.id} type="button" disabled={disabled} className="town-group-tab" aria-pressed={g.id===group?.id} aria-label={uiText(g.name)} title={uiText(g.name)} onClick={()=>{setGroupId(g.id);setPage(0);}}>{g.icon??g.items[0]?.art}</button>)}
            </div>
            <p className="town-group-name">{uiText(group?.name??'')}</p>
            <div className="town-catalog-area" ref={area}>
                <div className="town-blueprints">{items.slice(current*perPage,current*perPage+perPage).map(item=><ItemButton key={item.id} item={item} disabled={disabled} selected={!!item.selected} onClick={item.onChoose}/>)}</div>
                {!items.length&&<p className="town-group-empty">{uiText('Nothing here yet.')}</p>}
                {pages>1&&<nav className="town-pagination" aria-label={uiText('Construction choices')}><button type="button" disabled={disabled||!current} onClick={()=>setPage(current-1)}>{uiText('Previous')}</button><span>{current+1}/{pages}</span><button type="button" disabled={disabled||current+1>=pages} onClick={()=>setPage(current+1)}>{uiText('Next')}</button></nav>}
            </div>
        </div>
        {detail&&<div className="town-build-detail">{detail}</div>}
        <BuildingBook open={book} groups={groups} onClose={()=>openBook(false)} onBuild={(g,item)=>{
            setGroupId(g.id);setPage(Math.floor(g.items.indexOf(item)/perPage));
            if(!item.selected)item.onChoose();
            openBook(false);
        }}/>
    </div>;
}
