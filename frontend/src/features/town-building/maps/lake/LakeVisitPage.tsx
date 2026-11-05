import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {fetchLakeVisit} from '../../../../api/town';
import {useProfileStore} from '../../../../stores/profileStore';
import {useFamilyStore} from '../../../../stores/familyStore';
import {familyQueryKey,familyScopedQuery} from '../../../../lib/familyQueries';
import {useUiLanguage} from '../../../../hooks/useUiLanguage';
import {uiText} from '../../../../i18n/uiText';
import {LAKE_BLUEPRINTS} from '../../../../../../server/src/town-building/water/catalog';
import {BLUEPRINTS} from '../../../../../../server/src/town-building/game';
import {lakeDisplayName} from '../../../../../../server/src/town-building/maps/lake/name';
import {TownMapLayout} from '../../TownMapLayout';
import {TownLoading} from '../../TownLoading';
import {CloseIcon} from '../../TownActionIcons';
import {useMapArtwork} from '../../scene/useMapArtwork';
import {MapScene} from '../../scene/MapScene';
import type {TownView} from '../../townViewport';
import {LakeActionButton} from './LakeActionButton';
import {LakeStageArt,LakeArt} from './LakeArt';
import {useActiveTownPage} from '../../useTownEnvironment';

export function LakeVisitPage({ownerId}:{ownerId:string}){
 useUiLanguage();const viewer=useProfileStore(s=>s.activeProfileId)!,family=useFamilyStore(s=>s.familyId),navigate=useNavigate();
 const active=useActiveTownPage();
 const key=familyQueryKey('lake-visit',family,viewer,ownerId),query=useQuery({queryKey:key,queryFn:familyScopedQuery(family,()=>fetchLakeVisit(viewer,ownerId)),enabled:active,retry:false,refetchOnWindowFocus:false,gcTime:0});
 const visit=query.isError?undefined:query.data,art=useMapArtwork(visit?.state.maps?.lake?.land.entities??[],0,!!visit,true),[selected,setSelected]=useState(''),[view,setView]=useState<TownView>({zoom:1,camera:{x:0,y:0}});
 if(!visit||!art.ready)return <TownLoading failed={query.isError||art.error} onRetry={()=>{void query.refetch();art.retry();}}/>;
 const lake=visit.state.maps!.lake!;
 const leave=()=>navigate(`/town-building?visit=${encodeURIComponent(ownerId)}`);
 const details=<><h2>{uiText('A friend’s lake')}</h2><p>{uiText('Eggs and other treats wait on the river raft in Town.')}</p></>;
 const actions=selected&&<><LakeActionButton label="Deselect building" onClick={()=>setSelected('')}><CloseIcon/></LakeActionButton></>;
 return <TownMapLayout mapId="lake" readOnly visitingProfileId={ownerId} state={visit.state} environment={visit.environment} title={lakeDisplayName(visit.owner.name,lake.adjective)} levelIcon={<LakeStageArt stage={lake.stage}/>} busy={false} onProject={()=>{}} onToggleEdit={()=>{}} zoom={view.zoom} onZoom={()=>setView({zoom:view.zoom===1?2:1,camera:{x:0,y:0}})} onCenter={()=>setView({zoom:1,camera:{x:0,y:0}})} footprint={{x:0,y:0,disabled:true,onMove:()=>{}}}
  objects={[...lake.rafts.map(r=>({id:r.id,name:LAKE_BLUEPRINTS.find(b=>b.id===r.blueprintId)!.name})),...lake.land.entities.map(e=>({id:e.id,name:BLUEPRINTS.find(b=>b.id===e.blueprintId)!.name}))]} selectedId={selected} onSelect={setSelected} error="" info={uiText('Visiting a friend')} tip={'Look around, or follow the arrow home.'} palette={null} viewDetails={selected?details:undefined} reward={{}} receipt=""
  scene={<MapScene mapId="lake" state={visit.state} environment={visit.environment} liveClock={visit.environment} images={art.images} view={view} onViewChange={setView} onTap={(_,id)=>setSelected(id??'')} selectedId={selected} actions={actions||undefined} placement={null} onCancel={()=>setSelected('')} busy={false} editing={false} previewGrowth={false} exits={[{id:'town',label:'Follow the river back to Town',icon:<span><LakeArt index={6}/></span>,point:{x:16.5,y:-1.5},onClick:leave,className:'lake-river-return'}]}/>}/>;
}
