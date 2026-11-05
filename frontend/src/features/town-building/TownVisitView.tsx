import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {KidBackButton} from '../../components/KidBackButton';
import {fetchFriendTown} from '../../api/townVisits';
import {familyQueryKey,familyScopedQuery} from '../../lib/familyQueries';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText,uiMessage} from '../../i18n/uiText';
import {townDisplayName} from '../../../../server/src/town-building/game';
import {MapScene} from './scene/MapScene';
import {emptyTown} from '../../../../server/src/town-building/game';
import {useMapArtwork} from './scene/useMapArtwork';
import {TownFriendsButton,TownLevel} from './TownFriends';
import type {TownView} from './townViewport';
import {useTownRiver} from './useTownRiver';
import {TownRiverObjects,TownRiverButtons} from './TownRiver';
import {TownRewardBar} from './TownRewardBar';
import {LakeArt} from './maps/lake/LakeArt';
import './town.css';
import './townVisits.css';
import {useActiveTownPage} from './useTownEnvironment';
import {TownWeatherAttribution} from './TownWeatherAttribution';
import {TownFullscreenButton} from './TownRelaxingView';
export function TownVisitView({viewerId,family,friendId}:{viewerId:string;family:string|null;friendId:string}) {
  useUiLanguage();
  const navigate=useNavigate();
  const active=useActiveTownPage();
  const query=useQuery({queryKey:familyQueryKey('town-visit',family,viewerId,friendId),queryFn:familyScopedQuery(family,()=>fetchFriendTown(viewerId,friendId)),enabled:active,retry:false,gcTime:0,staleTime:0,refetchInterval:30000,refetchIntervalInBackground:false});
  const town=query.isError?undefined:query.data;
  const art=useMapArtwork(town?.entities??[],town?.prosperityStage??0,!!town,!!town?.rafts?.length);
  const river=useTownRiver(viewerId,family,friendId,!!town&&art.ready);
  const [view,setView]=useState<TownView>({zoom:1,camera:{x:0,y:0}});
  const failed=query.isError||art.error;
  // A visit shows the friend's public town through the same scene as the owner's.
  const visited=town?{...emptyTown(),entities:town.entities,...(town.droppings?{droppings:town.droppings}:{}),...(town.bushes?{bushes:town.bushes}:{}),rafts:town.rafts??[],civ:{activeMs:town.civActiveMs,lastTick:0,helpedTypes:[]}}:undefined;
  return <main className="town-page town-visit-page">
    <header className="town-header kid-nav town-visit-nav">
      <TownFullscreenButton disabled={!town||!art.ready}/>
      <div className="town-header-actions"><KidBackButton/><TownFriendsButton viewerId={viewerId} family={family} currentTownId={friendId}/></div>
      <div className="town-header-brand">{town?<div className="town-visit-heading"><strong className="town-visit-owner" title={town.profile.name}>{town.profile.name}</strong><span aria-hidden="true">·</span><h1 title={townDisplayName(town)}>{townDisplayName(town)}</h1><TownLevel stage={town.prosperityStage}/></div>:<h1>{uiText('Visiting a friend')}</h1>}</div>
      <TownRewardBar {...river.rewardReceipt} source=".town-scene"/>
    </header>
    {!town||!visited||!art.ready?<section className="town-visit-loading" aria-busy={!failed}><h2>{uiText(failed?'This friend’s town is not available.':'Getting the town ready…')}</h2><p role={failed?'alert':'status'}>{uiText(failed?'Your friendship may have changed. Choose another town or go back to yours.':'A little moment, and your town will be ready.')}</p>{failed&&<button type="button" onClick={()=>{art.retry();void query.refetch();}}>{uiText('Try again')}</button>}</section>:<>
      <p className="town-visit-note">{uiMessage('You are visiting {name}’s town. Look around and enjoy!',{name:town.profile.name})}</p>
      <section className="town-play town-visit-play" aria-label={uiText('Friend’s town')}>
        <div className="town-scene"><MapScene mapId="town" state={visited} environment={town.environment} liveClock={town.environment} images={art.images} view={view} onViewChange={setView}
          editing={false} interactionBlocked selectedId="" placement={null} onTap={()=>{}} onCancel={()=>{}} previewGrowth={false} prosperityStage={town.prosperityStage}
          {...(town.lakeStage!=null?{exits:[{id:'lake',label:uiMessage('Visit {name}’s lake',{name:town.profile.name}),icon:<LakeArt index={6}/>,point:{x:16.5,y:41.5},disabled:false,onClick:()=>navigate(`/town-building/lake/visit/${encodeURIComponent(friendId)}`)}]}:{})}
          overlays={canvas=><TownRiverObjects canvas={canvas} river={river} zoom={view.zoom} camera={view.camera} blocked={false}/>}
        /></div>
        <div className="town-map-controls"><TownRiverButtons river={river}/><button type="button" onClick={()=>setView({zoom:view.zoom===1?2:1,camera:{x:0,y:0}})}>{uiText(view.zoom===1?'Zoom in':'Overview')}</button><button type="button" onClick={()=>setView({zoom:1,camera:{x:0,y:0}})}>{uiText('Center map')}</button><span>{uiText('Drag or pinch to look around.')}</span></div>
        <TownWeatherAttribution environment={town.environment}/>
      </section>
    </>}
  </main>;
}
