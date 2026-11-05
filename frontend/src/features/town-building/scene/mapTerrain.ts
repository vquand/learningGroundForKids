import type {Entity,Season} from '../../../../../server/src/town-building/game';
import type {Environment} from '../../../../../server/src/town-building/environment';
import type {MapId} from '../../../../../server/src/town-building/maps/types';
import type {ScenerySide,SceneryFile} from '../sceneryLayout';
import {drawTownTerrain,drawTownForeground,drawTownScenery} from '../maps/town/terrainRender';
import {drawLakeTerrain} from '../maps/lake/terrainRender';
import {drawLakeScenery,drawLakeStrip} from '../maps/lake/sceneryRender';

export type SceneGeometry={tile:number;x:number;y:number;width:number;height:number};
/** The only per-map part of a scene: its ground, scenery and the strips that
 * overlap animals at the map's edge. Everything else is shared. */
export interface MapTerrain {
    background(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,environment:Environment,entities:readonly Entity[],g:SceneGeometry,editing:boolean):void;
    foreground(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,season:Season,g:SceneGeometry):void;
    strip(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,season:Season,g:SceneGeometry,side:ScenerySide,file:SceneryFile,backdrop?:boolean):void;
}
export const MAP_TERRAIN:Record<MapId,MapTerrain>={
    town:{background:drawTownTerrain,foreground:drawTownForeground,strip:drawTownScenery},
    lake:{
        background:(ctx,images,environment,entities,g,editing)=>drawLakeTerrain(ctx,images,environment,[...entities],g,editing),
        foreground:(ctx,images,season,g)=>drawLakeScenery(ctx,images,season,g,true),
        strip:drawLakeStrip,
    },
};
