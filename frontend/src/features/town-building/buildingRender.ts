import type {TownOccluder} from './halloweenDepth.ts';
import {drawWitheredCrop} from './witheredPlant.ts';
import {BLUEPRINTS,TOWN_ANIMALS,animalSpecies,entityFootprint,isBridge,isRoadLike,isSnowSculpture,residentSpecies,petCapacity,type Entity,type Direction} from '../../../../server/src/town-building/game.ts';
import type {Environment} from '../../../../server/src/town-building/environment.ts';
import {businessFor} from '../../../../server/src/town-building/civCatalog.ts';
import {CIV_ART} from './civAtlas.ts';
import {CROPS,SEASONS} from './townAtlas.ts';
import {FARMHOUSE_ART} from './structureAtlas.ts';
import {bridgeMask,roadSprite} from './roadArt.ts';
import {CROPS as GARDEN_CROPS,cropStage} from '../../../../server/src/town-building/garden.ts';
import {GARDEN_ATLASES} from './gardenAtlas.ts';
import {ANIMAL_SIGNPOST,ANIMAL_HEADS} from './animalAtlas.ts';
import {buildingView} from './buildingViews.ts';
import {shelterView,shelterInteriorTint} from './shelterInterior.ts';
import {drawHalloweenLantern} from './lanternRender.ts';

// Boards sit in front of their own interior residents, never outdoor passersby.
const BOARD_DEPTH_OFFSET=1;

export interface BuildingRenderOptions {
    selectedId?:string;
    roadTiles?:ReadonlySet<string>;
    /** Dry land on this map, so a bridge can open onto the bank. */
    landAt?:(x:number,y:number)=>boolean;
    /** Host ids with a resident resting at home: their sheltering art and interior are drawn. */
    sheltered?:ReadonlySet<string>;
}
/** A road tile's sprite, joined to neighbouring roads, bridges and farm gates. */
function drawRoadTile(ctx:CanvasRenderingContext2D,road:HTMLImageElement,entity:Entity,rocky:boolean,entities:readonly Entity[],tile:number,ox:number,oy:number,roadTiles?:ReadonlySet<string>) {
    const neighbors=[[-1,0],[0,1],[1,0],[0,-1]];
    const mask=neighbors.reduce((mask,[dx,dy],i)=>mask|((roadTiles?.has(`${entity.x+dx!}:${entity.y+dy!}`)??entities.some(e=>e.x===entity.x+dx!&&e.y===entity.y+dy!&&isRoadLike(e)))?1<<i:0),0);
    const sprite=roadSprite(mask);ctx.save();ctx.translate(ox+(entity.y+.5)*tile,oy+(entity.x+.5)*tile);ctx.rotate(sprite.rotation*Math.PI/2);
    ctx.drawImage(road,sprite.column*100,rocky?100:0,100,100,-tile/2,-tile/2,tile,tile);ctx.restore();
}
/** Bridge decks rotate like roads; stone uses the second row of the sheet. */
export function drawBridgeTile(ctx:CanvasRenderingContext2D,bridges:HTMLImageElement,entity:Pick<Entity,'x'|'y'|'blueprintId'>,entities:readonly Entity[],tile:number,ox:number,oy:number,landAt:(x:number,y:number)=>boolean=()=>false,extra:ReadonlySet<string>=new Set()) {
    const at=(x:number,y:number)=>entities.find(e=>e.x===x&&e.y===y);
    const mask=bridgeMask(entity.x,entity.y,(x,y)=>extra.has(`${x}:${y}`)||!!at(x,y)&&isBridge(at(x,y)!),(x,y)=>{const e=at(x,y);return !!e&&isRoadLike(e)&&!isBridge(e);},landAt);
    const sprite=roadSprite(mask);ctx.save();ctx.translate(ox+(entity.y+.5)*tile,oy+(entity.x+.5)*tile);ctx.rotate(sprite.rotation*Math.PI/2);
    ctx.drawImage(bridges,sprite.column*100,entity.blueprintId==='stone-bridge'?100:0,100,100,-tile/2,-tile/2,tile,tile);ctx.restore();
}
/** Clips out bridge decks so whatever is drawn next swims under them. `fromRow` keeps
 * decks behind the swimmer (smaller rows) visible beneath a body drawn up over them. */
