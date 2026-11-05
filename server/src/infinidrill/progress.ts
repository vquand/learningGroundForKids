import { createInfinidrillGame, infinidrillReducer, issueInfinidrillQuestion } from './game.ts';
import type { InfinidrillAction, InfinidrillGameState, InfinidrillQuestion, InfinidrillRuntime } from './types.ts';
import { publicQuestion } from '../questions/projection.ts';
import { questionKeyFromInfinidrill, fromInfinidrillQuestion } from '../questions/legacy.ts';
import { INFINIDRILL_ACHIEVEMENT_GROUP } from '../achievement-catalog.ts';
import { AppError } from '../errors.ts';

export type Command =
  | { type: 'submit-answer'; questionId: string; answer: number }
  | { type: 'choose-challenge'; choice: 'A' | 'B' }
  | { type: 'choose-upgrade-reward' | 'purchase-upgrade' | 'equip-upgrade'; upgradeId: string }
  | { type: 'replay' | 'pause' | 'resume' | 'open-workshop' | 'close-workshop' };
export interface Progress {
  revision: number;
  game: InfinidrillGameState | null;
  caveFalls: number;
  bonusQuestionsCompleted: number;
  earned: Record<string, string>;
  /** Server-only rock carry for the Town sand bonus; absent in legacy saves. */
  townRockRemainder?: number;
}
export const emptyProgress = (): Progress => ({ revision: 0, game: null, caveFalls: 0, bonusQuestionsCompleted: 0, earned: {} });

/** Convert persisted InfiniDrill question data before it reaches the reducer. */
export function normalizeProgress(progress: Progress, runtime: InfinidrillRuntime = {}): Progress {
  if (!progress.game) return progress;
  const game = progress.game as InfinidrillGameState & { currentQuestion?: unknown };
  const currentQuestion = game.currentQuestion === null || game.currentQuestion === undefined
    ? null
    : fromInfinidrillQuestion(game.currentQuestion) as InfinidrillQuestion | null;
  const seenQuestions = [...new Set((game.seenQuestions ?? []).flatMap((value) => {
    const key = questionKeyFromInfinidrill(value);
    return key ? [key] : [];
  }))];
  if (currentQuestion) {
    // Legacy conversion keeps the existing question counter. Only the repair
    // branch below calls issueInfinidrillQuestion and issues a new ID.
    seenQuestions.push(currentQuestion.key);
    return { ...progress, game: { ...game, currentQuestion, seenQuestions: [...new Set(seenQuestions)] } };
  }
  if (game.currentQuestion === null || game.currentQuestion === undefined) {
    return { ...progress, game: { ...game, seenQuestions } };
  }
  const repaired = ['playing', 'bonus-question', 'paused'].includes(game.mode)
    ? issueInfinidrillQuestion({ ...game, currentQuestion: null, seenQuestions }, runtime)
    : { ...game, currentQuestion: null, seenQuestions };
  return { ...progress, game: repaired };
}

export function applyCommand(progress: Progress, command: Command, now: number, runtime: InfinidrillRuntime = {}): Progress {
  const configured = { ...runtime, now: () => now };
  if (command.type === 'replay') return { ...progress, revision: progress.revision + 1, game: createInfinidrillGame(configured), caveFalls: 0, bonusQuestionsCompleted: 0 };
  if (!progress.game) throw new AppError(409, 'INFINIDRILL_NOT_STARTED', 'Start an expedition first.');
  const before = progress.game;
  let input = before;
  let action: InfinidrillAction;
  if (command.type === 'submit-answer') {
    if (command.questionId !== before.currentQuestion?.id || !['playing', 'bonus-question'].includes(before.mode)) {
      throw new AppError(409, 'INFINIDRILL_STALE_QUESTION', 'This question has already changed. Sync the game to continue.');
    }
    input = { ...before, input: String(command.answer) };
    action = { type: 'submit-answer', questionId: command.questionId };
  } else action = command;
  const game = infinidrillReducer(input, action, configured);
  const solvedMain = game.mainQuestionsCompleted > before.mainQuestionsCompleted;
  const caveFalls = progress.caveFalls + (solvedMain && game.lastEvent.depth?.kind === 'cave-fall' ? 1 : 0);
  const bonusQuestionsCompleted = progress.bonusQuestionsCompleted + (command.type === 'submit-answer' && before.mode === 'bonus-question' && game.lastEvent.kind === 'challenge-completed' ? 1 : 0);
  const metrics = { mainQuestionsCompleted: game.mainQuestionsCompleted, depthMetres: game.depthMetres,
    caveFalls, bonusQuestionsCompleted, ownedUpgradeCount: game.ownedUpgradeIds.length, coreReached: game.mode === 'core' ? 1 : 0 };
  const earned = { ...progress.earned };
  for (const definition of INFINIDRILL_ACHIEVEMENT_GROUP.achievements) {
    if (metrics[definition.metric as keyof typeof metrics] >= definition.target && !earned[definition.id]) earned[definition.id] = new Date(now).toISOString();
  }
  return { ...progress, revision: progress.revision + 1, game, caveFalls, bonusQuestionsCompleted, earned };
}

function withoutQuestionHistory({ seenQuestions: _seen, ...game }: InfinidrillGameState) {
  return game;
}

export function publicState(progress: Progress) {
  const game = progress.game ? withoutQuestionHistory(progress.game) : null;
  return { revision: progress.revision, game: game ? { ...game, currentQuestion: game.currentQuestion ? publicQuestion(game.currentQuestion) : null } : null,
  achievements: INFINIDRILL_ACHIEVEMENT_GROUP.achievements.map(a => ({ ...a, earnedAt: progress.earned[a.id] ?? null })) };
}
export type PublicState = ReturnType<typeof publicState>;
