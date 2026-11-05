import type { TownState } from '../game.ts';
import { HALLOWEEN_EDITION, HALLOWEEN_EVENT_ID, type HalloweenState } from './halloween2026Model.ts';

/** Legacy API field is a projection, never a second persisted source of truth. */
export function halloweenProjection(state: TownState): HalloweenState | undefined {
  const record = state.events?.[HALLOWEEN_EVENT_ID];
  if (!record) return state.halloween;
  if (record.edition !== HALLOWEEN_EDITION) return;
  return { ...record.data as HalloweenState, edition: record.edition };
}
