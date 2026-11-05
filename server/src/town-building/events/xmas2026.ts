import { defineTimedEvent } from './runtime.ts';
import { XMAS_EDITION, XMAS_EVENT_ID, xmasOccurrence, type XmasState } from './xmas2026Model.ts';

export const xmasEvent = defineTimedEvent<XmasState>({
  id: XMAS_EVENT_ID,
  occurrence: weather => xmasOccurrence(weather),
  editionFor: () => XMAS_EDITION,
  editions: [{
    version: XMAS_EDITION,
    create: year => ({ year }),
    tick() {},
  }],
});
