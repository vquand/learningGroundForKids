import type {ArtManifest} from './townArtTier.ts';
import {variantFile} from './townArtTier.ts';
import {getArtTier} from './townArtStore.ts';
import manifestJson from './townArtManifest.json' with {type:'json'};

export const ART_MANIFEST=manifestJson as ArtManifest;
/** Variant-over-base width ratio of every decoded Town image that is a downscaled variant (absent = full size). */
const scales=new WeakMap<object,{x:number;y:number}>();
export function registerArtScale(image:HTMLImageElement,key:string,manifest:ArtManifest=ART_MANIFEST){
    const entry=manifest[key];
    if(entry&&image.naturalWidth>0&&(image.naturalWidth!==entry.baseWidth||image.naturalHeight!==entry.baseHeight))scales.set(image,{x:image.naturalWidth/entry.baseWidth,y:image.naturalHeight/entry.baseHeight});
}
export const artScale=(image:object)=>scales.get(image)?.x??1;
/** Size an image would have at full resolution; atlas rectangles and offscreen buffers are measured in these units. */
export const artBaseSize=(image:HTMLImageElement)=>{const scale=scales.get(image)??{x:1,y:1};return {width:Math.round(image.naturalWidth/scale.x),height:Math.round(image.naturalHeight/scale.y)};};

/** Maps a base-pixel source rectangle onto a variant. The rectangle stays fractional: widening it to whole pixels would stretch
 * the sprite into an unchanged destination (up to one variant pixel of drift); atlas gutters absorb the sampling blur.
 * Width and height scale separately because the variant height is rounded on its own. */
export function scaleSourceRect(sx:number,sy:number,sw:number,sh:number,scaleX:number,scaleY:number=scaleX):[number,number,number,number] {
    if(scaleX===1&&scaleY===1)return [sx,sy,sw,sh];
    return [sx*scaleX,sy*scaleY,sw*scaleX,sh*scaleY];
}
let installed=false;
/** Makes 9-argument drawImage calls on downscaled Town images keep using base-pixel atlas rectangles. Canvas sources are untouched. */
export function installScaledDrawImage(proto:{drawImage:(...args:never[])=>void}=CanvasRenderingContext2D.prototype as never){
    if(installed)return;installed=true;
    const original=proto.drawImage as (this:unknown,...args:unknown[])=>void;
    proto.drawImage=function(this:unknown,...args:unknown[]){
        const scale=args.length===9?scales.get(args[0] as object):undefined;
        if(scale!==undefined){
            const [sx,sy,sw,sh]=scaleSourceRect(args[1] as number,args[2] as number,args[3] as number,args[4] as number,scale.x,scale.y);
            return original.call(this,args[0],sx,sy,sw,sh,args[5],args[6],args[7],args[8]);
        }
        return original.apply(this,args);
    } as never;
}

const DOM_ART='/minigames/town-building/';
/** URL for art drawn by DOM/SVG: the same tier file the canvas already cached, or the PNG when the key is not converted. SVG `<image>` keeps base width/height, so any tier fits. */
export const townArtHref=(key:string,extension='png')=>DOM_ART+(variantFile(key,getArtTier(),ART_MANIFEST)??`${key}.${extension}`);
