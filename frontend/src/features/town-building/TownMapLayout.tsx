import {DEV_INFO_ENABLED,toggleDevInfo,useDevInfo} from './devInfo';
import {createContext,useCallback,useContext,useLayoutEffect,useMemo,useState,type KeyboardEvent,type Dispatch,type ReactNode,type SetStateAction} from 'react';
import {createPortal} from 'react-dom';
import {MATERIALS} from '../../../../server/src/town-building/game';
import type {Environment} from '../../../../server/src/town-building/environment';
import {previewTownEnvironment,type TownResponse} from '../../api/town';
import {useQueryClient} from '@tanstack/react-query';
import {useFamilyStore} from '../../stores/familyStore';
import {familyQueryKey} from '../../lib/familyQueries';
import {useSessionRequests} from '../../hooks/useSessionRequests';
import {KidBackButton} from '../../components/KidBackButton';
import {MinigameBadgesButton} from '../achievements/MinigameBadgesButton';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText} from '../../i18n/uiText';
import {MaterialArt,SEASONS} from './TownArt';
import {TownRewardBar} from './TownRewardBar';
import './townMapLayout.css';
import './townIcons.css';
import {TownFriendsButton} from './TownFriends';
import {TownWeatherStatus} from './TownWeatherStatus';
import {BuildToolsIcon} from './TownActionIcons';
import {TownMapSummary} from './TownMapSummary';
import {TownFullscreenButton,useTownRelaxing} from './TownRelaxingView';

type Slot='scene'|'palette'|'viewDetails'|'notices'|'headerActions'|'overlays'|'testControls'|'mapControls';
type Appearance=Partial<Pick<Environment,'season'|'precipitation'|'snowCover'|'cloudCover'|'timeOfDay'|'isDay'|'localTime'>>;
export interface TownMapPresentation {
    mapId:'town'|'lake';state:TownResponse;environment:Environment;busy:boolean;readOnly?:boolean;visitingProfileId?:string;
    title:string;levelIcon:ReactNode;onProject:()=>void;onRename?:()=>void;renameLabel?:string;
    onToggleEdit:()=>void;zoom:number;onZoom:()=>void;onCenter:()=>void;
    footprint:{x:number;y:number;active?:boolean;disabled:boolean;onMove:(dx:number,dy:number)=>void};
    objects:{id:string;name:string}[];selectedId:string;onSelect:(id:string)=>void;
    tip:string;error?:string;info?:string;onPause?:()=>void;onResume?:()=>void;
    reward?:import('./townReward').TownReward;receipt?:number|string;
    scene:ReactNode;palette:ReactNode;/** The selected building's card while viewing (not editing). */viewDetails?:ReactNode;/** Controls shown below the read-only overview while idle. */idlePanel?:ReactNode;notices?:ReactNode;
    headerActions?:ReactNode;testControls?:ReactNode;mapControls?:ReactNode;children?:ReactNode;
}
interface Host {
    slots:Partial<Record<Slot,HTMLElement>>;
    publish:(value:TownMapPresentation)=>void;setLoading:(value:boolean)=>void;
    editing:boolean;setEditing:Dispatch<SetStateAction<boolean>>;
    appearance:Appearance|null;setAppearance:Dispatch<SetStateAction<Appearance|null>>;
}
const Context=createContext<Host|null>(null);
export function useTownMapEditing(){const host=useContext(Context);if(!host)throw new Error('Town maps require the persistent TownMapScreen.');return [host.editing,host.setEditing] as const;}
export function useTownMapEnvironment(live:Environment){const host=useContext(Context);return useMemo(()=>host?.appearance?{...live,...host.appearance,weatherSource:'preview' as const}:live,[live,host?.appearance]);}
export function useTownMapHost(){return useContext(Context);}

/** Contextual cards may replace the idle hint, but never a failed-request message. */
export function TownMapFeedback({error,tip,contextual=false}:{error?:string;tip?:string;contextual?:boolean}){
    return <p className="town-view-tip" role={error?'alert':'status'} hidden={contextual&&!error}>{uiText(error||tip||'A little moment, and your town will be ready.')}</p>;
}

/** A controller publishes map data and renders only into the persistent screen's slots. */
export function TownMapLayout(props:TownMapPresentation){
    const host=useContext(Context);if(!host)throw new Error('Town maps require the persistent TownMapScreen.');
    useLayoutEffect(()=>{host.publish(props);host.setLoading(false);},[host.publish,host.setLoading,props]);
    const content:Partial<Record<Slot,ReactNode>>={scene:props.scene,palette:props.palette,viewDetails:props.viewDetails,notices:props.notices,headerActions:props.headerActions,overlays:props.children,testControls:props.testControls,mapControls:props.mapControls};
    return <>{(Object.keys(content) as Slot[]).map(slot=>host.slots[slot]?createPortal(content[slot],host.slots[slot]!,slot):null)}</>;
}

