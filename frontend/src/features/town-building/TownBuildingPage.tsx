import {ApiError} from '../../api/core';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {DevelopmentBoard} from './DevelopmentBoard';
import {womensDayRecord} from '../../../../server/src/town-building/events/womensDay2026Model';
import {WomensDayWelcome} from './WomensDayWelcome';
import {useWomensDayEvent} from './useWomensDayEvent';
import {townTimedEventsNeedHeartbeat} from './TownTimedEventLayers';
import {LakeArt} from './maps/lake/LakeArt';
import {TownLoading} from './TownLoading';
import {businessFor} from '../../../../server/src/town-building/civCatalog';
import {CivPicture,PROSPERITY_ART} from './civArt';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText} from '../../i18n/uiText';
import {actLake,actTown,tickTownGarden,checkpointTownGarden,fetchTown,type TownResponse} from '../../api/town';
import {useProfileStore} from '../../stores/profileStore';
import {useFamilyStore} from '../../stores/familyStore';
import {familyScopedQuery,familyQueryKey} from '../../lib/familyQueries';
import {TOWN_ADJECTIVES,TOWN_NOUNS,DEFAULT_TOWN_NAME,townDisplayName,type TownName} from '../../../../server/src/town-building/game';
import type {Environment} from '../../../../server/src/town-building/environment';
import {useTownMapEnvironment} from './TownMapLayout';
import {useTownEnvironment} from './useTownEnvironment';
import {useSessionRequests} from '../../hooks/useSessionRequests';
import {TownVisitView} from './TownVisitView';
import {useTownRiver} from './useTownRiver';
import {TownRiverObjects,TownRiverButtons} from './TownRiver';
import {MapWorkspace,type MapAction} from './scene/MapWorkspace';
import {useMapArtwork} from './scene/useMapArtwork';
import {useMapHeartbeat,type TickOutcome} from './scene/useMapHeartbeat';
import './town.css';

