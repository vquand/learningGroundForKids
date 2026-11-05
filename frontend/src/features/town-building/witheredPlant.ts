/** One species-neutral withered sprite; every crop shares the same root anchor.
 * Source pixels retain their original color, silhouette and proportions. */
export function drawWitheredCrop(ctx:CanvasRenderingContext2D,image:HTMLImageElement|undefined,x:number,y:number,size:number){
 if(!image?.complete||!image.naturalWidth)return;
 const crop=WITHERED_PLANT_CROP,scale=Math.min(size/crop[2],size/crop[3]);
 ctx.drawImage(image,...crop,x-crop[2]*scale/2,y-crop[3]*scale,crop[2]*scale,crop[3]*scale);
}
// Measured from the generated original after alpha inspection.
const WITHERED_PLANT_CROP=[306,461,475,557] as const;