/** The one page, navigation, inventory, workspace and editing lifecycle for every map. */
export function TownMapHost({children,profileId}:{children:ReactNode;profileId:string}){
    useUiLanguage();
    const relaxing=useTownRelaxing();
    const client=useQueryClient(),family=useFamilyStore(s=>s.familyId),requests=useSessionRequests(profileId);
    const [snapshot,publish]=useState<TownMapPresentation|null>(null);
    const [loading,setLoading]=useState(true);
    const [slots,setSlots]=useState<Partial<Record<Slot,HTMLElement>>>({});
    const refs=useMemo(()=>Object.fromEntries((['scene','palette','viewDetails','notices','headerActions','overlays','testControls','mapControls'] as Slot[]).map(slot=>[slot,(node:HTMLElement|null)=>{if(node)setSlots(old=>old[slot]===node?old:{...old,[slot]:node});}])) as Record<Slot,(node:HTMLElement|null)=>void>,[]);
    const [sharedEditing,setEditing]=useState(()=>sessionStorage.getItem(`town-editing:${profileId}`)==='true');
    const editing=sharedEditing&&!snapshot?.readOnly&&!relaxing,viewing=!editing&&!!snapshot?.viewDetails;
    useLayoutEffect(()=>sessionStorage.setItem(`town-editing:${profileId}`,String(sharedEditing)),[profileId,sharedEditing]);
    const [appearance,setAppearance]=useState<Appearance|null>(null),[appearanceError,setAppearanceError]=useState('');
    const value=useMemo<Host>(()=>({slots,publish,setLoading,editing:sharedEditing,setEditing,appearance,setAppearance}),[slots,sharedEditing,appearance]);
    const move=useCallback((event:KeyboardEvent)=>{if(event.defaultPrevented||loading||!editing||!snapshot||snapshot.footprint.disabled||document.querySelector('dialog[open]'))return;const target=event.target as HTMLElement;if(target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(target.tagName))return;const delta:Record<string,[number,number]>={ArrowLeft:[0,-1],ArrowUp:[-1,0],ArrowDown:[1,0],ArrowRight:[0,1]};if(delta[event.key]){event.preventDefault();snapshot.footprint.onMove(...delta[event.key]!);}},[editing,snapshot,loading]);
    const env=snapshot?.environment,blocked=loading||!snapshot||snapshot.busy;
    function resetAppearance(){setAppearance(null);setAppearanceError('');if(env?.weatherSource==='preview'&&env.canPreviewEnvironment&&!requests.busy)void requests.run(()=>previewTownEnvironment(profileId,{reset:true}),{success:next=>client.setQueryData(familyQueryKey('town-environment',family,profileId),next),error:e=>setAppearanceError(e instanceof Error?e.message:'Preview unavailable.')});}
    return <Context.Provider value={value}><main className="town-page town-map-screen" data-map={snapshot?.mapId??'town'} data-season={env?.season} data-editing={editing} data-zoom={snapshot?.zoom??1} aria-busy={loading} onKeyDown={move}>
      <header className="town-header kid-nav"><div className="town-header-actions"><KidBackButton/><TownFriendsButton viewerId={profileId} family={family} currentTownId={snapshot?.visitingProfileId} disabled={blocked} onOpen={()=>snapshot?.onPause?.()} onClose={()=>snapshot?.onResume?.()}/><span ref={refs.headerActions}/></div><div className="town-header-brand"><p className="town-eyebrow">{uiText('A little place of your own')}</p><div className="town-name-heading"><button className="town-prosperity-button" aria-label={uiText(snapshot?.mapId==='lake'?'Lake development project':'Town development project')} title={uiText('Your town is growing')} disabled={blocked||snapshot?.readOnly} onClick={()=>snapshot?.onProject()}><span className="town-prosperity">{snapshot?.levelIcon}</span></button><h1 title={snapshot?.title}>{snapshot?.title??uiText('Your town')}</h1><button className="town-map-rename" style={{visibility:snapshot?.onRename?'visible':'hidden'}} aria-label={uiText(snapshot?.renameLabel??'Change town name')} title={uiText(snapshot?.renameLabel??'Change town name')} disabled={blocked} onClick={()=>snapshot?.onRename?.()}><svg className="town-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="2.5"><path d="m6 22 15-15 5 5-15 15-6 1Z" fill="#e4c28b"/><path d="m18 10 5 5"/></svg></button></div></div><MinigameBadgesButton groupIds={['town-building','town-lake','halloween','womens-day-2026','xmas-2026']} disabled={blocked} onOpen={()=>snapshot?.onPause?.()} onClose={()=>snapshot?.onResume?.()}/><TownFullscreenButton disabled={blocked}/></header>
      <div className="town-status-row"><section className="town-weather-section" aria-label={uiText('Weather forecast')}><TownWeatherStatus environment={env} onOpen={()=>snapshot?.onPause?.()} onClose={()=>snapshot?.onResume?.()}/></section><section className="town-storage" aria-label={uiText('Shared town storage')}>{MATERIALS.map(material=><div key={material}><MaterialArt material={material}/><span>{uiText(material)}<strong>{snapshot?.state.materials[material]??'…'}</strong></span></div>)}</section><button className="town-edit-toggle" aria-label={uiText(editing?'Done editing':'Build')} title={uiText(editing?'Done editing':'Build')} aria-pressed={editing} disabled={blocked||snapshot?.readOnly} onClick={()=>snapshot?.onToggleEdit()}><BuildToolsIcon/></button></div>
      <div className={`town-layout ${editing?'':'is-viewing'}`}>
        <section className="town-play" aria-label={uiText('Your town')}>
          <div className="town-scene" data-town-map-stage ref={refs.scene}><div className="town-map-notices" ref={refs.notices}/>
          <div className="town-map-controls"><span ref={refs.mapControls}/><button onClick={()=>snapshot?.onZoom()} disabled={blocked}>{uiText((snapshot?.zoom??1)===1?'Zoom in':'Overview')}</button><button onClick={()=>snapshot?.onCenter()} disabled={blocked}>{uiText('Center map')}</button><div className="town-footprint-controls" aria-label={uiText('Move the footprint')} hidden={!editing||!snapshot?.footprint.active}>{([{direction:'up',label:'Footprint up',icon:'↑',dx:-1,dy:0},{direction:'left',label:'Footprint left',icon:'←',dx:0,dy:-1},{direction:'right',label:'Footprint right',icon:'→',dx:0,dy:1},{direction:'down',label:'Footprint down',icon:'↓',dx:1,dy:0}]).map(n=><button key={n.label} data-direction={n.direction} aria-label={uiText(n.label)} disabled={blocked||snapshot?.footprint.disabled} onClick={()=>snapshot?.footprint.onMove(n.dx,n.dy)}>{n.icon}</button>)}</div></div>
          </div>
          {(import.meta.env.DEV||env?.canPreviewEnvironment)&&<details className="town-test-appearance"><summary>{uiText('Test appearance controls')}</summary><div className="town-test-buttons"><span>{uiText('Weather')}</span>{([{label:'Clear',precipitation:'none',cloudCover:0,snowCover:false},{label:'Rain',precipitation:'rain',cloudCover:95,snowCover:false},{label:'Clouds',precipitation:'none',cloudCover:100,snowCover:false},{label:'Snow',precipitation:'snow',cloudCover:85,snowCover:true}] as const).map(option=><button key={option.label} aria-pressed={appearance?.precipitation===option.precipitation&&appearance?.cloudCover===option.cloudCover&&appearance?.snowCover===option.snowCover} onClick={()=>setAppearance(old=>({...old,...option}))}>{uiText(option.label)}</button>)}<span>{uiText('Season')}</span>{SEASONS.map(season=><button key={season} aria-pressed={appearance?.season===season} onClick={()=>setAppearance(old=>({...old,season,snowCover:false}))}>{uiText(season)}</button>)}<span>{uiText('Light')}</span>{(['morning','noon','afternoon','evening','night'] as const).map(timeOfDay=><button key={timeOfDay} aria-pressed={appearance?.timeOfDay===timeOfDay} onClick={()=>setAppearance(old=>({...old,timeOfDay,isDay:timeOfDay!=='night',localTime:null}))}>{uiText(timeOfDay)}</button>)}<button onClick={resetAppearance}>{uiText('Reset to live')}</button><span ref={refs.testControls}/>{DEV_INFO_ENABLED&&<DevInfoButton/>}</div></details>}
        </section><aside className="town-palette town-sidebar" aria-label={uiText(editing?'Town blueprints':'Building details')}>{!editing&&!viewing&&snapshot&&<><TownMapSummary state={snapshot.state} mapId={snapshot.mapId}/>{snapshot.idlePanel}</>}<div className="town-sidebar-content town-edit-panel" hidden={!editing} ref={refs.palette}/><div className="town-sidebar-content town-view-panel" hidden={!viewing} ref={refs.viewDetails}/><TownMapFeedback error={appearanceError||snapshot?.error} tip={snapshot?.tip} contextual={viewing||(editing&&(!!snapshot?.selectedId||!!snapshot?.footprint.active))}/><span className="town-tile-readout" hidden={!editing||!snapshot?.footprint.active}>{uiText('Tile ')}{(snapshot?.footprint.y??0)+1}, {(snapshot?.footprint.x??0)+1}</span><span className="town-map-info">{snapshot?.info}</span></aside>
      </div>
      {relaxing&&(appearanceError||snapshot?.error)&&<div className="town-relax-error"><TownMapFeedback error={appearanceError||snapshot?.error}/></div>}
      <TownRewardBar reward={snapshot?.reward} event={snapshot?.receipt} source="[data-town-map-stage]" target=".town-storage" hideLink/>
      <div className="town-map-overlays" ref={refs.overlays}/>{children}
    </main></Context.Provider>;
}

export {TownMapDialog} from './TownMapDialog';
export {TownWeatherStatus} from './TownWeatherStatus';
export {TownBuildingPalette,type TownPaletteItem,type TownPaletteGroup} from './TownBuildingPalette';


/** Dev mode only: show IDs over everything on the map; tapping one copies it for a bug report. */
function DevInfoButton(){const on=useDevInfo();return <button className="town-dev-info-toggle" aria-pressed={on} onClick={toggleDevInfo}>{on?'Dev info: on':'Dev info: off'}</button>;}
