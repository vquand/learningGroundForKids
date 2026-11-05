import type {TimedEventRecord} from './runtime.ts';
export const WOMENS_DAY_EVENT_ID='womens-day';
export const WOMENS_DAY_EDITION='2026-v1';
export const WOMENS_DAY_VISITORS=Object.freeze(Array.from({length:7},(_,i)=>Object.freeze({id:`flower-${i+1}`,art:i})));
export type WomensDayCommand={type:'visit'}|{type:'dismiss-intro'}|{type:'greet';visitorId:string};
export interface WomensDayState {year:string;introSeenDates?:string[]}
/** Edition-owned cosmetic policy. A later edition must define its own policy. */
export const WOMENS_DAY_2026_POLICY=Object.freeze({maxBlobs:7,bodySize:.78,maxFlowers:16,flowerSpacing:3,maxHanging:5,treeSpacing:6,walkSpeed:.65,petalPeriod:11});
export const isWomensDay=(localDate?:string)=>typeof localDate==='string'&&/^\d{4}-10-(19|20|21)$/.test(localDate);
/** Fail closed for a missing record, old occurrence, or unsupported edition.
 * The server's home clock and pinned namespaced record must agree. */
export function womensDayRecord(events:Readonly<Record<string,TimedEventRecord>>|undefined,localDate:string):TimedEventRecord|undefined {
 const record=events?.[WOMENS_DAY_EVENT_ID];
 return isWomensDay(localDate)&&record?.edition===WOMENS_DAY_EDITION&&record.occurrence===localDate.slice(0,4)?record:undefined;
}

export function womensDayIntroSeen(events:Readonly<Record<string,TimedEventRecord>>|undefined,localDate:string):boolean {
 const data=womensDayRecord(events,localDate)?.data as WomensDayState|undefined;
 return Array.isArray(data?.introSeenDates)&&data.introSeenDates.includes(localDate);
}