export function clipUnderBridges(ctx:CanvasRenderingContext2D,bridges:Iterable<{x:number;y:number}>,tile:number,ox:number,oy:number,fromRow=-Infinity) {
    ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);
    for(const deck of bridges)if(deck.x>=fromRow)ctx.rect(ox+deck.y*tile,oy+deck.x*tile,tile,tile);
    ctx.clip('evenodd');
}
const outlineCache=new WeakMap<HTMLImageElement,Map<string,HTMLCanvasElement>>();
function buildingOutline(image:HTMLImageElement,crop:readonly number[],width:number,height:number,ratio:number) {
    let cache=outlineCache.get(image);
    if(!cache){cache=new Map();outlineCache.set(image,cache);}
    const key=JSON.stringify([crop,width,height,ratio]);
    let mask=cache.get(key);
    if(!mask){
        mask=document.createElement('canvas');
        mask.width=Math.max(1,Math.ceil(width*ratio));mask.height=Math.max(1,Math.ceil(height*ratio));
        const outline=mask.getContext('2d')!;
        outline.setTransform(ratio,0,0,ratio,0,0);
        outline.drawImage(image,crop[0]!,crop[1]!,crop[2]!,crop[3]!,0,0,width,height);
        outline.globalCompositeOperation='source-in';
        outline.fillStyle='#63b777';outline.fillRect(0,0,width,height);
        if(cache.size>=4)cache.delete(cache.keys().next().value!);
        cache.set(key,mask);
    }
    return mask;
}
/** Shared selection glow for every sprite (buildings, rafts): it follows the
 * artwork's alpha, so the tiles around the sprite are never highlighted. */
export function drawSelectionOutline(ctx:CanvasRenderingContext2D,image:HTMLImageElement,crop:readonly number[],x:number,y:number,width:number,height:number) {
    const mask=buildingOutline(image,crop,width,height,Math.min(globalThis.devicePixelRatio||1,2));
    ctx.save();ctx.shadowColor='#7bdb8e';ctx.shadowBlur=9;
    for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2],[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]]) ctx.drawImage(mask,x+dx!,y+dy!,width,height);
    ctx.restore();
}
export function snowSculptureCrop(blueprintId: string, direction?: Direction): readonly [number, number, number, number] {
    if (blueprintId === 'snow-tree') {
        return [0, 0, 256, 256] as const;
    }
    const frameIndex = direction === 'right' ? 1 : direction === 'back' ? 2 : direction === 'left' ? 3 : 0;
    return [frameIndex * 256, 0, 256, 256] as const;
}

export function drawSnowSculpture(
    ctx: CanvasRenderingContext2D,
    images: Map<string, HTMLImageElement>,
    entity: Entity,
    tile: number,
    ox: number,
    oy: number,
    occluders?: TownOccluder[],
    options: BuildingRenderOptions = {}
) {
    const file = `xmas/${entity.blueprintId}`;
    const img = images.get(file);
    const px = ox + entity.y * tile, py = oy + entity.x * tile;
    const rows = 1, columns = 1;
    const dw = columns * tile, dh = rows * tile + tile * 0.9;
    const crop = snowSculptureCrop(entity.blueprintId, entity.direction);
    const scale = Math.min(dw / crop[2], dh / crop[3]);
    const artWidth = crop[2] * scale, artHeight = crop[3] * scale;
    const artX = px + (dw - artWidth) / 2, artY = py + rows * tile - artHeight;
    if (img?.complete && img.naturalWidth) {
        occluders?.push({ depth: entity.x + rows, image: img, crop, x: artX, y: artY, width: artWidth, height: artHeight });
        if (entity.id === options.selectedId) drawSelectionOutline(ctx, img, crop, artX, artY, artWidth, artHeight);
        ctx.drawImage(img, crop[0], crop[1], crop[2], crop[3], artX, artY, artWidth, artHeight);
    }
}

