import type {Entity} from '../../../../../../server/src/town-building/game';
import type {Environment} from '../../../../../../server/src/town-building/environment';
import type {Season} from '../../../../../../server/src/town-building/game';
import {entityFootprint,terrainAt} from '../../../../../../server/src/town-building/game';
import {CIV_GATE} from '../../../../../../server/src/town-building/civ';
import {SEASONS} from '../../TownArt';
import {SCENERY_ATLASES} from '../../sceneryAtlas';
import {sceneryStrips,type ScenerySide,type SceneryFile} from '../../sceneryLayout';
import {TERRAIN_SHEET} from '../../terrainAtlas';
import {TERRAIN_PALETTES,foregroundVegetation,vegetationAt} from '../../terrainStyle';
import {FOREST_GROUND,isForestTile} from '../../forestWorld';
import {riverSceneryBankPoints,drawShoreline} from '../../shoreline';
import {drawMapGrid} from '../../mapGrid';
import {TOWN_RING_LAYERS} from '../../townRing.generated';

type Geometry={tile:number;x:number;y:number;width:number;height:number};
/** The baked scenery ring of this season and layer (whole trees, no clipping), or null while it is not loaded. */
function ring(images:Map<string,HTMLImageElement>,season:Season,layer:'back'|'front'){
    const key=`ring-${season}-${layer}`,image=images.get(key),place=TOWN_RING_LAYERS[`${season}-${layer}`];
    return image?.complete&&image.naturalWidth&&place?{image,place}:null;
}
function drawRing(ctx:CanvasRenderingContext2D,g:Geometry,baked:NonNullable<ReturnType<typeof ring>>) {
    const {tile,x,y}=g,{image,place}=baked;
    ctx.drawImage(image,x+place.x*tile,y+place.y*tile,place.width*tile,place.height*tile);
}
/** Margin rectangles (tile units) used to lift the ring above an animal walking in that margin. */
const MARGIN={top:{x:-3,y:-3,w:46,h:3},left:{x:-3,y:0,w:3,h:20},right:{x:40,y:0,w:3,h:20}} as const;
/** One Town scenery strip; the west side keeps an opening for the arrival road. */
export function drawTownScenery(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,season:Season,g:Geometry,side:ScenerySide,file:SceneryFile,backdrop=false) {
    const baked=side==='bottom'?ring(images,season,'front'):ring(images,season,'back');
    if(baked){
        // Animals in the scenery margin walk behind the baked trees: redraw the ring over just that margin.
        ctx.save();
        if(side!=='bottom'){const m=MARGIN[side];ctx.beginPath();ctx.rect(g.x+m.x*g.tile,g.y+m.y*g.tile,m.w*g.tile,m.h*g.tile);ctx.clip();}
        drawRing(ctx,g,baked);ctx.restore();return;
    }
    const image=images.get(file);if(!image?.complete||!image.naturalWidth)return;
    const {tile,x:offsetX,y:offsetY}=g,atlas=SCENERY_ATLASES[file],forest=file==='forest-strips';
    const row=forest?SEASONS.indexOf(season):season==='winter'?1:0,count=forest?3:2;
    ctx.save();
    if(side==='left'){
        // One permanent opening shared by trees, mountains and the arrival road.
        ctx.beginPath();ctx.rect(0,0,g.width,g.height);
        ctx.rect(offsetX-3.5*tile,offsetY+(CIV_GATE.x-.2)*tile,3.5*tile,1.4*tile);
        ctx.clip('evenodd');
    }
    for(const strip of sceneryStrips(side,file,backdrop)){
        const crop=atlas.rects[row*count+strip.variant]!,w=strip.width*tile,h=w*crop[3]!/crop[2]!;
        ctx.drawImage(image,crop[0]!,crop[1]!,crop[2]!,crop[3]!,offsetX+strip.x*tile,offsetY+strip.root*tile-h,w,h);
    }
    ctx.restore();
}
/** Town ground, river, scenery, entrance road and protected mountain corner. */
export function drawTownTerrain(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,environment:Environment,entities:readonly Entity[],g:Geometry,editing:boolean) {
    const {tile,x:offsetX,y:offsetY,width,height}=g;
    ctx.fillStyle=FOREST_GROUND[environment.season];
    ctx.fillRect(0,0,width,height);
    const season=SEASONS.indexOf(environment.season),terrain=images.get('terrain');
    const palette=TERRAIN_PALETTES[environment.season],ground=TERRAIN_SHEET.groundColors[season]!;
    const terrainReady=!!terrain?.complete&&terrain.naturalWidth>0;
    function detail(column:number,px:number,py:number,boxWidth:number,boxHeight=boxWidth) {
        if(!terrainReady)return;
        const rect=TERRAIN_SHEET.rects[season*8+column]!,scale=Math.min(boxWidth/rect[2],boxHeight/rect[3]);
        const w=rect[2]*scale,h=rect[3]*scale;
        ctx.drawImage(terrain!,rect[0],rect[1],rect[2],rect[3],px+(boxWidth-w)/2,py+(boxHeight-h)/2,w,h);
    }
    // A continuous flat ground plane prevents seams and busy repeated texture.
    ctx.fillStyle=ground;ctx.fillRect(offsetX,offsetY,40*tile,20*tile);
    const scenery=(side:ScenerySide,file:SceneryFile,backdrop=false)=>drawTownScenery(ctx,images,environment.season,g,side,file,backdrop);
    const bakedBack=ring(images,environment.season,'back');
    if(bakedBack)drawRing(ctx,g,bakedBack);
    else{
        scenery('top','mountain-strips',true);
        for(const side of ['top','left','right'] as const)scenery(side,'mountain-strips');
        for(const side of ['top','left','right'] as const)scenery(side,'forest-strips');
    }
    // Fixed stone road through the west scenery. It occupies no buildable cells.
    const entranceRoad=images.get('roads');
    if(entranceRoad?.complete&&entranceRoad.naturalWidth)for(let y=-3;y<0;y++){
        ctx.save();ctx.translate(offsetX+(y+.5)*tile,offsetY+(CIV_GATE.x+.5)*tile);ctx.rotate(Math.PI/2);
        ctx.drawImage(entranceRoad,200,100,100,100,-tile/2,-tile/2,tile,tile);ctx.restore();
    }
    const banks=[riverSceneryBankPoints(0,tile,offsetX,offsetY,width),riverSceneryBankPoints(3,tile,offsetX,offsetY,width)];
    const riverOutline=[...banks[0]!,...[...banks[1]!].reverse()];
    ctx.fillStyle=palette.water;ctx.beginPath();ctx.moveTo(riverOutline[0]!.x,riverOutline[0]!.y);
    for(const point of riverOutline.slice(1))ctx.lineTo(point.x,point.y);
    ctx.closePath();ctx.fill();
    const shoreline=images.get('shoreline');if(shoreline)for(const bank of banks)drawShoreline(ctx,shoreline,bank,tile);
    const occupied=new Set<string>();
    for(const entity of entities){
        const placed=entityFootprint(entity);
        for(let x=placed.x;x<placed.x+placed.width;x++)for(let y=placed.y;y<placed.y+placed.length;y++)occupied.add(`${x}:${y}`);
    }
    for(let x=0;x<20;x++)for(let y=0;y<40;y++){
        const px=offsetX+y*tile,py=offsetY+x*tile;
        if(px+tile<0||py+tile<0||px>width||py>height)continue;
        const kind=terrainAt(x,y);
        if(kind==='river'){if((y*7+x*11)%9===0)detail(6,px+tile*.18,py+tile*.22,tile*.65);}
        else if(kind==='grass'&&!occupied.has(`${x}:${y}`)){
            const column=vegetationAt(x,y,environment.season,[...entities],'town');
            if(column!==null)detail(column,px+tile*.16,py+tile*.16,tile*.68);
        }
    }
    if(environment.snowCover){
        // Surface wash leaves the outlined props and shoreline recognizable.
        // The river is curved, so mask by its drawn outline, not by the straight river grid cells (those left lighter/darker rectangles on the bends).
        ctx.save();ctx.beginPath();ctx.rect(offsetX,offsetY,40*tile,20*tile);
        ctx.moveTo(riverOutline[0]!.x,riverOutline[0]!.y);for(const point of riverOutline.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();
        ctx.clip('evenodd');ctx.fillStyle='rgba(255,253,242,.42)';ctx.fillRect(offsetX,offsetY,40*tile,20*tile);ctx.restore();
    }
    if(editing)drawMapGrid(ctx,tile,offsetX,offsetY);
    // Organic foothills and staggered peaks soften the protected scenery corner.
    ctx.save();ctx.translate(offsetX,offsetY);ctx.scale(tile,tile);ctx.fillStyle=palette.mountain;ctx.beginPath();
    ctx.moveTo(0,0);ctx.lineTo(6.3,0);
    ctx.bezierCurveTo(7.35,.1,7.8,.65,7.45,1.55);ctx.bezierCurveTo(7.15,2.15,7.8,2.7,7.1,3.2);
    ctx.bezierCurveTo(6.6,3.65,5.7,3.4,5.15,4.1);ctx.bezierCurveTo(4.55,4.85,3.75,4.25,3.05,4.65);
    ctx.bezierCurveTo(2.35,5.1,1.5,4.45,0,4.65);ctx.closePath();ctx.fill();ctx.restore();
    detail(7,offsetX+tile*2.75,offsetY+tile*.15,tile*3.7,tile*3.7);
    detail(7,offsetX+tile*.45,offsetY+tile*1.05,tile*3.15,tile*3.15);
    detail(7,offsetX+tile*5.15,offsetY+tile*1.85,tile*2.1,tile*2.1);
    detail(4,offsetX+tile*1.15,offsetY+tile*3.65,tile*.8);
    detail(4,offsetX+tile*3.65,offsetY+tile*3.9,tile*.65);
    detail(4,offsetX+tile*6.15,offsetY+tile*3.25,tile*.75);
    for(const prop of foregroundVegetation([...entities],environment.season,'town'))if(isForestTile(prop.x,prop.y))detail(prop.column,offsetX+(prop.y+.16)*tile,offsetY+(prop.x+.16)*tile,tile*.68);
}
/** Forest and mountains along the bottom edge, drawn over buildings. */
export function drawTownForeground(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,season:Season,g:Geometry) {
    const baked=ring(images,season,'front');
    if(baked){drawRing(ctx,g,baked);return;}
    drawTownScenery(ctx,images,season,g,'bottom','forest-strips');
    drawTownScenery(ctx,images,season,g,'bottom','forest-strips',true);
    drawTownScenery(ctx,images,season,g,'bottom','mountain-strips');
}
