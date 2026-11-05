import type {MapId} from '../../../../../server/src/town-building/maps/types';
import type {MapView} from './viewport';
const key=(scope:string,mapId:MapId)=>`town-map-view:${scope}:${mapId}`;
/** Cosmetic camera preferences only, scoped to the mounted family/profile. */
export function readMapView(scope:string,mapId:MapId):MapView {
    try {const v=JSON.parse(sessionStorage.getItem(key(scope,mapId))??'null');if(v&&Number.isFinite(v.zoom)&&v.zoom>=1&&v.zoom<=2&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.abs(v.x)<100000&&Math.abs(v.y)<100000)return v;}catch{}
    return {zoom:1,x:0,y:0};
}
export function saveMapView(scope:string,mapId:MapId,view:MapView):void {
    try{sessionStorage.setItem(key(scope,mapId),JSON.stringify(view));}catch{}
}
