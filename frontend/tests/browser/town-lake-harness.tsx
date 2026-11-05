import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Route,Routes,Link} from 'react-router-dom';
import {TownMapScreen} from '../../src/features/town-building/TownMapScreen';
import {LanguageSwitcher} from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import {useFamilyStore} from '../../src/stores/familyStore';
import {useProfileStore} from '../../src/stores/profileStore';
import {initialTown,BLUEPRINTS} from '../../../server/src/town-building/game';
import {LAKE_BLUEPRINTS} from '../../../server/src/town-building/water/catalog';
import {freshPatch,advanceCropGrowth,applyGardenCommand} from '../../../server/src/town-building/garden';
import {insectCycleRoll} from '../../../server/src/town-building/gardenEffects';
import {LAKE_ISLAND} from '../../../server/src/town-building/maps/lake/terrain';
import {AnimalDepthLayer} from '../../src/features/town-building/animalDepth';
import {emptyLake,applyLakeCommand} from '../../../server/src/town-building/maps/lake/game';
import {tickMap} from '../../../server/src/town-building/mapTick';
import {playMap} from '../../../server/tests/helpers/play';
import {applyMapLandCommand} from '../../../server/src/town-building/maps/land';
import {townPayload} from '../../../server/src/town-building/presentation';
import {applyHarvestAll} from '../../../server/src/town-building/harvestAll';
import {visitScene} from '../../../server/src/town-building/visits';
import {LAKE_ACHIEVEMENTS,lakeMetrics} from '../../../server/src/town-building/maps/lake/achievements';
import type {LakeAction} from '../../../server/src/town-building/maps/lake/repository';
import type {ShopTradeCommand} from '../../../server/src/town-building/shopTypes';
import type {Environment} from '../../../server/src/town-building/environment';
import {ensurePoultry} from '../../../server/src/town-building/poultry';
import {freshCivHome} from '../../../server/src/town-building/civCatalog';
import {tickTownEvents,interactWomensDay} from '../../../server/src/town-building/events';
import {mapDefinition} from '../../../server/src/town-building/maps/registry';
import '../../src/app.css';

