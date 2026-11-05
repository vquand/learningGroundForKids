export type AdventureGame = 'explore' | 'kitchen' | 'town' | 'ufo' | 'math-wall' | 'infinidrill' | 'miniku';
export type AdventureKind = 'explore_learned' | 'meal_finished' | 'meal_burnt' | 'meal_undercooked' | 'blueprint_unlocked' | 'town_built' | 'town_milestone' | 'town_harvest' | 'ufo_solved' | 'waddle_passed' | 'drill_depth' | 'drill_core' | 'drill_upgrade' | 'miniku_completed';
export interface AdventureData { subject?: string; itemId?: string; amount?: number; difficulty?: string; recipeId?: string }
export interface AdventureEntry {
  id: string;
  game: AdventureGame;
  kind: AdventureKind;
  data: AdventureData;
  occurred_at: string;
  /** Number of verified events in this actor/activity/local-hour group. */
  count?: number;
  profile: { id: string; name: string; emoji: string; color: string; avatar_type: string | null; avatar_url: string | null; avatar_frame: string | null };
}
export interface AdventurePage { entries: AdventureEntry[]; next_cursor: string | null }
export interface AdventureCursor { at: string; id: string }
export interface AdventureEvent { key: string; game: AdventureGame; kind: AdventureKind; data: AdventureData }
