/** Decorative drift only; no wind/provider claims or changes to tile ownership. */
export function cloudShadows(cloudCover:number|null|undefined,time:number,reducedMotion:boolean) {
 if(cloudCover==null||!Number.isFinite(cloudCover)||cloudCover<25)return [];
 const cover=Math.min(100,cloudCover),count=Math.max(1,Math.floor(cover/25));
 const seconds=reducedMotion?0:time/1000;
 return Array.from({length:count},(_,index)=>{
  const width=6+index%3;
  return {x:4+index*3.5+(reducedMotion?0:Math.sin(seconds*.05+index)*.6),y:(seconds*.22+index*13+width+5)%(40+width*2)-width,width,opacity:.10+cover/100*.08,sprite:index%2};
 });
}
