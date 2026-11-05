import type { TownState } from '../game.ts';
import { mapDefinition } from '../maps/registry.ts';
import type { MapDefinition } from '../maps/types.ts';
import { runTimedEvents, interactTimedEvent, type EventWeather } from './runtime.ts';
import {womensDayCelebration} from './womensDay2026.ts';
import { halloweenPumpkins } from './halloween2026.ts';
import { HALLOWEEN_EDITION, HALLOWEEN_EVENT_ID } from './halloween2026Model.ts';
import { halloweenProjection } from './halloweenProjection.ts';
import { xmasEvent } from './xmas2026.ts';

/** Explicit, bundled allowlist. No browser-selected or remotely loaded plugins. */
const TOWN_EVENTS = Object.freeze([halloweenPumpkins,womensDayCelebration,xmasEvent]);
export const eventAllowsCrop=(crop:import('../garden.ts').CropId,localDate='')=>TOWN_EVENTS.some(event=>event.allowsCrop?.(crop,localDate)===true);
/** Run every event allowed on `map` against that map's view. */
export function tickTownEvents(state: TownState, map: MapDefinition, weather: EventWeather, elapsed: number, ripeGrowth: number, now=Date.now()): void {
  if (!weather.timeOfDay || !weather.localDate) return;
  if (state.halloween && !state.events?.[HALLOWEEN_EVENT_ID]) {
    state.events ??= {};
    state.events[HALLOWEEN_EVENT_ID] = { occurrence: state.halloween.year,
      edition: state.halloween.edition ?? HALLOWEEN_EDITION, data: structuredClone(state.halloween) };
    state.revision++;
  }
  // Remove the response projection before lifecycle cleanup; it must not revive
  // an expired occurrence or overwrite the authoritative namespaced record.
  delete state.halloween;
  const failures=runTimedEvents(state, map, weather, elapsed, ripeGrowth, TOWN_EVENTS,now);
  for(const failure of failures)console.error(JSON.stringify({level:'error',message:'Town event paused after behavior failure',eventId:failure.eventId,edition:failure.edition}));
  const projected = halloweenProjection(state);
  if (projected) state.halloween = projected;
}

export function interactWomensDay(state:TownState,weather:EventWeather,command:unknown,now=Date.now()):void {
  interactTimedEvent(state,mapDefinition('town'),womensDayCelebration,weather,command,now);
}
