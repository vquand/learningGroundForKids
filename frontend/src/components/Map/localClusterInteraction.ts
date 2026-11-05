import L from "leaflet";
import { clusterTapAction } from "./mapTouchInteraction";

type LeafletMapWithTargets = L.Map & {
  _targets?: Record<number, L.Layer>;
};

type MarkerClusterBranch = L.MarkerCluster & {
  _zoom: number;
  _childClusters: MarkerClusterBranch[];
  _markers: L.Marker[];
};

function findMarkerCluster(map: L.Map, target: Element): L.MarkerCluster | null {
  const iconElement = target.closest(".leaflet-marker-icon");
  if (!(iconElement instanceof HTMLElement)) return null;

  const layer = (map as LeafletMapWithTargets)._targets?.[L.stamp(iconElement)];
  return L.MarkerCluster && layer instanceof L.MarkerCluster ? layer : null;
}

function nextClusterSplitZoom(cluster: L.MarkerCluster, maxZoom: number): number {
  let branch = cluster as MarkerClusterBranch;

  while (branch._childClusters.length === 1 && branch._markers.length === 0) {
    branch = branch._childClusters[0]!;
  }

  return Math.min(branch._zoom + 1, maxZoom);
}

function expandCluster(map: L.Map, cluster: L.MarkerCluster) {
  const bounds = cluster.getBounds();
  const action = clusterTapAction({
    currentZoom: map.getZoom(),
    maxZoom: map.getMaxZoom(),
    hasGeographicSpread: !bounds.getSouthWest().equals(bounds.getNorthEast()),
  });

  if (action === "spiderfy") {
    cluster.spiderfy();
    return;
  }

  map.setView(
    cluster.getLatLng(),
    nextClusterSplitZoom(cluster, map.getMaxZoom()),
    { animate: false },
  );
}

export function expandLocalCluster(map: L.Map, element: Element) {
  const cluster = findMarkerCluster(map, element);
  if (cluster) expandCluster(map, cluster);
}
