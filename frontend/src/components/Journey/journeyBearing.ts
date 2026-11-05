import bearing from "@turf/bearing";
import { point } from "@turf/helpers";

/** Geographic heading from the current route sample to the next sample. */
export function getJourneySegmentBearing(
  from: [number, number],
  to: [number, number],
): number {
  return bearing(point(from), point(to));
}
