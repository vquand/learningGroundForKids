import {WORLD_COLUMNS,WORLD_ROWS,SCENERY_SIDE,SCENERY_TOP,SCENERY_BOTTOM} from '../forestWorld';
export interface MapView {zoom:number;x:number;y:number}
export function mapGeometry(width:number,height:number,view:MapView) {
    const tile=Math.min(width/WORLD_COLUMNS,height/WORLD_ROWS)*view.zoom;
    const clamp=(value:number,min:number,max:number)=>min<=max?Math.max(min,Math.min(max,value)):(min+max)/2;
    const x=clamp(view.x,width-(40+SCENERY_SIDE)*tile,SCENERY_SIDE*tile),y=clamp(view.y,height-(20+SCENERY_BOTTOM)*tile,SCENERY_TOP*tile);
    return {tile,x,y,width,height};
}
export function zoomMap(view:MapView,zoom:number,point:{x:number;y:number},width:number,height:number):MapView {
    const next=Math.max(1,Math.min(2,zoom)),g=mapGeometry(width,height,view),scale=next/view.zoom;
    const proposed={zoom:next,x:point.x-(point.x-g.x)*scale,y:point.y-(point.y-g.y)*scale};
    const bounded=mapGeometry(width,height,proposed);return {zoom:next,x:bounded.x,y:bounded.y};
}
