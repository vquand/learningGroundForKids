import type { HalloweenState } from '../../../../server/src/town-building/halloween';
import {drawHalloweenLantern,drawLanternGlow} from './lanternRender.ts';
import {lanternLightSources} from './lanternLayout.ts';
import type {Entity} from '../../../../server/src/town-building/game.ts';
export interface TownOccluder {
  depth:number;image:HTMLImageElement;crop:readonly number[];x:number;y:number;width:number;height:number;
  /** Signposts also cover their own shelter residents regardless of doorstep depth. */
  ownerId?:string;interiorOnly?:boolean;
}
interface Geometry {tile:number;offsetX:number;offsetY:number}
/** Transparent ground overlays, cached independently from terrain and ghosts.
 * Erase only the alpha of closer buildings/trees, so roofs hide posts naturally
 * without painting scenery over flying visitors or duplicating scene shading. */
export class HalloweenGroundLayers {
  private ground=document.createElement('canvas');
  private glow=document.createElement('canvas');
  private scratch=document.createElement('canvas');
  private key='';private occluders:readonly TownOccluder[]=[];
  private hasLanterns=false;
  prepare(images:Map<string,HTMLImageElement>,state:HalloweenState|undefined,geometry:Geometry,occluders:readonly TownOccluder[],width:number,height:number,ratio:number,entities:readonly Entity[]=[]) {
    const lights=lanternLightSources(state,entities),key=JSON.stringify([lights,geometry,width,height,ratio]);
    if(key===this.key&&this.occluders===occluders)return;
    this.key=key;this.occluders=occluders;
    this.hasLanterns=lights.length>0;
    this.ground.dataset.townLayer='lantern-ground';this.glow.dataset.townLayer='lantern-glow';
    if(!this.hasLanterns){this.ground.width=this.glow.width=1;return;}
    for(const layer of [this.ground,this.glow]){layer.width=Math.round(width*ratio);layer.height=Math.round(height*ratio);}
    const span=geometry.tile*2.5;this.scratch.width=Math.ceil(span*ratio);this.scratch.height=Math.ceil(span*ratio);
    for(const lamp of lights) {
      const left=geometry.offsetX+(lamp.y-.75)*geometry.tile,top=geometry.offsetY+(lamp.x-1.1)*geometry.tile;
      for(const [layer,glowing]of [[this.ground,false],[this.glow,true]] as const) {
        if(!glowing&&!lamp.ground)continue; // Built posts already belong to the shared building renderer.
        const work=this.scratch.getContext('2d')!;work.setTransform(1,0,0,1,0,0);work.clearRect(0,0,this.scratch.width,this.scratch.height);
        work.setTransform(ratio,0,0,ratio,-left*ratio,-top*ratio);
        if(glowing)drawLanternGlow(work,lamp,geometry,true,lamp.flipped);else drawHalloweenLantern(work,images,{...lamp,id:0},geometry);
        work.globalCompositeOperation='destination-out';
        for(const prop of occluders) {
          if(prop.depth<lamp.x+.9||prop.x+prop.width<left||prop.x>left+span||prop.y+prop.height<top||prop.y>top+span)continue;
          const c=prop.crop;work.drawImage(prop.image,c[0]!,c[1]!,c[2]!,c[3]!,prop.x,prop.y,prop.width,prop.height);
        }
        work.globalCompositeOperation='source-over';
        layer.getContext('2d')!.drawImage(this.scratch,Math.round(left*ratio),Math.round(top*ratio));
      }
    }
  }
  drawGround(ctx:CanvasRenderingContext2D,width:number,height:number){if(this.hasLanterns)ctx.drawImage(this.ground,0,0,width,height);}
  drawGlow(ctx:CanvasRenderingContext2D,width:number,height:number){if(!this.hasLanterns)return;ctx.save();ctx.globalCompositeOperation='screen';ctx.drawImage(this.glow,0,0,width,height);ctx.restore();}
}
