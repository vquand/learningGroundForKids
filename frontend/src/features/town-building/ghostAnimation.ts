import { flightPosition, flightTiming, ghostFacing, type GhostFlight, type GhostMotionPolicy, type GhostPoint } from '../../../../server/src/town-building/ghostMotion.ts';
export interface GhostAnimation {
  readonly flying: readonly number[]; readonly pickup: readonly number[]; readonly placing: readonly number[];
  readonly frameMs: number;
}
/** An event supplies route endpoints, motion policy and skin frame ranges. This
 * module knows nothing about pumpkins, lanterns, calendars or achievements. */
export function ghostFlightPose(job:GhostFlight,origin:GhostPoint,destination:GhostPoint,policy:GhostMotionPolicy,animation:GhostAnimation,seconds:number,time:number,reduced=false) {
  const age=Math.max(0,seconds-job.startedAt),timing=flightTiming(job,policy);
  const stage=age<timing.approach||age>=timing.pickupAt&&age<timing.hangStarts?'flying':age<timing.pickupAt?'pickup':'placing';
  const frames=animation[stage];
  const progress=stage==='pickup'?(age-timing.approach)/policy.pickupSeconds:stage==='placing'?(age-timing.hangStarts)/policy.placeSeconds:0;
  const frame=reduced?animation.flying[0]!:stage==='flying'?frames[Math.floor(time/animation.frameMs)%frames.length]!:frames[Math.min(frames.length-1,Math.floor(progress*frames.length))]!;
  return {...flightPosition(job,seconds,origin,destination,policy),stage,frame,
    facing:age<timing.approach?ghostFacing(job.origin??origin,job.from):ghostFacing(job.from,destination)};
}
export function drawGhostSprite(ctx:CanvasRenderingContext2D,sheet:HTMLImageElement,crop:readonly number[],x:number,y:number,size:number,facing:number,tilt=0) {
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(facing,1);
  const scale=size/Math.max(crop[2]!,crop[3]!);
  ctx.drawImage(sheet,crop[0]!,crop[1]!,crop[2]!,crop[3]!,-crop[2]!*scale/2,-crop[3]!*scale/2,crop[2]!*scale,crop[3]!*scale);
  ctx.restore();
}
