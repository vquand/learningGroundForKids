import type {Entity,Blueprint,Direction} from '../../../../../server/src/town-building/game';
import {BLUEPRINTS,canRotate,isLineBlueprint} from '../../../../../server/src/town-building/game';
import type {Environment} from '../../../../../server/src/town-building/environment';
import {LAKE_BLUEPRINTS,type LakeBlueprintId} from '../../../../../server/src/town-building/water/catalog';
import {drawBridgeTile,drawTownBuilding} from '../buildingRender';
import {roadSprite} from '../roadArt';
import type {RoadTile} from '../roadGlide';
import {LAKE_ATLAS} from '../maps/lake/LakeArt';
import {drawSprite} from './waterLayer';
import type {SceneGeometry} from './mapTerrain';

/** Where a tapped construction would stand: a building (turned to `direction`), a road,
 * fence or bridge tile, or a raft (`raftBlueprintId`), and whether it may be built there. */
export interface ScenePlacement{x:number;y:number;width:number;length:number;valid:boolean;blueprintId?:string;raftBlueprintId?:LakeBlueprintId;direction?:Direction}

/** The one construction preview for every blueprint: the piece as it will stand, faded,
 * then its tinted footprint with a dashed border on top (green when it fits, red when not)
 * and, for a building that turns, a chevron on the edge its door opens onto.
 * A glided `stroke` previews each of its road, fence or bridge tiles, joined together. */
