import type {TownOccluder} from './halloweenDepth';
export interface AnimalBounds{x:number;y:number;width:number;height:number}
/** Mask ground residents behind the alpha silhouette of closer buildings and
 * trees. One small reusable canvas keeps transparent gutters and the scene's
 * cached terrain intact; airborne residents bypass this layer. */
export class AnimalDepthLayer{
 private scratch=document.createElement('canvas');
 draw(ctx:CanvasRenderingContext2D,depth:number,bounds:AnimalBounds,occluders:readonly TownOccluder[],paint:(ctx:CanvasRenderingContext2D)=>void,ratio=1,clip?:TownOccluder,frame?:TownOccluder){
  const closer=occluders.filter(o=>(o.depth>depth||(o.interiorOnly&&clip?.ownerId!==undefined&&o.ownerId===clip.ownerId))&&o.x<bounds.x+bounds.width&&o.x+o.width>bounds.x&&o.y<bounds.y+bounds.height&&o.y+o.height>bounds.y);
  if(!closer.length&&!clip){paint(ctx);return;}
  // Whole device pixels keep the scratch blit exact; a fractional origin would smear masked edges past the opening.
  const left=Math.floor(bounds.x*ratio)/ratio,top=Math.floor(bounds.y*ratio)/ratio;
  const width=Math.ceil(bounds.width*ratio),height=Math.ceil(bounds.height*ratio);
  if(this.scratch.width<width)this.scratch.width=width;if(this.scratch.height<height)this.scratch.height=height;
  const work=this.scratch.getContext('2d')!;work.setTransform(1,0,0,1,0,0);work.clearRect(0,0,this.scratch.width,this.scratch.height);work.setTransform(ratio,0,0,ratio,-left*ratio,-top*ratio);paint(work);
  if(clip){const c=clip.crop;work.globalCompositeOperation='destination-in';work.drawImage(clip.image,c[0]!,c[1]!,c[2]!,c[3]!,clip.x,clip.y,clip.width,clip.height);}
  // Inside a hollow building, its own frame (posts, roof edge, porch lip) always stays in front.
  if(frame){const c=frame.crop;work.globalCompositeOperation='destination-out';work.drawImage(frame.image,c[0]!,c[1]!,c[2]!,c[3]!,frame.x,frame.y,frame.width,frame.height);}
  work.globalCompositeOperation='destination-out';for(const o of closer){const c=o.crop;work.drawImage(o.image,c[0]!,c[1]!,c[2]!,c[3]!,o.x,o.y,o.width,o.height);}work.globalCompositeOperation='source-over';
  ctx.drawImage(this.scratch,0,0,width,height,left,top,width/ratio,height/ratio);
 }
}