// Node-served test entry only; never imported by production routes. No real DB.
useFamilyStore.setState({familyId:'lake-fixture',sessionGeneration:1,isInitializing:false});
useProfileStore.setState({activeProfileId:'lake-child'});
let now=1000,state=initialTown();state.maps={lake:emptyLake(now)};state.learnedIds=Array.from({length:100},(_,i)=>`fixture-${i}`);
for(const key of Object.keys(state.materials))state.materials[key as keyof typeof state.materials]=500;
// Wool is a stored animal-product item, not a material: give the fixture player plenty so wool-cost builds work.
state.storage={...(state.storage??{built:false,crops:{},milk:[],fish:{}}),wool:500};
state.storage.yarn=500;state.storage.milk=[{count:500,at:now}];
const catches={P1:10,P3:10,P4:10,P5:10,R4:10};
const fixture=new URLSearchParams(location.search);
// A floating garden on the owner's Town river, for visitor-scene coverage.
if(fixture.has('town-river'))state.rafts=[{id:'town-garden',blueprintId:'floating-garden',x:15,y:16,paidCost:{wood:12},generation:0,fish:[],plant:'water-spinach',plantGrowth:300,feeder:false}];
if(fixture.has('overview-many')){
    state.entities=[];
    state.rafts=[];
    const add=(blueprintId:string,id:string,x:number)=>state.entities.push({id,blueprintId,x,y:1,paidCost:{}});
    ['house','farmhouse','coop','animal-habitat','large-house','infirmary','school','town-hall','library','grocery'].forEach((id,index)=>add(id,`overview-${id}`,index));
    add('vegetable-patch','overview-patch',4);
    ['dirt-road','rocky-road','dirt-road','rocky-road','dirt-road'].forEach((id,index)=>add(id,`overview-road-${index}`,index));
    ['wood-bridge','stone-bridge','wood-bridge'].forEach((id,index)=>add(id,`overview-bridge-${index}`,index));
    state.rafts.push({id:'overview-floating-garden',blueprintId:'floating-garden',x:15,y:16,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false});
}
state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:8,y:fixture.get('fish')==='small'?7:12},now,'nursery',catches);
state=applyLakeCommand(state,{type:'stock',raftId:'nursery',species:fixture.get('fish')==='small'?'P1':'P3'},now,'fish',catches);
state=applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-garden',x:12,y:fixture.get('garden')==='deep'?15:7},now,'garden',catches);
state=applyLakeCommand(state,{type:'plant',raftId:'garden',plant:'water-spinach'},now,'plant',catches);
state=applyLakeCommand(state,{type:'build-raft',blueprintId:'insect-raiser',x:8,y:6},now,'insects',catches);
state.maps!.lake!.harvested=96;
for(const fish of state.maps!.lake!.rafts[0]!.fish)fish.growth=300;
if(fixture.get('harvest')==='partial')state.maps!.lake!.rafts[0]!.fish[0]!.growth=0;
Object.assign(window,{__lakeIsland:LAKE_ISLAND});
state.maps!.lake!.land.entities.push({id:'lake-house',blueprintId:'house',x:2,y:1,paidCost:{wood:9,stamina:7,rock:5},mapId:'lake',pets:['golden-retriever']});
const environment:Environment={season:'spring',precipitation:'none',snowCover:false,localDate:'2026-10-24',timeZone:'Asia/Ho_Chi_Minh',localTime:'09:00',timeOfDay:'morning',weatherSource:'live',temperatureC:fixture.has('no-temperature')?null:32,observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Fixture lake'};
if(fixture.get('garden')==='ripe')state.maps!.lake!.rafts.find(r=>r.blueprintId==='floating-garden')!.plantGrowth=300;
if(fixture.get('season')==='autumn')environment.season='autumn';
if(fixture.get('weather')==='rain')environment.precipitation='rain';
if(fixture.get('weather')==='snow'){environment.precipitation='snow';environment.snowCover=true;environment.season='winter';}
if(fixture.get('time')==='night'){environment.timeOfDay='night';environment.localTime='22:00';}
if(fixture.get('weather')==='unavailable'){environment.weatherSource='unavailable';environment.timeOfDay=null;environment.localTime=null;}
if(fixture.get('weather')==='stale')environment.weatherSource='stale';
if(fixture.has('poultry')){
    state.maps!.lake!.harvested=100;
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'friendly',x:10,y:7},now,'friendly',catches);
    state.maps!.lake!.land.entities.push({id:'chickens',blueprintId:'coop',animal:'chicken',mapId:'lake',x:6,y:3,paidCost:{}},{id:'ducks',blueprintId:'coop',animal:'duck',mapId:'lake',x:12,y:3,paidCost:{}});
    now=Date.now();state=ensurePoultry(state,now);state.maps!.lake!.land.entities.find(e=>e.id==='chickens')!.poultry!.eggs=2;
    state.maps!.lake!.land.entities.find(e=>e.id==='chickens')!.poultry!.rate=2;
    for(const fish of state.maps!.lake!.rafts[0]!.fish)fish.growth=0;
}
if(fixture.has('bridges')){
    // A wooden U-turn dock off the west shore, and a stone deck carrying an insect nest (W W W / B N B / B B B).
    const land=state.maps!.lake!.land.entities;
    for(const [x,y] of [[3,7],[3,8],[4,8],[5,8],[5,7]] as const)land.push({id:`dock-${x}-${y}`,blueprintId:'wood-bridge',x,y,paidCost:{}});
    for(const [x,y] of [[12,7],[12,8],[12,9],[13,7],[13,8],[13,9]] as const)land.push({id:`deck-${x}-${y}`,blueprintId:'stone-bridge',x,y,paidCost:{}});
    state.maps!.lake!.rafts.push({id:'nest',blueprintId:'insect-raiser',x:12,y:8,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false});
}
if(fixture.has('entities')){
    // The same entity definitions exercise both production scene adapters.
    state.entities=state.entities.filter(e=>e.id!=='starter-home');
    for(const mapId of ['town','lake'] as const){
        const entities=mapId==='town'?state.entities:state.maps!.lake!.land.entities;
        entities.push({id:`${mapId}-coop`,blueprintId:'coop',animal:'chicken',mapId,x:6,y:3,paidCost:{}},
            {id:`${mapId}-farm`,blueprintId:'farmhouse',animal:'pig',mapId,x:9,y:1,paidCost:{}},
            {id:`${mapId}-haven`,blueprintId:'animal-habitat',animal:'rabbit',mapId,x:0,y:mapId==='town'?10:3,paidCost:{}},
            {id:`${mapId}-shop`,blueprintId:'grocery',mapId,x:18,y:1,paidCost:{},civ:{...freshCivHome(),phase:'ready'}});
    }
    now=Date.now();state=ensurePoultry(state,now);
    for(const entity of [...state.entities,...state.maps!.lake!.land.entities])if(entity.poultry)entity.poultry.eggs=2;
}
if(fixture.has('shop-trade')){
    state.entities.push({id:'town-vegetable-shop',blueprintId:'vegetable-shop',x:18,y:1,paidCost:{},civ:{...freshCivHome(),phase:'ready'}});
    state.maps!.lake!.land.entities.push({id:'lake-vegetable-shop',blueprintId:'vegetable-shop',x:18,y:1,paidCost:{},mapId:'lake',civ:{...freshCivHome(),phase:'ready'}});
}
if(fixture.has('harvest-all')){
    const townPatch={id:'harvest-town-patch',blueprintId:'vegetable-patch',x:8,y:15,paidCost:{},garden:freshPatch('spring')};
    advanceCropGrowth(townPatch,300,'spring',environment.localDate,false);
    state.entities.push(townPatch,{id:'harvest-town-coop',blueprintId:'coop',animal:'chicken',x:6,y:3,paidCost:{}});
    const lakePatch={id:'harvest-lake-patch',blueprintId:'vegetable-patch',mapId:'lake' as const,x:6,y:15,paidCost:{},garden:freshPatch('spring')};
    advanceCropGrowth(lakePatch,300,'spring',environment.localDate,false);
    state.maps!.lake!.land.entities.push(lakePatch,{id:'harvest-lake-coop',blueprintId:'coop',animal:'chicken',mapId:'lake',x:6,y:3,paidCost:{}});
    now=Date.now();state=ensurePoultry(state,now);
    for(const entity of [...state.entities,...state.maps!.lake!.land.entities])if(entity.id.includes('harvest-')&&entity.poultry)entity.poultry.eggs=2;
    const garden=state.maps!.lake!.rafts.find(raft=>raft.id==='garden');if(garden)garden.plantGrowth=300;
}
if(fixture.has('effects')){
 const id=Array.from({length:100},(_,i)=>`plot-${i}`).find(id=>insectCycleRoll(id,0)<.25)!;
 const patch={id,blueprintId:'vegetable-patch',mapId:'lake' as const,x:6,y:3,paidCost:{},garden:freshPatch('spring')};
 advanceCropGrowth(patch,240,'spring',environment.localDate,true,true);
 state.maps!.lake!.land.entities.push(patch,{id:'chicken-helper',blueprintId:'coop',mapId:'lake',animal:'chicken',x:4,y:3,paidCost:{}});
 Object.assign(window,{__gardenFixtureId:id});
}
if(fixture.has('raft-effects')){
 const raft=state.maps!.lake!.rafts.find(r=>r.id==='garden')!;
 raft.id=Array.from({length:100},(_,i)=>`raft-${i}`).find(id=>insectCycleRoll(id,0)<.25)!;
 raft.plantCycle=0;raft.plantGrowth=0;raft.duckBoosted=true;
 state=applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-insect-raiser',x:11,y:10},now,'water-insects',catches);
 state=playMap(playMap(state,'lake',1000,environment,true),'lake',301000,environment);
 Object.assign(window,{__raftGardenFixtureId:raft.id});
}
if(fixture.has('release')){
 state.maps!.lake!.harvested=100;
 state=applyLakeCommand(state,{type:'build-raft',blueprintId:'friendly',x:8,y:7},now,'friendly',catches);
 state=applyLakeCommand(state,{type:'stock',raftId:'friendly',species:'P1'},now,'companions',catches);
 for(const raft of state.maps!.lake!.rafts){raft.plantGrowth=123;for(const fish of raft.fish)fish.growth=123;}
}
if(fixture.has('duck-coverage')){
 const coop=state.maps!.lake!.land.entities.find(e=>e.id==='lake-coop');
 if(coop){coop.animal='duck';coop.x=6;coop.y=5;}
}
let friendEggs=2;const takenRequests=new Set<string>();
const iconSizeRaft={unlocked:true,fishCaught:50,items:[{id:'egg-1',kind:'egg',itemId:'egg',stamina:1},{id:'fish-1',kind:'fish',itemId:'P3',stamina:2}],remainingToday:30,serverNow:Date.now(),report:{visitors:[],items:0,stamina:0},days:[]};
const friendVisit=()=>({owner:{id:'friend-child',name:'Robin',emoji:'🐱',color:'#aabbcc'},state:{...townPayload(state),maps:structuredClone(state.maps),lakeOwnerName:'Robin'},eggsAvailable:friendEggs,environment});
const nativeFetch=window.fetch.bind(window);
const commands:Array<LakeAction|import('../../../server/src/town-building/harvestTypes').HarvestAllCommand|ShopTradeCommand>=[];
Object.assign(window,{__lakeCommands:commands});
const actionFailure={message:''};Object.assign(window,{__townActionFailure:actionFailure});
let shopQuoteChanged=true;
const shopQuote=(path:string)=>{
    const url=new URL(path,location.href),crop=url.searchParams.get('crop')??'carrot',quantity=Number(url.searchParams.get('quantity')??1),mapId=path.includes('/maps/lake/')?'lake':'town';
    const unavailable=fixture.has('shop-not-affordable'),storageRoom=!fixture.has('shop-storage-full');
    return Response.json({entityId:url.searchParams.get('entityId')??`${mapId}-vegetable-shop`,crop,quantity,revision:state.revision,inSeason:crop==='carrot'&&!fixture.has('shop-out-of-season'),units:4*quantity,payment:unavailable?[]:[{item:'wool',amount:1},{item:'yarn',amount:1},{item:'milk',amount:1},{item:'P1',amount:1}],affordable:!unavailable,storageRoom,confirmation:'a'.repeat(64)});
};
const shopTrade=(path:string,body:any)=>{
    const mapId=path.includes('/maps/lake/')?'lake':'town',command=body.command as ShopTradeCommand;
    if(fixture.get('shop-action-error')==='quote'&&shopQuoteChanged){shopQuoteChanged=false;return Response.json({error:{code:'SHOP_QUOTE_CHANGED',message:'The shop updated its offer.'}},{status:409});}
    const actionError=fixture.get('shop-action-error');
    if(actionError==='affordable')return Response.json({error:{code:'SHOP_NOT_AFFORDABLE',message:'Not enough animal products yet'}},{status:409});
    if(actionError==='storage')return Response.json({error:{code:'SHOP_STORAGE_FULL',message:'Storage is full for this vegetable'}},{status:409});
    if(actionError==='stale')return Response.json({error:{code:'TOWN_STALE',message:'Your town changed. Sync and try again.'}},{status:409});
    if(body.revision!==state.revision)return Response.json({error:{code:'TOWN_STALE',message:'Your town changed. Sync and try again.'}},{status:409});
    state.revision++;
    const receipt={id:`shop:${mapId}:${command.crop}:${state.revision}`,revision:state.revision,mapId,crop:command.crop,amount:command.quantity,spent:[{item:'wool',amount:1},{item:'yarn',amount:1}],reward:{crop:command.crop,amount:command.quantity},duplicate:false};
    return Response.json({...townPayload(state,mapId),...(mapId==='lake'?{lakeOwnerName:fixture.get('kid')??'Mika'}:{}),shopReceipt:receipt});
};
Object.assign(window,{__lakeFixtureState:()=>state});
Object.assign(window,{__lakeFixtureObjects:()=>{const entities=document.querySelector('.town-map-screen')?.getAttribute('data-map')==='town'?state.entities:[...state.maps!.lake!.rafts,...state.maps!.lake!.land.entities];return entities.map(e=>{const b=[...LAKE_BLUEPRINTS,...BLUEPRINTS].find(b=>b.id===e.blueprintId)!;return{id:e.id,name:b.name,x:e.x,y:e.y,width:b.width,length:b.length};});}});
Object.assign(window,{__verifyAnimalDepth:async()=>{const source=document.createElement('canvas');source.width=source.height=20;const paint=source.getContext('2d')!;paint.fillStyle='blue';paint.fillRect(10,0,10,20);const image=new Image();image.src=source.toDataURL();await image.decode();const result=[];for(const depth of [0,30]){const c=document.createElement('canvas');c.width=c.height=40;const ctx=c.getContext('2d')!;ctx.drawImage(image,10,10);new AnimalDepthLayer().draw(ctx,depth,{x:10,y:10,width:20,height:20},[{depth:20,image,crop:[0,0,20,20],x:10,y:10,width:20,height:20}],work=>{work.fillStyle='red';work.fillRect(10,10,20,20);});result.push([Array.from(ctx.getImageData(15,15,1,1).data),Array.from(ctx.getImageData(25,15,1,1).data)]);}return result;}});
// Real alpha compositing: an opaque blue post, transparent gutters, and a red
// animal. Presentation ownership must distinguish passersby from indoor animals.
Object.assign(window,{__verifySignpostDepth:async()=>{
 const source=document.createElement('canvas');source.width=source.height=20;
 const paint=source.getContext('2d')!;paint.fillStyle='blue';paint.fillRect(10,0,10,20);
 const post=new Image();post.src=source.toDataURL();await post.decode();
 paint.fillStyle='white';paint.fillRect(0,0,20,20);const mask=new Image();mask.src=source.toDataURL();await mask.decode();
 const results=[];
 for(const ratio of [1,2])for(const inside of [null,'home','other-home']){
  const c=document.createElement('canvas');c.width=c.height=40*ratio;const ctx=c.getContext('2d')!;ctx.scale(ratio,ratio);ctx.drawImage(post,10,10);
  const board={depth:20,image:post,crop:[0,0,20,20],x:10,y:10,width:20,height:20,ownerId:'home',interiorOnly:true};
  const clip=inside?{...board,image:mask,depth:19,ownerId:inside,interiorOnly:false}:undefined;
  new AnimalDepthLayer().draw(ctx,19,{x:10,y:10,width:20,height:20},[board],work=>{work.fillStyle='red';work.fillRect(10,10,20,20);},ratio,clip);
  const pixel=(x:number)=>Array.from(ctx.getImageData(x*ratio,15*ratio,1,1).data);
  results.push({ratio,inside,gutter:pixel(15),post:pixel(25)});
 }
 return results;
}});
window.fetch=async (input,options)=>{
    const path=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    if(!path.startsWith('/api/'))return nativeFetch(input,options);
    const body=options?.body?JSON.parse(String(options.body)):null;
    if(actionFailure.message&&path.endsWith('/action'))return Response.json({error:{code:'TOWN_STALE',message:actionFailure.message}},{status:409});
    if(fixture.has('poultry'))now=Date.now();
    try {
        const friend={id:'friend-child',name:'Robin',emoji:'🐱',color:'#aabbcc',avatar_type:'emoji',avatar_url:null,avatar_frame:null};
        if(path.includes('/town/friends?'))return Response.json({towns:[{profile:friend,townName:{adjective:'Sunny',noun:'Meadow'},prosperityStage:0,lakeStage:state.maps!.lake!.stage}],nextOffset:null});
        if(path.endsWith('/town/friends/friend-child'))return Response.json({profile:friend,townName:{adjective:'Sunny',noun:'Meadow'},prosperityStage:0,lakeStage:state.maps!.lake!.stage,...visitScene(state),environment});
        if(path.endsWith('/maps/lake/friends'))return Response.json([{id:'friend-child',name:'Robin',emoji:'🐱',color:'#aabbcc'}]);
        if(path.endsWith('/visits/friend-child'))return Response.json(friendVisit());
        if(path.endsWith('/visits/friend-child/take-egg')){
            if(takenRequests.has(body.requestId))return Response.json(friendVisit());
            if(!friendEggs)return Response.json({error:{code:'EGGS_EMPTY',message:'Your friend has no takeaway eggs right now.'}},{status:409});
            friendEggs--;state.materials.stamina++;state.revision++;takenRequests.add(body.requestId);return Response.json({...friendVisit(),receipt:body.requestId,reward:{stamina:1}});
        }
        if(fixture.has('icon-size')&&(path.endsWith('/raft')||path.endsWith('/river/arrive')))return Response.json({...iconSizeRaft,serverNow:Date.now(),hasNew:false});
        if(path.includes('/shop/quote'))return shopQuote(path);
        if(path.endsWith('/development'))return Response.json({town:(await import('../../../server/src/town-building/development')).townDevelopmentProject(state),lake:(await import('../../../server/src/town-building/development')).lakeDevelopmentProject(state)});
        if(path.endsWith('/environment'))return Response.json(environment);
        if(path.endsWith('/achievement-groups'))return Response.json([{id:'town-lake',name:'Lake Friends',earning:'server-verified',recorded:true,metrics:[],scope:'lifetime',achievements:LAKE_ACHIEVEMENTS.map((badge,badgeIndex)=>({...badge,badge:'/minigames/town-building/lake/achievement-badges-v1.png',badgeIndex,badgeColumns:4,badgeRows:3,current:lakeMetrics(state.maps!.lake)[badge.metric]??0,earned:!!state.maps!.lake!.earned[badge.id],earned_at:state.maps!.lake!.earned[badge.id]??null}))}]);
        if(path.endsWith('/maps/lake/action')) {
            if(body.command?.type==='shop-trade')return shopTrade(path,body);
            if(body.command?.type==='harvest-all'){
                if(fixture.has('harvest-delay'))await new Promise(resolve=>setTimeout(resolve,500));
                const outcome=applyHarvestAll(state,body.revision,body.command,now,environment);
                state=outcome.state;
                return Response.json({...townPayload(state,body.command.mapId),...(body.command.mapId==='lake'?{lakeOwnerName:fixture.get('kid')??'Mika'}:{}),harvestReceipt:outcome.receipt});
            }
            if(fixture.get('harvest')==='error'&&body.command.type==='harvest-fish')return Response.json({error:{code:'TOWN_STALE',message:'Your town changed. Sync and try again.'}},{status:409});
            if(body.revision!==state.revision)return Response.json({error:{code:'TOWN_STALE',message:'Your town changed. Sync and try again.'}},{status:409});
            const command=body.command as LakeAction;
            commands.push(command);
            if(fixture.has('poultry')&&state.maps!.lake!.land.gardening?.lastTick)state=tickMap(state,'lake',now,environment);
            state=command.type==='land-action'||command.type==='transfer-building'?applyMapLandCommand(state,command,now,crypto.randomUUID(),environment):applyLakeCommand(state,command,now,crypto.randomUUID(),catches,environment);
        } else if(path.endsWith('/maps/lake/tick')) {if(!fixture.has('poultry'))now+=5000;state=tickMap(state,'lake',now,environment,body.resume);}
        else if(path.endsWith('/maps/lake/pause')&&state.maps!.lake!.land.gardening?.lastTick){state.maps!.lake!.land.gardening.lastTick=0;state.revision++;}
        else if(path.endsWith('/town/action')){
            if(body.command?.type==='shop-trade')return shopTrade(path,body);
            if(body.command?.type==='harvest-all'){
                if(fixture.has('harvest-delay'))await new Promise(resolve=>setTimeout(resolve,500));
                const outcome=applyHarvestAll(state,body.revision,body.command,now,environment);
                state=outcome.state;
                return Response.json({...townPayload(state,'town'),harvestReceipt:outcome.receipt});
            }
            state=applyGardenCommand(state,'town',body.command,crypto.randomUUID(),now,environment.timeOfDay?environment.season:null,environment.localDate);
        }
        return Response.json({...townPayload(state,path.includes('/maps/lake')?'lake':'town'),...(path.includes('/maps/lake')?{lakeOwnerName:fixture.get('kid')??'Mika'}:{})});
    }catch(error){return Response.json({error:{code:'LAKE_ACTION',message:error instanceof Error?error.message:'Fixture error'}},{status:409});}
};
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
if(fixture.has('celebration')){
    Object.assign(environment,{localDate:'2026-10-20',season:'autumn',localTime:'10:00',timeOfDay:'noon'});
    tickTownEvents(state,mapDefinition('town'),environment,0,300);
    interactWomensDay(state,environment,{type:'dismiss-intro'});
}
if(fixture.has('boost'))state.entities.push({id:'boosted-plot',blueprintId:'vegetable-patch',x:8,y:15,paidCost:{},garden:{...freshPatch('spring'),boost:300}});
if(fixture.has('shortages')){for(const key of Object.keys(state.materials))state.materials[key as keyof typeof state.materials]=0;if(state.storage)state.storage.wool=0;state.learnedIds=[];}
const start=fixture.has('visit')?'/town-building?visit=friend-child':fixture.get('town')?'/town-building':'/town-building/lake';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[start]}><LanguageSwitcher/><Routes><Route path="/town-building/*" element={<TownMapScreen/>}/><Route path="*" element={<Link to="/town-building/lake">Return to lake</Link>}/></Routes></MemoryRouter></QueryClientProvider>);
