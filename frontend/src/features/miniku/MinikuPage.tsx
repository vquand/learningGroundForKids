import { MinigameBadgesButton } from '../achievements/MinigameBadgesButton';
import { KidBackButton } from "../../components/KidBackButton";
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { actMiniku, fetchMiniku, type MinikuCommand, type MinikuSize, type MinikuState } from '../../api/miniku';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { useSessionRequests } from '../../hooks/useSessionRequests';
import './miniku.css';

const sizes: Array<{ size: MinikuSize; label: string; detail: string }> = [
  { size: 3, label: '3 × 3', detail: 'A tiny first grid' },
  { size: 4, label: '4 × 4', detail: 'A little more to think about' },
  { size: 5, label: '5 × 5', detail: 'A big thinker grid' },
];

function numberIsAlreadyNearby(board: NonNullable<MinikuState['board']>, index: number, value: number): boolean {
  const row = Math.floor(index / board.size);
  const column = index % board.size;
  return board.entries.some((entry, otherIndex) => entry === value && otherIndex !== index && (
    Math.floor(otherIndex / board.size) === row || otherIndex % board.size === column
  ));
}

export function MinikuPage() {
  const familyId = useFamilyStore(state => state.familyId);
  const generation = useFamilyStore(state => state.sessionGeneration);
  const profileId = useProfileStore(state => state.activeProfileId);
  return <MinikuSession key={`${generation}:${familyId}:${profileId}`} />;
}

