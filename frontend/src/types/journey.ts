export interface JourneyWaypoint {
  kind: "home" | "item";
  item_id: string;
  title: string;
  category: string;
  latitude: number;
  longitude: number;
  done_at: string;
}

export interface JourneyRoute {
  origin: {
    latitude: number;
    longitude: number;
    title: string;
  };
  waypoints: JourneyWaypoint[];
  exploredCount: number;
}

export type JourneyPeriod = 'today' | 'yesterday' | 'last3days' | 'last7days';

export const JOURNEY_SPEEDS = [1, 4, 8] as const;
export type JourneySpeed = (typeof JOURNEY_SPEEDS)[number];

export type VehicleType =
  | 'car'
  | 'boat'
  | 'submarine'
  | 'zeppelin'
  | 'camel'
  | 'sled';

export type TerrainType =
  | 'land'
  | 'ocean'
  | 'undersea'
  | 'mountain_air'
  | 'hot_desert'
  | 'cold_desert';

export interface AnimationState {
  status: 'idle' | 'playing' | 'paused' | 'complete';
  currentSegment: number;
  segmentProgress: number;
  totalSegments: number;
}
