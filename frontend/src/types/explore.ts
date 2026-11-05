import type { ItemSummary } from './item';
export type ExploreBounds = [number, number, number, number];
export type ExploreProgress = 'all' | 'todo' | 'done';
export interface ExploreFilters { categories: string[]; year: number | null; progress?: ExploreProgress }
export interface ExploreViewRequest extends ExploreFilters { zoom: number; bounds: ExploreBounds; offset?: number; limit?: number }
export interface ExploreFeature {
  id: number; count: number; latitude: number; longitude: number; bounds: ExploreBounds;
  expansionZoom: number; item: ItemSummary | null;
}
export interface ExploreTimelineYear { year: number; count: number }
export interface ExploreView {
  version: string; validator: string; shared: boolean; total: number; zoom: number; features: ExploreFeature[];
  next_offset: number | null; timeline: ExploreTimelineYear[]; feature_count?: number;
}
export interface ExploreLeaves { version: string; total: number; items: ItemSummary[]; next_offset: number | null }
