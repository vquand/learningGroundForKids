export interface ExploreViewport { center: [number, number]; zoom: number }
const DEFAULT: ExploreViewport = { center: [20, 0], zoom: 2 };
let currentFamily: string | null = null;
const views = new Map<string, ExploreViewport>();

// UI camera state only, kept in memory for this family session, never identity
// or progress. A different family/login cannot inherit the previous camera.
export function exploreViewport(family: string, profile: string): ExploreViewport {
  if (family !== currentFamily) { views.clear(); currentFamily = family; }
  const view = views.get(profile) ?? DEFAULT;
  return { center: [...view.center], zoom: view.zoom };
}
export function rememberExploreViewport(family: string, profile: string, view: ExploreViewport) {
  if (!view.center.every(Number.isFinite) || !Number.isFinite(view.zoom) || view.zoom < 2 || view.zoom > 18) return;
  exploreViewport(family, profile);
  views.set(profile, { center: [...view.center], zoom: view.zoom });
}
