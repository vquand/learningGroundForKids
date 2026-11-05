import { questionKey, gradeQuestion } from '../questions/identity.ts';
import { selectInfinidrillQuestion } from './questions-config.ts';
import { diggingColumns, laserCut, laserShotFromCuts, newlyMinedDeposits } from './mining.ts';
import {
  allUpgradesOwned,
  chooseUpgradeIds,
  getUpgrade,
  isUpgradeUsable,
} from "./upgrades.ts";
import {
  BLOCKS_PER_LEVEL,
  CHALLENGE_INTERVAL,
  FAST_ANSWER_LIMIT_MS,
  FAST_STREAK_TARGET,
  INFINIDRILL_LEVEL_COUNT,
  METRES_PER_BLOCK,
  type Clock,
  type InfinidrillAction,
  type InfinidrillEvent,
  type InfinidrillGameState,
  type InfinidrillLevel,
  type InfinidrillRuntime,
  type RandomSource,
  type Resources,
  type UpgradeSlot,
} from "./types.ts";

const STARTER_EQUIPMENT: Readonly<Partial<Record<UpgradeSlot, string>>> = {
  head: "starter-head",
  cabin: "starter-cabin",
  accessory: "starter-accessory",
  engine: "starter-engine",
  treads: "starter-treads",
};

const defaultRandom: RandomSource = Math.random;
const defaultClock: Clock = () => Date.now();
type ConfiguredRuntime = Omit<InfinidrillRuntime, 'random' | 'now'> & { random: RandomSource; now: Clock };

function runtimeOf(runtime: InfinidrillRuntime = {}): ConfiguredRuntime {
  return {
    random: runtime.random ?? defaultRandom,
    now: runtime.now ?? defaultClock,
    ...(runtime.questionFactory ? { questionFactory: runtime.questionFactory } : {}),
  };
}

function levelBoundary(level: InfinidrillLevel): number {
  return level * BLOCKS_PER_LEVEL;
}

function nextLevel(level: InfinidrillLevel): InfinidrillLevel {
  return Math.min(INFINIDRILL_LEVEL_COUNT, level + 1) as InfinidrillLevel;
}

function stateWithQuestion(
  state: InfinidrillGameState,
  level: InfinidrillLevel,
  counter: number,
  at: number,
  runtime: ConfiguredRuntime,
): InfinidrillGameState {
  const seen = new Set(state.seenQuestions ?? []);
  if (state.currentQuestion) seen.add(questionKey(state.currentQuestion));
  const generated = runtime.questionFactory
    ? selectWithFactory(level, runtime.random, seen, runtime.questionFactory)
    : selectInfinidrillQuestion(level, runtime.random, seen);
  if (generated) seen.add(questionKey(generated));
  return {
    ...state,
    level,
    currentQuestion: generated ? { ...generated, id: `earth-question-${counter + 1}` } : null,
    mode: generated ? state.mode : 'question-exhausted',
    seenQuestions: [...seen],
    questionCounter: counter + (generated ? 1 : 0),
    input: "",
    questionStartedAt: at,
    questionAttempted: false,
    feedback: null,
    upgradeChoices: [],
    lastEvent: { kind: "none" },
  };
}

function selectWithFactory(
  level: InfinidrillLevel,
  random: RandomSource,
  seen: ReadonlySet<string>,
  factory: NonNullable<InfinidrillRuntime['questionFactory']>,
) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = factory(level, random);
    if (!seen.has(questionKey(candidate))) return candidate;
  }
  return selectInfinidrillQuestion(level, random, seen);
}

function addResources(first: Resources, second: Resources): Resources {
  return { crystals: first.crystals + second.crystals, nuggets: first.nuggets + second.nuggets };
}

function depthEvent(
  kind: "drill" | "practice" | "cave-fall" | "core",
  blocks: number,
  reward: Resources,
): InfinidrillEvent {
  return {
    kind: kind === "core" ? "core" : kind === "cave-fall" ? "cave-fall" : "drill",
    depth: {
      kind,
      blocks,
      metres: blocks * METRES_PER_BLOCK,
      crystals: reward.crystals,
      nuggets: reward.nuggets,
    },
  };
}

