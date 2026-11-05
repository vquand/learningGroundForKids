import type { infinidrillReducer } from './game';
import type { UpgradeSlot } from './types';

export interface InfinidrillProfile {
  id?: string; name?: string; emoji: string; color?: string;
  avatar_type?: "emoji" | "default" | "custom"; avatar_url?: string; avatar_frame?: string | null;
}

export type Overlay = "pause" | "exit" | "achievements" | null;
export type Slot = UpgradeSlot;
export type DrillAction = Parameters<typeof infinidrillReducer>[1];
