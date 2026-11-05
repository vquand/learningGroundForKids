import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from 'react';
import {reportArtDensity} from '../townArtStore';
import type {TownState,Blueprint} from '../../../../../server/src/town-building/game';
import {BLUEPRINTS,entityFootprint,isBridge,isRoadLike,isSnowSculpture,type Direction} from '../../../../../server/src/town-building/game';
import {FloatingHeart} from '../../../components/emotes/HeartEmote';
import type {Environment} from '../../../../../server/src/town-building/environment';
import type {MapId} from '../../../../../server/src/town-building/maps/types';
import {mapDefinition} from '../../../../../server/src/town-building/maps/registry';
import {landView} from '../../../../../server/src/town-building/maps/view';
import type {LakeRaft} from '../../../../../server/src/town-building/water/types';
import {LAKE_BLUEPRINTS} from '../../../../../server/src/town-building/water/catalog';
import {feedingSources} from '../../../../../server/src/town-building/water/behavior';
import {plantRaftInsectCovered} from '../../../../../server/src/town-building/water/plantEffects';
import {gardenAreaEffects,gardenInsectSources} from '../../../../../server/src/town-building/gardenEffects';
import {advanceCropGrowth} from '../../../../../server/src/town-building/garden';
import {halloweenDark,halloweenWorkAllowed,isHalloweenNight} from '../../../../../server/src/town-building/halloweenCalendar';
import {useUiLanguage} from '../../../hooks/useUiLanguage';
import {uiText} from '../../../i18n/uiText';
import {AnimalWorld} from '../sharedAnimalWorld';
import type {AnimalResident} from '../animalWorld';
import {drawAnimalResidents} from '../animalRender';
import {AnimalDepthLayer} from '../animalDepth';
import {clipUnderBridges,drawTownBuilding,drawBuildingContents} from '../buildingRender';
import {shelteredHostIds} from '../shelterInterior';
import {drawFarmGates} from '../farmGateArt';
import {AnimalMoments} from '../animalMoments';
import {DevInfoLayer,devInfoOn,DEV_INFO_ENABLED,type DevInfoItem} from '../devInfo';
import {useProfileStore} from '../../../stores/profileStore';
import {drawMomentGround,drawMomentOverlay,drawServerHabits} from '../momentRender';
import {TownStatusLayer,type TownStatusHandle} from '../TownStatusLayer';
import {TownTimedEventLayers} from '../TownTimedEventLayers';
import {fitTiles,gestureTownView,panTownView,zoomTownView,type TownView,type TownPoint} from '../townViewport';
import {createCivWorld,type CivWorld} from '../civWorld';
import {drawCivWorld} from '../civRender';
import {CLOUD_SHADES} from '../directionalAtlas';
import {cloudShadows} from '../cloudShadows';
import {sceneLighting} from '../sceneLighting';
import {drawHalloweenGhosts,type GhostMotion} from '../halloweenRender';
import {HalloweenPreviewWorld} from '../halloweenWorld';
import {HalloweenGroundLayers,type TownOccluder} from '../halloweenDepth';
import {ghostsMayVisit} from '../halloween';
import {PET_ATLASES} from '../petAtlas';
import {wildlifePoses} from '../ambientWildlife';
import {roadLine,type RoadTile} from '../roadGlide';
import {foregroundVegetation} from '../terrainStyle';
import {WORLD_COLUMNS,WORLD_ROWS,townSceneGeometry} from '../forestWorld';
import {drawCoverageArea} from '../coverage';
import {advanceFishAnimation} from '../maps/lake/fishAnimation';
import {LakeReleaseClock,type LakeRelease} from '../maps/lake/releaseAnimation';
import {DuckFlocks} from './duckFlocks';
import {drawWaterLayer,drawWaterReleases} from './waterLayer';
import {drawPlacementPreview,type ScenePlacement} from './placementPreview';
export type {ScenePlacement} from './placementPreview';
import {drawPrecipitation} from './weather';
import {selectionCoverage} from './coverageLayer';
import {MAP_TERRAIN,type SceneGeometry} from './mapTerrain';
import {useTownRelaxing} from '../TownRelaxingView';

const NO_RAFTS:LakeRaft[]=[];
export interface MapExit{id:string;label:string;icon:ReactNode;point:{x:number;y:number};onClick:()=>void;disabled?:boolean;className?:string}
/** `blueprintId` and `direction` let the scene preview a land building as it will stand once turned. */
export interface MapSceneProps {
    mapId:MapId;state:TownState;environment:Environment;liveClock?:Environment;images:Map<string,HTMLImageElement>;
    view:TownView;onViewChange:(view:TownView)=>void;
    editing:boolean;interactionBlocked?:boolean;busy?:boolean;paused?:boolean;
    selectedId:string;placement:ScenePlacement|null;actions?:ReactNode;actionsLabel?:string;
    roadDraft?:RoadTile[];draftBlueprint?:Blueprint;roadGlideEnabled?:boolean;
    onRoadPreview?:(tiles:RoadTile[])=>void;onRoadCommit?:(tiles:RoadTile[])=>void;
    /** A tap on a map tile, with the land building or water structure under it. */
    onTap:(tile:{x:number;y:number},objectId:string|null)=>void;
    onCancel:()=>void;onConfirm?:()=>void;
    exits?:MapExit[];overlays?:ReactNode|((canvas:RefObject<HTMLCanvasElement|null>)=>ReactNode);
    release?:LakeRelease;previewGrowth?:boolean;
    halloweenPreview?:boolean;xmasPreview?:boolean;onGreetBlob?:(visitorId:string)=>void;prosperityStage?:number;
    /** A farmhouse whose animals were just fed: they show hearts. */
    fed?:{hostId:string;at:number};
    /** A pending wool collection: preserve the fleece until each sheep exits. */
    sheared?:import('../animalMoments').ShearCue;
}
function footprint(object:{blueprintId:string;x:number;y:number;direction?:Direction|undefined}){
    if(BLUEPRINTS.some(b=>b.id===object.blueprintId))return entityFootprint(object);
    const b=LAKE_BLUEPRINTS.find(b=>b.id===object.blueprintId)!;
    return {x:object.x,y:object.y,width:b.width,length:b.length};
}
const inside=(f:{x:number;y:number;width:number;length:number},x:number,y:number)=>x>=f.x&&x<f.x+f.width&&y>=f.y&&y<f.y+f.length;
/** The one scene for every map. A map only contributes its terrain (MAP_TERRAIN);
 * buildings, water structures, animals, neighbours, events, weather, coverage,
 * status stickers and controls are shared. */