function withNextMainQuestion(
  state: InfinidrillGameState,
  level: InfinidrillLevel,
  mode: InfinidrillGameState["mode"],
  at: number,
  runtime: ConfiguredRuntime,
): InfinidrillGameState {
  const next = stateWithQuestion(state, level, state.questionCounter, at, runtime);
  return {
    ...next,
    mode: next.mode === 'question-exhausted' ? next.mode : mode,
    previousMode: null,
    firstTryMastery: level === state.level ? next.firstTryMastery : 0,
    fastStreak: level === state.level ? next.fastStreak : 0,
    lastEvent: state.lastEvent,
  };
}

function startChallengeQuestion(
  state: InfinidrillGameState,
  at: number,
  runtime: ConfiguredRuntime,
): InfinidrillGameState {
  const next = stateWithQuestion(state, state.level, state.questionCounter, at, runtime);
  return {
    ...next,
    mode: next.mode === 'question-exhausted' ? next.mode : "bonus-question",
    previousMode: null,
  };
}

function answerMainQuestion(
  state: InfinidrillGameState,
  at: number,
  runtime: ConfiguredRuntime,
): InfinidrillGameState {
  const question = state.currentQuestion;
  if (!question) return state;
  const firstTry = !state.questionAttempted;
  const fast = firstTry && Math.max(0, at - state.questionStartedAt) < FAST_ANSWER_LIMIT_MS;
  const mastery = firstTry ? Math.min(5, state.firstTryMastery + 1) : state.firstTryMastery;
  const fastStreak = fast ? state.fastStreak + 1 : 0;
  const mainQuestionsCompleted = state.mainQuestionsCompleted + 1;
  const questionsSinceChallenge = state.questionsSinceChallenge + 1;
  const boundary = levelBoundary(state.level);
  const remaining = Math.max(0, boundary - state.depthBlocks);
  const bonusTiles = (['cabin', 'engine', 'treads'] as const).reduce((total, slot) => total + (getUpgrade(state.equippedUpgradeIds[slot] ?? '')?.tier ?? 0), 0);
  const drilled = remaining > 0 ? Math.min(remaining, 2 + Math.floor(runtime.random() * 2) + bonusTiles / 2) : 0;
  // Stationary boundary practice cannot re-mine a deposit already collected.
  const depositBlocks = drilled;
  const columns = diggingColumns(getUpgrade(state.equippedUpgradeIds.head ?? '')?.tier ?? 0, runtime.random());
  const cut = { from: state.depthBlocks, to: state.depthBlocks + drilled, ...columns };
  const laser = drilled ? laserCut(getUpgrade(state.equippedUpgradeIds.accessory ?? '')?.tier ?? 0, cut.to, runtime.random(), boundary, columns) : null;
  const laserSteps = laser?.steps ?? [];
  const previousCuts = [...(state.excavations ?? []), ...(state.laserCuts ?? [])];
  const deposits = newlyMinedDeposits(state.worldSeed ?? 0, [...(drilled ? [cut] : []), ...laserSteps], previousCuts);
  const reward = { crystals: deposits.filter(item => item.kind === 'crystals').length, nuggets: deposits.filter(item => item.kind === 'nuggets').length };
  const nextDepthBlocks = state.depthBlocks + drilled;
  const nextResources = addResources(state.resources, reward);
  const base: InfinidrillGameState = {
    ...state,
    mode: "playing",
    excavations: [...(state.excavations ?? (state.depthBlocks ? [{ from: 0, to: state.depthBlocks, left: -1, right: 1 }] : [])), ...(drilled ? [{ from: state.depthBlocks, to: state.depthBlocks + drilled, ...columns }] : [])],
    laserCuts: [...(state.laserCuts ?? []), ...laserSteps],
    input: "",
    questionAttempted: false,
    firstTryMastery: mastery,
    fastStreak,
    mainQuestionsCompleted,
    questionsSinceChallenge,
    depthBlocks: nextDepthBlocks,
    depthMetres: nextDepthBlocks * METRES_PER_BLOCK,
    destroyedBlocks: state.destroyedBlocks + depositBlocks,
    resources: nextResources,
    feedback: null,
    lastEvent: drilled === 0
      ? { kind: "drill", depth: { kind: "practice", blocks: depositBlocks, metres: 0, crystals: reward.crystals, nuggets: reward.nuggets } }
      : depthEvent("drill", drilled, reward),
    upgradeChoices: [],
  };

  // A fast streak opens a hollow and immediately crosses the remaining layer.
  // The final Earth layer still requires its five first-try answers.
  if (fastStreak >= FAST_STREAK_TARGET && nextDepthBlocks < boundary) {
    const caveBlocks = boundary - nextDepthBlocks;
    const caveDepth = nextDepthBlocks + caveBlocks;
    const fallState: InfinidrillGameState = {
      ...base,
      depthBlocks: caveDepth,
      depthMetres: caveDepth * METRES_PER_BLOCK,
      firstTryMastery: 0,
      fastStreak: 0,
      questionsSinceChallenge,
      lastEvent: depthEvent("cave-fall", caveBlocks, { crystals: 0, nuggets: 0 }),
    };
    if (state.level === INFINIDRILL_LEVEL_COUNT) {
      return {
        ...fallState,
        mode: "core",
        currentQuestion: null,
        finishedAt: at,
        firstTryMastery: mastery,
        fastStreak,
        lastEvent: depthEvent("cave-fall", caveBlocks, { crystals: 0, nuggets: 0 }),
      };
    }
    const enteredNextLevel = withNextMainQuestion(fallState, nextLevel(state.level), "playing", at, runtime);
    return questionsSinceChallenge >= CHALLENGE_INTERVAL && enteredNextLevel.mode !== 'question-exhausted'
      ? { ...enteredNextLevel, mode: "challenge-choice", currentQuestion: null, input: "", questionsSinceChallenge: 0, questionStartedAt: at, lastEvent: { kind: "challenge", ...(enteredNextLevel.lastEvent.depth ? { depth: enteredNextLevel.lastEvent.depth } : {}) } }
      : enteredNextLevel;
  }

  const reachedBoundary = nextDepthBlocks >= boundary;
  const completed = reachedBoundary && mastery >= FAST_STREAK_TARGET;
  if (completed && state.level === INFINIDRILL_LEVEL_COUNT) {
    return {
      ...base,
      mode: "core",
      currentQuestion: null,
      finishedAt: at,
      firstTryMastery: mastery,
      lastEvent: depthEvent("core", drilled, reward),
    };
  }
  if (completed) {
    const enteredNextLevel = withNextMainQuestion(base, nextLevel(state.level), "playing", at, runtime);
    return questionsSinceChallenge >= CHALLENGE_INTERVAL && enteredNextLevel.mode !== 'question-exhausted'
      ? { ...enteredNextLevel, mode: "challenge-choice", currentQuestion: null, input: "", questionsSinceChallenge: 0, questionStartedAt: at, lastEvent: { kind: "challenge", ...(enteredNextLevel.lastEvent.depth ? { depth: enteredNextLevel.lastEvent.depth } : {}) } }
      : enteredNextLevel;
  }

  const nextState = withNextMainQuestion(base, state.level, "playing", at, runtime);
  if (questionsSinceChallenge >= CHALLENGE_INTERVAL && nextState.mode !== 'question-exhausted') {
    return { ...nextState, mode: "challenge-choice", currentQuestion: null, input: "", questionsSinceChallenge: 0, questionStartedAt: at, lastEvent: { kind: "challenge", ...(nextState.lastEvent.depth ? { depth: nextState.lastEvent.depth } : {}) } };
  }
  return nextState;
}