export function drawPlacementPreview(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,environment:Environment,g:SceneGeometry,entities:readonly Entity[],placement:ScenePlacement,landAt:(x:number,y:number)=>boolean,stroke:readonly RoadTile[]=[]) {
    const tile=g.tile,blueprint=BLUEPRINTS.find(b=>b.id===placement.blueprintId);
    const line=!!blueprint&&isLineBlueprint(blueprint),tiles=line?(stroke.length?stroke:[placement]):[];
    ctx.save();ctx.globalAlpha=.72;
    if(line)drawLinePieces(ctx,images,g,entities,tiles,blueprint!,landAt);
    else if(blueprint)drawTownBuilding(ctx,images,{id:'placement-preview',blueprintId:blueprint.id,x:placement.x,y:placement.y,paidCost:{},...(placement.direction&&placement.direction!=='front'?{direction:placement.direction}:{})},environment,tile,g.x,g.y);
    else if(placement.raftBlueprintId){
        const raft=LAKE_BLUEPRINTS.find(b=>b.id===placement.raftBlueprintId)!;
        drawSprite(ctx,images.get('lake-structures'),LAKE_ATLAS['structures-v1'].rects[raft.art]!,g.x+(placement.y+raft.length/2)*tile,g.y+(placement.x+raft.width/2)*tile,raft.length*tile,(raft.width+.75)*tile);
    }
    ctx.restore();
    const areas=line?tiles.map(t=>({x:t.x,y:t.y,width:1,length:1})):[placement];
    ctx.save();ctx.fillStyle=placement.valid?'rgba(79,140,109,.23)':'rgba(190,84,64,.25)';ctx.strokeStyle=placement.valid?'#356d50':'#b45240';
    ctx.lineWidth=line?Math.max(1.5,tile*.08):2.5;ctx.setLineDash([5,3]);
    for(const a of areas){const px=g.x+a.y*tile,py=g.y+a.x*tile;ctx.fillRect(px,py,a.length*tile,a.width*tile);ctx.strokeRect(px+.75,py+.75,a.length*tile-1.5,a.width*tile-1.5);}
    ctx.restore();
    if(blueprint&&blueprint.kind!=='decoration'&&canRotate(blueprint.id))drawDoorMarker(ctx,g,placement);
}
/** A small chevron just outside the edge the door opens onto. */
function drawDoorMarker(ctx:CanvasRenderingContext2D,g:SceneGeometry,b:ScenePlacement){
    const tile=g.tile,direction=b.direction??'front',left=g.x+b.y*tile,top=g.y+b.x*tile,w=b.length*tile,h=b.width*tile;
    const [cx,cy,dx,dy]=direction==='left'?[left,top+h/2,-1,0]:direction==='right'?[left+w,top+h/2,1,0]:direction==='back'?[left+w/2,top,0,-1]:[left+w/2,top+h,0,1];
    const s=tile*.28;
    ctx.save();ctx.fillStyle=b.valid?'#356d50':'#b45240';ctx.strokeStyle='#fff8e7';ctx.lineWidth=1.5;ctx.beginPath();
    ctx.moveTo(cx!+dx!*s*1.4,cy!+dy!*s*1.4);ctx.lineTo(cx!-dy!*s+dx!*s*.2,cy!+dx!*s+dy!*s*.2);ctx.lineTo(cx!+dy!*s+dx!*s*.2,cy!-dx!*s+dy!*s*.2);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
/** Road, fence and bridge pieces, joined to each other and to their placed neighbours. */
function drawLinePieces(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,g:SceneGeometry,entities:readonly Entity[],tiles:readonly RoadTile[],blueprint:Blueprint,landAt:(x:number,y:number)=>boolean) {
    const tile=g.tile,roads=new Set([...entities.filter(e=>BLUEPRINTS.find(b=>b.id===e.blueprintId)?.kind==='road').map(e=>`${e.x}:${e.y}`),...tiles.map(p=>`${p.x}:${p.y}`)]);
for(const {x,y}of tiles){
    if(blueprint.kind==='fence'){
        const centerX=g.x+(y+.5)*tile,centerY=g.y+(x+.7)*tile;
        const neighbors=[[x-1,y],[x,y+1],[x+1,y],[x,y-1]].filter(([nx,ny])=>entities.some(e=>e.blueprintId==='wooden-fence'&&e.x===nx&&e.y===ny)||tiles.some(p=>p.x===nx&&p.y===ny));
        ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
        for(const lift of [.25,.5])for(const [nx,ny]of neighbors.length?neighbors:[[x,y-.45],[x,y+.45]]) {
            ctx.beginPath();ctx.moveTo(centerX,centerY-lift*tile);ctx.lineTo(centerX+(ny!-y)*tile*.5,centerY+(nx!-x)*tile*.5-lift*tile);ctx.strokeStyle='#6b4935';ctx.lineWidth=tile*.18;ctx.stroke();ctx.strokeStyle='#dfb67c';ctx.lineWidth=tile*.1;ctx.stroke();
        }
        ctx.fillStyle='#dfb67c';ctx.strokeStyle='#6b4935';ctx.lineWidth=Math.max(1,tile*.06);ctx.beginPath();ctx.roundRect(centerX-tile*.1,centerY-tile*.72,tile*.2,tile*.8,tile*.06);ctx.fill();ctx.stroke();ctx.restore();
    }else if(blueprint.kind==='bridge'){
        const image=images.get('bridges');if(!image?.complete||!image.naturalWidth)continue;
        drawBridgeTile(ctx,image,{x,y,blueprintId:blueprint.id},entities as Entity[],tile,g.x,g.y,landAt,new Set(tiles.map(p=>`${p.x}:${p.y}`)));
    }else{
        const image=images.get('roads');if(!image?.complete||!image.naturalWidth)continue;
        const mask=(roads.has(`${x-1}:${y}`)?1:0)|(roads.has(`${x}:${y+1}`)?2:0)|(roads.has(`${x+1}:${y}`)?4:0)|(roads.has(`${x}:${y-1}`)?8:0),sprite=roadSprite(mask);
        ctx.save();ctx.translate(g.x+(y+.5)*tile,g.y+(x+.5)*tile);ctx.rotate(sprite.rotation*Math.PI/2);
        ctx.drawImage(image,sprite.column*100,blueprint.id==='rocky-road'?100:0,100,100,-tile/2,-tile/2,tile,tile);ctx.restore();
    }
}}
