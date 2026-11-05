import {ApiError} from '../../../api/core';
import type {StorageRemovalReceipt} from '../../../../../server/src/town-building/storage';
import {StorageRemovalDialog} from '../StorageRemovalDialog';
import {barnCollectionReward,type TownReward} from '../townReward';
import {useEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from 'react';
import {Link} from 'react-router-dom';
import type {ShopTradeAction,TownResponse} from '../../../api/town';
import {ANIMAL_NAMES,BLUEPRINTS,animalChoices,animalSpecies,blueprintEventError,bridgeAnchorError,canRotate,gateAxis,isSnowSculpture,movementCost,nextDirection,petCapacity,type Blueprint,type Direction,type Entity,type TownCommand} from '../../../../../server/src/town-building/game';
import type {Environment} from '../../../../../server/src/town-building/environment';
import type {MapId} from '../../../../../server/src/town-building/maps/types';
import {mapDefinition} from '../../../../../server/src/town-building/maps/registry';
import {landView} from '../../../../../server/src/town-building/maps/view';
import {blueprintMapError,landObstruction} from '../../../../../server/src/town-building/maps/landShared';
import type {LakeAction} from '../../../../../server/src/town-building/maps/lake/repository';
import type {HarvestAllCommand,HarvestCategory} from '../../../../../server/src/town-building/harvestTypes';
import {businessFor} from '../../../../../server/src/town-building/civCatalog';
import {planMoveIn} from '../../../../../server/src/town-building/civ';
import {turnedSize} from '../../../../../server/src/town-building/direction';
import {planPatchFence,isBridge,isLineBlueprint} from '../../../../../server/src/town-building/game';
import {GROW_SECONDS} from '../../../../../server/src/town-building/garden';
import {coopEggCount} from '../../../../../server/src/town-building/poultry';
import {LAKE_BLUEPRINTS,LAKE_FISH,LAKE_FISH_IDS,LAKE_GROW_SECONDS,LAKE_PLANTS,LAKE_PLANT_IDS,fishCapacity,type LakeFishId,type LakePlantId} from '../../../../../server/src/town-building/water/catalog';
import {fishGrowthMultiplier,feedingSources} from '../../../../../server/src/town-building/water/behavior';
import {raftPlacementError} from '../../../../../server/src/town-building/water/rules';
import type {LakeRaft} from '../../../../../server/src/town-building/water/types';
import {useUiLanguage} from '../../../hooks/useUiLanguage';
import {uiMessage,uiText} from '../../../i18n/uiText';
import {BlueprintArt} from '../TownArt';
import {BUILDING_GROUPS,landGroup,raftGroup,type BuildingGroupId} from '../buildingGroups';
import {TownMapDialog,TownMapLayout,TownBuildingPalette,type TownPaletteItem,useTownMapEditing,type TownMapPresentation,type TownPaletteGroup} from '../TownMapLayout';
import {BuildingCostList,BuildingDetailCard,type BuildingDetail} from '../BuildingDetailCard';
import {GardenDialog} from '../GardenDialog';
import {CivInterior} from '../CivInterior';
import {TownResidentsDialog} from '../TownResidentsDialog';
import {HalloweenNotice} from '../HalloweenNotice';
import {CivPortrait} from '../civArt';
import {EggIcon} from '../PoultryUi';
import {FeedIcon,MilkIcon,StorageDialog,StorageIcon,WoolIcon,YarnIcon,barnWaiting} from '../BarnUi';
import {FAVOURITE_CROPS,MAX_FED_MS,barnProduct} from '../../../../../server/src/town-building/barn';
import {AnimalHeadIcon,BuildToolsIcon,ChooseCropIcon,CloseIcon,DecorationsIcon,DemolishIcon,HarvestIcon,MoveIcon,RemoveFenceIcon,RemoveFenceNetworkIcon,RemoveRoadIcon,RemoveRoadNetworkIcon,RotateIcon,WrapFenceIcon} from '../TownActionIcons';
import {LakeActionButton} from '../maps/lake/LakeActionButton';
import {LakeArt} from '../maps/lake/LakeArt';
import {harvestChoice,type LakeHarvestChoice} from '../maps/lake/harvestChoice';
import type {LakeRelease} from '../maps/lake/releaseAnimation';
import {readMapView,saveMapView} from '../maps/viewMemory';
import {planRoadStroke,type RoadTile} from '../roadGlide';
import type {TownView} from '../townViewport';
import {MapScene,type MapExit} from './MapScene';
import {buildingViewFiles} from '../buildingViews';
import {loadImage} from '../useTownArtwork';
import {MapDestination} from './MapDestination';
import {PlacementDetails,SelectedDetails,blueprintCard,landBuildingCost,placementProblem,raftArt,raftBlueprintCard,selectedCard,type Placement} from './workspaceDetails';
import '../town.css';
import '../maps/lake/lake.css';
import {useTownRelaxing} from '../TownRelaxingView';
import {TownHarvestAll,type HarvestDialogState,harvestReceiptShouldAnimate} from '../TownHarvestAll';
import {shopReceiptShouldAnimate} from '../shopTradeModel';

export type MapAction=LakeAction|HarvestAllCommand|ShopTradeAction;
export interface WorkspaceChrome extends Pick<TownMapPresentation,'title'|'levelIcon'|'onProject'|'info'> {
    renameLabel?:string;onRename?:()=>void;headerActions?:ReactNode;mapControls?:ReactNode;testControls?:ReactNode;notices?:ReactNode;
}
export interface MapWorkspaceProps {
    mapId:MapId;profileId:string;/** The other map's name, for moving buildings between maps. */otherMap?:{id:MapId;name:string};
    viewKey:string;state:TownResponse;environment:Environment;liveEnvironment:Environment;images:Map<string,HTMLImageElement>;
    busy:boolean;error:string;paused:boolean;growthPaused?:boolean;
    /** Sends one verified command and resolves the new state, or null when refused. */
    send:(action:MapAction)=>Promise<TownResponse|null>;
    onPause:()=>void;onResume:()=>void;onSync?:()=>void;
    chrome:WorkspaceChrome;exits?:MapExit[];overlays?:ReactNode;sceneOverlays?:(view:TownView,canvas:RefObject<HTMLCanvasElement|null>)=>ReactNode;
    onGreetBlob?:(visitorId:string)=>void;prosperityStage?:number;
    /** Raised after a verified change (reward, release animation) for the page's own chrome. */
    onChanged?:(previous:TownResponse,next:TownResponse,action:MapAction)=>void;
}
const stamina=(s:TownResponse)=>s.materials.stamina;

/** Selection, building, glide, details, dialogs and palette for any map. A page
 * supplies its data, transport and chrome; behavior comes from the building,
 * animal, plant, environment and events — never from which map this is. */
export function MapWorkspace(props:MapWorkspaceProps){
    useUiLanguage();
    const {mapId,state,busy,error,send}=props,map=mapDefinition(mapId);
    // Test-kit event previews are common to every map: same buttons, same effect (local development only).
    const [halloweenPreview,setHalloweenPreview]=useState(false),[xmasPreview,setXmasPreview]=useState(false);
    const environment=xmasPreview?{...props.environment,season:'winter' as const,snowCover:true}:props.environment;
    const previewControls=import.meta.env.DEV?<>
        <button type="button" aria-label={uiText('Preview Halloween visitors')} aria-pressed={halloweenPreview} onClick={()=>setHalloweenPreview(value=>!value)}>{uiText(halloweenPreview?'Stop Halloween':'Preview Halloween')}</button>
        <button type="button" aria-label={uiText('Preview Xmas sculptures')} aria-pressed={xmasPreview} title={uiText('Preview Xmas sculptures (writes real sculptures to your town)')} onClick={()=>setXmasPreview(value=>!value)}>{uiText(xmasPreview?'Stop Xmas':'Preview Xmas')}</button>
        {xmasPreview&&<small className="town-preview-label">{uiText('Xmas preview: building writes real sculptures')}</small>}
    </>:null;
    const [editing,setEditing]=useTownMapEditing();
    const relaxing=useTownRelaxing();
    const relaxingRef=useRef(relaxing);relaxingRef.current=relaxing;
    const view=landView(state,mapId),entities=view.entities,rafts=view.rafts??[],lake=state.maps?.lake;
    const scope=`${props.viewKey}:v2`;
    const [camera,setCamera]=useState<TownView>(()=>{const v=readMapView(scope,mapId);return {zoom:v.zoom,camera:{x:v.x,y:v.y}};});
    useEffect(()=>saveMapView(scope,mapId,{zoom:camera.zoom,x:camera.camera.x,y:camera.camera.y}),[scope,mapId,camera]);
    const [selectedId,setSelectedId]=useState(''),[placement,setPlacement]=useState<Placement|null>(null),[picked,setPicked]=useState(false);
    const [position,setPosition]=useState({x:7,y:12}),[message,setNotice]=useState<string|null>(null),[roadDraft,setRoadDraft]=useState<RoadTile[]>([]);
    const noticeIsHint=message===null;
    const notice=message??(editing?'Choose a blueprint when you are ready to build.':'Tap a building to visit. Drag or pinch to look around.');
    const [storageRemoved,setStorageRemoved]=useState<StorageRemovalReceipt>();
    const [storageLoss,setStorageLoss]=useState<{entityId:string;receipt:StorageRemovalReceipt}>();
    const [confirmRemoval,setConfirmRemoval]=useState(false),[garden,setGarden]=useState(false),[shop,setShop]=useState(false),[pets,setPets]=useState(false),[toOther,setToOther]=useState(false),[storageOpen,setStorageOpen]=useState(false),[fed,setFed]=useState<{hostId:string;at:number}>(),[sheared,setSheared]=useState<import('../animalMoments').ShearCue>();
    const [woolPending,setWoolPending]=useState(false),pendingWool=useRef<{timer:number;sent:boolean}|null>(null),transportBusy=useRef(busy);transportBusy.current=busy;
    // Leaving the map abandons an unsent trip: re-enable Collect and let the saved stock decide the fleece again.
    useEffect(()=>()=>{if(!pendingWool.current)return;window.clearTimeout(pendingWool.current.timer);pendingWool.current=null;setWoolPending(false);setSheared(s=>s?{...s,settled:true}:s);},[mapId,props.viewKey]);
    const [destination,setDestination]=useState({x:7,y:12}),[direction,setDirection]=useState<Direction>('front');
    const [species,setSpecies]=useState<LakeFishId>('P1'),[inhabitants,setInhabitants]=useState<'fish'|'plant'|null>(null),[plantChoice,setPlantChoice]=useState<LakePlantId|null>(null),[plantHint,setPlantHint]=useState('');
    const [nextCycle,setNextCycle]=useState<LakeHarvestChoice>(),[restockAfterChoice,setRestockAfterChoice]=useState(false);
    const [reward,setReward]=useState<TownReward>({}),[receipt,setReceipt]=useState<number|string>(0),[release,setRelease]=useState<LakeRelease>();
    const [harvestDialog,setHarvestDialog]=useState<HarvestDialogState>();
    // Display time past the last server state: never credited, only previewed.
    const clock=view.gardening?.activeSeconds??0,[display,setDisplay]=useState(clock);
    useEffect(()=>setDisplay(clock),[clock]);
    const [now,setNow]=useState(()=>Date.now());
    useEffect(()=>{if(props.paused)return;const timer=window.setInterval(()=>{if(!document.hidden){setDisplay(v=>v+1);setNow(Date.now());}},1000);return()=>window.clearInterval(timer);},[props.paused]);
    const extra=Math.max(0,display-clock);
    const latest=useRef(state);latest.current=state;

    const entity=entities.find(e=>e.id===selectedId),raft=rafts.find(r=>r.id===selectedId);
    const season=environment.season;
    const localDate=props.liveEnvironment.timeOfDay?props.liveEnvironment.localDate:'';
    const moving:Entity|LakeRaft|undefined=placement?.kind==='raft'?rafts.find(r=>r.id===placement.raftId):placement?.kind==='land'?entities.find(e=>e.id===placement.entityId):undefined;
    const placed:Blueprint|undefined=placement?.kind==='land'?BLUEPRINTS.find(b=>b.id===placement.blueprintId):undefined;
    const placedRaft=placement?.kind==='raft'?LAKE_BLUEPRINTS.find(b=>b.id===placement.blueprintId):undefined;
    // A turned building covers its rotated footprint; everything below measures that, never the blueprint.
    const footprint=placed?{...placed,...turnedSize(placed,direction)}:placedRaft;
    const rotatable=placement?.kind==='land'&&!!placed&&canRotate(placed.id)&&placed.id!=='snow-tree';
    const problem=editing&&placement&&picked?placementProblem(state,view,mapId,placement,position,moving,direction,localDate,xmasPreview||halloweenPreview):null;
    const showDraft=placement?.kind==='land'&&!placement.entityId&&placed&&isLineBlueprint(placed);

    function clear(){setPlacement(null);setPicked(false);setSelectedId('');setConfirmRemoval(false);setRoadDraft([]);setNotice(null);}
    /** After a successful removal, return to browsing but keep telling the child what happened. */
    const removed=(message:string)=>(next:unknown)=>{if(next){clear();setNotice(message);}};
    function select(id:string){
        if(relaxing)return;
        if(id===selectedId&&!placement){clear();return;}
        const e=entities.find(e=>e.id===id),r=rafts.find(r=>r.id===id),at=e??r;
        setSelectedId(id);setPlacement(null);setPicked(false);setConfirmRemoval(false);setRoadDraft([]);
        if(at)setPosition({x:at.x,y:at.y});
        if(r?.fish[0])setSpecies(r.nextFish??r.fish[0].species);
        const kind=e&&BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind;
        setNotice(!editing?null:kind==='road'||kind==='fence'||kind==='bridge'?'Move or remove this tile, or remove the whole line of the same kind.':'Move this building or demolish it.');
    }
    function startPlacement(next:Placement){
        if(relaxing)return;
        const at=next.kind==='raft'?rafts.find(r=>r.id===next.raftId):next.kind==='land'?entities.find(e=>e.id===next.entityId):undefined;
        setPlacement(next);setSelectedId('');setConfirmRemoval(false);setRoadDraft([]);
        // A move starts on the object's own tile.
        if(at)setPosition({x:at.x,y:at.y});
        setDirection(next.kind==='land'?(at as Entity|undefined)?.direction??'front':'front');
        setPicked(!!at);setNotice(at?'Choose a new patch. Moving uses half the original materials, rounded up.':'Pick a tile, then make it yours.');
    }
    function pick(tile:{x:number;y:number}){
        if(relaxing)return;
        if(!editing||!placement){if(!placement)clear();return;}
        // A blueprint the child has not unlocked never takes a tile or shows build actions.
        if(lockedNeed)return;
        setPicked(true);setPosition(tile);
        if(camera.zoom===2)setCamera({zoom:2,camera:{x:Math.max(-5,Math.min(5,tile.x-10)),y:Math.max(-10,Math.min(10,tile.y-20))}});
    }
    function onTap(tile:{x:number;y:number},objectId:string|null){
        if(relaxing)return;
        if(!editing){if(objectId)select(objectId);else clear();return;}
        if(placement){
            const glide=showDraft;
            const blocksGlide=glide&&objectId&&(()=>{const e=entities.find(e=>e.id===objectId);return e&&BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind===placed!.kind&&e.blueprintId!==placed!.id;})();
            const bridgeForLantern=placed?.id==='halloween-lantern'&&entities.some(e=>e.id===objectId&&isBridge(e));
            if(objectId&&!placement.entityId&&!placement.raftId&&!blocksGlide&&!bridgeForLantern)select(objectId);else pick(tile);
            return;
        }
        if(objectId)select(objectId);else clear();
    }
    const clampMove=(dx:number,dy:number)=>pick({x:Math.max(0,Math.min(map.rows-(footprint?.width??1),position.x+dx)),y:Math.max(0,Math.min(map.columns-(footprint?.length??1),position.y+dy))});

    /** One press turns the building being placed or moved; fixed buildings ignore it. */
    function rotate(){
        if(relaxing||!editing||busy||placement?.kind!=='land'||!placed||!canRotate(placed.id)||placed.id==='snow-tree')return;
        setDirection(current=>nextDirection(placed.id,current));
    }
    // The turned views are loaded once a rotatable building is being placed, so the preview never waits on a click.
    const [viewImages,setViewImages]=useState(new Map<string,HTMLImageElement>());
    const placedId=rotatable&&editing?placed!.id:'';
    useEffect(()=>{
        if(!placedId)return;
        let alive=true;
        for(const file of buildingViewFiles(placedId))void loadImage(file).then(image=>{if(alive)setViewImages(previous=>previous.has(file)?previous:new Map(previous).set(file,image));},()=>undefined);
        return()=>{alive=false;};
    },[placedId]);
    const placedSculpture=placed&&isSnowSculpture(placed.id)?`xmas/${placed.id}`:'';
    useEffect(()=>{
        if(!placedSculpture)return;
        let alive=true;
        void loadImage(placedSculpture).then(image=>{if(alive)setViewImages(previous=>previous.has(placedSculpture)?previous:new Map(previous).set(placedSculpture,image));},()=>undefined);
        return()=>{alive=false;};
    },[placedSculpture]);
    const sceneImages=useMemo(()=>viewImages.size?new Map([...props.images,...viewImages]):props.images,[props.images,viewImages]);
    const rotateRef=useRef(rotate);rotateRef.current=rotate;
    useEffect(()=>{
        const onKey=(event:KeyboardEvent)=>{
            if(event.key.toLowerCase()!=='r'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.defaultPrevented)return;
            const target=event.target instanceof HTMLElement?event.target:null;
            if(target&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName)))return;
            event.preventDefault();rotateRef.current();
        };
        window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
    },[]);
    /** One path for every verified change, with its reward and release feedback. */
    async function act(action:MapAction){
        if(relaxingRef.current)return null;
        const previous=latest.current,next=await send(action);if(!next)return null;
        const water=action as {type:string;raftId?:string};
        if(action.type==='harvest-all'){
            const harvestReceipt=next.harvestReceipt;
            if(harvestReceipt){
                if(harvestReceiptShouldAnimate(harvestReceipt)){setReward(harvestReceipt.reward as TownReward);setReceipt(harvestReceipt.id);}
                setHarvestDialog({phase:'result',category:action.category,receipt:harvestReceipt});
            }
            props.onChanged?.(previous,next,action);
            return next;
        }
        if(action.type==='shop-trade'){
            const shopReceipt=next.shopReceipt;
            if(shopReceipt&&shopReceiptShouldAnimate(shopReceipt)){setReward({cropReward:shopReceipt.reward});setReceipt(shopReceipt.id);}
            props.onChanged?.(previous,next,action);
            return next;
        }
        if(['harvest-fish','harvest-plant','harvest','harvest-eggs'].includes(action.type==='land-action'?action.command.type:action.type)&&next.revision>previous.revision&&stamina(next)>stamina(previous)){setReward({stamina:stamina(next)-stamina(previous)});setReceipt(`${mapId}:${next.revision}:${action.type}`);}
        if(action.type==='land-action'&&action.command.type==='collect-barn'){const gain=barnCollectionReward(previous,next,mapId,action.command.entityId);if(Object.keys(gain).length){setReward(gain);setReceipt(`${mapId}:${next.revision}:collect-barn:${action.command.entityId}`);}}
        if(action.type==='land-action'&&action.command.type==='feed-animals')setFed({hostId:action.command.entityId,at:performance.now()});
        if(action.type==='remove-raft'){const old=(landView(previous,mapId).rafts??[]).find(r=>r.id===water.raftId);if(old&&(old.fish.length||old.plant)&&!(landView(next,mapId).rafts??[]).some(r=>r.id===old.id))setRelease({receipt:`${next.revision}`,raft:structuredClone(old),mapId});}
        if(action.type==='harvest-fish'||action.type==='harvest-plant'){const choice=harvestChoice(previous,next,mapId,action);if(choice){setSelectedId(choice.raftId);if(choice.kind==='fish')setSpecies(choice.type);setNextCycle(choice);}}
        props.onChanged?.(previous,next,action);
        return next;
    }
    /** Results of garden, neighbor and animal commands are told in the shared notice for every map. */
    const commandNotice=(command:TownCommand):string|null=>command.type==='harvest'?'Harvested the ripe plants. New crops are growing.':command.type==='plant'?'Your seed is planted.':command.type==='wrap-fence'?'Your patch is protected!'
        :command.type==='feed-animals'?'Yum! Your animals loved their treat.':command.type==='collect-barn'?'Collected! Find it in your Town Storage.':command.type==='help-neighbor'?'Thank you for helping your neighbor!':command.type==='set-pets'?'Your pets are home!':command.type==='set-animal'?uiMessage('{animal} friends have moved in!',{animal:uiText(ANIMAL_NAMES[command.animal])}):null;
    const land=async(command:TownCommand)=>{
        try {
            const next=await act({type:'land-action',mapId,command});
            const message=commandNotice(command);if(next&&message)setNotice(message);
            if(next&&command.type==='remove'&&next.storageRemovalReceipt){
                const r=next.storageRemovalReceipt;setStorageLoss(undefined);if(r.losses.length)setStorageRemoved(r);clear();
                setNotice(uiMessage(r.losses.length?'Storage limit reduced from {old} to {next}. Listed goods were discarded.':'Storage limit reduced from {old} to {next}. No goods were affected.',{old:r.oldItemLimit,next:r.newItemLimit}));
            }
            return next;
        }catch(e){
            if(e instanceof ApiError&&e.code==='STORAGE_LOSS_CONFIRM'&&command.type==='remove'){setConfirmRemoval(false);setStorageLoss({entityId:command.entityId,receipt:e.details as StorageRemovalReceipt});return null;}
            throw e;
        }
    };
    function collectBarn(host:Entity){
        if(busy)return;
        const command:TownCommand={type:'collect-barn',entityId:host.id,generation:host.barn?.generation??0};
        if(barnProduct(host)!=='wool'){void land(command);return;}
        if(pendingWool.current)return;
        const pending={timer:0,sent:false};pendingWool.current=pending;setWoolPending(true);
        const complete=()=>{
            if(pendingWool.current!==pending||pending.sent)return;
            window.clearTimeout(pending.timer);
            // A heartbeat or another explicit action may own the transport when the trip ends.
            if(transportBusy.current){pending.timer=window.setTimeout(complete,100);return;}
            pending.sent=true;
            setSheared(s=>s?{...s,finish:true}:s);
            void land(command).finally(()=>{
                if(pendingWool.current!==pending)return;
                pendingWool.current=null;setWoolPending(false);setSheared(s=>s?{...s,settled:true}:s);
            });
        };
        pending.timer=window.setTimeout(complete,15000);
        setSheared({hostId:host.id,stock:barnWaiting(host,Date.now()),at:performance.now(),onComplete:complete});
    }
    const water=(command:Record<string,unknown>)=>act({...command,mapId} as MapAction);
    async function harvestAll(category:HarvestCategory){
        if(busy||harvestDialog?.phase==='loading')return;
        setHarvestDialog({phase:'loading',category});
        const next=await act({type:'harvest-all',category,mapId});
        if(!next||!next.harvestReceipt)setHarvestDialog({phase:'error',category});
    }
    async function build(){
        if(relaxingRef.current||!editing||!placement||!footprint||problem||busy)return;
        let action:MapAction;
        if(placement.kind==='raft')action=placement.raftId?{type:'move-raft',raftId:placement.raftId,mapId,...position}:{type:'build-raft',blueprintId:placement.blueprintId,mapId,...position};
        else action={type:'land-action',mapId,command:placement.entityId?{type:'move',entityId:placement.entityId,...position,direction}:{type:'build',blueprintId:placement.blueprintId,...position,...(direction==='front'?{}:{direction})}};
        if(await act(action)){setNotice(placement.entityId||placement.raftId?'Moved! Your map is taking shape.':'Built! A little more of your map is ready.');setPlacement(null);setPicked(false);setSelectedId('');}
    }
    /** One request builds the whole stroke; the server checks every tile and saves once. */
    async function glide(tiles:RoadTile[]){
        if(relaxingRef.current||!editing||busy||!showDraft||!placed)return;
        const view=landView(latest.current,mapId),planned=planRoadStroke(view,mapId,placed,tiles);
        setRoadDraft([]);
        if(!planned.length){setNotice('Choose an open patch with enough materials.');return;}
        const fresh=planned.filter(tile=>!view.entities.some(e=>e.x===tile.x&&e.y===tile.y&&e.blueprintId===placed.id));
        const kind=placed.kind==='fence'?'fence':placed.kind==='bridge'?'bridge':'road';
        if(!fresh.length){setNotice(kind==='fence'?'Those fence tiles are already in place.':kind==='bridge'?'Those bridge tiles are already in place.':'Those road tiles are already in place.');return;}
        // A bridge has to reach land somewhere; say so before asking the server.
        if(kind==='bridge'){const anchor=bridgeAnchorError([...view.entities,...fresh.map((tile,i)=>({id:`stroke-${i}`,blueprintId:placed.id,...tile,paidCost:{}}))],mapId,fresh);if(anchor){setNotice(anchor);return;}}
        const next=await land({type:'build-line',blueprintId:placed.id,tiles:fresh});
        if(next)setNotice(kind==='fence'?uiMessage('Built {count} fence tiles. Glide again to keep going.',{count:fresh.length}):kind==='bridge'?uiMessage('Built {count} bridge tiles. Glide again to keep going.',{count:fresh.length}):uiMessage('Built {count} road tiles. Glide again to keep going.',{count:fresh.length}));
    }

    // Water-care helpers (fish and plants on any map's rafts).
    const catches=lake?.catches??{},residentSpecies=raft?.fish[0]?.species??species,choosingNextFish=raft?.blueprintId==='nursery'&&raft.fish.length>0;
    const fishGrowth=(r:LakeRaft,fish:{growth:number})=>Math.min(LAKE_GROW_SECONDS,fish.growth+extra*fishGrowthMultiplier(r,feedingSources(rafts,mapId)));
    const fishChoiceError=(id:LakeFishId)=>choosingNextFish?((catches[id]??0)<10?'Catch 10 of this fish in Fishing Friends first.':raftPlacementError(view,mapId,{...raft!,nextFish:undefined,fish:[{id:'preview',species:id,growth:0}]},raft!.x,raft!.y)):null;
    const plantError=(plant:LakePlantId)=>raft?raftPlacementError(view,mapId,{...raft,plant},raft.x,raft.y):'Choose a floating garden first.';
    const plantMessage=(message:string)=>message==='This habitat needs shallow water.'?'This plant likes shallow water. Move your garden closer to shore to grow it.':message;
    const fishError=raft&&['nursery','friendly'].includes(raft.blueprintId)?raft.fish.some(f=>f.species!==species)?'Keep one species in each raft.':raftPlacementError(view,mapId,{...raft,fish:[{id:'preview',species,growth:0}]},raft.x,raft.y):null;
    const restockError=inhabitants==='fish'&&restockAfterChoice?(fishError??((catches[species]??0)<10?'Catch 10 of this fish in Fishing Friends first.':error)):'';
    function closeInhabitants(){setInhabitants(null);setRestockAfterChoice(false);setPlantHint('');}
    async function chooseFish(id:LakeFishId){
        if(choosingNextFish){if(await water({type:'set-next-fish',raftId:raft!.id,species:id})){setSpecies(id);closeInhabitants();}}
        else{setSpecies(id);if(!restockAfterChoice)closeInhabitants();}
    }
    async function keepHarvestType(){if(!nextCycle||busy)return;if(nextCycle.kind==='plant'||await water({type:'stock',raftId:nextCycle.raftId,species:nextCycle.type}))setNextCycle(undefined);}
    function changeHarvestType(){if(!nextCycle)return;setRestockAfterChoice(nextCycle.kind==='fish');setInhabitants(nextCycle.kind);setPlantChoice(null);setPlantHint('');setNextCycle(undefined);}

    // Neighbors waiting for a road, and the Halloween pumpkin patch call-to-action.
    const stuck=useMemo(()=>{for(const host of entities)if(host.civ?.phase==='waiting'){const plan=planMoveIn(entities,host,map);if(!plan.reachable)return {host,plan,business:businessFor(host.blueprintId)!};}return null;},[state,mapId]);
    function preparePumpkins(){
        if(busy)return;clear();
        const patch=entities.find(e=>e.blueprintId==='vegetable-patch');
        if(patch){setSelectedId(patch.id);setPosition({x:patch.x,y:patch.y});setGarden(true);}
        else{setEditing(true);startPlacement({kind:'land',blueprintId:'vegetable-patch'});setNotice('Pick a tile, then use the hammer to build.');}
    }

    // Palette: every blueprint available here, grouped by kind. Water structures
    // need an open lake; only buildings restricted to other maps are hidden.
    const learned=state.learnedIds.length;
    const raftItems:Array<[BuildingGroupId,TownPaletteItem]>=lake?LAKE_BLUEPRINTS.map(b=>[raftGroup(b.id),{id:b.id,name:b.name,art:raftArt(b.id),detail:raftBlueprintCard(b,state),locked:raftBlueprintCard(b,state).locked,selected:placement?.kind==='raft'&&!placement.raftId&&placement.blueprintId===b.id,onChoose:()=>{if(placement?.kind==='raft'&&!placement.raftId&&placement.blueprintId===b.id)clear();else startPlacement({kind:'raft',blueprintId:b.id});}}]):[];
    const landItems:Array<[BuildingGroupId,TownPaletteItem]>=BLUEPRINTS.filter(b=>b.palette!==false&&!blueprintMapError(b.id,mapId)&&!blueprintEventError(b.id,localDate,b.id==='halloween-lantern'?halloweenPreview:isSnowSculpture(b.id)&&xmasPreview)).map(b=>{
        const eventError=blueprintEventError(b.id,localDate,b.id==='halloween-lantern'?halloweenPreview:isSnowSculpture(b.id)&&xmasPreview);
        return [landGroup(b),{
            id:b.id,
            name:b.name,
            art:<BlueprintArt blueprint={b} season={season}/>,
            detail:blueprintCard(b,state,season),
            locked:b.learned>learned,
            disabled:!!eventError,
            disabledReason:eventError??undefined,
            selected:placement?.kind==='land'&&!placement.entityId&&placement.blueprintId===b.id,
            onChoose:()=>{
                if(eventError){setNotice(eventError);return;}
                if(placement?.kind==='land'&&!placement.entityId&&placement.blueprintId===b.id)clear();
                else startPlacement({kind:'land',blueprintId:b.id});
            }
        }];
    });
    const groups:TownPaletteGroup[]=[
        ...BUILDING_GROUPS.map(group=>({id:group.id,name:group.name,...(group.id==='decorations'?{icon:<DecorationsIcon/>}:{}),items:[...landItems,...raftItems].filter(([id])=>id===group.id).map(([,item])=>item)})).filter(group=>group.items.length),
    ];

    // The detail card for what is being placed or what is selected.
    const lockedNeed=placed&&!placement?.entityId&&placed.learned>learned?{need:placed.learned}:null;
    const card:BuildingDetail|null=placement&&footprint
        ?{...(placedRaft?raftBlueprintCard(placedRaft,state):blueprintCard(placed!,state,season)),cost:placed?landBuildingCost(placed,state,moving as Entity|undefined):{moving:!!moving,cost:moving?movementCost(moving.paidCost):footprint.cost,materials:state.materials}}
        :selectedCard(state,mapId,season,entity,raft,now,extra);
    // Keep the shared card first, with the former inspector information in its own section.
    const viewDetails=!editing&&card?<BuildingDetailCard detail={{...card,cost:null}}><section className="town-selected-details" aria-label={uiText('Building details')}><h4>{uiText('Building details')}</h4><SelectedDetails state={state} {...(entity?{entity}:{})} {...(raft?{raft}:{})} species={species} extraSeconds={extra} confirmingRemoval={false}/>{card.cost&&<BuildingCostList cost={card.cost}/>}<p role={error?'alert':'status'}>{uiText(error||(noticeIsHint?'':notice))}</p></section></BuildingDetailCard>:undefined;
    const detail=<BuildingDetailCard detail={card}>
        {placement&&footprint?<PlacementDetails blueprint={footprint} moving={!!moving} problem={problem} locked={lockedNeed} state={state} notice={error||notice}/>
        :entity||raft?<><SelectedDetails state={state} {...(entity?{entity}:{})} {...(raft?{raft}:{})} species={species} extraSeconds={extra} confirmingRemoval={confirmRemoval}/><p className="town-placement-status" role="status">{uiText(error||notice)}</p></>
        :<>{lake&&<><Link className="lake-fishing-link" to="/fishing" onClick={props.onPause}>{uiText('Catch fish to unlock new species')}</Link><p className="lake-reserve">{uiMessage('Raised fish waiting for a home: {count}',{count:Object.values(lake.reserve).reduce((a,b)=>a+(b??0),0)})}</p></>}{(error||!noticeIsHint)&&<p className="town-placement-status" role={error?'alert':'status'}>{uiText(error||notice)}</p>}</>}
    </BuildingDetailCard>;

    // Buttons around the selected object, or the build/cancel pair while placing.
    const selectedKind=entity&&BLUEPRINTS.find(b=>b.id===entity.blueprintId)?.kind;
    const GATE_WOOD=BLUEPRINTS.find(b=>b.id==='farm-gate')!.cost.wood??0;
    const lineKind=selectedKind==='road'||selectedKind==='fence'||selectedKind==='bridge'?selectedKind:null;
    const fence=entity?.blueprintId==='vegetable-patch'?planPatchFence({...view,materials:state.materials},entity,mapId):null;
    const grown=raft&&['nursery','friendly'].includes(raft.blueprintId)&&raft.fish.some(f=>fishGrowth(raft,f)>=LAKE_GROW_SECONDS);
    const favourites=entity?.blueprintId==='farmhouse'?FAVOURITE_CROPS[animalSpecies(entity)!]??[]:[];
    const feedProblem=entity?.blueprintId!=='farmhouse'?null:!favourites.some(c=>(state.storage?.crops[c]??0)>0)?'Store one of their favourite crops first.':Math.max(entity.barn?.fedUntil??0,now)-now>=MAX_FED_MS?'They are full. Feed them again later.':null;
    const actions=placement&&picked?<>
        <LakeActionButton label={moving?'Move here':'Build here'} disabled={busy||!!problem} onClick={()=>void build()}><BuildToolsIcon/></LakeActionButton>
        {rotatable&&<LakeActionButton label="Rotate" title={uiText('Rotate (R)')} disabled={busy} onClick={rotate}><RotateIcon/></LakeActionButton>}
        <LakeActionButton label="Cancel placement" disabled={busy} onClick={clear}><CloseIcon/></LakeActionButton></>
        :selectedId&&(entity||raft)&&!placement?(confirmRemoval?<>
            <span className="town-tile-warning">{uiText('No materials are returned.')}</span>
            <LakeActionButton label="Confirm removal" disabled={busy} onClick={()=>{void (raft?water({type:'remove-raft',raftId:raft.id}):land({type:'remove',entityId:entity!.id})).then(removed('Removed. Your other buildings are safe.'));}}><DemolishIcon/></LakeActionButton>
            <LakeActionButton label="Keep it" disabled={busy} onClick={()=>setConfirmRemoval(false)}><CloseIcon/></LakeActionButton></>:<>
            {raft&&['nursery','friendly'].includes(raft.blueprintId)&&<>
                <LakeActionButton label="Fish type" disabled={busy} onClick={()=>setInhabitants('fish')}><LakeArt fish index={LAKE_FISH[residentSpecies].art*4+2}/></LakeActionButton>
                <LakeActionButton label="Stock free fish" title={fishError?uiText(fishError):undefined} disabled={busy||!!fishError||(catches[species]??0)<10||raft.fish.length>=fishCapacity(species)} onClick={()=>void water({type:'stock',raftId:raft.id,species})}><span className="lake-fish-add"><LakeArt fish index={LAKE_FISH[species].art*4+2}/><b>+</b></span></LakeActionButton>
                {raft.blueprintId==='nursery'?<LakeActionButton label="Collect grown fish" disabled={busy||!grown} onClick={()=>void water({type:'harvest-fish',raftId:raft.id,generation:raft.generation})}><HarvestIcon/></LakeActionButton>
                :<><LakeActionButton label={uiMessage('Add raised fish · {count}',{count:lake?.reserve[species]??0})} title={fishError?uiText(fishError):undefined} disabled={busy||!!fishError||!(lake?.reserve[species]??0)||raft.fish.length>=fishCapacity(species)} onClick={()=>void water({type:'transfer-fish',raftId:raft.id,species})}><span className="lake-fish-add"><LakeArt fish index={LAKE_FISH[species].art*4+2}/><MoveIcon/></span></LakeActionButton>
                  {grown&&<LakeActionButton label="Return grown fish to reserve" disabled={busy} onClick={()=>void water({type:'reserve-fish',raftId:raft.id})}><MoveIcon/></LakeActionButton>}</>}
            </>}
            {raft?.blueprintId==='floating-garden'&&<>
                <LakeActionButton label="Choose a plant" disabled={busy} onClick={()=>{setPlantChoice(null);setPlantHint('');setInhabitants('plant');}}><ChooseCropIcon/></LakeActionButton>
                <LakeActionButton label="Collect grown plants" disabled={busy||raft.plantGrowth+extra<LAKE_GROW_SECONDS} onClick={()=>void water({type:'harvest-plant',raftId:raft.id,generation:raft.generation})}><HarvestIcon/></LakeActionButton></>}
            {entity&&<>
                {entity.blueprintId==='coop'&&entity.poultry&&<LakeActionButton label="Harvest eggs" disabled={busy||coopEggCount(entity.poultry,now)<1} onClick={()=>void land({type:'harvest-eggs',entityId:entity.id,generation:entity.poultry!.generation})}><EggIcon/></LakeActionButton>}
                {entity.blueprintId==='farmhouse'&&<>
                    {barnProduct(entity)&&<LakeActionButton label={barnProduct(entity)==='milk'?'Collect milk':barnProduct(entity)==='yarn'?'Collect yarn':'Collect wool'} disabled={busy||(barnProduct(entity)==='wool'&&woolPending)||barnWaiting(entity,now)<1} onClick={()=>collectBarn(entity)}>{barnProduct(entity)==='milk'?<MilkIcon/>:barnProduct(entity)==='yarn'?<YarnIcon/>:<WoolIcon/>}</LakeActionButton>}
                    <LakeActionButton label="Feed the animals" title={feedProblem?uiText(feedProblem):undefined} disabled={busy||!!feedProblem} onClick={()=>void land({type:'feed-animals',entityId:entity.id})}><FeedIcon/></LakeActionButton></>}
                {entity.blueprintId==='town-storage'&&<LakeActionButton label="Open storage" disabled={busy} onClick={()=>setStorageOpen(true)}><StorageIcon/></LakeActionButton>}
                {businessFor(entity.blueprintId)&&<LakeActionButton label="Visit inside" disabled={busy} onClick={()=>setShop(true)}><BlueprintArt blueprint={BLUEPRINTS.find(b=>b.id==='house')!} season={season}/></LakeActionButton>}
                {entity.garden&&<><LakeActionButton label="Choose a crop" disabled={busy} onClick={()=>setGarden(true)}><ChooseCropIcon/></LakeActionButton>
                    <LakeActionButton label="Harvest crops" title={uiText('Harvest all ready plants')} disabled={busy||!entity.garden.slots.some(s=>s.withered||s.crop&&s.growth+extra>=GROW_SECONDS)} onClick={()=>void land({type:'harvest',entityId:entity.id,generation:entity.garden!.generation??0})}><HarvestIcon/></LakeActionButton></>}
                {(petCapacity(entity.blueprintId)>0||animalChoices(entity.blueprintId).length>0)&&<LakeActionButton label="Animal friends" disabled={busy} onClick={()=>setPets(true)}><AnimalHeadIcon/></LakeActionButton>}
                {editing&&entity.garden&&<LakeActionButton label={uiMessage('Wrap around with fence · {wood} wood',{wood:fence?.wood??0})} disabled={busy||!fence||!!fence.error||!fence.tiles.length} onClick={()=>void land({type:'wrap-fence',entityId:entity.id})}><WrapFenceIcon/></LakeActionButton>}
                {editing&&entity.blueprintId==='wooden-fence'&&gateAxis(entities,entity)&&<LakeActionButton label={uiMessage('Make a farm gate · {wood} wood',{wood:GATE_WOOD})} disabled={busy||(state.materials.wood??0)<GATE_WOOD} onClick={()=>void land({type:'make-gate',entityId:entity.id}).then(next=>{if(next)setNotice('Your farm gate is ready. It opens for animals, people and vehicles.');})}><span className="town-gate-icon"><BlueprintArt blueprint={BLUEPRINTS.find(b=>b.id==='farm-gate')!} season={season}/></span></LakeActionButton>}
                {editing&&lineKind&&<LakeActionButton label="Remove the whole line" disabled={busy} onClick={()=>void land({type:'remove-line',entityId:entity.id}).then(removed(lineKind==='fence'?'Connected fences removed.':lineKind==='bridge'?'Connected bridge removed.':'Connected roads removed. Other road types are safe.'))}>{lineKind==='fence'?<RemoveFenceNetworkIcon/>:<RemoveRoadNetworkIcon/>}</LakeActionButton>}
            </>}
            {editing&&<LakeActionButton label="Move" disabled={busy} onClick={()=>startPlacement(raft?{kind:'raft',blueprintId:raft.blueprintId,raftId:raft.id}:{kind:'land',blueprintId:entity!.blueprintId,entityId:entity!.id})}><MoveIcon/></LakeActionButton>}
            {editing&&entity&&props.otherMap&&!blueprintMapError(entity.blueprintId,props.otherMap.id)&&!lineKind&&<LakeActionButton label={`Move to ${props.otherMap.name}`} disabled={busy} onClick={()=>{setDestination({x:entity.x,y:entity.y});setToOther(true);}}><span className="lake-from-town-icon"><BlueprintArt blueprint={BLUEPRINTS.find(b=>b.id==='house')!} season={season}/><MoveIcon/></span></LakeActionButton>}
            {editing&&<LakeActionButton label={lineKind==='road'?'Remove this road tile':lineKind==='fence'?entity?.blueprintId==='farm-gate'?'Remove this farm gate':'Remove this fence tile':lineKind==='bridge'?'Remove this bridge tile':'Remove'} disabled={busy} onClick={()=>{if(lineKind){void land({type:'remove',entityId:entity!.id}).then(removed('Removed. Your other buildings are safe.'));}else if(entity?.blueprintId==='town-storage')void land({type:'remove',entityId:entity.id});else setConfirmRemoval(true);}}>{lineKind==='fence'?<RemoveFenceIcon/>:lineKind?<RemoveRoadIcon/>:<DemolishIcon/>}</LakeActionButton>}
            <LakeActionButton label="Deselect building" disabled={busy} onClick={clear}><CloseIcon/></LakeActionButton></>):null;

    const destinationError=toOther&&entity&&props.otherMap?landObstruction(state,props.otherMap.id,BLUEPRINTS.find(b=>b.id===entity.blueprintId)!,destination.x,destination.y,undefined,entity.direction??'front'):null;
    // Every tapped construction (building, road, fence, bridge or raft) previews as it will stand.
    const scenePlacement=!relaxing&&editing&&placement&&picked&&footprint?{...position,width:footprint.width,length:footprint.length,valid:!problem,...(placed?{blueprintId:placed.id,...(rotatable?{direction}:{})}:placedRaft?{raftBlueprintId:placedRaft.id}:{})}:null;
    const objects=[...rafts.map(r=>({id:r.id,name:LAKE_BLUEPRINTS.find(b=>b.id===r.blueprintId)!.name})),...entities.filter(e=>{const k=BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind;return k!=='road'&&k!=='fence';}).map(e=>({id:e.id,name:BLUEPRINTS.find(b=>b.id===e.blueprintId)!.name}))];
    const stuckCall=stuck&&<div className="town-road-call" role="status"><CivPortrait art={stuck.business.workers[0]!.art}/><p>{uiMessage('{name}: Please connect the stone entrance on the left to my shop.',{name:stuck.business.workers[0]!.name})}</p><button onClick={()=>setCamera({zoom:2,camera:{x:Math.max(-5,Math.min(5,stuck.plan.parking.x-10)),y:Math.max(-10,Math.min(10,stuck.plan.parking.y-20))}})}>{uiText('Show me')}</button></div>;
    const scene=<><MapScene mapId={mapId} state={state} environment={environment} liveClock={props.liveEnvironment} images={sceneImages} view={camera} onViewChange={setCamera}
        editing={editing&&!relaxing} interactionBlocked={busy} busy={busy} paused={props.paused}
        selectedId={relaxing?'':placement?.kind==='land'?placement.entityId??'':placement?.kind==='raft'?placement.raftId??'':selectedId} placement={scenePlacement} actions={relaxing?null:actions} actionsLabel={placement?'Construction actions':'Building actions'}
        roadDraft={relaxing?[]:roadDraft} {...(fed?{fed}:{})} {...(sheared?{sheared}:{})} {...(!relaxing&&showDraft&&placed?{draftBlueprint:placed}:{})} roadGlideEnabled={!relaxing&&editing&&!!showDraft&&!busy}
        onRoadPreview={tiles=>{if(!relaxing)setRoadDraft(showDraft&&placed?planRoadStroke(landView(state,mapId),mapId,placed,tiles):[]);}} onRoadCommit={tiles=>void glide(tiles)}
        onTap={onTap} onCancel={()=>{if(!relaxingRef.current)clear();}} onConfirm={()=>void build()} {...(props.exits?{exits:props.exits}:{})}
        {...(release?{release}:{})} {...(halloweenPreview?{halloweenPreview:true}:{})} {...(xmasPreview?{xmasPreview:true}:{})}
        {...(props.onGreetBlob?{onGreetBlob:props.onGreetBlob}:{})} prosperityStage={props.prosperityStage??0} overlays={canvas=>props.sceneOverlays?.(camera,canvas)}/></>;

    const chrome=props.chrome;
    return <TownMapLayout mapId={mapId} state={state} environment={environment} busy={busy} title={chrome.title} levelIcon={chrome.levelIcon} onProject={chrome.onProject}
        {...(chrome.onRename?{onRename:chrome.onRename}:{})} {...(chrome.renameLabel?{renameLabel:chrome.renameLabel}:{})} onPause={props.onPause} onResume={props.onResume}
        onToggleEdit={()=>{clear();setEditing(!editing);}} zoom={camera.zoom} onZoom={()=>setCamera(v=>({zoom:v.zoom===1?2:1,camera:{x:0,y:0}}))} onCenter={()=>setCamera({zoom:1,camera:{x:0,y:0}})}
        footprint={{...position,active:!!placement,disabled:busy||!placement||!!lockedNeed,onMove:clampMove}} objects={objects} selectedId={selectedId} onSelect={select}
        tip={problem??(error||notice)} error={error} {...(chrome.info?{info:chrome.info}:{})}
        reward={reward} receipt={receipt} scene={scene} palette={<TownBuildingPalette disabled={busy} groups={groups} detail={detail}/>} viewDetails={viewDetails}
        idlePanel={<TownHarvestAll ready={state.harvestReady} busy={busy} dialog={harvestDialog} error={error} onHarvest={harvestAll} onClose={()=>setHarvestDialog(undefined)}/>}
        {...(chrome.headerActions?{headerActions:chrome.headerActions}:{})} {...(chrome.mapControls?{mapControls:chrome.mapControls}:{})} {...(previewControls||chrome.testControls?{testControls:<>{previewControls}{chrome.testControls}</>}:{})}
        notices={<><HalloweenNotice localDate={localDate} holiday={view.halloween} busy={busy} onGarden={preparePumpkins}/>{stuckCall}{chrome.notices}</>}>
        <GardenDialog entity={entity} season={view.gardening?.season??(props.liveEnvironment.timeOfDay?props.liveEnvironment.season:null)} localDate={props.liveEnvironment.timeOfDay?props.liveEnvironment.localDate:undefined} open={garden} busy={busy} error={error||(props.growthPaused?'Growth is paused. Please check your connection.':'')} onClose={()=>setGarden(false)} onCommand={c=>{void land(c).then(next=>{if(next)setGarden(false);});}}/>
        <StorageDialog state={state} open={storageOpen} now={now} onClose={()=>setStorageOpen(false)}/>
        <CivInterior entity={entity} activeMs={view.civ?.activeMs??0} clock={props.liveEnvironment} open={shop} busy={busy} error={error} onClose={()=>setShop(false)} onCommand={c=>void land(c)} profileId={props.profileId} mapId={mapId} season={props.liveEnvironment.season} localDate={localDate} onShopTrade={action=>act(action)}/>
        <TownResidentsDialog open={pets} entity={entity} busy={busy} error={error} onClose={()=>setPets(false)} onAnimal={animal=>{if(entity)void land({type:'set-animal',entityId:entity.id,animal}).then(next=>{if(next)setPets(false);});}} onPets={values=>{if(entity)void land({type:'set-pets',entityId:entity.id,pets:values}).then(next=>{if(next)setPets(false);});}}/>
        <StorageRemovalDialog receipt={storageRemoved} completed busy={busy} onClose={()=>setStorageRemoved(undefined)} onConfirm={()=>{}}/>
        <StorageRemovalDialog receipt={storageLoss?.receipt} busy={busy} onClose={()=>setStorageLoss(undefined)} onConfirm={()=>{if(storageLoss)void land({type:'remove',entityId:storageLoss.entityId,confirmLoss:true,lossConfirmation:storageLoss.receipt.confirmation});}}/>
        <TownMapDialog open={!!inhabitants} title={uiText(inhabitants==='fish'?'Fish type':'Choose a plant')} error={restockError||plantHint||plantMessage(error)} busy={busy} onClose={closeInhabitants} className="lake-inhabitants-dialog" footer={<>
            {inhabitants==='fish'&&restockAfterChoice&&<button className="town-dialog-primary" disabled={busy||!raft||!!fishError||(catches[species]??0)<10} onClick={()=>{if(raft)void water({type:'stock',raftId:raft.id,species}).then(next=>{if(next)closeInhabitants();});}}>{uiText('Raise these fish')}</button>}
            {inhabitants==='plant'&&<button className="town-dialog-primary" disabled={busy||!raft||!plantChoice||!!plantError(plantChoice)} onClick={()=>{if(raft&&plantChoice&&!plantError(plantChoice))void water({type:'plant',raftId:raft.id,plant:plantChoice}).then(next=>{if(next)closeInhabitants();});}}>{uiText('Plant')}</button>}
            <button className="town-dialog-secondary" disabled={busy} onClick={closeInhabitants}>{uiText('Cancel')}</button></>}>
            <div className="lake-inhabitant-choices">
                {inhabitants==='fish'&&LAKE_FISH_IDS.map(id=><button key={id} aria-label={uiText(LAKE_FISH[id].name)} title={fishChoiceError(id)?uiText(fishChoiceError(id)!):undefined} disabled={busy||!!fishChoiceError(id)||raft?.blueprintId==='friendly'&&!!raft.fish.some(f=>f.species!==id)} aria-pressed={species===id} onClick={()=>void chooseFish(id)}><LakeArt fish index={LAKE_FISH[id].art*4+2}/><strong>{uiText(LAKE_FISH[id].name)}</strong><span>{Math.min(10,catches[id]??0)}/10</span><small>{uiText(LAKE_FISH[id].size==='small'?'16 small fish':'4 big fish')}</small></button>)}
                {inhabitants==='plant'&&LAKE_PLANT_IDS.map(id=>{const habitatError=plantError(id);return <button key={id} aria-label={uiText(LAKE_PLANTS[id].name)} disabled={busy} aria-disabled={!!habitatError} aria-pressed={plantChoice===id} onClick={()=>{if(habitatError){setPlantHint(plantMessage(habitatError));return;}setPlantHint('');setPlantChoice(id);}}><LakeArt index={LAKE_PLANTS[id].art}/><strong>{uiText(LAKE_PLANTS[id].name)}</strong><small className={habitatError?'lake-choice-error':''}>{uiText(habitatError==='This habitat needs shallow water.'?'Needs shallow water':habitatError??(plantChoice===id?'Selected':'Ready to plant'))}</small></button>;})}
            </div>
            {inhabitants==='fish'&&choosingNextFish&&<p>{uiText('Your current fish stay until harvested. The next batch will use your chosen type.')}</p>}
        </TownMapDialog>
        <TownMapDialog open={!!nextCycle} title={uiText(nextCycle?.kind==='fish'?'What would you like to raise next?':'What would you like to plant next?')} error={error} busy={busy} onClose={()=>setNextCycle(undefined)} className="lake-harvest-choice" footer={<><button className="town-dialog-primary" disabled={busy} onClick={()=>void keepHarvestType()}>{uiText(nextCycle?.kind==='fish'?'Keep this fish':'Keep this plant')}</button><button className="town-dialog-secondary" disabled={busy} onClick={changeHarvestType}>{uiText('Change type')}</button></>}>
            {nextCycle&&<><LakeArt fish={nextCycle.kind==='fish'} index={nextCycle.kind==='fish'?LAKE_FISH[nextCycle.type].art*4+2:LAKE_PLANTS[nextCycle.type].art}/><strong>{uiText(nextCycle.kind==='fish'?LAKE_FISH[nextCycle.type].name:LAKE_PLANTS[nextCycle.type].name)}</strong><p>{uiText('Keep the same type or choose a new one.')}</p></>}
        </TownMapDialog>
        {props.otherMap&&<TownMapDialog open={toOther} title={uiMessage('Choose a destination in {map}',{map:uiText(props.otherMap.name)})} error={error||destinationError||''} busy={busy} onClose={()=>setToOther(false)} footer={<>
            <LakeActionButton label="Move here" disabled={busy||!!destinationError} onClick={()=>{if(entity)void act({type:'transfer-building',entityId:entity.id,sourceMap:mapId,destinationMap:props.otherMap!.id,...destination}).then(next=>{if(next){setToOther(false);clear();}});}}><MoveIcon/></LakeActionButton>
            <LakeActionButton label="Cancel" disabled={busy} onClick={()=>setToOther(false)}><CloseIcon/></LakeActionButton></>}>
            {entity&&<MapDestination footprint={{...BLUEPRINTS.find(b=>b.id===entity.blueprintId)!,...turnedSize(BLUEPRINTS.find(b=>b.id===entity.blueprintId)!,entity.direction??'front')}} state={state} mapId={props.otherMap.id} mapName={uiText(props.otherMap.name)} images={props.images} environment={environment} position={destination} onPick={(x,y)=>setDestination({x,y})}/>}
        </TownMapDialog>}
        {props.overlays}
    </TownMapLayout>;
}
