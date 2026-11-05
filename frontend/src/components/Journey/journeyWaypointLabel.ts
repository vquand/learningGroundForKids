export function getLastReachedWaypointIndex(
  segmentWaypointArrivals: Array<number | null>,
  segmentIndex: number,
): number {
  let lastReachedWaypointIndex = -1;

  for (let index = 0; index < segmentIndex; index += 1) {
    const waypointIndex = segmentWaypointArrivals[index];
    if (waypointIndex != null) {
      lastReachedWaypointIndex = waypointIndex;
    }
  }

  return lastReachedWaypointIndex;
}
