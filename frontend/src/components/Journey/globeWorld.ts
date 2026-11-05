import { addGlobeBiomeCubes } from "./globeBiomeCubes.ts";
import type { Viewer } from "cesium";

export function addGlobeWorld(viewer: Viewer): () => void {
  const previousGlobeVisibility = viewer.scene.globe.show;
  viewer.scene.globe.show = false;
  const removeBiomeCubes = addGlobeBiomeCubes(viewer);

  return () => {
    removeBiomeCubes();
    if (!viewer.isDestroyed()) {
      viewer.scene.globe.show = previousGlobeVisibility;
    }
  };
}
