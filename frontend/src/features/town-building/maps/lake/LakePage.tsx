import {ApiError} from '../../../../api/core';
import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {fetchLake,actLake,tickLake,pauseLake,type TownResponse} from '../../../../api/town';
import {useProfileStore} from '../../../../stores/profileStore';
import {useFamilyStore} from '../../../../stores/familyStore';
import {useSessionRequests} from '../../../../hooks/useSessionRequests';
import {useUiLanguage} from '../../../../hooks/useUiLanguage';
import {uiMessage,uiText} from '../../../../i18n/uiText';
import {familyQueryKey,familyScopedQuery} from '../../../../lib/familyQueries';
import {LAKE_ADJECTIVES,DEFAULT_LAKE_ADJECTIVE,lakeDisplayName,type LakeAdjective} from '../../../../../../server/src/town-building/maps/lake/name';
import {DevelopmentBoard} from '../../DevelopmentBoard';
import {TownLoading} from '../../TownLoading';
import {LakeArt,LakeStageArt} from './LakeArt';
import {useTownMapEnvironment} from '../../TownMapLayout';
import {useTownEnvironment} from '../../useTownEnvironment';
import {MapWorkspace,type MapAction} from '../../scene/MapWorkspace';
import {useMapArtwork} from '../../scene/useMapArtwork';
import {useMapHeartbeat,type TickOutcome} from '../../scene/useMapHeartbeat';
import '../../town.css';
import './lake.css';

