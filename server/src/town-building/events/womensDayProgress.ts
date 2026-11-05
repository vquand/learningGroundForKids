import {WOMENS_DAY_EVENT_ID,WOMENS_DAY_EDITION,WOMENS_DAY_VISITORS} from './womensDay2026Model.ts';
import {WOMENS_DAY_GREET_COUNTER,WOMENS_DAY_VISIT_COUNTER} from './womensDayAchievements.ts';
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
/** Read only the 2026 occurrence and verified receipts; never sum later years. */
export function womensDayProgress(town:unknown){
 const entry=object(object(object(object(town).eventHistory)[WOMENS_DAY_EVENT_ID])['2026']);
 const counters=entry.edition===WOMENS_DAY_EDITION?object(entry.counters):{};
 const receipts=(id:string)=>{const counter=object(counters[id]);return Array.isArray(counter.receipts)?counter.receipts:[];};
 const greeted=new Set(receipts(WOMENS_DAY_GREET_COUNTER).filter(id=>WOMENS_DAY_VISITORS.some(v=>v.id===id))).size;
 const visits=receipts(WOMENS_DAY_VISIT_COUNTER).includes('visit')?1:0;
 return {visits,greeted,metrics:{womensDay2026Visited:visits,womensDay2026Greeted:greeted}};
}
