type LatLng = [number, number];

/**
 * Splits a continuous route at the edges of the displayed world so a leg that
 * crosses the date line leaves one edge and re-enters at the other instead of
 * drawing a line across the whole map.
 */
export function splitPathAtWorldEdges(path: LatLng[], center: number): LatLng[][] {
  const first = path[0];
  if (!first) return [];
  const low = center - 180;
  const world = (lng: number) => Math.floor((lng - low) / 360);
  const normalizedFirst = (((first[1] - center + 180) % 360) + 360) % 360 - 180 + center;
  const shift = normalizedFirst - first[1];
  const pieces: LatLng[][] = [];
  let current: LatLng[] = [];
  let previous: LatLng | null = null;
  for (const [lat, rawLng] of path) {
    const lng = rawLng + shift;
    if (previous) {
      const from = world(previous[1]);
      const to = world(lng);
      if (from !== to) {
        const edge = low + 360 * Math.max(from, to);
        const edgeLat = previous[0] + (lat - previous[0]) * ((edge - previous[1]) / (lng - previous[1]));
        current.push([edgeLat, edge - 360 * from]);
        pieces.push(current);
        current = [[edgeLat, edge - 360 * to]];
      }
    }
    current.push([lat, lng - 360 * world(lng)]);
    previous = [lat, lng];
  }
  pieces.push(current);
  return pieces.filter((piece) => piece.length > 1);
}
