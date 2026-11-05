import type { AvatarFrameId } from "../lib/avatarFrames";

export type AvatarType = "emoji" | "default" | "custom";

export interface Profile {
  id: string;
  name: string;
  emoji: string;
  color: string;
  avatar_type?: AvatarType;
  avatar_url?: string;
  avatar_frame?: AvatarFrameId | null;
  native_country_code?: string;
  native_city?: string;
  tour_completed_at?: string | null;
  created_at: string;
}

export interface ProfileWithStats extends Profile {
  total_done: number;
  badge_count: number;
  public_id?: string;  // server-owned public identifier, absent for legacy profiles
}

export interface ProfileCreate {
  name: string;
  emoji: string;
  color: string;
  avatar_type?: AvatarType;
  avatar_url?: string;
  avatar_frame?: AvatarFrameId | null;
  native_country_code?: string;
  native_city?: string;
}

export interface ProfileUpdate {
  name?: string;
  emoji?: string;
  color?: string;
  native_country_code?: string | null;
  native_city?: string | null;
  avatar_type?: "emoji" | "default";
  avatar_url?: string | null;
  avatar_frame?: AvatarFrameId | null;
}

export interface BadgeInfo {
  id: string;
  badge_key: string;
  badge_type: string;
  milestone: number;
  earned_at: string;
  name: string;
  description: string;
}

export interface MarkDoneResponse {
  status: 'done' | 'quiz_required';
  already_done: boolean;
  newly_earned_badges: BadgeInfo[];
}

export interface AchievementItem {
  item_id: string;
  title: string;
  category: string;
  country_code?: string;
  country_name: string;
  continent: string;
  completed_at: string;
}

export interface ProfileLessonEntry {
  item_id: string;
  title: string;
  category: string;
  country_code?: string;
  completed_at: string;
  quiz_required: boolean;
}

export interface RecentActivityEntry {
  family_id: string;
  family_name: string;
  profile_id: string;
  profile_name: string;
  profile_emoji: string;
  profile_color: string;
  avatar_type?: "default" | "custom";
  avatar_url?: string;
  avatar_frame?: AvatarFrameId | null;
  item_id: string;
  item_title: string;
  item_category: string;
  country_name: string;
  continent: string;
  completed_at: string;
  is_own_family: boolean;
}