function MinikuSession() {
  useUiLanguage();
  const cache = useQueryClient();
  const familyId = useFamilyStore(state => state.familyId);
  const profileId = useProfileStore(state => state.activeProfileId);
  const key = familyQueryKey('miniku', familyId, profileId);
  const query = useQuery({ queryKey: key, queryFn: familyScopedQuery(familyId, () => fetchMiniku(profileId!)), enabled: Boolean(familyId && profileId), retry: false, refetchOnWindowFocus: false });
  const current = useRef<MinikuState | undefined>(query.data);
  current.current = query.data;
  const [size, setSize] = useState<MinikuSize>(3);
  const [choosingDifficulty, setChoosingDifficulty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const cellElements = useRef(new Map<number, HTMLButtonElement>());
  const activeFlight = useRef<{ element: HTMLSpanElement; animation: Animation } | null>(null);
  const requests = useSessionRequests(profileId);
  const [landingIndex, setLandingIndex] = useState<number | null>(null);
  const celebrateAfterLanding = useRef(false);

  useEffect(() => () => {
    activeFlight.current?.animation.cancel();
    activeFlight.current?.element.remove();
  }, []);
  const completionDialog = useRef<HTMLDialogElement>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCompletionBurst, setShowCompletionBurst] = useState(false);

  useEffect(() => {
    if (showCelebration) completionDialog.current?.showModal();
    else completionDialog.current?.close();
  }, [showCelebration]);

  useEffect(() => {
    if (!query.data || initialized.current) return;
    initialized.current = true;
    if (query.data.board) setSize(query.data.board.size);
  }, [query.data]);

  const command = useCallback(async (nextCommand: MinikuCommand, arrival?: Promise<void>) => {
    const state = current.current;
    if (!state || !profileId || requests.busy) return;
    await requests.run(async () => {
      const next = await actMiniku(profileId, state.revision, nextCommand);
      if (arrival) await arrival;
      return next;
    }, {
      start: () => { setPending(true); setError(''); },
      success: next => {
        if (arrival && nextCommand.type === 'set-cell') setLandingIndex(nextCommand.index);
        current.current = next;
        cache.setQueryData(key, next);
        if (state.board?.status === 'playing' && next.board?.status === 'complete') {
          if (arrival) celebrateAfterLanding.current = true;
          else setShowCompletionBurst(true);
        } else if (next.board?.status === 'playing') {
          if (nextCommand.type === 'start' || nextCommand.type === 'new-puzzle') setChoosingDifficulty(false);
          setShowCelebration(false);
        }
      },
      error: caught => setError(caught instanceof Error ? caught.message : 'Please try again.'),
      finish: () => setPending(false),
    });
  }, [cache, key, requests, profileId]);

  const board = query.data?.board ?? null;
  const selected = board?.selectedIndex !== null && board?.selectedIndex !== undefined ? board.selectedIndex : null;
  const canEdit = board && selected !== null && board.givens[selected] === 0 && board.status === 'playing';

  if (query.isLoading) return <main className="miniku-loading" role="status">{uiText("Setting up a little grid…")}</main>;
  if (query.error || !query.data) return <main className="miniku-loading"><p role="alert">{query.error instanceof Error ? query.error.message : uiText("Choose a profile to play.")}</p><button type="button" onClick={() => void query.refetch()}>{uiText("Try again")}</button><KidBackButton className="kid-back--floating"/></main>;

  const placeNumber = (value: number, source: HTMLButtonElement) => {
    if (selected === null || !canEdit || requests.busy) return;
    const target = cellElements.current.get(selected);
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void command({ type: 'set-cell', index: selected, value });
      return;
    }
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const digit = document.createElement('span');
    digit.className = 'miniku-flying-number';
    digit.textContent = String(value);
    digit.setAttribute('aria-hidden', 'true');
    digit.style.left = `${from.left + from.width / 2}px`;
    digit.style.top = `${from.top + from.height / 2}px`;
    digit.style.fontSize = getComputedStyle(target).fontSize;
    document.body.append(digit);
    const dx = to.left + to.width / 2 - from.left - from.width / 2;
    const dy = to.top + to.height / 2 - from.top - from.height / 2;
    const animation = digit.animate([
      { transform: 'translate(-50%, -50%) scale(.55)' },
      { transform: `translate(calc(-50% + ${dx * .65}px), calc(-50% + ${dy * .65 - 20}px)) scale(1.08)`, offset: .65 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)` },
    ], { duration: 420, easing: 'ease-in-out', fill: 'forwards' });
    activeFlight.current = { element: digit, animation };
    const arrival = animation.finished.then(() => {}, () => {}).finally(() => {
      digit.remove();
      activeFlight.current = null;
    });
    setLandingIndex(null);
    void command({ type: 'set-cell', index: selected, value }, arrival);
  };

  const finishLanding = () => {
    setLandingIndex(null);
    if (celebrateAfterLanding.current) {
      celebrateAfterLanding.current = false;
      setShowCompletionBurst(true);
    }
  };
  const changeDifficulty = () => { setShowCelebration(false); setChoosingDifficulty(true); };
  const start = () => void command({ type: board ? 'new-puzzle' : 'start', size });
  return <main className="miniku-page">
    <div className="miniku-background" aria-hidden="true" />
    <header className="miniku-topbar kid-nav">
      <KidBackButton/>
      <div className="miniku-title"><span className="miniku-eyebrow">{uiText("A quiet thinking game")}</span><h1>Miniku</h1><span>{uiText("Mini sudoku for curious minds")}</span></div>
      <MinigameBadgesButton groupIds={['miniku']} />
    </header>
    <div className="miniku-layout">
      <section className="miniku-board-card" aria-label={uiText("Miniku board")}>
        {!board || choosingDifficulty ? <div className="miniku-setup">
          <p className="miniku-eyebrow">{uiText("Choose your difficulty")}</p><h2>{uiText("Which size feels right?")}</h2><p>{uiText("Each row and column uses every number once. You can change a number whenever you want.")}</p>
          <div className="miniku-size-options">{sizes.map(option => <button key={option.size} type="button" className={size === option.size ? 'is-selected' : ''} onClick={() => setSize(option.size)} aria-pressed={size === option.size}><strong>{option.label}</strong><span>{uiText(option.detail)}</span></button>)}</div>
          {board && <p>{uiText("Starting a new puzzle replaces your current grid.")}</p>}
          <button type="button" className="miniku-primary" onClick={start} disabled={pending}>{uiText("Make my puzzle →")}</button>
          {board && <button type="button" className="miniku-small-button miniku-return-grid" onClick={() => setChoosingDifficulty(false)} disabled={pending}>{uiText("Back to my grid")}</button>}
        </div> : <>
          <div className="miniku-board-heading"><div><p className="miniku-eyebrow">{uiText("Your ")}{board.size} × {board.size} {uiText(" grid")}</p><h2>{board.status === "complete" ? uiText("You solved it!") : uiText("Take your time")}</h2></div><div className="miniku-board-actions"><button type="button" className="miniku-small-button" onClick={changeDifficulty} disabled={pending}>{uiText("Change difficulty")}</button><button type="button" className="miniku-small-button" onClick={start} disabled={pending}>{uiText("New puzzle")}</button></div></div>
          <div className={`miniku-grid-wrap ${board.status === "complete" ? 'is-complete' : ''}`}>
          <div className={`miniku-grid miniku-grid-${board.size}`} style={{ '--miniku-size': board.size } as CSSProperties}>{board.entries.map((value, index) => {
            const fixed = board.givens[index] !== 0;
            const active = selected === index;
            const conflicted = board.conflictIndices.includes(index);
            return <button key={index} ref={element => { if (element) cellElements.current.set(index, element); else cellElements.current.delete(index); }} type="button" className={`miniku-cell ${fixed ? 'is-given' : 'is-editable'} ${active ? 'is-selected' : ''} ${conflicted ? 'is-conflict' : ''}`} onClick={() => fixed ? undefined : void command({ type: 'select-cell', index })} disabled={fixed || pending} aria-label={`Row ${Math.floor(index / board.size) + 1}, column ${(index % board.size) + 1}${fixed ? ', clue' : ''}${conflicted ? ', conflict' : ''}`} aria-pressed={active}>{value ?? ''}{landingIndex === index && <span className="miniku-landing-dust" aria-hidden="true" onAnimationEnd={finishLanding}>{Array.from({ length: 6 }, (_, particle) => <i key={particle} style={{ '--dust-x': `${(particle - 2.5) * 13}px`, '--dust-y': `${particle % 2 ? -14 : -24}px` } as CSSProperties} />)}</span>}</button>;
          })}</div>
          {showCompletionBurst && <div className="miniku-completion-burst" aria-hidden="true" onAnimationEnd={event => {
            if (event.target !== event.currentTarget) return;
            setShowCompletionBurst(false);
            setShowCelebration(true);
          }}>{Array.from({ length: 16 }, (_, index) => {
            const angle = index * Math.PI * 2 / 16;
            return <span key={index} className="miniku-party-particle" style={{ left: `${50 + Math.cos(angle) * 35}%`, top: `${50 + Math.sin(angle) * 35}%`, '--party-x': `${Math.cos(angle) * 85}px`, '--party-y': `${Math.sin(angle) * 85}px`, '--party-rotation': `${index % 2 ? -25 : 25}deg` } as CSSProperties}>
              {index % 2 === 0 ? <svg viewBox="0 0 32 32"><path fill="#f29ab0" d="M16 28C12 24 3 18 3 11C3 3 12 2 16 8C20 2 29 3 29 11C29 18 20 24 16 28Z" /></svg> : <svg viewBox="0 0 32 32"><path fill="#f7bfd3" d="M16 11C6-3 1 12 10 16C-3 22 11 34 16 23C22 35 35 23 23 16C34 10 23-3 16 11Z" /><circle cx="16" cy="17" r="4" fill="#f7d87c" /></svg>}
            </span>;
          })}</div>}
          </div>
          <p className="miniku-hint" aria-live="polite">{board.status === "complete" ? uiText("Lovely work. Choose another grid when you are ready.") : selected === null ? uiText("Pick an empty square, then choose a number.") : canEdit ? (query.data.hints === false ? uiText("Choose a number. Look across and down to check it.") : uiText("A red number means it is already used nearby. You can still try it.")) : uiText("Clue squares are part of the puzzle.")}</p>
          <div className={`miniku-number-pad ${query.data.hints === false ? 'miniku-no-hints' : ''}`} aria-label={uiText("Choose a number")}>{Array.from({ length: board.size }, (_, index) => index + 1).map(value => <button key={value} type="button" onClick={event => placeNumber(value, event.currentTarget)} disabled={!canEdit || pending} className={query.data.hints !== false && selected !== null && numberIsAlreadyNearby(board, selected, value) ? 'is-conflict-choice' : ''}>{value}</button>)}<button type="button" className="miniku-clear" onClick={() => selected !== null && canEdit ? void command({ type: 'clear-cell', index: selected }) : undefined} disabled={!canEdit || pending}>{uiText("Clear")}</button></div>
        </>}
      </section>
      <aside className="miniku-side-card">
        <div className="miniku-side-art" role="img" aria-label={uiText("A thoughtful capybara friend looking at a sudoku board")} />
        <p className="miniku-eyebrow">{uiText("Think like a detective")}</p><h2>{uiText("Look across and down.")}</h2><p>{uiText("Every row and column needs one of each number. Start with a square where only one number can fit.")}</p>
        {board && <div className="miniku-progress"><span>{uiText("Boards complete")}</span><strong>{query.data.completed}</strong><small>3×3: {query.data.completedBySize['3'] ?? 0} · 4×4: {query.data.completedBySize['4'] ?? 0} · 5×5: {query.data.completedBySize['5'] ?? 0}</small></div>}
        {error && <p className="miniku-error" role="alert">{error}</p>}
      </aside>
    </div>
    <dialog ref={completionDialog} className="miniku-completion-dialog" aria-labelledby="miniku-completion-title" onClose={() => setShowCelebration(false)} onCancel={() => setShowCelebration(false)}>
      <img className="miniku-cheering-friend" src="/minigames/food-and-drink/capybara/capybara-celebrate.png" alt={uiText("A happy capybara cheering with both paws in the air")} />
      <p className="miniku-eyebrow">{uiText("Hip, hip, hooray!")}</p>
      <h2 id="miniku-completion-title">{uiText("Congratulations! You solved it!")}</h2>
      <p>{uiText("Every number found its place. Your capybara friend is cheering for you!")}</p>
      <div className="miniku-completion-actions">
        <button type="button" className="miniku-primary" onClick={start} disabled={pending}>{uiText("Another puzzle →")}</button>
        <button type="button" className="miniku-small-button" onClick={changeDifficulty}>{uiText("Change difficulty")}</button>
        <button type="button" className="miniku-small-button" onClick={() => setShowCelebration(false)}>{uiText("Look at my grid")}</button>
      </div>
      {error && <p className="miniku-error" role="alert">{error}</p>}
    </dialog>
  </main>;
}
