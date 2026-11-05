// Project geographic coordinates into the fixed 720 x 360 SVG world used by
// the map overlays. Consecutive longitudes are unwrapped so a coastline that
// crosses the date line remains local instead of drawing across the map.
const MAX_MERCATOR_LATITUDE = 85.0511287798;

type WorldProjector = (longitude: number, latitude: number) => [number, number];

function buildWorldRingPath(
  ring: readonly (readonly number[])[],
  project: WorldProjector,
): string {
  if (!ring.length) return "";

  const points: number[][] = [];
  for (const point of ring) {
    let [x, y] = project(point[0]!, point[1]!);
    const previous = points.at(-1);
    if (previous) x += 720 * Math.round((previous[0]! - x) / 720);
    points.push([x, y]);
  }

  const first = points[0]!;
  const last = points.at(-1)!;
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.join(",")}`);

  // Polar rings need to close against the pole, not through the middle of the
  // map. This also keeps Antarctica seam-safe when it is rendered at the edge.
  if (Math.abs(last[0]! - first[0]!) >= 360) {
    const pole = ring.reduce((sum, point) => sum + point[1]!, 0) < 0 ? 360 : 0;
    path.push(`L${last[0]},${pole}`, `L${first[0]},${pole}`);
  }

  return `${path.join(" ")} Z`;
}

const EQUIRECTANGULAR_PROJECTOR: WorldProjector = (longitude, latitude) => [
  (longitude + 180) * 2,
  (90 - latitude) * 2,
];

const MERCATOR_PROJECTOR: WorldProjector = (longitude, latitude) => {
  const clampedLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude),
  );
  const sine = Math.sin((clampedLatitude * Math.PI) / 180);
  return [
    (longitude + 180) * 2,
    (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * 360,
  ];
};

export function worldMercatorPoint(longitude: number, latitude: number): [number, number] {
  return MERCATOR_PROJECTOR(longitude, latitude);
}

/** Projection retained for the flat, standalone admin journey illustration. */
export function worldRingPath(ring: readonly (readonly number[])[]): string {
  return buildWorldRingPath(ring, EQUIRECTANGULAR_PROJECTOR);
}

/** Projection matching Leaflet's default EPSG:3857 map CRS. */
export function worldMercatorRingPath(ring: readonly (readonly number[])[]): string {
  return buildWorldRingPath(ring, MERCATOR_PROJECTOR);
}

export const WORLD_MERCATOR_BOUNDS: [[number, number], [number, number]] = [
  [-MAX_MERCATOR_LATITUDE, -180],
  [MAX_MERCATOR_LATITUDE, 180],
];
