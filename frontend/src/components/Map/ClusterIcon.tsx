import L from "leaflet";
import { clusterExpansionLabel } from './mapMarkerLabels';

/**
 * Creates a custom cluster icon showing item count as a purple circle.
 * Minimum 64px for child-friendly tap targets with illustration styling.
 */
export function createClusterIcon(cluster: Pick<L.MarkerCluster, 'getChildCount'>, nodeId?: number): L.DivIcon {
  const count = cluster.getChildCount();

  return L.divIcon({
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    className: "map-cluster-marker",
    html: `<div data-cluster="true" ${nodeId === undefined ? '' : `data-explore-node="${nodeId}"`} class="map-marker-hit-target" style="
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6C5CE7, #a29bfe);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.1);
    "><span aria-hidden="true">${count}</span><span class="map-marker-sr-only">${clusterExpansionLabel(count)}</span></div>`,
  });
}