export function LakePage() {
    const id=useProfileStore(s=>s.activeProfileId)!,family=useFamilyStore(s=>s.familyId),generation=useFamilyStore(s=>s.sessionGeneration);
    return <LakeSession key={`${generation}:${family}:${id}`} id={id} family={family}/>;
}
function LakeSession({id,family}:{id:string;family:string|null}) {
    useUiLanguage();
    const client=useQueryClient(),navigate=useNavigate(),requests=useSessionRequests(id),key=familyQueryKey('town',family,id);
    const lake=useQuery({queryKey:familyQueryKey('town-lake',family,id),queryFn:familyScopedQuery(family,()=>fetchLake(id)),retry:false,refetchOnWindowFocus:false});
    const environment=useTownEnvironment(id,family);
    const [state,setState]=useState<TownResponse>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[paused,setPaused]=useState(false),[growthPaused,setGrowthPaused]=useState(false);
    const [projectPanel,setProjectPanel]=useState(false),[namePanel,setNamePanel]=useState(false),[nameDraft,setNameDraft]=useState<LakeAdjective>(DEFAULT_LAKE_ADJECTIVE);
    const nameDialog=useRef<HTMLDialogElement>(null);
    useEffect(()=>{if(namePanel&&!nameDialog.current?.open)nameDialog.current?.showModal();else if(!namePanel)nameDialog.current?.close();},[namePanel]);
    useEffect(()=>{if(lake.data)setState(previous=>previous&&previous.revision>lake.data!.revision?previous:lake.data);},[lake.data]);
    const current=useRef(state);current.current=state;
    const artwork=useMapArtwork([...(state?.entities??[]),...(state?.maps?.lake?.land.entities??[])],0,!!state&&!!environment.data,true);
    const ready=!!state?.maps?.lake&&artwork.ready;
    const displayEnvironment=useTownMapEnvironment(environment.data??{season:'spring',localDate:'',timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'unavailable',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:''});
    function update(next:TownResponse){setState(previous=>previous&&previous.revision>next.revision?previous:next);client.setQueryData<TownResponse>(key,previous=>previous&&previous.revision>next.revision?previous:next);}
    useMapHeartbeat({enabled:ready&&!paused&&!projectPanel,
        tick:async(resume):Promise<TickOutcome>=>{
            if(requests.busy)return 'skipped';
            let outcome:TickOutcome='error';
            await requests.run(()=>tickLake(id,resume),{success:next=>{update(next);setGrowthPaused(false);outcome='ok';},error:()=>setGrowthPaused(true)});
            return outcome;
        },
        checkpoint:async()=>{update(await pauseLake(id));}});
    async function send(action:MapAction):Promise<TownResponse|null>{
        if(!current.current||requests.busy)return null;
        let result:TownResponse|null=null;
        let storageError:unknown,shopError:unknown;
        const revision=action.type==='shop-trade'?action.revision:Math.max(current.current!.revision,client.getQueryData<TownResponse>(key)?.revision??0);
        await requests.run(()=>actLake(id,revision,action.type==='shop-trade'?action.command:action),
            {start:()=>{setBusy(true);setError('');},success:next=>{update(next);result=next;if(action.type==='rename')setNamePanel(false);},
             error:e=>{if(e instanceof ApiError&&e.code==='STORAGE_LOSS_CONFIRM'){storageError=e;return;}if(action.type==='shop-trade'){shopError=e;void lake.refetch();return;}setError(e instanceof ApiError&&e.code==='HARVEST_STORAGE_FULL'?uiText('Storage is full. Make room, then try again.'):e instanceof ApiError&&e.code==='HARVEST_EMPTY'?uiText('Nothing was ready to harvest.'):e instanceof Error?e.message:'Could not save your lake.');void lake.refetch();},finish:()=>setBusy(false)});
        if(storageError)throw storageError;
        if(shopError)throw shopError;
        return result;
    }
    async function leave(){if(requests.busy)return;setBusy(true);try{update(await pauseLake(id));navigate('/town-building');}catch(e){setError(e instanceof Error?e.message:'Could not pause the lake.');setBusy(false);}}
    if(!ready||!state||!environment.data)return <TownLoading failed={lake.isError||environment.isError||artwork.error} onRetry={()=>{void lake.refetch();void environment.refetch();artwork.retry();}}/>;
    const book=state.maps!.lake!,displayName=(adjective:LakeAdjective)=>state.lakeOwnerName?lakeDisplayName(state.lakeOwnerName,adjective):uiText('Your lake');
    return <MapWorkspace mapId="lake" profileId={id} otherMap={{id:'town',name:'Town'}} viewKey={`${family}:${id}`} state={state} environment={displayEnvironment} liveEnvironment={environment.data} images={artwork.images}
        busy={busy} error={error} paused={paused} growthPaused={growthPaused} send={send} onPause={()=>setPaused(true)} onResume={()=>setPaused(false)}
        exits={[{id:'town',label:'Follow the river back to Town',icon:<span><LakeArt index={6}/></span>,point:{x:16.5,y:-1.5},onClick:()=>void leave(),disabled:busy,className:'lake-river-return'}]}
        chrome={{title:displayName(book.adjective??DEFAULT_LAKE_ADJECTIVE),renameLabel:'Change lake name',levelIcon:<LakeStageArt stage={book.stage}/>,onProject:()=>setProjectPanel(true),
            onRename:()=>{setNameDraft(book.adjective??DEFAULT_LAKE_ADJECTIVE);setNamePanel(true);},
            info:uiMessage('Fish home raft · {count}/100 fish harvested',{count:Math.min(100,book.harvested)})}}
        overlays={<>
            <DevelopmentBoard state={state} profileId={id} map="lake" open={projectPanel} onClose={()=>setProjectPanel(false)}/>
            <dialog ref={nameDialog} className="town-friends-dialog" aria-labelledby="lake-name-title" onCancel={event=>{event.preventDefault();if(!busy)setNamePanel(false);}}>
                <h2 id="lake-name-title">{uiText('Name your lake')}</h2><p>{uiText('Choose an adjective for your lake.')}</p>
                <div className="town-name-options"><label>{uiText('Adjective')}<select value={nameDraft} disabled={busy} onChange={event=>setNameDraft(event.target.value as LakeAdjective)}>{LAKE_ADJECTIVES.map(word=><option key={word} value={word}>{word}</option>)}</select></label></div>
                <strong className="town-name-preview">{displayName(nameDraft)}</strong>
                {error&&<p role="alert">{uiText(error)}</p>}<div className="town-dialog-actions"><button disabled={busy||!state.lakeOwnerName} onClick={()=>void send({type:'rename',adjective:nameDraft})}>{uiText('Save name')}</button><button disabled={busy} onClick={()=>setNamePanel(false)}>{uiText('Cancel')}</button></div>
            </dialog></>}/>;
}
