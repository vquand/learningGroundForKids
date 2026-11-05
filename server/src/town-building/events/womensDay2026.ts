import {defineTimedEvent} from './runtime.ts';
import {WOMENS_DAY_EVENT_ID,WOMENS_DAY_EDITION,WOMENS_DAY_VISITORS,isWomensDay,type WomensDayState} from './womensDay2026Model.ts';
import {WOMENS_DAY_ACHIEVEMENTS,WOMENS_DAY_VISIT_COUNTER,WOMENS_DAY_GREET_COUNTER} from './womensDayAchievements.ts';
/** Cosmetic animation is local; the host owns verified, deduplicated interactions. */
export const womensDayCelebration=defineTimedEvent<WomensDayState>({
 maps:['town'],
 id:WOMENS_DAY_EVENT_ID,
 occurrence:weather=>isWomensDay(weather.localDate)?weather.localDate!.slice(0,4):undefined,
 editionFor:()=>WOMENS_DAY_EDITION,
 editions:[{version:WOMENS_DAY_EDITION,create:year=>({year}),tick(){},
  counters:[{id:WOMENS_DAY_VISIT_COUNTER,achievements:WOMENS_DAY_ACHIEVEMENTS.filter(b=>b.metric==='womensDay2026Visited').map(({id,target})=>({id,target}))},
   {id:WOMENS_DAY_GREET_COUNTER,achievements:WOMENS_DAY_ACHIEVEMENTS.filter(b=>b.metric==='womensDay2026Greeted').map(({id,target})=>({id,target}))}],
  interact(data,command,context){
   if(!command||typeof command!=='object')throw new Error('Choose a flower friend.');
   const action=command as {type?:string;visitorId?:string};
   if(action.type!=='visit'&&action.type!=='dismiss-intro'&&(action.type!=='greet'||!WOMENS_DAY_VISITORS.some(v=>v.id===action.visitorId)))throw new Error('Choose a flower friend.');
   if(action.type==='dismiss-intro'){
    const date=context.weather.localDate!;
    const seen=Array.isArray(data.introSeenDates)?data.introSeenDates.filter(value=>isWomensDay(value)&&value.slice(0,4)===data.year):[];
    if(!seen.includes(date)){data.introSeenDates=[...new Set([...seen,date])];context.changed();}return;
   }
   // Later occurrences never grant an earlier year's permanent collectibles.
   if(data.year!=='2026'||context.weather.localDate?.slice(0,4)!=='2026')return;
   context.recordCompletion(WOMENS_DAY_VISIT_COUNTER,'visit');
   if(action.type==='greet')context.recordCompletion(WOMENS_DAY_GREET_COUNTER,action.visitorId!);
  }}],
});
