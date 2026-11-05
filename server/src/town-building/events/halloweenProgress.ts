import { HALLOWEEN_EDITION, HALLOWEEN_EVENT_ID, MAX_HALLOWEEN_LANTERNS } from './halloween2026Model.ts';
import { HALLOWEEN_COUNTER } from './halloweenAchievements.ts';
function object(value:unknown):Record<string,unknown> {
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
/** Bounded public summary only. Reservation/completion receipts stay private. */
export function halloweenProgress(town:unknown) {
  const history=object(object(object(town).eventHistory)[HALLOWEEN_EVENT_ID]);
  const records=Object.entries(history).flatMap(([year,raw])=>{
    const entry=object(raw),counter=object(object(entry.counters)[HALLOWEEN_COUNTER]),count=counter.count;
    return /^\d{4}$/.test(year)&&entry.edition===HALLOWEEN_EDITION&&typeof count==='number'&&Number.isSafeInteger(count)&&count>=0&&count<=MAX_HALLOWEEN_LANTERNS?[{year,count}]:[];
  }).sort((a,b)=>b.year.localeCompare(a.year));
  return {records,total:records.reduce((sum,record)=>sum+record.count,0),best:Math.max(0,...records.map(record=>record.count))};
}
