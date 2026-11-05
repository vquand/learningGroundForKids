import {townSceneGeometry,WORLD_ROWS,SCENERY_TOP} from './forestWorld.ts';
export interface TownPoint {x:number;y:number}
export interface TownView {zoom:number;camera:TownPoint}
function bounded(view:TownView,width:number,height:number):TownView {
    const zoom=Math.max(1,Math.min(2,Number.isFinite(view.zoom)?view.zoom:1));
    const g=townSceneGeometry(width,height,zoom,view.camera);
    if(!g.tile)return {zoom,camera:{x:0,y:0}};
    const clean=(n:number)=>Math.abs(n)<1e-10?0:n;
    return {zoom,camera:{x:clean(((height-WORLD_ROWS*g.tile)/2+SCENERY_TOP*g.tile-g.offsetY)/g.tile),y:clean(((width-40*g.tile)/2-g.offsetX)/g.tile)}};
}
export function panTownView(view:TownView,dx:number,dy:number,width:number,height:number):TownView {
    const g=townSceneGeometry(width,height,view.zoom,view.camera);
    return bounded({zoom:view.zoom,camera:{x:view.camera.x-dy/g.tile,y:view.camera.y-dx/g.tile}},width,height);
}
export function zoomTownView(view:TownView,target:number,point:TownPoint,width:number,height:number):TownView {
    const zoom=Math.max(1,Math.min(2,target)),g=townSceneGeometry(width,height,view.zoom,view.camera),tile=g.tile*zoom/view.zoom;
    const offsetX=point.x-(point.x-g.offsetX)*tile/g.tile,offsetY=point.y-(point.y-g.offsetY)*tile/g.tile;
    return bounded({zoom,camera:{x:((height-WORLD_ROWS*tile)/2+SCENERY_TOP*tile-offsetY)/tile,y:((width-40*tile)/2-offsetX)/tile}},width,height);
}
export function gestureTownView(view:TownView,start:TownPoint[],current:TownPoint[],width:number,height:number):TownView {
    if(!start.length||!current.length)return view;
    if(start.length===1||current.length===1)return panTownView(view,current[0]!.x-start[0]!.x,current[0]!.y-start[0]!.y,width,height);
    const center=(p:TownPoint[])=>({x:(p[0]!.x+p[1]!.x)/2,y:(p[0]!.y+p[1]!.y)/2});
    const distance=(p:TownPoint[])=>Math.hypot(p[1]!.x-p[0]!.x,p[1]!.y-p[0]!.y);
    const a=center(start),b=center(current),length=distance(start);
    if(length<1)return view;
    return panTownView(zoomTownView(view,view.zoom*distance(current)/length,a,width,height),b.x-a.x,b.y-a.y,width,height);
}
/** Map controls drawn over the scene never outgrow a house: at most 3 tiles wide and 2 tall
 * (or a taller box such as 2 wide × 3 tall). They shrink to fit, keeping their proportions, and never grow. */
export function fitTiles(width:number,height:number,tile:number,cols=3,rows=2):{width:number;height:number} {
    const scale=tile>0?Math.min(1,cols*tile/width,rows*tile/height):1;
    return {width:width*scale,height:height*scale};
}
