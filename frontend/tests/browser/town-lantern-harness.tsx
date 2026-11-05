import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {TownMapHost} from '../../src/features/town-building/TownMapLayout';
import {MapWorkspace,type MapAction} from '../../src/features/town-building/scene/MapWorkspace';
import {useTownArtwork} from '../../src/features/town-building/useTownArtwork';
import {BLUEPRINTS,TOWN_BADGES,emptyTown} from '../../../server/src/town-building/game';
import {emptyLake} from '../../../server/src/town-building/maps/lake/game';
import {applyMapLandCommand} from '../../../server/src/town-building/maps/land';
import {tickMap} from '../../../server/src/town-building/mapTick';
import type {TownResponse} from '../../src/api/town';
import type {Environment} from '../../../server/src/town-building/environment';
import {bootstrapUiLanguage} from './ui-language-bootstrap';
import '../../src/app.css';
await bootstrapUiLanguage();
const env:Environment={season:'autumn',localDate:'2026-10-30',localTime:'10:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,cloudCover:0,weatherSource:'unavailable',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
const key='lantern-verification-state';
function fresh():TownResponse{const state=emptyTown();state.maps={lake:emptyLake(1000)};state.materials.wood=20;state.storage={built:false,crops:{pumpkin:6},milk:[],fish:{}};state.entities.push({id:'deck',blueprintId:'wood-bridge',x:16,y:12,paidCost:{wood:2}});return {...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES};}
function Harness(){
 const [state,setState]=useState<TownResponse>(()=>JSON.parse(sessionStorage.getItem(key)??'null')??fresh()),[mapId,setMap]=useState<'town'|'lake'>('town'),[environment,setEnvironment]=useState(env),[error,setError]=useState('');
 const art=useTownArtwork(state.entities,0,true);
 const save=(next:TownResponse)=>{setState(next);sessionStorage.setItem(key,JSON.stringify(next));return next;};
 Object.assign(window,{lanternTest:{state,reset:()=>save(fresh()),map:(id:'town'|'lake')=>setMap(id),night:(dark:boolean)=>setEnvironment(previous=>({...previous,isDay:!dark,timeOfDay:dark?'night':'noon',localTime:dark?'21:00':'12:00'})),date:(date:string)=>{const weather={...environment,localDate:date};setEnvironment(weather);let next=state;for(const id of ['town','lake'] as const)next={...tickMap(next,id,Date.now(),weather,true),blueprints:BLUEPRINTS,badges:TOWN_BADGES};save(next);}}});
 async function send(action:MapAction){try{if(action.type!=='land-action'&&action.type!=='transfer-building')throw new Error('Only construction is enabled in this fixture.');const next={...applyMapLandCommand(state,action,Date.now(),`fixture-${state.revision}`,environment),blueprints:BLUEPRINTS,badges:TOWN_BADGES};setError('');return save(next);}catch(e){setError(e instanceof Error?e.message:'Build failed');return null;}}
 return <TownMapHost profileId="lantern-fixture"><MapWorkspace mapId={mapId} viewKey="lantern-fixture" state={state} environment={environment} liveEnvironment={environment} images={art.images} busy={false} error={error} paused={true} send={send} onPause={()=>{}} onResume={()=>{}} chrome={{title:mapId==='town'?'Lantern Town':'Lantern Lake',levelIcon:'',onProject:()=>{},empty:{title:'Pick a building',text:'Choose a blueprint when you are ready to build.'}}}/></TownMapHost>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><Harness/></MemoryRouter></QueryClientProvider>);
