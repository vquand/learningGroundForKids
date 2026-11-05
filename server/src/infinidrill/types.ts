/** Pure data contracts shared by the Infinidrill scene, reducer and tests. */

import type { EquationCard, Question, VennCard } from '../questions/types.ts';

export const INFINIDRILL_LEVEL_COUNT = 18 as const;
export const BLOCKS_PER_LEVEL = 20 as const;
export const METRES_PER_BLOCK = 6 as const;
export const FAST_STREAK_TARGET = 5 as const;
export const FAST_ANSWER_LIMIT_MS = 15_000 as const;
export const CHALLENGE_INTERVAL = 7 as const;

export type InfinidrillLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;
export type UpgradeSlot = "head" | "cabin" | "accessory" | "engine" | "treads";
export type GameMode = "playing" | "challenge-choice" | "bonus-question" | "upgrade-reward" | "workshop" | "paused" | "core" | "question-exhausted";
export type InfinidrillQuestion = Omit<Question, 'card' | 'answer'> & {
  readonly card: EquationCard | VennCard;
  readonly answer: number;
};

export interface UpgradePart {
  readonly id: string;
  readonly slot: UpgradeSlot;
  readonly tier: 1 | 2 | 3 | 4;
  readonly name: string;
  readonly description: string;
  readonly prerequisiteId: string | null;
  readonly crystals: number;
  readonly nuggets: number;
  readonly color: string;
}

export interface Resources {
  readonly crystals: number;
  readonly nuggets: number;
}

export interface Deposit { readonly row: number; readonly column: number; readonly kind: keyof Resources }
export interface Excavation { readonly from: number; readonly to: number; readonly left: number; readonly right: number }
export interface LaserShot extends Excavation { readonly steps?: readonly Excavation[] }

export interface DepthEvent {
  readonly kind: "drill" | "practice" | "cave-fall" | "core";
  readonly blocks: number;
  readonly metres: number;
  readonly crystals: number;
  readonly nuggets: number;
}

export interface UpgradeRevealEvent {
  readonly kind: "upgrade-reward" | "upgrade-purchased" | "upgrade-equipped";
  readonly upgradeId: string;
}

export interface InfinidrillEvent {
  readonly laser?: LaserShot;
  readonly deposits?: readonly Deposit[];
  readonly kind: "none" | "wrong-answer" | "challenge" | "challenge-failed" | "challenge-completed" | "drill" | "cave-fall" | "core" | "upgrade-reward" | "upgrade-purchased" | "upgrade-equipped";
  readonly depth?: DepthEvent;
  readonly upgrade?: UpgradeRevealEvent;
}

export interface InfinidrillGameState {
  /** Optional for pre-mineral-map saves; existing balances are retained. */
  readonly worldSeed?: number;
  readonly excavations?: readonly Excavation[];
  readonly laserCuts?: readonly Excavation[];
  readonly mode: GameMode;
  readonly level: InfinidrillLevel;
  /** Destroyed/traversed blocks below the surface. Cave blocks are included. */
  readonly depthBlocks: number;
  readonly depthMetres: number;
  readonly currentQuestion: InfinidrillQuestion | null;
  /** Private canonical identities for this expedition; absent in older saves. */
  readonly seenQuestions?: readonly string[];
  /** Monotonic local token that makes an already-submitted answer harmless. */
  readonly questionCounter: number;
  readonly input: string;
  readonly questionStartedAt: number;
  readonly questionAttempted: boolean;
  readonly firstTryMastery: number;
  readonly fastStreak: number;
  readonly mainQuestionsCompleted: number;
  readonly questionsSinceChallenge: number;
  readonly destroyedBlocks: number;
  readonly resources: Resources;
  /** Free and purchased parts live here, even when prerequisites are not usable yet. */
  readonly ownedUpgradeIds: readonly string[];
  readonly equippedUpgradeIds: Readonly<Partial<Record<UpgradeSlot, string>>>;
  readonly previousMode: GameMode | null;
  readonly pauseStartedAt: number | null;
  readonly upgradeChoices: readonly string[];
  readonly lastEvent: InfinidrillEvent;
  readonly feedback: "wrong" | "challenge-failed" | null;
  readonly finishedAt: number | null;
}

export type InfinidrillAction =
  | { readonly type: "question-ready"; readonly questionId: string; readonly at?: number }
  | { readonly type: "input-digit"; readonly digit: number }
  | { readonly type: "backspace" }
  | { readonly type: "clear-input" }
  | { readonly type: "submit-answer"; readonly questionId: string; readonly at?: number }
  | { readonly type: "choose-challenge"; readonly choice: "A" | "B" }
  | { readonly type: "choose-upgrade-reward"; readonly upgradeId: string }
  | { readonly type: "open-workshop"; readonly at?: number }
  | { readonly type: "close-workshop"; readonly at?: number }
  | { readonly type: "pause"; readonly at?: number }
  | { readonly type: "resume"; readonly at?: number }
  | { readonly type: "purchase-upgrade"; readonly upgradeId: string }
  | { readonly type: "equip-upgrade"; readonly upgradeId: string }
  | { readonly type: "replay"; readonly at?: number };

export type RandomSource = () => number;
export type Clock = () => number;
export type QuestionFactory = (level: InfinidrillLevel, random: RandomSource) => InfinidrillQuestion;

export interface InfinidrillRuntime {
  readonly random?: RandomSource;
  readonly now?: Clock;
  readonly questionFactory?: QuestionFactory;
}
