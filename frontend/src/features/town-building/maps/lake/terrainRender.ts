import type {Entity} from '../../../../../../server/src/town-building/game';
import type {Environment} from '../../../../../../server/src/town-building/environment';
import {entityFootprint} from '../../../../../../server/src/town-building/game';
import {LAKE_ISLAND,lakeTerrainAt} from '../../../../../../server/src/town-building/maps/lake/terrain';
import {TERRAIN_SHEET} from '../../terrainAtlas';
import {TERRAIN_PALETTES,terrainDetail} from '../../terrainStyle';
import {SEASONS} from '../../TownArt';
import {drawShoreline,roundedBankPoints} from '../../shoreline';
import {drawMapGrid} from '../../mapGrid';
import {FOREST_GROUND} from '../../forestWorld';
import {drawLakeScenery} from './sceneryRender';
import {lakeDepthOutline} from './depthBorder';

export function drawLakeTerrain(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,environment:Environment,entities:Entity[],geometry:{tile:number;x:number;y:number;width:number;height:number},editing:boolean) {
    const {tile,x:ox,y:oy}=geometry,season=SEASONS.indexOf(environment.season),palette=TERRAIN_PALETTES[environment.season];
    const project=(p:{x:number;y:number})=>({x:ox+p.x*tile,y:oy+p.y*tile});
    const outline=roundedBankPoints([{x:-4,y:15},{x:7,y:15},{x:7,y:0},{x:40,y:0},{x:40,y:15},{x:44,y:15},{x:44,y:18},{x:40,y:18},{x:40,y:20},{x:7,y:20},{x:7,y:18},{x:-4,y:18}],1).map(project);
    ctx.fillStyle=FOREST_GROUND[environment.season];ctx.fillRect(0,0,geometry.width,geometry.height);
    ctx.fillStyle=TERRAIN_SHEET.groundColors[season]!;ctx.fillRect(ox,oy,40*tile,20*tile);
    const waterPath=new Path2D();waterPath.moveTo(outline[0]!.x,outline[0]!.y);for(const point of outline.slice(1))waterPath.lineTo(point.x,point.y);waterPath.closePath();
    ctx.fillStyle=palette.water;ctx.fill(waterPath);
    const depth=lakeDepthOutline().map(project),depthPath=new Path2D();
    depthPath.moveTo(depth[0]!.x,depth[0]!.y);for(const point of depth.slice(1))depthPath.lineTo(point.x,point.y);depthPath.closePath();
    ctx.save();ctx.clip(waterPath);ctx.fillStyle='#557f91';ctx.globalAlpha=.2;ctx.fill(depthPath);
    // A submerged shelf has a soft blue ribbon, using the rounded bank geometry.
    // Feather inside the fill so the transition doesn't shift habitat locations.
    ctx.clip(depthPath);ctx.strokeStyle=palette.water;ctx.lineJoin='round';ctx.lineCap='round';
    for(const [width,alpha]of [[.28,.16],[.18,.22],[.08,.32]]){ctx.lineWidth=tile*width!;ctx.globalAlpha=alpha!;ctx.stroke(depthPath);}
    ctx.restore();
    const shore=images.get('shoreline');if(shore)drawShoreline(ctx,shore,outline,tile);
    const island=LAKE_ISLAND,islandPath=roundedBankPoints([{x:island.y+island.length/2,y:island.x},{x:island.y+island.length,y:island.x},{x:island.y+island.length,y:island.x+island.width},{x:island.y,y:island.x+island.width},{x:island.y,y:island.x},{x:island.y+island.length/2,y:island.x}],.3).map(project);
    ctx.beginPath();ctx.moveTo(islandPath[0]!.x,islandPath[0]!.y);for(const point of islandPath.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();ctx.fillStyle=TERRAIN_SHEET.groundColors[season]!;ctx.fill();if(shore)drawShoreline(ctx,shore,islandPath,tile);
    drawLakeScenery(ctx,images,environment.season,geometry);
    const terrain=images.get('terrain');
    if(terrain?.complete&&terrain.naturalWidth){
        const occupied=new Set<string>();
        for(const entity of entities){const b=entityFootprint(entity);for(let x=b.x;x<b.x+b.width;x++)for(let y=b.y;y<b.y+b.length;y++)occupied.add(`${x}:${y}`);}
        for(let row=0;row<20;row++)for(let col=0;col<40;col++){
            const kind=lakeTerrainAt(row,col),water=kind!=='grass';
            let column=water?(col*7+row*11)%9===0?6:null:occupied.has(`${row}:${col}`)?null:terrainDetail(row,col);
            if(column===1&&(environment.season==='winter'?(row+col)%3!==0:environment.season==='autumn'&&(row+col)%2!==0))column=null;
            if(column===null)continue;
            const crop=TERRAIN_SHEET.rects[season*8+column]!,size=tile*(water?.65:.68),scale=Math.min(size/crop[2],size/crop[3]);
            ctx.drawImage(terrain,crop[0],crop[1],crop[2],crop[3],ox+(col+.16)*tile+(size-crop[2]*scale)/2,oy+(row+.16)*tile+(size-crop[3]*scale)/2,crop[2]*scale,crop[3]*scale);
        }
    }
    // This outlet remains blocked until the next map is introduced.
    if(terrain?.complete&&terrain.naturalWidth){const rock=TERRAIN_SHEET.rects[season*8+4]!;for(const [row,col,size]of [[15.35,40.2,1.5],[16.25,40.55,1.8],[17.45,40.15,1.65],[15.7,41.5,1.25],[17.1,41.6,1.35]]){const scale=size!*tile/rock[2];ctx.drawImage(terrain,rock[0],rock[1],rock[2],rock[3],ox+col!*tile-rock[2]*scale/2,oy+row!*tile-rock[3]*scale/2,rock[2]*scale,rock[3]*scale);}}
    if(environment.snowCover){ctx.fillStyle='rgba(255,253,242,.42)';for(let row=0;row<20;row++)for(let col=0;col<40;col++)if(lakeTerrainAt(row,col)==='grass')ctx.fillRect(ox+col*tile,oy+row*tile,tile+.5,tile+.5);}
    if(editing)drawMapGrid(ctx,tile,ox,oy);
}
