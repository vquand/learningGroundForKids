/** Cosmetic time survives heartbeats; server ticks alone advance earned growth. */
export interface FishAnimationClock {seconds:number;lastTime:number|null}
export function advanceFishAnimation(clock:FishAnimationClock,time:number,paused:boolean):number {
    const elapsed=clock.lastTime===null?0:Math.max(0,Math.min(.05,(time-clock.lastTime)/1000));
    clock.lastTime=time;
    if(!paused)clock.seconds+=elapsed;
    return clock.seconds;
}
