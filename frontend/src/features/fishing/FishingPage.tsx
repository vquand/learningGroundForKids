import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KidBackButton } from '../../components/KidBackButton';
import { TownRewardBar } from '../town-building/TownRewardBar';
import { MinigameBadgesButton } from '../achievements/MinigameBadgesButton';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import type { FishingCompanion } from '../../api/fishing';
import { uiMessage, uiText } from '../../i18n/uiText';
import { useFishingSession } from './useFishingSession';
import { BaitArt, BucketArt, CatchArt, FishingEmote, FishingFloat, FriendArt, SleepingFriendArt, PondFrog, PropArt, ReadyFriendArt, type FriendGreeting } from './FishingArt';
import { BAITS, FISH, FRIENDS, ODDS } from './viewCatalog';
import { FishingCollection, FishingDialog, FishingMath, FishingSetup, FishingSupplies } from './FishingPanels';
import './fishing.css';

export function FishingSession({ profileId }: { profileId: string }) {
  useUiLanguage(); const navigate = useNavigate();
  const game = useFishingSession(profileId), { state, busy, send } = game;
  const [started, setStarted] = useState(false), [panel, setPanel] = useState<'settings' | 'collection' | 'pause' | 'exit' | null>(null), [baitPage, setBaitPage] = useState(0);
  const [newDiscovery, setNewDiscovery] = useState(false);
  const [greeting, setGreeting] = useState<FriendGreeting | null>(null), greetingSequence = useRef(0);
  useEffect(() => {
    if (!greeting) return;
    const timeout = window.setTimeout(() => setGreeting(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [greeting]);
  function chooseFriend(companion: FishingCompanion) {
    if (busy) return;
    setGreeting({ companion, id: ++greetingSequence.current });
    if (state?.companion !== companion) { game.halt(); void send({ type: 'select-companion', companion }); }
  }
  const [notice, setNotice] = useState(''), [graduated, setGraduated] = useState<'pond' | 'river' | null>(null);
  const previous = useRef(state);
  const earnButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = previous.current; previous.current = state;
    if (!before || !state) return;
    if (before.question && !state.question) earnButton.current?.focus({ preventScroll: true });
    if (before.cast?.phase === 'waiting' && state.cast?.phase === 'result' && state.cast.fishId) setNewDiscovery(!before.discovered[state.cast.location].includes(state.cast.fishId));
    if (state.stats.questions > before.stats.questions) setNotice(uiText('Great math! One bait earned.'));
    if (before.points.pond < 60 && state.points.pond >= 60) { game.halt(); setGraduated('pond'); }
    if (before.points.river < 180 && state.points.river >= 180) { game.halt(); setGraduated('river'); }
  }, [state]);
  function openPanel(value: 'settings' | 'collection' | 'pause' | 'exit') { game.halt(); setPanel(value); }
  const back = () => { game.halt(); navigate('/playground'); };
  const sessionPaused = game.halted || !state?.running;
  function resumePanel() { setPanel(null); void game.resume(); }
  const header = <header className={`kid-nav fishing-nav ${started ? 'has-session' : ''}`}><KidBackButton onClick={() => started ? openPanel('exit') : back()}/>{started && state && <button type="button" className="kid-nav-action fishing-pause-button" onClick={() => sessionPaused ? void game.resume() : openPanel('pause')} disabled={busy || game.error} aria-haspopup={sessionPaused ? undefined : 'dialog'}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{sessionPaused ? <path d="M7 3 21 12 7 21Z"/> : <><rect x="5" y="3" width="5" height="18" rx="2"/><rect x="14" y="3" width="5" height="18" rx="2"/></>}</svg><span>{uiText(sessionPaused ? 'Continue fishing' : 'Pause game')}</span>
  </button>}<div className="fishing-brand">{uiText('Fishing Friends')}</div>{started && state && <button type="button" className="kid-nav-action" onClick={() => openPanel('settings')} disabled={busy}>{uiText('Fishing spot & friend')}</button>}<TownRewardBar {...game.rewardReceipt} source=".fishing-scene" onOpenStorage={game.halt}/><MinigameBadgesButton groupIds={['fishing']} onOpen={game.halt}/></header>;
  if (!state) return <div className="fishing-page">{header}<main className="fishing-load"><h1>{uiText('Fishing Friends')}</h1><p role={game.error ? 'alert' : 'status'}>{uiText(game.error ? 'Let’s reconnect your fishing trip.' : 'Getting your fishing bucket ready…')}</p>{game.error && <button className="fishing-primary" type="button" onClick={() => void game.sync()}>{uiText('Reconnect')}</button>}</main></div>;
  const waiting = state.cast?.phase === 'waiting', paused = sessionPaused, result = state.cast?.phase === 'result' ? state.cast : null;
  const bait = BAITS.find(b => b.id === state.selectedBait) ?? BAITS[0];
  if (!bait) return null;
  const available = state.points.pond >= 60 ? BAITS : BAITS.slice(0, 4);
  const selectedPage = Math.min(baitPage, Math.ceil(available.length / 4) - 1);
  const target = state.location === 'pond' ? 60 : 180, points = state.points[state.location], fish = result?.fishId ? FISH.find(f => f.id === result.fishId) : null;
  const openMath = async () => { setNotice(''); await send({ type: 'question', baitId: state.selectedBait }); };
  const outOfBait = state.running && !waiting && (result?.revealRemainingMs ?? 0) <= 0 && Object.values(state.bait).every(count => count === 0);
  const pose = outOfBait ? 3 : result ? fish ? 2 : 3 : waiting && !paused && (state.cast?.remainingMs ?? 0) > 6500 ? 1 : 0;
  const friend = FRIENDS.find(candidate => candidate.id === state.companion) ?? FRIENDS[0];
  async function startSession() { setStarted(true); await game.cast(); }
  return <div className="fishing-page" data-phase={!started ? 'setup' : game.error ? 'error' : state.question ? 'math' : paused ? 'paused' : waiting ? 'waiting' : result ? 'result' : 'ready'}>{header}
    {!started ? <main className="fishing-setup"><section className={`fishing-setup-scene is-${state.location}`} aria-label={uiText('Your friend by the water')}><button type="button" className="fishing-ready-preview" aria-label={uiMessage('Say hello to {name}', { name: uiText(friend?.name ?? state.companion) })} aria-disabled={busy} onClick={() => chooseFriend(state.companion)}><ReadyFriendArt companion={state.companion} greeting={greeting}/></button><div className="fishing-scene-sticker">{uiText('Your next little adventure')}</div></section><FishingSetup state={state} busy={busy} send={send} done={() => { void startSession(); }} greeting={greeting} chooseFriend={chooseFriend}/></main> : <main className="fishing-game">
      <section className={`fishing-scene is-${state.location} ${waiting && !paused ? 'is-active' : ''} ${paused ? 'is-paused' : ''}`} aria-label={uiText('Your friend by the water')}>
        <div className="fishing-scene-top"><span className="fishing-location-tag">{uiText(state.location === 'pond' ? 'Little Pond' : 'Village River')}</span></div>
        <div className="fishing-companion">{paused ? <SleepingFriendArt companion={state.companion}/> : <FriendArt companion={state.companion} pose={pose}/>}{!paused && (waiting || result || outOfBait) && <FishingEmote kind={outOfBait ? 'annoyed' : result ? fish ? 'heart' : 'annoyed' : 'sweat'}/>}
          {!paused && result && !fish && <FishingEmote kind="sweat"/>}{!paused && waiting && <FishingFloat companion={state.companion} pose={pose}/>}</div>
        <div className="fishing-bucket"><BucketArt/></div>
        {state.location === 'pond' && <PondFrog/>}
        {result && !paused && !outOfBait && <div className="fishing-reveal" data-cast-id={result.id} key={result.id}>{fish ? <CatchArt fishId={result.fishId}/> : <PropArt index={7 + (result.garbageIndex ?? 0) % 3}/>}</div>}
        <div className="fishing-scene-message" role="status">{result && !paused && !outOfBait && <small className="fishing-catch-reward">{uiMessage('Stamina +{stamina} · Fishing points +{points}', { stamina: result.stamina ?? 0, points: result.points ?? 0 })}</small>}{result && fish && !paused && !outOfBait && <small className="fishing-discovery-tag">{uiText(newDiscovery ? 'New discovery!' : 'In your discovery journal')}</small>}<strong>{uiText(paused ? 'A little fishing break' : outOfBait ? 'More bait, please!' : waiting ? 'Waiting for a nibble…' : fish ? fish.name : result ? 'A surprise from the water!' : 'A peaceful spot. A curious fish.')}</strong><span>{uiText(paused ? 'Your friend is waiting. Continue when you’re ready.' : outOfBait ? 'Earn a bait. Your friend will start again right away.' : waiting ? 'Keep earning bait while your friend fishes.' : fish?.id === 'T1' ? 'A turtle! Points earned, journal updated, turtle released.' : fish ? 'Safely kept in your fish bucket.' : result ? 'An old treasure? Just a little garbage. Try again!' : 'Earn bait with math. Your friend will keep fishing.')}</span></div>
        <div className="fishing-graduation"><progress aria-label={uiText(points >= target ? 'Fishing spot completed!' : 'Spot progress')} aria-valuetext={`${points}/${target}`} value={Math.min(points, target)} max={target}/><span aria-hidden="true">{points}/{target}</span></div>
      </section>
      <section className="fishing-control-panel" aria-label={uiText('Fishing controls')}>
        {state.question && !game.error ? <><FishingSupplies state={state}/><FishingMath question={state.question} busy={busy} send={send} close={() => { void send({ type: 'dismiss-question' }); }}/></> : <>
        <div className="fishing-panel-heading"><div><p className="fishing-kicker">{uiText('A math-powered fishing trip')}</p><h1>{uiText('Your bait box')}</h1></div><button type="button" className="kid-nav-action fishing-collection-button" disabled={busy} onClick={() => openPanel('collection')}>{uiText('Collection')}</button></div>
        <div className="fishing-bait-grid">{available.slice(selectedPage * 4, selectedPage * 4 + 4).map(item => <button type="button" key={item.id} disabled={busy} aria-pressed={state.selectedBait === item.id} className="fishing-bait-choice" onClick={() => { setNotice(''); void send({ type: 'select-bait', baitId: item.id }); }}><BaitArt baitId={item.id}/><span><strong>{uiText(item.name)}</strong><span className="fishing-bait-count">×{state.bait[item.id]}</span></span></button>)}</div>
        {available.length > 4 && <nav className="fishing-bait-pages" aria-label={uiText('Bait pages')}><button type="button" disabled={busy || !selectedPage} onClick={() => setBaitPage(0)}>{uiText('Pond baits')}</button><button type="button" disabled={busy || selectedPage === 1} onClick={() => setBaitPage(1)}>{uiText('River baits')}</button></nav>}
        <div className="fishing-selected-bait"><span>{uiText(bait.skill)}</span><strong>{uiText(bait.difficulty)}</strong></div>
        <section className="fishing-odds" aria-label={uiText('Catch chances')}><h2>{uiText('What might nibble?')}</h2>{ODDS[state.location][state.selectedBait].map(({ fishId }) => { const oddsFish = fishId ? FISH.find(candidate => candidate.id === fishId) : undefined; return <div key={fishId ?? 'garbage'}>{fishId ? <CatchArt fishId={fishId}/> : <PropArt index={7}/>}<span>{uiText(oddsFish?.name ?? 'No fishy')}{oddsFish && <small className="fishing-fish-points">{uiMessage('Fishing points: {points}', { points: oddsFish.points })}</small>}</span></div>; })}</section>
        <div className="fishing-action-area"><p className="fishing-notice" role="status">{notice ? uiText(notice) : result ? fish ? uiMessage('Stamina +{stamina} · Fishing points +{points}', { stamina: result.stamina ?? 0, points: result.points ?? 0 }) : uiText('No rewards this time. Another nibble awaits!') : uiText('One correct answer earns one bait.')}</p><button ref={earnButton} type="button" className="fishing-secondary" disabled={busy} onClick={() => void openMath()}>{uiText('Earn bait')}</button></div>
        </>}
      </section>
    </main>}
    {game.error && <FishingDialog title="Let’s reconnect your fishing trip." close={() => { void game.sync(); }} className="fishing-reconnect-dialog"><p>{uiText('Reconnect to check your progress and keep fishing.')}</p><button type="button" className="fishing-primary" onClick={() => void game.sync()} disabled={busy}>{uiText('Reconnect')}</button></FishingDialog>}
    {(panel === 'pause' || panel === 'exit') && !game.error && <FishingDialog title={panel === 'pause' ? 'Fishing paused' : 'Leave this fishing trip?'} close={() => setPanel(null)} className="fishing-pause-dialog">
      <p>{uiText('Your fish, bait and badges are saved. You can return later.')}</p><button type="button" className="fishing-primary" onClick={resumePanel} disabled={busy}>{uiText('Resume')}</button><button type="button" className="fishing-secondary" onClick={back} disabled={busy}>{uiText('Leave')}</button>
    </FishingDialog>}
    {panel === 'settings' && !game.error && <FishingDialog title="Your fishing trip" close={() => setPanel(null)} className="fishing-settings-dialog"><FishingSetup state={state} busy={busy} send={send} done={() => { setPanel(null); void game.resume(); }} greeting={greeting} chooseFriend={chooseFriend}/></FishingDialog>}
    {panel === 'collection' && !game.error && <FishingCollection state={state} close={() => setPanel(null)}/>}
    {graduated && !game.error && <FishingDialog title="You completed this spot!" close={() => setGraduated(null)} className="fishing-graduate-dialog"><CatchArt fishId={graduated === 'pond' ? 'P5' : 'R5'}/><p>{uiText(graduated === 'pond' ? 'Village River and three new baits are now unlocked!' : 'A wonderful river adventure! More fishing spots are coming later.')}</p><button type="button" className="fishing-primary" onClick={() => { setGraduated(null); void game.resume(); }}>{uiText('Keep fishing')}</button></FishingDialog>}
  </div>;
}
export function FishingPage() {
  useUiLanguage(); const profileId = useProfileStore(s => s.activeProfileId), familyId = useFamilyStore(s => s.familyId), generation = useFamilyStore(s => s.sessionGeneration);
  if (!profileId) return <div className="fishing-page"><header className="kid-nav fishing-nav"><KidBackButton/><MinigameBadgesButton groupIds={['fishing']}/></header><main className="fishing-load"><h1>{uiText('Choose a profile before fishing.')}</h1></main></div>;
  return <FishingSession key={`${generation}:${familyId}:${profileId}`} profileId={profileId}/>;
}
export default FishingPage;
