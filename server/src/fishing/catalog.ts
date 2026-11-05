/** Browser-safe approved catalog. Outcomes and grading belong to game/repository. */
export const BAIT_IDS = ['baby', 'beginner', 'leafy', 'chewy', 'bouncy', 'crunchy', 'master'] as const;
export type BaitId = typeof BAIT_IDS[number];
export const COMPANION_IDS = ['highland', 'capybara', 'cow'] as const;
export type CompanionId = typeof COMPANION_IDS[number];
export const LOCATION_IDS = ['pond', 'river'] as const;
export type LocationId = typeof LOCATION_IDS[number];
export const FISH_IDS = ['P1', 'P2', 'P3', 'P4', 'P5', 'T1', 'R1', 'R2', 'R3', 'R4', 'R5'] as const;
export type FishId = typeof FISH_IDS[number];
export type RetainedFishId = Exclude<FishId, 'T1'>;
export const CAST_DURATION_MS = 8000;
export const HEARTBEAT_LEASE_MS = 2500;
export const RESULT_HOLD_MS = 2000;
export const BAITS = {
  baby: { id: 'baby', name: 'Baby Bait', difficulty: 'starter', skill: 'Addition: 10–98 + 0–9, no carrying', unlock: 'pond' },
  beginner: { id: 'beginner', name: 'Corn Bait', difficulty: 'easy', skill: 'Addition: 30–100', unlock: 'pond' },
  leafy: { id: 'leafy', name: 'Leafy Bait', difficulty: 'easy', skill: 'Subtraction: 0–29', unlock: 'pond' },
  chewy: { id: 'chewy', name: 'Worm Bait', difficulty: 'medium', skill: 'Subtraction: 0–100', unlock: 'pond' },
  bouncy: { id: 'bouncy', name: 'Bouncy Bait', difficulty: 'medium', skill: 'Multiplication: 2–5', unlock: 'river' },
  crunchy: { id: 'crunchy', name: 'Crunchy Bait', difficulty: 'hard', skill: 'Multiplication: 0–9, products up to 81', unlock: 'river' },
  master: { id: 'master', name: 'Scholar Bait', difficulty: 'hard', skill: 'Exact division: 2–12 tables', unlock: 'river' },
} as const;
export const FISH = {
  P1: { id: 'P1', name: 'Button Minnow', stamina: 1, points: 1 },
  P2: { id: 'P2', name: 'Sunny Goldfish', stamina: 2, points: 2 },
  P3: { id: 'P3', name: 'Pebble Carp', stamina: 3, points: 2 },
  P4: { id: 'P4', name: 'Round Bluegill', stamina: 4, points: 3 },
  P5: { id: 'P5', name: 'Ribbon Koi', stamina: 6, points: 4 },
  T1: { id: 'T1', name: 'Little Pond Turtle', stamina: 2, points: 2 },
  R1: { id: 'R1', name: 'Silver Dace', stamina: 3, points: 2 },
  R2: { id: 'R2', name: 'Striped Perch', stamina: 4, points: 3 },
  R3: { id: 'R3', name: 'Speckled Trout', stamina: 6, points: 3 },
  R4: { id: 'R4', name: 'Whisker Catfish', stamina: 8, points: 4 },
  R5: { id: 'R5', name: 'Round River Pike', stamina: 10, points: 4 },
} as const;
export const LOCATIONS = {
  pond: { id: 'pond', name: 'Little Pond', target: 60, fishIds: ['P1', 'P2', 'P3', 'P4', 'P5', 'T1'] },
  river: { id: 'river', name: 'Village River', target: 180, fishIds: ['P1', 'T1', 'R1', 'R2', 'R3', 'R4', 'R5'] },
} as const;
export const COMPANIONS = {
  highland: { id: 'highland', name: 'Highland Cow' },
  capybara: { id: 'capybara', name: 'Capybara' },
  cow: { id: 'cow', name: 'Dairy Cow' },
} as const;
export interface CatchChance { fishId: FishId | null; percent: number }
const row = (...entries: Array<[FishId | null, number]>): CatchChance[] => entries.map(([fishId, percent]) => ({ fishId, percent }));
export const CATCH_TABLES: Record<LocationId, Record<BaitId, CatchChance[]>> = {
  pond: {
    baby: row(['P1',60],['P2',20],[null,20]), beginner: row(['P1',20],['P2',50],['P3',20],[null,10]),
    leafy: row(['T1',80],[null,20]), chewy: row(['P3',45],['P4',35],['P5',10],[null,10]),
    bouncy: row(['P2',15],['P4',60],['P5',15],[null,10]), crunchy: row(['P3',15],['P4',30],['P5',45],[null,10]),
    master: row(['P3',10],['P4',30],['P5',50],[null,10]),
  },
  river: {
    baby: row(['P1',50],['R1',30],[null,20]), beginner: row(['R1',60],['R2',20],[null,20]),
    leafy: row(['T1',80],[null,20]), chewy: row(['R1',20],['R2',50],['R3',20],[null,10]),
    bouncy: row(['R2',20],['R3',55],['R4',15],[null,10]), crunchy: row(['R3',25],['R4',40],['R5',25],[null,10]),
    master: row(['R3',15],['R4',30],['R5',45],[null,10]),
  },
};
