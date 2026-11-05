import type {TimedEventRecord} from '../../../../server/src/town-building/events/runtime';
import {WOMENS_DAY_EVENT_ID,WOMENS_DAY_EDITION,womensDayRecord,isWomensDay} from '../../../../server/src/town-building/events/womensDay2026Model';
import {WomensDayCelebration,type WomensDayVisualProps} from './WomensDayCelebration';
/** Explicit visual adapters for supported pinned server editions. Keep new
 * editions separate; never reskin an unknown saved edition with the latest. */
const EVENT_VISUALS=Object.freeze([
 {id:WOMENS_DAY_EVENT_ID,edition:WOMENS_DAY_EDITION,select:womensDayRecord,isScheduled:isWomensDay,Component:WomensDayCelebration},
]);
interface Props extends Omit<WomensDayVisualProps,'occurrence'> {
 events?:Readonly<Record<string,TimedEventRecord>>;
 localDate:string;
}
export function TownTimedEventLayers({events,localDate,...visualProps}:Props){
 return <>{EVENT_VISUALS.map(event=>{
  const record=event.select(events,localDate);
  return record&&record.edition===event.edition?<event.Component key={`${event.id}:${record.occurrence}:${record.edition}`} {...visualProps} occurrence={record.occurrence}/>:null;
 })}</>;
}

export function townTimedEventsNeedHeartbeat(events:Props['events'],localDate=''){return EVENT_VISUALS.some(event=>event.isScheduled(localDate)||Boolean(events?.[event.id]));}
