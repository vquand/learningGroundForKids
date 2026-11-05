import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { feature } from "topojson-client";
import land from "world-atlas/land-110m.json";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { JourneyWaypoint } from "../../types/journey";
import { worldRingPath } from "./adminJourneyProjection";

const project = ([longitude, latitude]: number[]) => [(longitude! + 180) * 2, (90 - latitude!) * 2];
const geography = feature(land as unknown as Topology, (land as unknown as Topology).objects.land as GeometryCollection);
const landPaths = geography.features.flatMap((entry) => {
  const polygons = entry.geometry.type === "MultiPolygon" ? entry.geometry.coordinates
    : entry.geometry.type === "Polygon" ? [entry.geometry.coordinates] : [];
  return polygons.map((polygon) => polygon.map(worldRingPath).join(" "));
});

// A local vector map keeps private admin inspection independent of map-tile
// providers. The numbered list remains the accessible, authoritative history.
export function AdminJourneyMap({ waypoints, startIndex = 0 }: { waypoints: JourneyWaypoint[]; startIndex?: number }) {
  useUiLanguage();
  const points = waypoints.map((point) => project([point.longitude, point.latitude]));
  return <svg role="img" aria-label={uiText("Completed item locations in journey order")} viewBox="0 0 720 360"
    className="w-full rounded-md border border-gray-200 bg-sky-50">
    {[-720, 0, 720].map((offset) => <g key={offset} transform={`translate(${offset},0)`}>
      {landPaths.map((path, index) => <path key={index} d={path} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" fillRule="evenodd" />)}
    </g>)}
    {points.map((point, index) => {
      const previous = points[index - 1];
      // Do not draw a misleading line across the world at the date-line seam.
      return previous && Math.abs(point[0]! - previous[0]!) <= 360
        ? <line key={`line-${index}`} x1={previous[0]} y1={previous[1]} x2={point[0]} y2={point[1]} stroke="#2563eb" strokeWidth="2" /> : null;
    })}
    {points.map((point, index) => <g key={waypoints[index]!.item_id}>
      <circle cx={point[0]} cy={point[1]} r="4" fill="#1d4ed8" stroke="white" strokeWidth="1" />
      <title>{startIndex + index + 1}. {waypoints[index]!.title}</title>
    </g>)}
  </svg>;
}