export function MapScene(props:MapSceneProps) {
    const uiLanguage=useUiLanguage();
    const {mapId}=props,relaxing=useTownRelaxing(),editing=props.editing&&!relaxing;
    const view=landView(props.state,mapId),entities=view.entities,rafts=view.rafts??NO_RAFTS;
    const layout=JSON.stringify([mapId,entities.map(({garden,civ,poultry,...e})=>e),rafts.map(r=>[r.id,r.blueprintId,r.x,r.y,r.plant,r.fish[0]?.species])]);
    // Layout-stable arrays key the shared caches (areas, navigation, effects).
    const layoutEntities=useMemo(()=>entities,[layout]),layoutRafts=useMemo(()=>rafts,[layout]);
    const effects=useMemo(()=>{const insects=gardenInsectSources(layoutRafts,mapId);return new Map(layoutEntities.filter(e=>e.garden).map(e=>[e.id,gardenAreaEffects(e,layoutEntities,insects,mapId)]));},[layout]);
    const vegetation=useMemo(()=>foregroundVegetation([...layoutEntities],props.environment.season,mapId),[layout,props.environment.season]);
    const latest=useRef({props,view,entities,rafts,effects,vegetation,relaxing});
    latest.current={props,view,entities,rafts,effects,vegetation,relaxing};
    const canvas=useRef<HTMLCanvasElement>(null),root=useRef<HTMLDivElement>(null),actionsRef=useRef<HTMLDivElement>(null),statusLayer=useRef<TownStatusHandle>(null);
    const exitRefs=useRef(new Map<string,HTMLButtonElement>());
    const geometry=useRef<SceneGeometry>({tile:1,x:0,y:0,width:0,height:0});
    const animals=useRef(new AnimalWorld()),ducks=useRef(new DuckFlocks()),civ=useRef<CivWorld|undefined>(undefined),moments=useRef(new AnimalMoments());
    useEffect(()=>{if(props.fed)moments.current.feed(props.fed.hostId,animals.current.residents);},[props.fed]);
    useEffect(()=>{const s=props.sheared;if(s)moments.current.shear(s.hostId,s.stock,animals.current.residents,s.onComplete,matchMedia('(prefers-reduced-motion: reduce)').matches);},[props.sheared?.at]);
    useEffect(()=>{const s=props.sheared;if(s?.finish)moments.current.finishShear(s.hostId);if(s?.settled)moments.current.resolveShear(s.hostId);},[props.sheared]);
    // Dev-only ID labels (VITE_DEV_MODE): tap one to copy profile, item and environment for a bug report.
    const [npcHearts,setNpcHearts]=useState<{id:string;x:number;y:number;key:number}[]>([]);
    const heartTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
    useEffect(()=>{return()=>{if(heartTimer.current)clearTimeout(heartTimer.current);};},[]);
    const profileId=useProfileStore(s=>s.activeProfileId)??'',devHost=useRef<HTMLDivElement>(null),devLayer=useRef<DevInfoLayer|null>(null);
    const devContext=useRef({profileId,env:{} as unknown});devContext.current.profileId=profileId;
    useEffect(()=>{if(!DEV_INFO_ENABLED||!devHost.current)return;const layer=new DevInfoLayer(devHost.current,()=>devContext.current);devLayer.current=layer;return()=>{layer.clear();devLayer.current=null;};},[]);
    const halloweenDemo=useRef<{world:HalloweenPreviewWorld;seconds:number}|null>(null);
    useLayoutEffect(()=>{if(!props.halloweenPreview)halloweenDemo.current=null;},[props.halloweenPreview]);
    useEffect(()=>{
        const {entities,rafts}=latest.current;
        animals.current.sync(entities,{mapId,rafts});ducks.current.sync({mapId,entities,rafts},animals.current.residents);
        civ.current=createCivWorld(entities,mapDefinition(mapId),civ.current,props.prosperityStage??0);
    },[layout,props.prosperityStage]);
    const gateMovers=useRef<{x:number;y:number}[]>([]);
    const received=useRef({clock:view.gardening?.activeSeconds??0,civ:view.civ?.activeMs??0,halloween:view.halloween,at:performance.now()});
    useLayoutEffect(()=>{received.current={clock:view.gardening?.activeSeconds??0,civ:view.civ?.activeMs??0,halloween:view.halloween,at:performance.now()};},[view.gardening?.activeSeconds,view.civ?.activeMs,view.halloween]);

    // Navigation and glide strokes (one finger glides while editing; two fingers always navigate).
    const gesture=useRef<{pointerId:number;tiles:RoadTile[];moved:boolean}|null>(null),suppressClick=useRef(false);
    const navigation=useRef<{points:Map<number,TownPoint>;starts:TownPoint[];startView:TownView;currentView:TownView;dragged:boolean;pinched:boolean}|null>(null);
    const pendingView=useRef<{frame:number;next:TownView|null}>({frame:0,next:null});
    const queueView=(next:TownView)=>{pendingView.current.next=next;if(!pendingView.current.frame)pendingView.current.frame=requestAnimationFrame(()=>{pendingView.current.frame=0;const value=pendingView.current.next;pendingView.current.next=null;if(value)latest.current.props.onViewChange(value);});};
    const flushView=()=>{cancelAnimationFrame(pendingView.current.frame);pendingView.current.frame=0;const value=pendingView.current.next;pendingView.current.next=null;if(value)latest.current.props.onViewChange(value);};
    const cancelStroke=()=>{if(gesture.current){gesture.current=null;latest.current.props.onRoadPreview?.([]);}};
    function endNavigation(event:{pointerId:number;currentTarget:HTMLCanvasElement},cancelled=false){
        const nav=navigation.current;if(!nav?.points.has(event.pointerId))return;
        nav.points.delete(event.pointerId);suppressClick.current||=nav.dragged||nav.pinched||cancelled;flushView();
        if(nav.points.size){nav.starts=[...nav.points.values()];nav.startView=nav.currentView;}else navigation.current=null;
        if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const pointerTile=(clientX:number,clientY:number)=>{
        const rect=canvas.current!.getBoundingClientRect(),g=geometry.current,map=mapDefinition(mapId);
        const x=Math.floor((clientY-rect.top-g.y)/g.tile),y=Math.floor((clientX-rect.left-g.x)/g.tile);
        return x>=0&&x<map.rows&&y>=0&&y<map.columns?{x,y}:null;
    };
    useLayoutEffect(()=>{
        const element=canvas.current!;
        const wheel=(event:WheelEvent)=>{
            event.preventDefault();const rect=element.getBoundingClientRect(),g=geometry.current;
            // A wheel gesture navigates in either mode; never commit a stroke started at another zoom.
            if(gesture.current){const id=gesture.current.pointerId;cancelStroke();suppressClick.current=true;if(element.hasPointerCapture(id))element.releasePointerCapture(id);}
            const start=pendingView.current.next??latest.current.props.view,scale=event.deltaMode===1?16:event.deltaMode===2?g.height:1;
            queueView(zoomTownView(start,start.zoom*Math.exp(-Math.max(-100,Math.min(100,event.deltaY*scale))*.005),{x:event.clientX-rect.left,y:event.clientY-rect.top},g.width,g.height));
        };
        element.addEventListener('wheel',wheel,{passive:false});
        return()=>{element.removeEventListener('wheel',wheel);cancelAnimationFrame(pendingView.current.frame);pendingView.current={frame:0,next:null};navigation.current=null;cancelStroke();suppressClick.current=true;};
    },[editing]);

    useEffect(()=>{
        const element=canvas.current!,host=root.current!,ctx=element.getContext('2d')!,reduced=matchMedia('(prefers-reduced-motion: reduce)');
        let frame=0,last=0,width=0,height=0,staticKey='',staticImages:Map<string,HTMLImageElement>|null=null,occluders:TownOccluder[]=[];
        const staticLayer=document.createElement('canvas'),staticContext=staticLayer.getContext('2d')!,shelteredHosts=new Set<string>();
        const fishClock={seconds:latest.current.view.gardening?.activeSeconds??0,lastTime:null as number|null};
        const animalDepth=new AnimalDepthLayer(),releases=new LakeReleaseClock(),groundLanterns=new HalloweenGroundLayers();
        const ghostMotion:GhostMotion=new Map();let ghostOpacity=0,previewBucket=-1,previewData:ReturnType<HalloweenPreviewWorld['advance']>|undefined;
        const size=()=>{
            const box=host.getBoundingClientRect();width=Math.min(box.width,box.height*WORLD_COLUMNS/WORLD_ROWS);height=width*WORLD_ROWS/WORLD_COLUMNS;
            element.style.width=`${width}px`;element.style.height=`${height}px`;
            // Keep the map toolbar on the ambient frame, including letterboxed canvases.
            host.parentElement?.style.setProperty('--town-canvas-left',`${(box.width-width)/2}px`);
            host.parentElement?.style.setProperty('--town-canvas-bottom',`${(box.height-height)/2}px`);
            host.parentElement?.style.setProperty('--town-canvas-width',`${width}px`);
            const ratio=Math.min(devicePixelRatio||1,2),pw=Math.round(width*ratio),ph=Math.round(height*ratio);
            if(element.width!==pw)element.width=pw;if(element.height!==ph)element.height=ph;staticKey='';
        };
        const observer=new ResizeObserver(size);observer.observe(host);size();
        const draw=(time:number)=>{
            frame=requestAnimationFrame(draw);
            const {props:p,view,entities,rafts,effects,vegetation,relaxing}=latest.current,env=p.environment,clock=p.liveClock??env,images=p.images,map=mapDefinition(mapId),tones=sceneLighting(env),selectedId=relaxing?'':p.selectedId;
            if(width<1||height<1)return;
            const ratio=Math.min(devicePixelRatio||1,2),scene=townSceneGeometry(width,height,p.view.zoom,p.view.camera);reportArtDensity(scene.tile*ratio);
            const g:SceneGeometry={tile:scene.tile,x:scene.offsetX,y:scene.offsetY,width,height},tile=g.tile;geometry.current=g;
            const elapsed=last?Math.max(0,(time-last)/1000):0,delta=Math.min(.05,elapsed);last=time;
            const active=!p.paused&&!document.hidden&&document.hasFocus(),still=reduced.matches||!!p.paused||document.hidden;
            statusLayer.current?.paint({...g,left:element.offsetLeft,top:element.offsetTop},time,still);
            ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
            // Static: terrain, building exteriors (with their selection outline) and foreground scenery.
            const draft=relaxing?[]:p.roadDraft??[];
            // Barns switch between closed and sheltering art only when the set of sheltered hosts changes.
            const sheltered=shelteredHostIds(animals.current.residents,entities,shelteredHosts);
            const key=[width,height,g.tile,g.x,g.y,env.season,env.snowCover,tones.join(','),editing,layout,selectedId,JSON.stringify(entities.map(e=>e.civ?.phase==='ready')),JSON.stringify(draft),[...sheltered].sort().join(',')].join('|');
            // Newly decoded artwork (a new image map) repaints the cached layer without restarting the renderer.
            if(key!==staticKey||images!==staticImages){
                staticLayer.width=element.width;staticLayer.height=element.height;staticContext.setTransform(ratio,0,0,ratio,0,0);
                const terrain=MAP_TERRAIN[mapId];occluders=[];
                terrain.background(staticContext,images,env,entities,g,editing);
                const roadTiles=new Set([...entities.filter(isRoadLike).map(e=>`${e.x}:${e.y}`),...draft.map(t=>`${t.x}:${t.y}`)]);
                const landAt=(x:number,y:number)=>x>=0&&y>=0&&x<map.rows&&y<map.columns&&map.terrainAt(x,y)==='grass';
                if(mapId==='town')roadTiles.add(`${map.entry.x}:-1`);
                for(const e of [...entities].sort((a,b)=>a.x-b.x))drawTownBuilding(staticContext,images,e,env,tile,g.x,g.y,entities,occluders,{selectedId,roadTiles,landAt,sheltered});
                terrain.foreground(staticContext,images,env.season,g);
                staticKey=key;staticImages=images;
            }
            ctx.drawImage(staticLayer,0,0,width,height);
            const shades=images.get('cloudShades');
            if(shades?.complete&&shades.naturalWidth){
                ctx.save();ctx.beginPath();ctx.rect(g.x,g.y,40*tile,20*tile);ctx.clip();ctx.globalCompositeOperation='multiply';
                for(const shadow of cloudShadows(env.cloudCover,time||performance.now(),reduced.matches)){
                    const crop=CLOUD_SHADES.rects[shadow.sprite]!,w=shadow.width*tile,h=w*crop[3]!/crop[2]!;ctx.globalAlpha=shadow.opacity;
                    ctx.drawImage(shades,crop[0]!,crop[1]!,crop[2]!,crop[3]!,g.x+shadow.y*tile-w/2,g.y+shadow.x*tile-h/2,w,h);
                }
                ctx.restore();
            }
            // Growth preview: display time beyond the last server state, never credited.
            const seconds=advanceFishAnimation(fishClock,time,still),growthElapsed=p.previewGrowth===false?0:Math.max(0,seconds-received.current.clock);
            // Fish and swimming birds pass under bridge decks.
            const bridges=entities.filter(isBridge);
            drawWaterLayer({ctx,images,g,mapId,rafts,feeding:feedingSources(rafts,mapId),environment:env,seconds,growthElapsed,selectedId,still,reduced:reduced.matches,bridges});
            const activeReleases=releases.step(p.release&&(p.release.mapId??'lake')===mapId?p.release:undefined,document.hidden?0:elapsed);
            host.dataset.releaseActive=String(activeReleases.length>0);
            drawWaterReleases(ctx,images,g,activeReleases,reduced.matches,mapId,bridges);
            // Halloween runs on every map with that map's own occurrence.
            const demo=import.meta.env.DEV&&p.halloweenPreview?(halloweenDemo.current??={world:new HalloweenPreviewWorld(entities,mapId),seconds:0}):null;
            const halloweenActive=ghostsMayVisit(env,!!demo);
            ghostOpacity=reduced.matches?(halloweenActive?1:0):Math.max(0,Math.min(1,ghostOpacity+(halloweenActive?1:-1)*delta*2));
            if(demo&&halloweenActive&&active)demo.seconds+=Math.min(elapsed,.1);
            if(demo&&Math.floor(demo.seconds*5)!==previewBucket){previewBucket=Math.floor(demo.seconds*5);previewData=demo.world.advance(demo.seconds);}
            const hp=received.current.halloween,between=hp?.working&&halloweenWorkAllowed(clock)&&active?Math.min(5,(performance.now()-received.current.at)/1000):0;
            const holiday=demo?previewData?.holiday:isHalloweenNight(env.localDate)&&hp?.year===env.localDate.slice(0,4)?hp:undefined;
            const holidaySeconds=demo?demo.seconds:(hp?.activeSeconds??0)+between,holidayGeometry={tile,offsetX:g.x,offsetY:g.y};
            const paintEntities=demo?previewData?.entities??entities:entities;
            ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
            const wildlife=images.get('wildlife'),wildAtlas=PET_ATLASES.wildlife;
            const wildSprite=(index:number,px:number,py:number,size:number,facing=1,alpha=1)=>{
                if(!wildlife?.complete||!wildlife.naturalWidth)return;
                const crop=wildAtlas.rects[index]!,scale=size/Math.max(crop[2]!,crop[3]!),w=crop[2]!*scale,h=crop[3]!*scale;
                ctx.save();ctx.globalAlpha=alpha;ctx.translate(px,py);ctx.scale(facing,1);ctx.drawImage(wildlife,crop[0]!,crop[1]!,crop[2]!,crop[3]!,-w/2,-h,w,h);ctx.restore();
            };
            const ambient=wildlifePoses(env,[...entities],time,mapId,reduced.matches);
            const wildFish=(visitor:typeof ambient[number])=>visitor.frame===10||visitor.frame===11;
            const drawWild=(visitors:typeof ambient)=>{for(const visitor of visitors)wildSprite(visitor.frame,g.x+visitor.y*tile,g.y+(visitor.x-visitor.lift)*tile,tile*visitor.size,visitor.facing,visitor.alpha);};
            const drawWildFish=(visitors:typeof ambient)=>{ctx.save();if(bridges.length)clipUnderBridges(ctx,bridges,tile,g.x,g.y);drawWild(visitors.filter(wildFish));ctx.restore();drawWild(visitors.filter(v=>!wildFish(v)));};
            drawWildFish(ambient.filter(v=>!v.airborne));
            groundLanterns.prepare(images,holiday,holidayGeometry,occluders,width,height,ratio,entities);groundLanterns.drawGround(ctx,width,height);
            for(const e of paintEntities){
                const effect=effects.get(e.id),visual=e.garden&&growthElapsed>0?{...e,garden:{...e.garden,slots:e.garden.slots.map(slot=>({...slot}))}}:e;
                if(effect&&visual!==e)advanceCropGrowth(visual,growthElapsed,clock.timeOfDay?clock.season:null,clock.localDate,effect.chicken,effect.insects);
                drawBuildingContents(ctx,images,visual,env,tile,g.x,g.y,time,reduced.matches,!relaxing);
            }
            const steered=(animal:AnimalResident)=>ducks.current.steers(animal);
            animals.current.advance(active?elapsed:0,env,reduced.matches,steered);
            ducks.current.step({mapId,entities,rafts},active?delta:0,clock,reduced.matches);
            const terrain=MAP_TERRAIN[mapId];
            // Decorative moments (babies, grazing, hide-and-seek, honks...) nudge the live residents, then dress their samples.
            const momentWorld={mapId,entities,rafts,bushes:view.bushes,weather:env,now:Date.now(),growthSeconds:growthElapsed,ghosts:halloweenActive?ghostMotion.values():undefined,
                restingDucks:new Set(ducks.current.flocks.filter(f=>!f.route.length).flatMap(f=>f.birds.map(b=>b.id)))};
            moments.current.step(animals.current.residents,momentWorld,active?delta:0,reduced.matches);
            const residents=moments.current.decorate(animals.current.sample(reduced.matches,steered),momentWorld);
            drawMomentGround(ctx,images,moments.current,g,env.season);
            drawServerHabits(ctx,images,view,g,env.season,time,reduced.matches);
            // Farm gates swing open for animals, people and vehicles passing through (people and vehicles from the last frame).
            drawFarmGates(ctx,images.get('farm-gate-v1'),entities,[...residents.map(a=>({x:a.x,y:a.y})),...moments.current.holders(),...gateMovers.current],tile,g.x,g.y);
            const hearts=drawAnimalResidents(ctx,images,residents,env,{tile,ox:g.x,oy:g.y,width,height,zoom:p.view.zoom,time:time||last,reducedMotion:reduced.matches,occluders,depth:animalDepth,vegetation,
                drawForest:(side,file)=>terrain.strip(ctx,images,env.season,g,side,file),bridges,showStatus:!relaxing});
            if(host.dataset.heartEmotes!==String(hearts))host.dataset.heartEmotes=String(hearts);
            drawWildFish(ambient.filter(v=>v.airborne));
            drawMomentOverlay(ctx,images,moments.current,g,!relaxing);
            ctx.restore();
            drawPrecipitation(ctx,env,width,height,time,reduced.matches);
            if(civ.current)civ.current.waitAt=moments.current.waitTiles(animals.current.residents);
            if(civ.current){const interpolation=reduced.matches?0:Math.min(5000,performance.now()-received.current.at),vehicles:{x:number;y:number}[]=[];drawCivWorld(ctx,images,civ.current,entities,received.current.civ+interpolation,clock,delta,interpolation,tile,g.x,g.y,reduced.matches,vehicles,!relaxing);
                gateMovers.current=[...vehicles,...civ.current.people.filter(person=>person.visible).map(person=>({x:person.x+.5,y:person.y+.5}))];}
            if(devLayer.current){
                if(devInfoOn()&&!relaxing){
                    devContext.current.env={map:mapId,shown:{season:env.season,timeOfDay:env.timeOfDay,isDay:env.isDay,precipitation:env.precipitation,snowCover:env.snowCover,localDate:env.localDate,localTime:env.localTime},
                        live:p.liveClock?{season:p.liveClock.season,timeOfDay:p.liveClock.timeOfDay,precipitation:p.liveClock.precipitation,localDate:p.liveClock.localDate,localTime:p.liveClock.localTime,timeZone:p.liveClock.timeZone}:null,editing,zoom:p.view.zoom};
                    const items:DevInfoItem[]=[];
                    for(const e of entities){const f=entityFootprint(e);items.push({id:e.id,kind:'building',label:`${e.blueprintId} · ${e.id.slice(0,8)}`,x:g.x+(f.y+f.length/2)*tile,y:g.y+(f.x-.2)*tile});}
                    for(const r of rafts)items.push({id:r.id,kind:'raft',label:`${r.blueprintId} · ${r.id.slice(0,8)}`,x:g.x+(r.y+1)*tile,y:g.y+r.x*tile});
                    for(const a of residents)items.push({id:a.id,kind:'animal',label:`${a.look??a.species} · ${a.id.split(':').slice(-2).join(':')} · ${a.mode}${a.sleeping?' zz':''} p${a.pause.toFixed(1)} →${a.path.length}`,x:g.x+a.y*tile,y:g.y+(a.x-.9)*tile});
                    for(const person of civ.current?.people??[])if(person.visible)items.push({id:person.id,kind:'person',label:`${person.art} · ${person.mode}`,x:g.x+(person.y+.5)*tile,y:g.y+(person.x-.5)*tile});
                    devLayer.current.paint(items,{left:element.offsetLeft,top:element.offsetTop});
                }else devLayer.current.clear();
            }
            ctx.save();ctx.beginPath();ctx.rect(g.x,g.y,40*tile,20*tile);ctx.clip();
            drawHalloweenGhosts(ctx,images,holiday,holidaySeconds,time||performance.now(),reduced.matches,ghostOpacity,delta,ghostMotion,holidayGeometry);
            ctx.restore();
            for(const tone of tones){ctx.fillStyle=tone;ctx.fillRect(0,0,width,height);}
            const areas=selectionCoverage(mapId,layoutEntities,layoutRafts,selectedId);
            for(const area of areas)drawCoverageArea(ctx,area.cells,g,area.tone,time,reduced.matches);
            const duckArea=areas.find(a=>a.tone==='teal');
            if(host.dataset.duckCoverage!==String(duckArea?.cells.size??0))host.dataset.duckCoverage=String(duckArea?.cells.size??0);
            if(halloweenDark(env))groundLanterns.drawGlow(ctx,width,height);
            // Every construction previews the same way: a glided stroke, or the tapped placement.
            const landAt=(x:number,y:number)=>x>=0&&y>=0&&x<map.rows&&y<map.columns&&map.terrainAt(x,y)==='grass';
            if(draft.length&&p.draftBlueprint)drawPlacementPreview(ctx,images,env,g,entities,{...draft[0]!,width:1,length:1,valid:true,blueprintId:p.draftBlueprint.id},landAt,draft);
            else if(p.placement&&!relaxing)drawPlacementPreview(ctx,images,env,g,entities,p.placement,landAt);
            const selected=entities.find(e=>e.id===selectedId);
            if(selected&&BLUEPRINTS.find(b=>b.id===selected.blueprintId)?.kind==='road'){
                ctx.save();ctx.strokeStyle='#63b777';ctx.shadowColor='#7bdb8e';ctx.shadowBlur=9;ctx.lineWidth=3;ctx.beginPath();
                ctx.roundRect(g.x+selected.y*tile,g.y+selected.x*tile,tile,tile,tile*.12);ctx.stroke();ctx.restore();
            }
            // Controls follow the camera: map exits, then building actions clear of them.
            const exits:DOMRect[]=[];
            for(const exit of p.exits??[]){
                const button=exitRefs.current.get(exit.id);if(!button)continue;
                const x=g.x+exit.point.y*tile,y=g.y+exit.point.x*tile,size=fitTiles(64,64,tile).width,half=size/2;
                button.hidden=x<0||x>width||y<0||y>height;
                button.style.width=button.style.height=button.style.minHeight=`${size}px`;
                const cx=Math.max(half,Math.min(width-half,x)),cy=Math.max(half,Math.min(height-half,y));
                button.style.left=`${element.offsetLeft+cx-half}px`;button.style.top=`${element.offsetTop+cy-half}px`;
                if(!button.hidden)exits.push(new DOMRect(cx-half-6,cy-half-12,size+12,size+20));
            }
            // Other tappable map objects (river baskets and rafts) are obstacles too, wherever they are drawn.
            if(actionsRef.current){const box=element.getBoundingClientRect();
                for(const object of host.parentElement?.querySelectorAll('.town-river-objects button,.town-map-controls button')??[]){const r=object.getBoundingClientRect();if(r.width&&r.height)exits.push(new DOMRect(r.left-box.left,r.top-box.top,r.width,r.height));}}
            const raft=rafts.find(r=>r.id===p.selectedId),construction=p.placement??null,anchor=construction??(selected?footprint(selected):raft?footprint(raft):null);
            if(actionsRef.current&&anchor){
                const actionWidth=actionsRef.current.offsetWidth||106,actionHeight=actionsRef.current.offsetHeight||50;
                const left=g.x+anchor.y*tile,top=g.y+anchor.x*tile;
                actionsRef.current.hidden=!construction&&(left+anchor.length*tile<0||left>width||top+anchor.width*tile<0||top>height);
                const centered=Math.max(4,Math.min(width-actionWidth-4,left+anchor.length*tile/2-actionWidth/2));
                const hits=(l:number,t:number)=>exits.some(exit=>l<exit.right&&l+actionWidth>exit.left&&t<exit.bottom&&t+actionHeight>exit.top);
                // Prefer below the object; slide clear of exits and river objects, then try above before giving up.
                const place=(t:number)=>{let l=centered;for(const exit of exits)if(l<exit.right&&l+actionWidth>exit.left&&t<exit.bottom&&t+actionHeight>exit.top){
                    if(exit.right+actionWidth<=width-4)l=exit.right;else if(exit.left-actionWidth>=4)l=exit.left-actionWidth;
                }return l;};
                const below=Math.max(4,Math.min(height-actionHeight-4,top+anchor.width*tile+8)),above=Math.max(4,Math.min(height-actionHeight-4,top-actionHeight-8));
                let actionTop=below,actionLeft=place(below);
                if(hits(actionLeft,actionTop)){const l=place(above);if(!hits(l,above)){actionTop=above;actionLeft=l;}}
                actionsRef.current.style.left=`${element.offsetLeft+actionLeft}px`;actionsRef.current.style.top=`${element.offsetTop+actionTop}px`;
            }
        };
        const resetTime=()=>{last=0;};document.addEventListener('visibilitychange',resetTime);window.addEventListener('focus',resetTime);window.addEventListener('blur',resetTime);
        frame=requestAnimationFrame(draw);
        return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',resetTime);window.removeEventListener('focus',resetTime);window.removeEventListener('blur',resetTime);};
    },[mapId,editing,layout]);

    const objectAt=(x:number,y:number)=>{
        const {entities,rafts}=latest.current;
        return [...rafts].reverse().find(r=>inside(footprint(r),x,y))?.id??[...entities].reverse().find(e=>inside(footprint(e),x,y))?.id??null;
    };
    const p=props,statusPlots=rafts.filter(r=>r.blueprintId==='floating-garden'&&r.plant).map(r=>({id:r.id,x:r.x,y:r.y,length:3,duck:r.duckBoosted,insectLabel:'Insects · 2 of 6 plants wither each growth cycle',insects:plantRaftInsectCovered(r,rafts,mapId)}));
    return <div ref={root} className={`lake-scene map-scene map-scene-${mapId}`} data-map-scene={mapId} data-show-status={!relaxing} data-zoom={props.view.zoom} data-camera={`${props.view.camera.x},${props.view.camera.y}`} {...(mapId==='lake'?{'data-lake-scene':''}:{})}>
      {DEV_INFO_ENABLED&&<div ref={devHost} className="town-dev-info-layer"/>}
      <TownTimedEventLayers onGreet={p.onGreetBlob} events={view.events} canvas={canvas} entities={layoutEntities} images={p.images} localDate={p.liveClock?.localDate??p.environment.localDate??''} zoom={p.view.zoom} camera={p.view.camera} blocked={editing||!!p.interactionBlocked}/>
      <canvas ref={canvas} className={`town-canvas ${editing?'is-editing':'is-viewing'}`} tabIndex={0} data-ui-language={uiLanguage}
        aria-label={uiText(relaxing?'Map. Drag or pinch to look around.':editing?'Map. Pinch or scroll to zoom. Tap a tile to place or a building to select. Arrow keys move the placement footprint.':'Map. Drag to look around, pinch or scroll to zoom. Tap a building to visit.')}
        onPointerDown={event=>{
            if(!editing||event.pointerType==='touch'){
                if(event.pointerType==='mouse'&&event.button!==0)return;
                const rect=event.currentTarget.getBoundingClientRect(),point={x:event.clientX-rect.left,y:event.clientY-rect.top};
                let nav=navigation.current;
                if(!nav){suppressClick.current=false;const start=pendingView.current.next??latest.current.props.view;nav={points:new Map(),starts:[],startView:start,currentView:start,dragged:false,pinched:false};navigation.current=nav;}
                if(nav.points.size>=2)return;
                nav.points.set(event.pointerId,point);nav.starts=[...nav.points.values()];nav.startView=nav.currentView;
                if(nav.points.size===2){nav.pinched=true;suppressClick.current=true;cancelStroke();}
                event.currentTarget.setPointerCapture(event.pointerId);
                if(!editing||nav.pinched)return;
            }
            suppressClick.current=false;
            if(gesture.current&&gesture.current.pointerId!==event.pointerId){const id=gesture.current.pointerId;cancelStroke();suppressClick.current=true;if(event.currentTarget.hasPointerCapture(id))event.currentTarget.releasePointerCapture(id);return;}
            if(!p.roadGlideEnabled||event.button!==0)return;
            const tile=pointerTile(event.clientX,event.clientY);if(!tile)return;
            gesture.current={pointerId:event.pointerId,tiles:[tile],moved:false};event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event=>{
            const nav=navigation.current;
            if(nav?.points.has(event.pointerId)){
                const rect=event.currentTarget.getBoundingClientRect();nav.points.set(event.pointerId,{x:event.clientX-rect.left,y:event.clientY-rect.top});
                if(!editing||nav.pinched){
                    const points=[...nav.points.values()];
                    nav.dragged||=nav.pinched||Math.hypot(points[0]!.x-nav.starts[0]!.x,points[0]!.y-nav.starts[0]!.y)>=6;
                    if(nav.dragged){suppressClick.current=true;const g=geometry.current;nav.currentView=gestureTownView(nav.startView,nav.starts,points,g.width,g.height);queueView(nav.currentView);}
                    return;
                }
            }
            const stroke=gesture.current;if(!stroke||stroke.pointerId!==event.pointerId)return;
            const tile=pointerTile(event.clientX,event.clientY),last=stroke.tiles.at(-1)!;
            if(!tile||tile.x===last.x&&tile.y===last.y)return;
            stroke.moved=true;stroke.tiles.push(...roadLine(last,tile));p.onRoadPreview?.(stroke.tiles);
        }}
        onPointerUp={event=>{
            if(!editing||navigation.current?.pinched){endNavigation(event);return;}
            const stroke=gesture.current;
            if(stroke?.pointerId===event.pointerId){
                gesture.current=null;
                if(!navigation.current?.points.has(event.pointerId)&&event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
                if(stroke.moved){suppressClick.current=true;p.onRoadCommit?.(stroke.tiles);}
            }
            endNavigation(event);
        }}
        onPointerCancel={event=>{endNavigation(event,true);cancelStroke();suppressClick.current=true;}}
        onLostPointerCapture={event=>{endNavigation(event,true);if(gesture.current?.pointerId===event.pointerId){cancelStroke();suppressClick.current=true;}}}
        onClick={event=>{
            if(suppressClick.current){suppressClick.current=false;return;}
            if(p.interactionBlocked||relaxing)return;
            const tile=pointerTile(event.clientX,event.clientY);if(!tile)return;
            if(moments.current.tap(tile,animals.current.residents))return;
            const objId=objectAt(tile.x,tile.y);
            const tappedSculpture=entities.find(e=>isSnowSculpture(e.blueprintId)&&(e.id===objId||inside(footprint(e),tile.x,tile.y)));
            if(tappedSculpture){
                const sx=tappedSculpture.x,sy=tappedSculpture.y;
                moments.current.sparkles.push(
                    {x:sx+.3,y:sy+.3,age:0},
                    {x:sx+.7,y:sy+.6,age:.15},
                    {x:sx+.5,y:sy+.8,age:.3}
                );
                const center={x:sx+.5,y:sy+.5};
                for(const a of animals.current.residents){
                    const dist=Math.hypot(a.x-center.x,a.y-center.y);
                    if(dist<=6){
                        a.path=[];a.pause=Math.max(a.pause,2.5);
                        const dx=center.x-a.x,dy=center.y-a.y;
                        if(Math.abs(dy)>Math.abs(dx)){a.direction='side';a.facing=dy>0?1:-1;}
                        else a.direction=dx>0?'front':'back';
                    }
                }
                const npcs=(civ.current?.people??[]).filter(person=>person.visible);
                if(npcs.length>0){
                    const g=geometry.current;
                    const now=Date.now();
                    const hearts=npcs.map(person=>({
                        id:person.id,
                        x:g.x+(person.y+.5)*g.tile-16,
                        y:g.y+(person.x-.3)*g.tile-24,
                        key:now+Math.random(),
                    }));
                    setNpcHearts(hearts);
                    if(heartTimer.current)clearTimeout(heartTimer.current);
                    heartTimer.current=setTimeout(()=>setNpcHearts([]),1800);
                }
            }
            p.onTap(tile,objId);
        }}
        onKeyDown={event=>{
            const d:Record<string,[number,number]>={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]},step=d[event.key],g=geometry.current;
            if(step&&!editing){event.preventDefault();p.onViewChange(panTownView(p.view,-step[1]*40,-step[0]*40,g.width,g.height));return;}
            if(!editing&&['+','=','-'].includes(event.key)){event.preventDefault();p.onViewChange(zoomTownView(p.view,p.view.zoom+(event.key==='-'?-.2:.2),{x:g.width/2,y:g.height/2},g.width,g.height));}
            if(event.key==='Enter'&&editing&&p.placement?.valid&&p.onConfirm){event.preventDefault();p.onConfirm();}
            if(event.key==='Escape'){event.preventDefault();p.onCancel();}
        }}/>
      {!relaxing&&<TownStatusLayer ref={statusLayer} mapId={mapId} entities={entities} insects={gardenInsectSources(rafts,mapId)} extraPlots={statusPlots}/>}
      {(p.exits??[]).map(exit=><button data-map-exit key={exit.id} ref={node=>{if(node)exitRefs.current.set(exit.id,node);else exitRefs.current.delete(exit.id);}} className={exit.className??'town-map-exit'} aria-label={uiText(exit.label)} title={uiText(exit.label)} disabled={exit.disabled??p.interactionBlocked} onClick={exit.onClick}>{exit.icon}</button>)}
      {npcHearts.map(h=><div key={h.key} style={{position:'absolute',left:`${h.x}px`,top:`${h.y}px`,width:'32px',height:'32px',pointerEvents:'none'}}><FloatingHeart/></div>)}
      {!relaxing&&p.actions&&!(p.roadDraft?.length)&&<div ref={actionsRef} className="town-tile-actions lake-building-actions" role="group" aria-label={uiText(p.actionsLabel??(p.placement?'Construction actions':'Building actions'))}>{p.actions}</div>}
      {typeof p.overlays==='function'?p.overlays(canvas):p.overlays}
    </div>;
}
