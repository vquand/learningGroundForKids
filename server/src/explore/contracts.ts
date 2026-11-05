import type { ItemSummaryRecord } from '../contracts/db.js';
import type { ClusterBounds, ClusterFeature } from './clusters.js';

export type MapProgress = 'all' | 'todo' | 'done';
export interface MapFilters { categories: string[]; year: number | null; progress?: MapProgress }
export interface MapScope { familyId: string; profileId?: string }
export interface MapViewInput extends MapScope, MapFilters {
  zoom: number; bounds: ClusterBounds; offset: number; limit: number; knownVersion?: string;
}
export interface MapTimelineYear { year: number; count: number }
export interface MapView {
  version: string; validator: string; shared: boolean; total: number; zoom: number;
  features: ClusterFeature[]; next_offset: number | null; timeline: MapTimelineYear[];
}
export interface MapUnchanged { version: string; validator: string; not_modified: true }
export interface MapLeavesInput extends MapScope, MapFilters { version: string; node: number; offset: number; limit: number }
export interface MapLeaves { version: string; total: number; items: ItemSummaryRecord[]; next_offset: number | null }
export interface ExploreRepository {
  view(input: MapViewInput): Promise<MapView | MapUnchanged>;
  leaves(input: MapLeavesInput): Promise<MapLeaves>;
}
