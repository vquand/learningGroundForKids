import {lanternLayout} from './lanternLayout.ts';
import type {TownLantern} from '../../../../server/src/town-building/halloween.ts';
type Images=Map<string,HTMLImageElement>;
interface Geometry{tile:number;offsetX:number;offsetY:number}

/** Shared warm halo, composited after night tint. Mirroring follows the pumpkin, not the post. */
export function drawLanternGlow(ctx:CanvasRenderingContext2D,lamp:Pick<TownLantern,'x'|'y'|'post'|'variant'>,geometry:Geometry,dark:boolean,flipped=false){
  if(!dark)return;
  const p=lanternLayout(lamp,geometry),center=geometry.offsetX+(lamp.y+.5)*geometry.tile;
  const x=flipped?center*2-p.hookX:p.hookX,y=p.hookY+geometry.tile*.32,radius=geometry.tile*.65;
  ctx.save();ctx.globalCompositeOperation='screen';
  const glow=ctx.createRadialGradient(x,y,0,x,y,radius);
  glow.addColorStop(0,'rgba(255,189,67,.25)');glow.addColorStop(1,'rgba(255,189,67,0)');
  ctx.fillStyle=glow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);ctx.restore();
}

export function drawHalloweenLantern(ctx:CanvasRenderingContext2D,images:Images,lamp:TownLantern,geometry:Geometry,flipped=false,outline?:(image:HTMLImageElement,crop:readonly number[],x:number,y:number,width:number,height:number)=>void){
  const center=geometry.offsetX+(lamp.y+.5)*geometry.tile,parts=lanternLayout(lamp,geometry);
  ctx.save();if(flipped){ctx.translate(center*2,0);ctx.scale(-1,1);}
  for(const [key,p] of [['halloweenPosts',parts.post],['halloweenLanterns',parts.lantern]] as const){
    const image=images.get(key);if(!image?.complete||!image.naturalWidth)continue;
    const c=p.crop;outline?.(image,c,p.x,p.y,p.width,p.height);ctx.drawImage(image,c[0]!,c[1]!,c[2]!,c[3]!,p.x,p.y,p.width,p.height);
  }
  ctx.restore();
}
