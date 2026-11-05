import type { AchievementDefinition } from '../achievement-catalog.js';

export interface ReportMetric { key: string; label: string; value: number | null }
export interface ReportAchievement extends AchievementDefinition { earned: boolean; earned_at: string | null; current?: number }
export interface GameReport {
  id: string;
  name: string;
  scope: 'lifetime' | 'current-expedition' | 'current-town' | 'recorded-study' | 'unavailable';
  recorded: boolean;
  metrics: ReportMetric[];
  achievements: ReportAchievement[];
  earning: 'server-verified' | 'catalog-only' | 'none';
}
export interface ChildReport {
  id: string; name: string; emoji: string; color: string;
  avatar_type: 'emoji' | 'default' | 'custom'; avatar_url: string | null; avatar_frame: string | null;
  public_id: string | null;
  exploring_completed: number;
  exploring_badges: number;
  quiz_attempts: number;
  quiz_passes: number;
  earned_badges: number;
  last_activity_at: string | null;
  latest_items: Array<{ item_id: string; title: string; category: string; completed_at: string }>;
  games: GameReport[];
}
export interface ParentReport {
  generated_at: string;
  children: ChildReport[];
  totals: { children: number; exploring_completed: number; quiz_attempts: number; quiz_passes: number;
    earned_badges: number; study_sessions: number; drink_completions: number };
}
export interface ParentReportRepository { read(familyId: string): Promise<ParentReport> }