function answerBonusQuestion(
  state: InfinidrillGameState,
  at: number,
  runtime: ConfiguredRuntime,
): InfinidrillGameState {
  const question = state.currentQuestion;
  if (!question) return state;
  if (allUpgradesOwned(state.ownedUpgradeIds)) {
    const reward = { crystals: 1, nuggets: 4 };
    const nextState = withNextMainQuestion({
      ...state,
      mode: "playing",
      resources: addResources(state.resources, reward),
      lastEvent: { kind: "challenge-completed" },
      questionsSinceChallenge: 0,
    }, state.level, "playing", at, runtime);
    return { ...nextState, lastEvent: { kind: "challenge-completed" } };
  }
  return {
    ...state,
    mode: "upgrade-reward",
    currentQuestion: null,
    input: "",
    questionAttempted: false,
    questionStartedAt: at,
    upgradeChoices: chooseUpgradeIds(state.ownedUpgradeIds, runtime.random),
    feedback: null,
    lastEvent: { kind: "challenge-completed" },
  };
}

export function createInfinidrillGame(runtime: InfinidrillRuntime = {}): InfinidrillGameState {
  const configured = runtimeOf(runtime);
  const at = configured.now();
  const empty: InfinidrillGameState = {
    worldSeed: Math.floor(configured.random() * 2 ** 32),
    excavations: [],
    mode: "playing",
    level: 1,
    depthBlocks: 0,
    depthMetres: 0,
    currentQuestion: null,
    questionCounter: 0,
    input: "",
    questionStartedAt: at,
    questionAttempted: false,
    firstTryMastery: 0,
    fastStreak: 0,
    mainQuestionsCompleted: 0,
    questionsSinceChallenge: 0,
    destroyedBlocks: 0,
    resources: { crystals: 0, nuggets: 0 },
    ownedUpgradeIds: [],
    equippedUpgradeIds: STARTER_EQUIPMENT,
    previousMode: null,
    pauseStartedAt: null,
    upgradeChoices: [],
    lastEvent: { kind: "none" },
    feedback: null,
    finishedAt: null,
  };
  return stateWithQuestion(empty, 1, 0, at, configured);
}