export function TownBuildingPage() {
  useUiLanguage();
    const id=useProfileStore(s=>s.activeProfileId)!;
    const family=useFamilyStore(s=>s.familyId);
    const generation=useFamilyStore(s=>s.sessionGeneration);
    const [params]=useSearchParams(),friendId=params.get('visit');
    if(friendId)return <TownVisitView key={`${generation}:${family}:${id}:${friendId}`} viewerId={id} family={family} friendId={friendId}/>;
    return <TownSession key={`${generation}:${family}:${id}`} id={id} family={family}/>;
}
/** Anything that grows or works on a map needs its clock ticking. */
const needsClock=(state:TownResponse|undefined,events:boolean)=>!!state&&(events||[...state.entities,...(state.maps?.lake?.land.entities??[])].some(e=>e.blueprintId==='vegetable-patch'||businessFor(e.blueprintId))||!!state.rafts?.length);
function TownSession({id,family}:{id:string;family:string|null}) {
  useUiLanguage();
    const client=useQueryClient(),navigate=useNavigate();
    const key=familyQueryKey('town',family,id);
    const town=useQuery({queryKey:key,queryFn:familyScopedQuery(family,async()=>{const incoming=await fetchTown(id);const cached=client.getQueryData<TownResponse>(key);return cached&&cached.revision>incoming.revision?cached:incoming;}),refetchInterval:30000,retry:false});
    const env=useTownEnvironment(id,family);
    const state=town.data;
    const requests=useSessionRequests(id);
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[paused,setPaused]=useState(false),[growthPaused,setGrowthPaused]=useState(false);
    const [projectPanel,setProjectPanel]=useState(false),[namePanel,setNamePanel]=useState(false),[cardRequested,setCardRequested]=useState(false);
    const [nameDraft,setNameDraft]=useState<TownName>({...DEFAULT_TOWN_NAME});
    const nameDialog=useRef<HTMLDialogElement>(null);
    useEffect(()=>{if(namePanel&&!nameDialog.current?.open)nameDialog.current?.showModal();else if(!namePanel)nameDialog.current?.close();},[namePanel]);
    const lake=state?.maps?.lake;
    const artwork=useMapArtwork([...(state?.entities??[]),...(lake?.land.entities??[])],state?.prosperityStage??0,!!state&&!!env.data,!!lake);
    const river=useTownRiver(id,family,undefined,!!state&&artwork.ready);
    const [opened,setOpened]=useState(false);
    useEffect(()=>{if(artwork.ready)setOpened(true);},[artwork.ready]);
    const localDate=env.data?.timeOfDay?env.data.localDate:'';
    const {greet:greetBlob,dismissIntro}=useWomensDayEvent(id,family,artwork.ready,localDate,()=>setError(uiText('Could not save your greeting. Please try again.')));
    const update=(next:TownResponse)=>client.setQueryData<TownResponse>(key,previous=>previous&&previous.revision>next.revision?previous:next);
    useMapHeartbeat({enabled:(opened||artwork.ready)&&needsClock(state,townTimedEventsNeedHeartbeat(state?.events,localDate))&&!paused&&!projectPanel,
        tick:async(resume):Promise<TickOutcome>=>{
            if(requests.busy)return 'skipped';
            let outcome:TickOutcome='error';
            await requests.run(()=>tickTownGarden(id,resume),{success:next=>{update(next);setGrowthPaused(false);outcome='ok';},error:()=>setGrowthPaused(true)});
            return outcome;
        },
        checkpoint:async()=>{update(await checkpointTownGarden(id));}});
    /** Land commands on Town use the Town endpoint; water and cross-map commands the lake one. */
    async function send(action:MapAction):Promise<TownResponse|null>{
        if(!state||requests.busy)return null;
        let result:TownResponse|null=null;
        let storageError:unknown,shopError:unknown;
        await requests.run(()=>{
            const current=client.getQueryData<TownResponse>(key)??state;
            const revision=action.type==='shop-trade'?action.revision:current.revision;
            if(action.type==='shop-trade')return action.mapId==='town'?actTown(id,revision,action.command):actLake(id,revision,action.command);
            const townAction=(action.type==='harvest-all'&&action.mapId==='town')||(action.type==='land-action'&&(action.mapId??'town')==='town');
            return townAction?actTown(id,revision,action.type==='land-action'?action.command:action):actLake(id,revision,action);
        },{start:()=>{setBusy(true);setError('');},success:next=>{client.setQueryData(key,next);result=next;if(action.type==='land-action'&&action.command.type==='rename'){client.setQueryData(familyQueryKey('town-name',family,id),{townName:next.townName});setNamePanel(false);}},
            error:e=>{if(e instanceof ApiError&&e.code==='STORAGE_LOSS_CONFIRM'){storageError=e;return;}if(action.type==='shop-trade'){shopError=e;void town.refetch();return;}setError(e instanceof ApiError&&e.code==='HARVEST_STORAGE_FULL'?uiText('Storage is full. Make room, then try again.'):e instanceof ApiError&&e.code==='HARVEST_EMPTY'?uiText('Nothing was ready to harvest.'):e instanceof Error?e.message:'Could not save your town.');void town.refetch();},finish:()=>setBusy(false)});
        if(storageError)throw storageError;
        if(shopError)throw shopError;
        return result;
    }
    if(!state||!env.data||!opened&&!artwork.ready)
        return <TownLoading failed={town.isError||env.isError||artwork.error} onRetry={()=>{if(!town.data||town.isError)void town.refetch();if(!env.data||env.isError)void env.refetch();artwork.retry();}}/>;
    return <TownWorkspace state={state} liveEnvironment={env.data} images={artwork.images} busy={busy} error={error} paused={paused} growthPaused={growthPaused} send={send} setPaused={setPaused}
        projectPanel={projectPanel} setProjectPanel={setProjectPanel} nameDraft={nameDraft} setNameDraft={setNameDraft} namePanel={namePanel} setNamePanel={setNamePanel} nameDialog={nameDialog}
        id={id} family={family} river={river} greetBlob={greetBlob} cardRequested={cardRequested} setCardRequested={setCardRequested} dismissIntro={dismissIntro} artworkReady={artwork.ready}
        hasCard={!!womensDayRecord(state.events,localDate)} localDate={localDate} setError={setError}
        lakeExit={lake?()=>{if(requests.busy)return;void checkpointTownGarden(id).then(next=>{update(next);navigate('/town-building/lake');},()=>setError('Could not save your town. Sync and try again.'));}:undefined}/>;
}
interface WorkspaceProps {
    state:TownResponse;liveEnvironment:Environment;images:Map<string,HTMLImageElement>;busy:boolean;error:string;paused:boolean;growthPaused:boolean;send:(a:MapAction)=>Promise<TownResponse|null>;
    setPaused:(v:boolean)=>void;projectPanel:boolean;setProjectPanel:(v:boolean)=>void;nameDraft:TownName;setNameDraft:(v:TownName)=>void;namePanel:boolean;setNamePanel:(v:boolean)=>void;setError:(v:string)=>void;
    nameDialog:RefObject<HTMLDialogElement|null>;id:string;family:string|null;river:ReturnType<typeof useTownRiver>;greetBlob:(id:string)=>void;cardRequested:boolean;setCardRequested:(v:boolean)=>void;
    dismissIntro:()=>void;artworkReady:boolean;hasCard:boolean;localDate:string;lakeExit:(()=>void)|undefined;
}
/** Town's own chrome (name, river friends, Women's Day) around the shared workspace. */
function TownWorkspace(p:WorkspaceProps){
    const {state,busy}=p,environment=useTownMapEnvironment(p.liveEnvironment);
    return <MapWorkspace mapId="town" profileId={p.id} {...(state.maps?.lake?{otherMap:{id:'lake' as const,name:'Lake'}}:{})} viewKey={`${p.family}:${p.id}`} state={state} environment={environment} liveEnvironment={p.liveEnvironment} images={p.images}
        busy={busy} error={p.error} paused={p.paused} growthPaused={p.growthPaused} send={p.send} onPause={()=>p.setPaused(true)} onResume={()=>p.setPaused(false)}
        prosperityStage={state.prosperityStage??0} onGreetBlob={p.greetBlob}
        exits={p.lakeExit?[{id:'lake',label:'Visit your lake',icon:<LakeArt index={6}/>,point:{x:16.5,y:41.5},onClick:p.lakeExit,disabled:busy}]:[]}
        chrome={{title:townDisplayName(state),levelIcon:<CivPicture atlas={PROSPERITY_ART} index={state.prosperityStage??0}/>,onProject:()=>p.setProjectPanel(true),
            onRename:()=>{p.setNameDraft({...state.townName??DEFAULT_TOWN_NAME});p.setNamePanel(true);p.setError('');},info:uiText('640 / 800 tiles buildable'),
            mapControls:<TownRiverButtons river={p.river} blocked={busy}/>,
            ...(p.hasCard?{headerActions:<button type="button" className="town-view-card" aria-label={uiText('View card')} title={uiText('View card')} onClick={()=>p.setCardRequested(true)}><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="20" rx="5" fill="#fff1d5" stroke="#70513b" strokeWidth="2.3"/><path d="m4 10 12 9 12-9M4 25l8-8m16 8-8-8" fill="none" stroke="#70513b" strokeWidth="2" strokeLinejoin="round"/><path d="M16 4c-5-5-10 2-6 5l6 5 6-5c4-3-1-10-6-5Z" fill="#efb4bf" stroke="#70513b" strokeWidth="1.8"/></svg></button>}:{}),}}
        sceneOverlays={(view,canvas)=><TownRiverObjects canvas={canvas} river={p.river} zoom={view.zoom} camera={view.camera} blocked={busy||p.namePanel||p.cardRequested}/>}
        overlays={<>
            <WomensDayWelcome events={state.events} localDate={p.localDate} ready={p.artworkReady} requested={p.cardRequested} onDismiss={()=>{p.setCardRequested(false);p.dismissIntro();}}/>
            <DevelopmentBoard state={state} profileId={p.id} map="town" open={p.projectPanel} onClose={()=>p.setProjectPanel(false)}/>
            <dialog ref={p.nameDialog} className="town-friends-dialog" aria-labelledby="town-name-title" onClose={()=>p.setNamePanel(false)} onCancel={event=>{if(busy)event.preventDefault();}}>
                <h2 id="town-name-title">{uiText('Name your little town')}</h2><p>{uiText('A little name for a place of your own.')}</p>
                <div className="town-name-options"><label>{uiText('Adjective')}<select value={p.nameDraft.adjective} disabled={busy} onChange={event=>p.setNameDraft({...p.nameDraft,adjective:event.target.value as TownName['adjective']})}>{TOWN_ADJECTIVES.map(word=><option key={word}>{word}</option>)}</select></label><label>{uiText('Noun')}<select value={p.nameDraft.noun} disabled={busy} onChange={event=>p.setNameDraft({...p.nameDraft,noun:event.target.value as TownName['noun']})}>{TOWN_NOUNS.map(word=><option key={word}>{word}</option>)}</select></label></div>
                <strong className="town-name-preview">{townDisplayName({townName:p.nameDraft})}</strong>
                {p.error&&<p role="alert">{p.error}</p>}<div className="town-dialog-actions"><button disabled={busy} onClick={()=>void p.send({type:'land-action',mapId:'town',command:{type:'rename',...p.nameDraft}})}>{uiText('Save name')}</button><button disabled={busy} onClick={()=>p.setNamePanel(false)}>{uiText('Cancel')}</button></div>
            </dialog></>}/>;
}