/** Every map uses this exterior, including resident/business wooden boards. */
export function drawTownBuilding(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,entity:Entity,environment:Environment,tile:number,ox:number,oy:number,entities:Entity[]=[],occluders?:TownOccluder[],options:BuildingRenderOptions={}) {
    const season=SEASONS.indexOf(environment.season),e=entity;
    const b=BLUEPRINTS.find(b=>b.id===entity.blueprintId)!;
    if(b.id==='halloween-lantern'){
        drawHalloweenLantern(ctx,images,{id:0,x:entity.x,y:entity.y,post:0,variant:0},{tile,offsetX:ox,offsetY:oy},entity.direction==='back',entity.id===options.selectedId?(...args)=>drawSelectionOutline(ctx,...args):undefined);return;
    }
    if (isSnowSculpture(b.id)) {
        drawSnowSculpture(ctx, images, entity, tile, ox, oy, occluders, options);
        return;
    }
    // A farm gate stands on its own dirt road; the gate itself swings in the moving layer.
    if(b.kind==='road'||b.id==='farm-gate') {
        const road=images.get('roads');if(!road?.complete||!road.naturalWidth)return;
        drawRoadTile(ctx,road,entity,b.id==='rocky-road',entities,tile,ox,oy,options.roadTiles);return;
    }
    if(b.kind==='bridge') {
        const bridges=images.get('bridges');if(!bridges?.complete||!bridges.naturalWidth)return;
        drawBridgeTile(ctx,bridges,entity,entities,tile,ox,oy,options.landAt);return;
    }
    if(b.kind==='fence') {
        const x=entity.x,y=entity.y,cx=ox+(y+.5)*tile,cy=oy+(x+.7)*tile;
        // Rails reach a farm gate in the line, just as they reach another fence.
        const neighbors=[[x-1,y],[x,y+1],[x+1,y],[x,y-1]].filter(([nx,ny])=>entities.some(e=>(e.blueprintId==='wooden-fence'||e.blueprintId==='farm-gate')&&e.x===nx&&e.y===ny));
        ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
        for(const lift of [.25,.5])for(const [nx,ny]of neighbors.length?neighbors:[[x,y-.45],[x,y+.45]]) {
            ctx.beginPath();ctx.moveTo(cx,cy-lift*tile);ctx.lineTo(cx+(ny!-y)*tile*.5,cy+(nx!-x)*tile*.5-lift*tile);ctx.strokeStyle='#6b4935';ctx.lineWidth=tile*.18;ctx.stroke();ctx.strokeStyle='#dfb67c';ctx.lineWidth=tile*.1;ctx.stroke();
        }
        ctx.fillStyle='#dfb67c';ctx.strokeStyle='#6b4935';ctx.lineWidth=Math.max(1,tile*.06);ctx.beginPath();ctx.roundRect(cx-tile*.1,cy-tile*.72,tile*.2,tile*.8,tile*.06);ctx.fill();ctx.stroke();ctx.restore();return;
    }
    if(b.kind==='garden') {
        const px=ox+entity.y*tile,py=oy+entity.x*tile;
        ctx.save();ctx.fillStyle='#c09971';ctx.strokeStyle=entity.id===options.selectedId?'#63b777':'#946642';ctx.lineWidth=Math.max(1,tile*.07);ctx.beginPath();ctx.roundRect(px+tile*.07,py+tile*.1,tile*1.86,tile*1.8,tile*.2);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#ad8259';ctx.lineWidth=tile*.03;for(let row=0;row<3;row++){ctx.beginPath();ctx.moveTo(px+tile*.2,py+tile*(.5+row*.5));ctx.lineTo(px+tile*1.8,py+tile*(.5+row*.5));ctx.stroke();}
        ctx.restore();return;
    }
    const px=ox+e.y*tile,py=oy+e.x*tile;
    const civAtlas=CIV_ART.buildings[b.id];
    // A turned building swaps its rows and columns and shows its own left, right or rear artwork.
    const turned=buildingView(b.id,e.direction),shelter=shelterView(e),footprint=entityFootprint(e),rows=footprint.width,columns=footprint.length;
    const file = shelter?.closed ?? turned?.file ?? civAtlas?.file ?? (b.id === 'farmhouse' ? FARMHOUSE_ART.file : b.id === 'town-storage' ? 'town-storage-v1' : b.id === 'coop' ? 'coop' : b.id === 'animal-habitat' ? 'habitat' : b.kind === 'tree' ? 'trees' : 'buildings');
    const img = images.get(file);
    const index = civAtlas ? (e.civ?.phase==='ready'?1:0) : b.id === 'farmhouse' || b.id === 'town-storage' || b.id === 'coop' || b.id === 'animal-habitat' ? 0 : b.kind === 'tree' ? season * 3 + b.art : b.art;
    const dw = columns * tile, dh = rows * tile + tile * .9;
    // Signs and clocks never turn with the building: they stand at the near corner on the door's side,
    // except a barn seen from the back, whose left end is the hay bay where sheltering animals sleep.
    const signLeft=e.direction==='left'||e.direction==='back'&&b.id!=='farmhouse';
    if (img?.complete && img.naturalWidth) {
        const crop = shelter?.crop ?? turned?.crop ?? CROPS[file]!.rects[index]!;
        const scale = Math.min(dw / crop[2]!, dh / crop[3]!);
        const artWidth = crop[2]! * scale, artHeight = crop[3]! * scale;
        const artX=px+(dw-artWidth)/2, artY=py+rows*tile-artHeight;
        occluders?.push({depth:e.x+rows,image:img,crop,x:artX,y:artY,width:artWidth,height:artHeight});
        if(e.id===options.selectedId)drawSelectionOutline(ctx,img,crop,artX,artY,artWidth,artHeight);
        // Sheltering shows the interior behind the hollow shell; until those layers decode it shows the door-open art, then the closed art.
        const sheltered=!!shelter&&(shelter.alwaysSheltered||!!options.sheltered?.has(e.id)),hollow=shelter?images.get(shelter.hollow):undefined,interior=shelter?images.get(shelter.interior):undefined,open=sheltered&&shelter?images.get(shelter.open):undefined;
        const opened=sheltered&&hollow?.complete&&hollow.naturalWidth&&interior?.complete&&interior.naturalWidth;
        if(opened)ctx.drawImage(shelterInteriorTint(interior,environment),crop[0]!,crop[1]!,crop[2]!,crop[3]!,artX,artY,artWidth,artHeight);
        const sheltering=sheltered&&open?.complete&&open.naturalWidth?open:img;
        ctx.drawImage(opened?hollow:sheltering, crop[0]!, crop[1]!, crop[2]!, crop[3]!, artX, artY, artWidth, artHeight);
        const business=businessFor(e.blueprintId);
        if(business&&e.civ?.phase==='ready'){
            const sign=images.get('animalSign'),iconsImage=images.get(CIV_ART.icons.file);
            if(sign?.complete&&sign.naturalWidth&&iconsImage?.complete&&iconsImage.naturalWidth){
                const c=ANIMAL_SIGNPOST.rect,f=ANIMAL_SIGNPOST.face,w=tile*.86,scale=w/c[2]!,h=c[3]!*scale,x=signLeft?px+tile*.08:px+dw-w-tile*.08,y=py+rows*tile-h;
                ctx.drawImage(sign,c[0]!,c[1]!,c[2]!,c[3]!,x,y,w,h);
                occluders?.push({depth:e.x+rows+BOARD_DEPTH_OFFSET,image:sign,crop:c,x,y,width:w,height:h,ownerId:e.id,interiorOnly:true});
                const icon=CIV_ART.icons.rects[business.icon]!,size=f[2]!*scale*.84,k=Math.min(size/icon[2]!,size/icon[3]!);
                ctx.drawImage(iconsImage,icon[0]!,icon[1]!,icon[2]!,icon[3]!,x+(f[0]!+f[2]!/2)*scale-icon[2]!*k/2,y+(f[1]!+f[3]!/2)*scale-icon[3]!*k/2,icon[2]!*k,icon[3]!*k);
            }
        }
        const species=animalSpecies(e);
        const icons=petCapacity(e.blueprintId)?residentSpecies(e):species?[species]:[];
        const sign=images.get('animalSign')!, heads=images.get('animal-heads-v1')!;
        if(icons.length&&sign?.complete&&sign.naturalWidth&&heads?.complete&&heads.naturalWidth) {
            const board=ANIMAL_SIGNPOST.rect,face=ANIMAL_SIGNPOST.face;
            // Stand beside the entrance at the front-right of the existing plot.
            const signWidth=Math.min(dw*.31,tile*.86),signScale=signWidth/board[2]!;
            const signHeight=board[3]!*signScale;
            const signX=signLeft?px+tile*.08:px+dw-tile*.08-signWidth,signY=py+rows*tile-signHeight;
            ctx.drawImage(sign,board[0]!,board[1]!,board[2]!,board[3]!,signX,signY,signWidth,signHeight);
            occluders?.push({depth:e.x+rows+BOARD_DEPTH_OFFSET,image:sign,crop:board,x:signX,y:signY,width:signWidth,height:signHeight,ownerId:e.id,interiorOnly:true});
            const faceX=signX+face[0]!*signScale,faceY=signY+face[1]!*signScale,faceSize=face[2]!*signScale;
            const centers=icons.length===1?[[.5,.5]]:icons.length===2?[[.25,.5],[.75,.5]]:[[.5,.25],[.25,.73],[.75,.73]];
            icons.forEach((pet,i)=>{
                const icon=ANIMAL_HEADS.rects[TOWN_ANIMALS.indexOf(pet)]!;
                // One large head, a centered pair, or a triangle for three pets.
                const slotSize=faceSize*(icons.length===1?.88:.46);
                const centerX=faceX+faceSize*centers[i]![0]!,centerY=faceY+faceSize*centers[i]![1]!;
                const iconScale=Math.min(slotSize/icon[2]!,slotSize/icon[3]!);
                const iconWidth=icon[2]!*iconScale,iconHeight=icon[3]!*iconScale;
                ctx.drawImage(heads,icon[0]!,icon[1]!,icon[2]!,icon[3]!,centerX-iconWidth/2,centerY-iconHeight/2,iconWidth,iconHeight);
            });
        }
    }
    if (environment.snowCover) {
        ctx.fillStyle = 'rgba(255,253,244,.72)';
        ctx.beginPath();
        ctx.ellipse(px + dw / 2, py + tile * .12, dw * .32, tile * .13, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** Dynamic contents stay outside the terrain/exterior cache on every map. */
export function drawBuildingContents(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,entity:Entity,environment:Environment,tile:number,ox:number,oy:number,time:number,reducedMotion=false,showStatus=true) {
    const plants=images.get('crop-growth')!;
    if(entity.blueprintId==='vegetable-patch'&&plants?.complete&&plants.naturalWidth) {const patch=entity;
        for(const [index,slot]of (patch.garden?.slots??[]).entries()) {
            const crop=GARDEN_CROPS.find(c=>c.id===slot.crop);if(!crop)continue;
            const stage=cropStage(slot),artStage=crop.id==='carrot'&&stage===2?1:stage;
            const rect=GARDEN_ATLASES['crop-growth'].rects[GARDEN_CROPS.indexOf(crop)*4+artStage]!;
            const size=tile*(stage===0?.42:stage===1?.68:stage===2?.85:.98);
            const scale=Math.min(size/rect[2],size/rect[3]);
            const x=ox+(patch.y+index%2+.5)*tile,y=oy+(patch.x+Math.floor(index/2)+.85)*tile;
            if(slot.withered){drawWitheredCrop(ctx,images.get('withered-plant-v1'),x,y,tile*.95);continue;}
            const wind=environment.windSpeed??0;const movement=reducedMotion?0:Math.sin(time/650+index)*Math.min(.07,wind/300)+(environment.precipitation==='rain'?Math.sin(time/230+index)*.025:0);
            ctx.save();ctx.translate(x,y);ctx.rotate(movement);
            // Calm nighttime leaves lower slightly; mature fruit keeps its silhouette.
            const rest=(environment.isDay===false||environment.timeOfDay==='night')&&stage<3?.93:1;
            ctx.drawImage(plants,rect[0],rect[1],rect[2],rect[3],-rect[2]*scale/2,-rect[3]*scale*rest,rect[2]*scale,rect[3]*scale*rest);ctx.restore();
        }
        if(showStatus&&(patch.garden?.boost??0)>0){ctx.font=`bold ${Math.max(11,tile*.65)}px Nunito`;ctx.fillStyle='#365839';ctx.fillText('🌱↑',ox+(patch.y+.5)*tile,oy+(patch.x+.15)*tile);}
    }
}
