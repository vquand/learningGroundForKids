import type { Environment } from '../../../../server/src/town-building/environment.ts';
const TONES = {
 morning:'rgba(255,221,163,.12)', noon:null, afternoon:'rgba(248,194,115,.10)',
 evening:'rgba(106,58,94,.23)', night:'rgba(22,35,76,.43)',
} as const;
/** Local time and modeled cloud cover come from the owned, server-side weather API. */
export function sceneLighting(environment:Pick<Environment,'timeOfDay'|'cloudCover'|'precipitation'|'isDay'>):string[] {
 const layers:string[]=[];
 const tone=environment.timeOfDay ? TONES[environment.timeOfDay] : null;
 if(tone) layers.push(tone);
 if(environment.isDay===false && environment.timeOfDay && !['night','evening'].includes(environment.timeOfDay)) layers.push('rgba(35,48,79,.24)');
 if(environment.cloudCover!=null && Number.isFinite(environment.cloudCover)) {
  const shade=Math.max(0,Math.min(100,environment.cloudCover))/100*.17;
  if(shade>0) layers.push(`rgba(87,99,117,${shade.toFixed(3)})`);
 }
 if(environment.precipitation==='rain') layers.push('rgba(75,102,126,.12)');
 return layers;
}
