import { useEffect, useRef, useState } from 'react';
import { getInfinidrill, sendInfinidrill, type InfinidrillState } from '../../api/infinidrill';
import { useSessionRequests } from '../../hooks/useSessionRequests';
import { createInfinidrillGame } from './game';
import { publicQuestion } from '../../../../server/src/questions/projection';
import type { InfinidrillAction, InfinidrillViewState } from './types';
import type { DrillAction } from './viewTypes';

interface Callbacks {
  sync: (result: InfinidrillState) => void;
  action: (before: InfinidrillViewState, result: InfinidrillState, action: DrillAction) => void;
}

/** Transport and local keypad input; authoritative game results come from Render. */
export function useInfinidrillServerSession(profileId: string | undefined, callbacks: Callbacks) {
  const [state, setState] = useState<InfinidrillViewState>(() => {
    const game = createInfinidrillGame();
    return { ...game, currentQuestion: game.currentQuestion ? publicQuestion(game.currentQuestion) : null };
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remote = useRef<InfinidrillState | null>(null);
  const requests = useSessionRequests(profileId);

  async function sync() {
    if (!profileId) return;
    await requests.run(() => getInfinidrill(profileId), {
      start: () => { setLoading(true); setError(''); },
      success: result => {
        remote.current = result;
        if (result.game) setState(result.game);
        callbacks.sync(result);
      },
      error: error => setError(error instanceof Error ? error.message : 'Unable to load your expedition.'),
      finish: () => setLoading(false),
    });
  }

  useEffect(() => { void sync(); }, [profileId, requests]);

  function dispatch(action: DrillAction) {
    if (requests.busy || !remote.current || !profileId) return;
    if (action.type === 'input-digit' || action.type === 'backspace' || action.type === 'clear-input' || action.type === 'question-ready') {
      setState(current => applyLocalAction(current, action));
      return;
    }
    const before = state;
    const revision = remote.current.revision;
    const { at: _ignored, ...command } = action as DrillAction & { at?: number };
    const payload = action.type === 'submit-answer' ? { ...command, answer: Number(state.input) } : command;
    void requests.run(() => sendInfinidrill(profileId, revision, payload), {
      start: () => { setBusy(true); setError(''); },
      success: result => {
        remote.current = result;
        if (!result.game) return;
        callbacks.action(before, result, action);
        setState(result.game);
      },
      error: error => setError(error instanceof Error ? error.message : 'Unable to save your expedition.'),
      finish: () => setBusy(false),
    });
  }

  return { state, loading, busy, error, remote, requests, sync, dispatch };
}

type LocalAction = Extract<InfinidrillAction, { type: 'input-digit' | 'backspace' | 'clear-input' | 'question-ready' }>;

function applyLocalAction(state: InfinidrillViewState, action: LocalAction): InfinidrillViewState {
  if (action.type === 'question-ready') {
    return state.mode !== 'playing' && state.mode !== 'bonus-question' || action.questionId !== state.currentQuestion?.id
      ? state
      : { ...state, questionStartedAt: action.at ?? Date.now() };
  }
  if (action.type === 'input-digit') {
    return state.mode !== 'playing' && state.mode !== 'bonus-question' || !Number.isInteger(action.digit) || action.digit < 0 || action.digit > 9 || state.input.length >= 3
      ? state
      : { ...state, input: `${state.input}${action.digit}`, feedback: null, lastEvent: { kind: 'none' } };
  }
  if (action.type === 'backspace') {
    return state.input.length > 0 ? { ...state, input: state.input.slice(0, -1), feedback: null, lastEvent: { kind: 'none' } } : state;
  }
  return state.input === '' ? state : { ...state, input: '', feedback: null, lastEvent: { kind: 'none' } };
}
