import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { FishingCommand, FishingCompanion, FishingState } from '../../api/fishing';
import { QuestionView } from '../../components/questions/QuestionView';
import { uiMessage, uiText } from '../../i18n/uiText';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { BAITS, FISH, FISHING_SPOTS, FRIENDS, LOCATION_FISH, ODDS } from './viewCatalog';
import { BaitArt, CatchArt, ReadyFriendArt, type FriendGreeting } from './FishingArt';

export function FishingDialog({ title, close, children, className = '' }: { title: string; close: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const previous = document.activeElement; ref.current?.showModal(); return () => { if (previous instanceof HTMLElement) previous.focus({ preventScroll: true }); }; }, []);
  return createPortal(<dialog className={`fishing-dialog ${className}`} ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={e => e.stopPropagation()}>
    <header><h2 id={id}>{uiText(title)}</h2><button className="kid-nav-action" type="button" onClick={close} aria-label={uiText('Close')}>×</button></header>{children}
  </dialog>, document.body);
}
export function FishingSetup({ state, busy, send, done, greeting, chooseFriend }: { state: FishingState; busy: boolean; send: (command: FishingCommand) => Promise<unknown>; done: () => void; greeting: FriendGreeting | null; chooseFriend: (companion: FishingCompanion) => void }) {
  useUiLanguage();
  const [spotPage, setSpotPage] = useState(() => Math.floor(Math.max(0, FISHING_SPOTS.findIndex(spot => spot.id === state.location)) / 2));
  const totalPages = Math.ceil(FISHING_SPOTS.length / 2), currentPage = Math.min(spotPage, totalPages - 1);
  const locked = state.points.pond < 60, choosingDisabled = busy;
  return <div className="fishing-setup-panel">
    <p className="fishing-kicker">{uiText('A little math. A lovely catch.')}</p><h1>{uiText('Fishing Friends')}</h1>
    <p>{uiText('Earn bait with math, settle by the water, and see who takes a nibble.')}</p>
    <h2>{uiText('Choose your fishing friend')}</h2><div className="fishing-friend-choices">{FRIENDS.map(friend => <button type="button" key={friend.id} aria-pressed={friend.id === state.companion} disabled={choosingDisabled} onClick={() => chooseFriend(friend.id)}><ReadyFriendArt companion={friend.id} greeting={greeting}/><strong>{uiText(friend.name)}</strong></button>)}</div>
    <h2>{uiText('Choose a fishing spot')}</h2><ul className="fishing-location-choices" aria-label={uiText('Fishing spots')}>{FISHING_SPOTS.slice(currentPage * 2, currentPage * 2 + 2).map(spot => <li key={spot.id}><button type="button" className={`is-${spot.id}`} aria-pressed={state.location === spot.id} disabled={choosingDisabled || state.cast?.phase === 'waiting' || spot.id === 'river' && locked} onClick={() => void send({ type: 'select-location', location: spot.id })}><strong>{uiText(spot.name)}</strong><small>{spot.id === 'river' && locked ? uiText('Complete Little Pond to unlock') : uiMessage('Fishing points: {points}', { points: state.points[spot.id] })}</small></button></li>)}</ul>
    {totalPages > 1 && <nav className="fishing-spot-pages" aria-label={uiText('Fishing spots')}><button type="button" className="kid-nav-action" disabled={currentPage === 0} onClick={() => setSpotPage(currentPage - 1)}>{uiText('Previous')}</button><span>{uiMessage('Page {page} of {total}', { page: currentPage + 1, total: totalPages })}</span><button type="button" className="kid-nav-action" disabled={currentPage === totalPages - 1} onClick={() => setSpotPage(currentPage + 1)}>{uiText('Next')}</button></nav>}
    <button type="button" className="fishing-primary" disabled={busy} onClick={done}>{uiText('Let’s go fishing')} <span aria-hidden="true">→</span></button>
  </div>;
}
export function FishingSupplies({ state }: { state: FishingState }) {
  useUiLanguage();
  const baits = BAITS.filter(bait => (bait.unlock === 'pond' || state.points.pond >= 60) && ODDS[state.location][bait.id].some(catchChance => catchChance.fishId !== null));
  const fish = FISH.filter(fish => fish.id !== 'T1' && (LOCATION_FISH[state.location] as readonly string[]).includes(fish.id));
  return <section className="fishing-supplies" aria-label={uiText('Bait and fish')}>
    <h2>{uiText('Your bait box')}</h2><ul className="fishing-bait-tally">{baits.map(bait => <li key={bait.id} title={uiText(bait.name)} aria-label={uiMessage('{name}: {count}', { name: uiText(bait.name), count: state.bait[bait.id] })}><BaitArt baitId={bait.id}/><strong>×{state.bait[bait.id]}</strong></li>)}</ul>
    <h2>{uiText('Fish bucket')}</h2><ul className="fishing-fish-tally">{fish.map(fish => <li key={fish.id}><CatchArt fishId={fish.id}/><span>{uiText(fish.name)}</span><strong>×{state.inventory[fish.id] ?? 0}</strong></li>)}</ul>
  </section>;
}
export function FishingMath({ question, busy, send, close }: { question: NonNullable<FishingState['question']>; busy: boolean; send: (command: FishingCommand) => Promise<FishingState | null>; close: () => void }) {
  const language = useUiLanguage(); const [input, setInput] = useState('');
  const panel = useRef<HTMLElement>(null), titleId = useId();
  useEffect(() => { setInput(''); panel.current?.focus({ preventScroll: true }); }, [question.id]);
  const submit = () => {
    if (busy || input === '') return;
    const questionId = question.id, previousAttempts = question.attempts;
    void send({ type: 'answer', questionId, answer: Number(input), continuePractice: true }).then(value => {
      if (value?.question?.id === questionId && value.question.attempts > previousAttempts) setInput('');
    });
  };
  function key(event: KeyboardEvent<HTMLElement>) {
      if (event.altKey || event.metaKey || event.ctrlKey || event.repeat || busy) return;
      if (/^\d$/.test(event.key)) { event.preventDefault(); panel.current?.focus({ preventScroll: true }); setInput(value => (value + event.key).slice(0, 4)); }
      if (event.key === 'Backspace') { event.preventDefault(); panel.current?.focus({ preventScroll: true }); setInput(value => value.slice(0, -1)); }
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); submit(); }
      if (event.key === 'Escape') { event.preventDefault(); close(); }
  }
  const bait = BAITS.find(b => b.id === question.baitId);
  if (!bait) return null;
  return <section ref={panel} tabIndex={-1} className="fishing-math-panel" aria-labelledby={titleId} onKeyDown={key}>
    <header><div className="fishing-math-title"><BaitArt baitId={question.baitId}/><div><h1 id={titleId}>{uiText('Earn a bait')}</h1><p>{uiText(bait.name)}</p></div></div><div className="fishing-math-tools"><button type="button" className="fishing-clear" disabled={busy} onClick={() => setInput('')}>{uiText('Clear')}</button><button className="kid-nav-action" type="button" disabled={busy} onClick={close} aria-label={uiText('Close')}>×</button></div></header>
    <div className="fishing-math-workspace"><div className="fishing-math-problem"><QuestionView question={question.publicQuestion} input={input} language={language} answerLabel={uiText('Your answer')} className="fishing-question-view"/><p className="fishing-math-feedback" role="status">{question.attempts > 0 ? uiText('Give it another try!') : uiText('Type with the keypad or your keyboard.')}</p></div>
      <div className="fishing-keypad">{[1,2,3,4,5,6,7,8,9].map(n => <button type="button" key={n} disabled={busy} onClick={() => setInput(v => (v + n).slice(0,4))}>{n}</button>)}<button type="button" disabled={busy} onClick={() => setInput(v => v.slice(0,-1))} aria-label={uiText('Delete last digit')}>⌫</button><button type="button" disabled={busy} onClick={() => setInput(v => (v + '0').slice(0,4))}>0</button><button type="button" className="fishing-submit" onClick={submit} disabled={busy || !input}>{uiText('Submit')}</button></div>
    </div>
  </section>;
}
export function FishingCollection({ state, close }: { state: FishingState; close: () => void }) {
  useUiLanguage(); const [tab, setTab] = useState<'inventory' | 'journal'>('inventory'), [page, setPage] = useState(0);
  const fish = tab === 'inventory' ? FISH.filter(f => f.id !== 'T1') : FISH.filter(f => (LOCATION_FISH[state.location] as readonly string[]).includes(f.id));
  const total = Math.ceil(fish.length / 4), current = Math.min(page, total - 1);
  return <FishingDialog title="Your fishing collection" close={close} className="fishing-collection-dialog">
    <div className="fishing-tabs"><button type="button" aria-pressed={tab === 'inventory'} onClick={() => { setTab('inventory'); setPage(0); }}>{uiText('Fish bucket')}</button><button type="button" aria-pressed={tab === 'journal'} onClick={() => { setTab('journal'); setPage(0); }}>{uiText('Discovery journal')}</button></div>
    <p>{uiText(tab === 'inventory' ? 'Keep your fish for aquariums and cooking, coming later.' : 'Discover every visitor. Turtles are recorded, then released.')}</p>
    <div className="fishing-collection-grid">{fish.slice(current * 4, current * 4 + 4).map(f => {
      const discovered = tab === 'inventory' ? state.discovered.pond.includes(f.id) || state.discovered.river.includes(f.id) : state.discovered[state.location].includes(f.id);
      return <article key={f.id} data-discovered={discovered}><CatchArt fishId={f.id}/><h3>{uiText(f.name)}</h3><strong>{tab === 'inventory' ? uiMessage('{count} kept', { count: state.inventory[f.id] ?? 0 }) : uiText(discovered ? 'Discovered' : 'Not discovered yet')}</strong><small>{uiMessage('Stamina: {stamina} · Points: {points}', { stamina: f.stamina, points: f.points })}</small></article>;
    })}</div>
    <nav className="fishing-pages" aria-label={uiText('Collection pages')}><button className="kid-nav-action" type="button" disabled={!current} onClick={() => setPage(current - 1)}>{uiText('Previous')}</button><span>{uiMessage('Page {page} of {total}', { page: current + 1, total })}</span><button className="kid-nav-action" type="button" disabled={current >= total - 1} onClick={() => setPage(current + 1)}>{uiText('Next')}</button></nav>
  </FishingDialog>;
}