/** Reissue a missing/invalid saved card without changing the expedition stage. */
export function issueInfinidrillQuestion(state: InfinidrillGameState, runtime: InfinidrillRuntime = {}): InfinidrillGameState {
  const configured = runtimeOf(runtime);
  return stateWithQuestion({ ...state, currentQuestion: null }, state.level, state.questionCounter, state.questionStartedAt, configured);
}

export function infinidrillReducer(
  state: InfinidrillGameState,
  action: InfinidrillAction,
  runtime: InfinidrillRuntime = {},
): InfinidrillGameState {
  const configured = runtimeOf(runtime);
  const at = action.type === "submit-answer" ? action.at ?? configured.now() : "at" in action && action.at !== undefined ? action.at : configured.now();

  if (action.type === "replay") return createInfinidrillGame({ ...runtime, now: () => at });
  if (action.type === "question-ready") {
    if ((state.mode !== "playing" && state.mode !== "bonus-question") || action.questionId !== state.currentQuestion?.id) return state;
    return { ...state, questionStartedAt: at };
  }
  if (action.type === "open-workshop") {
    if (state.mode === "workshop" || state.mode === "core") return state;
    return { ...state, mode: "workshop", previousMode: state.mode, pauseStartedAt: at };
  }
  if (action.type === "close-workshop") {
    if (state.mode !== "workshop") return state;
    const restoredMode = state.previousMode ?? "playing";
    const pauseDuration = state.pauseStartedAt === null ? 0 : Math.max(0, at - state.pauseStartedAt);
    return {
      ...state,
      mode: restoredMode,
      previousMode: null,
      pauseStartedAt: null,
      questionStartedAt: state.currentQuestion ? state.questionStartedAt + pauseDuration : state.questionStartedAt,
      lastEvent: { kind: "none" },
    };
  }
  if (action.type === "pause") {
    if (state.mode === "paused" || state.mode === "core") return state;
    return { ...state, mode: "paused", previousMode: state.mode, pauseStartedAt: at };
  }
  if (action.type === "resume") {
    if (state.mode !== "paused") return state;
    const restoredMode = state.previousMode ?? "playing";
    const pauseDuration = state.pauseStartedAt === null ? 0 : Math.max(0, at - state.pauseStartedAt);
    return {
      ...state,
      mode: restoredMode,
      previousMode: null,
      pauseStartedAt: null,
      questionStartedAt: state.currentQuestion ? state.questionStartedAt + pauseDuration : state.questionStartedAt,
      lastEvent: { kind: "none" },
    };
  }
  if (action.type === "purchase-upgrade") {
    if (state.mode !== "workshop") return state;
    const part = getUpgrade(action.upgradeId);
    if (!part || state.ownedUpgradeIds.includes(part.id) || (part.prerequisiteId !== null && !isUpgradeUsable(state.ownedUpgradeIds, part.prerequisiteId))) return state;
    if (state.resources.crystals < part.crystals || state.resources.nuggets < part.nuggets) return state;
    return {
      ...state,
      ownedUpgradeIds: [...state.ownedUpgradeIds, part.id],
      resources: { crystals: state.resources.crystals - part.crystals, nuggets: state.resources.nuggets - part.nuggets },
      lastEvent: { kind: "upgrade-purchased", upgrade: { kind: "upgrade-purchased", upgradeId: part.id } },
    };
  }
  if (action.type === "equip-upgrade") {
    const starterSlot = (Object.keys(STARTER_EQUIPMENT) as UpgradeSlot[]).find(slot => STARTER_EQUIPMENT[slot] === action.upgradeId);
    if (starterSlot) return {
      ...state,
      equippedUpgradeIds: { ...state.equippedUpgradeIds, [starterSlot]: action.upgradeId },
      lastEvent: { kind: 'upgrade-equipped', upgrade: { kind: 'upgrade-equipped', upgradeId: action.upgradeId } },
    };
    const part = getUpgrade(action.upgradeId);
    if (!part || !isUpgradeUsable(state.ownedUpgradeIds, part.id)) return state;
    return {
      ...state,
      equippedUpgradeIds: { ...state.equippedUpgradeIds, [part.slot]: part.id },
      lastEvent: { kind: "upgrade-equipped", upgrade: { kind: "upgrade-equipped", upgradeId: part.id } },
    };
  }
  if (state.mode === "core" || state.mode === "challenge-choice" && action.type !== "choose-challenge" || state.mode === "upgrade-reward" && action.type !== "choose-upgrade-reward") return state;
  if (action.type === "input-digit") {
    if ((state.mode !== "playing" && state.mode !== "bonus-question") || !Number.isInteger(action.digit) || action.digit < 0 || action.digit > 9 || state.input.length >= 3) return state;
    return { ...state, input: `${state.input}${action.digit}`, feedback: null, lastEvent: { kind: "none" } };
  }
  if (action.type === "backspace") return state.input.length > 0 ? { ...state, input: state.input.slice(0, -1), feedback: null, lastEvent: { kind: "none" } } : state;
  if (action.type === "clear-input") return state.input === "" ? state : { ...state, input: "", feedback: null, lastEvent: { kind: "none" } };
  if (action.type === "choose-challenge") {
    if (state.mode !== "challenge-choice") return state;
    return action.choice === "A"
      ? { ...withNextMainQuestion(state, state.level, "playing", at, configured), lastEvent: { kind: "none" } }
      : startChallengeQuestion(state, at, configured);
  }
  if (action.type === "choose-upgrade-reward") {
    if (state.mode !== "upgrade-reward" || !state.upgradeChoices.includes(action.upgradeId) || state.ownedUpgradeIds.includes(action.upgradeId)) return state;
    const ownedUpgradeIds = [...state.ownedUpgradeIds, action.upgradeId];
    const part = getUpgrade(action.upgradeId);
    const canEquipNow = part !== undefined && isUpgradeUsable(ownedUpgradeIds, part.id);
    const nextState = withNextMainQuestion({
      ...state,
      mode: "playing",
      ownedUpgradeIds,
      equippedUpgradeIds: canEquipNow && part ? { ...state.equippedUpgradeIds, [part.slot]: part.id } : state.equippedUpgradeIds,
      lastEvent: { kind: "upgrade-reward", upgrade: { kind: "upgrade-reward", upgradeId: action.upgradeId } },
      upgradeChoices: [],
    }, state.level, "playing", at, configured);
    return { ...nextState, lastEvent: { kind: "upgrade-reward", upgrade: { kind: "upgrade-reward", upgradeId: action.upgradeId } } };
  }
  if (action.type !== "submit-answer" || state.mode !== "playing" && state.mode !== "bonus-question" || !state.currentQuestion || action.questionId !== state.currentQuestion.id || state.input === "") return state;
  const answer = Number(state.input);
  if (!Number.isInteger(answer) || !gradeQuestion(state.currentQuestion, answer)) {
    if (state.mode === "bonus-question") {
      return { ...withNextMainQuestion({ ...state, mode: "playing", feedback: "challenge-failed", lastEvent: { kind: "challenge-failed" } }, state.level, "playing", at, configured), feedback: "challenge-failed", lastEvent: { kind: "challenge-failed" } };
    }
    return { ...state, input: "", questionAttempted: true, fastStreak: 0, feedback: "wrong", lastEvent: { kind: "wrong-answer" } };
  }
  if (state.mode === 'bonus-question') return answerBonusQuestion(state, at, configured);
  const next = answerMainQuestion(state, at, configured);
  const lastDig = next.excavations?.at(-1);
  const newLaserCuts = next.laserCuts?.slice(state.laserCuts?.length ?? 0) ?? [];
  const laser = laserShotFromCuts(newLaserCuts);
  const deposits = lastDig && next.destroyedBlocks > state.destroyedBlocks
    ? newlyMinedDeposits(state.worldSeed ?? 0, [lastDig, ...newLaserCuts], [...(state.excavations ?? []), ...(state.laserCuts ?? [])]) : [];
  return { ...next, lastEvent: { ...next.lastEvent, deposits, ...(laser ? { laser } : {}) } };
}

export const INFINIDRILL_STARTER_EQUIPMENT = STARTER_EQUIPMENT;
export { INFINIDRILL_UPGRADES } from "./upgrades.ts";
