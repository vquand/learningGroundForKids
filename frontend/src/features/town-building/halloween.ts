import { isHalloweenNight, halloweenDark, halloweenWorkAllowed } from '../../../../server/src/town-building/halloweenCalendar.ts';
/** The server supplies the child's home-city local date, never device UTC time. */
export const isHalloweenVisit = isHalloweenNight;
export const HALLOWEEN_GUESTS = [
  {x:6,y:10,phase:0}, {x:4,y:24,phase:1.1}, {x:11,y:19,phase:2.2},
  {x:7,y:34,phase:3.3}, {x:18,y:9,phase:4.4}, {x:13,y:31,phase:5.5},
] as const;
export function ghostPosition(guest:typeof HALLOWEEN_GUESTS[number],time:number,reducedMotion:boolean) {
  const phase=reducedMotion?0:time/1000;
  return {x:guest.x+(reducedMotion?0:Math.sin(phase*.45+guest.phase)*.65),y:guest.y+(reducedMotion?0:Math.sin(phase*.25+guest.phase)*1.25),tilt:reducedMotion?0:Math.sin(phase*.8+guest.phase)*.09};
}

/** Halloween preview overrides the calendar only, never daylight or weather. */
export function ghostsMayVisit(environment:{localDate:string;precipitation:'none'|'rain'|'snow'|null;isDay?:boolean|null;timeOfDay?:string|null;weatherSource?:string},preview=false):boolean {
  return preview ? halloweenDark(environment)&&environment.precipitation==='none' : halloweenWorkAllowed(environment);
}
