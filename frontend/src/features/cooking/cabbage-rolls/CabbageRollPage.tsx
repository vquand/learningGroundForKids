import { MinigameBadgesButton } from '../../achievements/MinigameBadgesButton';
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '../../../components/Layout/AppShell';
import { KidBackButton } from '../../../components/KidBackButton';
import { useUiLanguage } from '../../../hooks/useUiLanguage';
import { uiText } from '../../../i18n/uiText';
import { actCabbageRoll, fetchCabbageRoll } from '../../../api/cabbageRolls';
import { getFamilySessionSnapshot, isCurrentFamilySession } from '../../../lib/familyQueries';
import { useProfileStore } from '../../../stores/profileStore';
import { TownRewardBar } from '../../town-building/TownRewardBar';
import type { Cost } from '../../../../../server/src/town-building/game';
import type { CabbageRollSession } from '../../../../../server/src/town-building/cabbage-rolls';
import { cabbageReducer, canChop, chopRunning, chopPosition, chopTargets, createCabbageGame, INGREDIENTS, MIX_TURNS, pointerPosition, SEASONINGS, STEPS, stepIndex, steamDuration, type CabbageAction, type CabbageGame, type Heat } from './cabbageGame';
import { cabbageServerCommand, restoreCabbageGame, applyCabbageServedResult } from './cabbageSync';
import { CabbageSprite, MealArt } from './CabbageArt';
import { FoldCanvas, IngredientDrop, MixingWheel } from './CabbageInputs';
import { BowlScene, RestScene, RetrieveScene, SteamScene, SimmerScene, PlatingScene } from './CabbageScenes';
import './cabbage.css';

const TITLES = { setup: 'Little parcels, made with love', chop: 'Chop the filling', add: 'Into the mixing bowl', season: 'A little seasoning', mix: 'Round and round', rest: 'Let the filling rest', steam: 'Soften the cabbage', retrieve: 'Bring back the rested filling', fold: 'Fold a little parcel', simmer: 'A gentle tomato simmer', plating: 'From pot to plate', result: 'Your cabbage rolls', served: 'Three rolls, made by you!' };
const HINTS = {
  setup: 'Beef, carrot, mushroom, onion. Six little steps to a cozy meal.',
  chop: 'Tap the knife handle once in each green stripe. Three chops in a row!',
  add: 'Tap or drag each ingredient into the bowl, then choose your seasonings.',
  season: 'Choose salt, pepper, and soy sauce for the filling.',
  mix: 'Follow the oval inside the bowl to stir. Keyboard: use the arrow keys.',
  rest: 'Stretch plastic wrap over the bowl, then pop it in the fridge. It rests while we steam the cabbage.',
  steam: 'Put the whole cabbage in the big pot, cover, and steam until soft.',
  retrieve: 'The filling rested in the fridge while the cabbage steamed. Take it out before you start rolling.',
  fold: 'Drag the leaf itself: bottom up, both sides inward, then roll upward from the bottom.',
  simmer: 'Arrange three rolls, add tomato sauce, cover, and choose the heat.',
  plating: 'Lift the lid, move the rolls with tongs, then ladle sauce over the plate.',
  result: 'Serve this meal, or keep your rolls and try the simmer again.',
  served: 'Lovely cooking! Make another batch whenever you like.',
};
const OUTCOMES = { undercooked: 'Undercooked', okay: 'Okay-ish', perfect: 'Perfect', burnt: 'Burnt' };
function Action({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="cooking-primary-button" disabled={disabled} onClick={onClick}>{children}</button>;
}
function HeatChoices({ value, dispatch }: { value: Heat | null; dispatch: (a: CabbageAction) => void }) {
  return <div className="cr-choices">{(['low', 'medium', 'high'] as const).map(heat => <button key={heat} className="kid-nav-action" aria-pressed={value === heat} onClick={() => dispatch({ type: 'heat', value: heat })}>{uiText({ low: 'Low heat', medium: 'Medium heat', high: 'High heat' }[heat])}</button>)}</div>;
}
function TimingBar({ game }: { game: CabbageGame }) {
  const position = pointerPosition(game.cookMs);
  return <div className="cr-timing" aria-label={uiText('Cooking timing bar')}>
    <div className="cr-timing-track" role="meter" aria-label={uiText('Cooking pointer')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)}>
      <span className="cr-zone cr-zone--raw" /><span className="cr-zone cr-zone--okay" /><span className="cr-zone cr-zone--perfect" /><span className="cr-zone cr-zone--okay" /><span className="cr-zone cr-zone--burnt" />
      <span className="cr-pointer" style={{ left: `${position}%` }} />
    </div>
  </div>;
}
function Scene({ game, dispatch }: { game: CabbageGame; dispatch: (a: CabbageAction) => void }) {
  switch (game.phase) {
    case 'setup': case 'result': case 'served': return <MealArt outcome={game.outcome ?? 'perfect'} />;
    case 'chop': return <div className="cr-chopping">
      <CabbageSprite sheet="board" index={0} className="cr-board" />
      <CabbageSprite sheet={game.ingredient === 3 && !game.onionPeeled ? 'onion' : 'chopping'} index={game.ingredient === 3 && !game.onionPeeled ? 0 : game.ingredient * 4 + game.cuts} className="cr-chop-food" />
      {game.peelMs > 0 && <CabbageSprite sheet="onion" index={2} className="cr-onion-peel" />}
      <div className="cr-knife-tool">
        <CabbageSprite sheet="preparation" index={9} className={`cr-knife${game.chopMs > 0 ? ' cr-knife--chop' : ''}`} />
        <button type="button" className="cr-knife-handle" aria-label={uiText('Chop now')} aria-describedby="cr-chop-guide" disabled={!canChop(game)} onClick={() => dispatch({ type: 'chop' })}><span aria-hidden="true">👆</span></button>
      </div>
    </div>;
    case 'add': case 'season': return <BowlScene game={game} />;
    case 'mix': return <MixingWheel game={game} dispatch={dispatch} />;
    case 'rest': return <RestScene game={game} />;
    case 'steam': return <SteamScene game={game} />;
    case 'retrieve': return <RetrieveScene game={game} />;
    case 'fold': return <FoldCanvas game={game} dispatch={dispatch} />;
    case 'simmer': return <SimmerScene game={game} />;
    case 'plating': return <PlatingScene game={game} />;
  }
}
type PageAction = CabbageAction | { type: 'served-result'; session: CabbageRollSession } | { type: 'restore'; session: CabbageRollSession; now: number };
function pageReducer(game: CabbageGame, action: PageAction): CabbageGame {
  if (action.type === 'served-result') return applyCabbageServedResult(game, action.session);
  return action.type === 'restore' ? restoreCabbageGame(action.session, action.now) : cabbageReducer(game, action);
}
export function CabbageRollPage() {
  useUiLanguage();
  const [game, dispatch] = useReducer(pageReducer, undefined, createCabbageGame);
  const [muted, setMuted] = useState(true);
  const sound = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (game.paused) document.querySelector<HTMLButtonElement>('.cr-pause button')?.focus();
    else heading.current?.focus({ preventScroll: true });
  }, [game.paused]);
  const heading = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const practice = location.pathname.startsWith('/uat/');
  const profileId = useProfileStore(state => state.activeProfileId);
  const kitchen = location.pathname.startsWith('/uat/') ? '/uat/cooking' : '/cooking';
  const remote = useRef<CabbageRollSession | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const syncGeneration = useRef(0);
  const [syncReady, setSyncReady] = useState(practice);
  const [syncError, setSyncError] = useState('');
  const [syncRetry, setSyncRetry] = useState(0);
  const [syncLoading, setSyncLoading] = useState(false);
  const [townReward, setTownReward] = useState<Cost>({});
  const [rewardEvent, setRewardEvent] = useState(0);
  useEffect(() => {
    const generation = ++syncGeneration.current;
    if (practice) {
      remote.current = null;
      setSyncReady(true);
      setSyncError('');
      return;
    }
    if (!profileId) {
      setSyncReady(false);
      return;
    }
    let active = true;
    const snapshot = getFamilySessionSnapshot();
    const current = () => active && generation === syncGeneration.current && isCurrentFamilySession(snapshot) && useProfileStore.getState().activeProfileId === profileId;
    remote.current = null;
    queue.current = Promise.resolve();
    setSyncReady(false);
    setSyncLoading(true);
    setTownReward({});
    void fetchCabbageRoll(profileId).then(session => {
      if (!current()) return;
      remote.current = session;
      dispatch({ type: 'restore', session, now: Date.now() });
      setSyncError('');
      setSyncReady(true);
    }).catch(error => {
      if (current()) setSyncError(error instanceof Error ? error.message : 'Recipe unavailable.');
    }).finally(() => { if (current()) setSyncLoading(false); });
    return () => { active = false; ++syncGeneration.current; };
  }, [practice, profileId, syncRetry]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [game.phase]);
  const ticking = syncReady && !game.paused && (!!game.motion || chopRunning(game) || game.chopMs > 0 || game.peelMs > 0 || game.sauceMs > 0 || game.resting && game.restMs < 8000 || game.steaming && game.steamMs < steamDuration(game.steamHeat) || game.cooking);
  useEffect(() => {
    if (!ticking) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => { const ms = now - last; last = now; dispatch({ type: 'tick', ms }); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ticking]);
  useEffect(() => {
    const pause = () => dispatch({ type: 'pause', value: true });
    const hidden = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hidden); void sound.current?.close(); };
  }, []);
  function sync(command: NonNullable<ReturnType<typeof cabbageServerCommand>>) {
    if (practice || !profileId) return;
    const snapshot = getFamilySessionSnapshot();
    const requestedProfile = profileId;
    const generation = syncGeneration.current;
    const current = () => generation === syncGeneration.current && isCurrentFamilySession(snapshot) && useProfileStore.getState().activeProfileId === requestedProfile;
    queue.current = queue.current.then(async () => {
      const saved = remote.current;
      if (!saved || !current()) return;
      const next = await actCabbageRoll(requestedProfile, saved.revision, command);
      if (!current()) return;
      remote.current = next;
      if (command.type === 'serve') dispatch({ type: 'served-result', session: next });
      setTownReward(next.townReward);
      setRewardEvent(next.revision);
    }).catch(error => {
      if (current()) {
        remote.current = null;
        setSyncReady(false);
        setSyncError(error instanceof Error ? error.message : 'Unable to save recipe.');
      }
    });
  }
  function act(a: CabbageAction) {
    if (!practice && (!syncReady || !remote.current)) return;
    const next = cabbageReducer(game, a);
    const command = cabbageServerCommand(game, a, next);
    dispatch(a);
    if (command) sync(command);
    if (!muted && !game.paused && a.type !== 'turn') {
      try {
        const ctx = sound.current ??= new AudioContext(); void ctx.resume();
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = a.type === 'chop' ? 180 : 420;
        gain.gain.setValueAtTime(.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .08);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .08);
      } catch { /* Sound is optional; gameplay stays available. */ }
    }
  }
  let controls: ReactNode;
  switch (game.phase) {
    case 'setup': controls = <><div className="cr-recipe-list">{INGREDIENTS.map((name, i) => <div key={name}><CabbageSprite sheet="preparation" index={i} /><span>{uiText(name)}</span></div>)}</div><p>{uiText('Salt · Pepper · Soy sauce')}</p><Action disabled={!syncReady} onClick={() => act({ type: 'start' })}>{uiText('Start cooking')}</Action></>; break;
    case 'chop': controls = <><h3>{uiText(INGREDIENTS[game.ingredient]!)} · {game.ingredient + 1}/4</h3>
      {game.ingredient === 3 && !game.onionPeeled ? <><p>{uiText('Remove the onion skin before chopping.')}</p><Action onClick={() => act({ type: 'peel' })}>{uiText('Peel the onion')}</Action></> : <>
        <p className="cr-cut-count">{game.cuts}/3 {uiText('chops in a row')}</p>
        {game.chopMissed && <Action onClick={() => act({ type: 'retry-chop' })}>{uiText('Try three chops again')}</Action>}
        <Action disabled={game.cuts !== 3 || game.chopMs > 0} onClick={() => act({ type: 'next' })}>{uiText(game.ingredient < 3 ? 'Next ingredient' : 'Bring the bowl')}</Action>
      </>}</>; break;
    case 'add': controls = <><div className="cr-ingredients">{INGREDIENTS.map((name, index) => game.added.includes(index) ? <span className="cr-ingredient-added" key={name}>✓ {uiText(name)}</span> : <IngredientDrop key={name} index={index} onAdd={i => act({ type: 'add', index: i })}><CabbageSprite sheet="preparation" index={index + 4} /><span>{uiText(name)}</span></IngredientDrop>)}</div><Action disabled={game.added.length !== 4} onClick={() => act({ type: 'next' })}>{uiText('Choose seasonings')}</Action></>; break;
    case 'season': controls = <><div className="cr-seasonings">{[...SEASONINGS, 'Sugar', 'Cinnamon'].map(value => <button className="kid-nav-action" key={value} aria-pressed={game.seasoning.includes(value)} onClick={() => act({ type: 'season', value })}>{uiText(value)}{game.seasoning.includes(value) && ' ✓'}</button>)}</div><Action disabled={game.seasoning.length !== 3} onClick={() => act({ type: 'next' })}>{uiText('Mix the filling')}</Action></>; break;
    case 'mix': controls = <><progress aria-label={uiText('Mixing progress')} max={MIX_TURNS} value={game.turns} /><p>{uiText(game.turns >= MIX_TURNS ? 'Evenly mixed!' : 'Keep circling. Either direction is fine.')}</p><Action disabled={game.turns < MIX_TURNS} onClick={() => act({ type: 'next' })}>{uiText('Let it rest')}</Action></>; break;
    case 'rest': controls = <Action onClick={() => act({ type: game.covered ? 'refrigerate' : 'cover-bowl' })}>{uiText(game.covered ? 'Put in the fridge' : 'Cover with plastic wrap')}</Action>; break;
    case 'steam': controls = <><p className="cr-rest-note">{uiText(game.restMs >= 8000 ? 'Filling rested ✓' : 'Filling is resting in the fridge')}</p>
      {game.leaves === 0 ? <Action onClick={() => act({ type: 'leaf' })}>{uiText('Put the cabbage in the pot')}</Action> : !game.steamCovered ? <Action onClick={() => act({ type: 'cover-steamer' })}>{uiText('Cover the pot')}</Action> : !game.steaming ? <><HeatChoices value={game.steamHeat} dispatch={act} /><Action disabled={!game.steamHeat} onClick={() => act({ type: 'steam-start' })}>{uiText('Start steaming')}</Action></> : <><progress aria-label={uiText('Cabbage tenderness')} max={steamDuration(game.steamHeat)} value={game.steamMs} /><p>{uiText(game.steamMs >= steamDuration(game.steamHeat) ? 'Soft cabbage, ready to lift!' : 'Watch the cabbage soften.')}</p><Action disabled={game.steamMs < steamDuration(game.steamHeat) || game.restMs < 8000} onClick={() => act({ type: 'lift' })}>{uiText('Lift the cabbage')}</Action></>}
    </>; break;
    case 'retrieve': controls = <><p className="cr-rest-note">{uiText('The filling is rested and ready for the cabbage leaves.')}</p><Action onClick={() => act({ type: 'retrieve-filling' })}>{uiText('Take out the rested filling')}</Action></>; break;
    case 'fold': controls = <><div className="cr-tray" aria-label={uiText('Finished rolls')}>{Array.from({ length: 3 }, (_, i) => <div key={i}>{i < game.rolls ? <CabbageSprite sheet="folding" index={6} /> : <span>{i + 1}</span>}</div>)}</div>
      {game.rolls === 3 ? <Action onClick={() => act({ type: 'next' })}>{uiText('Bring the pot')}</Action> : game.torn ? <Action onClick={() => act({ type: 'fresh-leaf' })}>{uiText('Try a fresh leaf')}</Action> : !game.portion ? <><div className="cr-portion-target"><span className="cr-portion-spoon"><CabbageSprite sheet="preparation" index={11} /><CabbageSprite sheet="preparation" index={4} className="cr-spoon-filling" /></span><span>{uiText('Target: medium spoonful')}</span></div><div className="cr-choices">{(['small', 'medium', 'large'] as const).map(value => <button key={value} className="kid-nav-action" onClick={() => act({ type: 'portion', value })}>{uiText({ small: 'Small', medium: 'Medium', large: 'Large' }[value])}</button>)}</div></> : <><p>{uiText(game.rolls === 0 ? 'Drag the leaf edges inward. Start the final roll from the bottom.' : 'Bottom, both sides, then roll.')}</p><p className="cr-keyboard-note">{uiText('Keyboard: focus the leaf. Use arrow keys or Enter to fold.')}</p><p>{game.folds.length}/3 {uiText('folds tucked')}</p></>}
    </>; break;
    case 'simmer': controls = <>
      {game.arranged < 3 ? <Action onClick={() => act({ type: 'arrange' })}>{uiText('Place a roll in the pot')} · {game.arranged}/3</Action> : !game.sauce ? <Action onClick={() => act({ type: 'sauce' })}>{uiText('Ladle tomato sauce')}</Action> : !game.potCovered ? <Action disabled={game.sauceMs > 0} onClick={() => act({ type: 'cover-pot' })}>{uiText('Cover the pot')}</Action> : !game.cooking ? <><HeatChoices value={game.heat} dispatch={act} /><p>{uiText('Aim for green. Stop while the pointer is there!')}</p><Action disabled={!game.heat} onClick={() => act({ type: 'cook' })}>{uiText('Start simmering')}</Action></> : <><p>{uiText('Aim for green. Stop while the pointer is there!')}</p><Action onClick={() => act({ type: 'stop' })}>{uiText('Stop cooking')}</Action></>}
    </>; break;
    case 'plating': controls = <p>{uiText(game.motion && game.motion.elapsed < 1000 ? 'Opening the lid…' : game.motion && game.motion.elapsed < 4900 ? 'Moving the rolls to the plate…' : 'Pouring sauce over the rolls…')}</p>; break;
    case 'result': controls = <><h3 className={`cr-outcome cr-outcome--${game.outcome}`}>{uiText(OUTCOMES[game.outcome!])}</h3><Action onClick={() => act({ type: 'serve' })}>{uiText('Serve my rolls')}</Action><button className="kid-nav-action" onClick={() => act({ type: 'retry' })}>{uiText('Try simmering again')}</button></>; break;
    case 'served': controls = <><h3>{uiText(OUTCOMES[game.outcome!])}</h3><p>{uiText('Your meal is served!')}</p><Action onClick={() => act({ type: 'replay' })}>{uiText('Make another batch')}</Action><KidBackButton to={kitchen} label="Back to kitchen" /></>; break;
  }
  return <AppShell><main className="cr-page" data-phase={game.phase} data-paused={game.paused}>
    <header className="cr-header kid-nav" inert={game.paused}><KidBackButton to={kitchen} label="Back to kitchen" /><h1>{uiText('Cabbage rolls with meat')}</h1><MinigameBadgesButton groupIds={['cabbage-rolls']} onOpen={() => dispatch({ type: 'pause', value: true })} />{!practice && <TownRewardBar reward={townReward} event={rewardEvent} />}<button className="kid-nav-action" onClick={() => setMuted(!muted)} aria-pressed={!muted}>{uiText(muted ? 'Sound off' : 'Sound on')}</button><button className="kid-nav-action" onClick={() => dispatch({ type: 'pause', value: true })}>{uiText('Pause')}</button></header>
    {syncError && <div className="cr-sync-error" role="alert">{syncError} <button type="button" disabled={syncLoading} onClick={() => setSyncRetry(value => value + 1)}>{uiText('Sync recipe')}</button></div>}
    <nav inert={game.paused} className="cr-progress" aria-label={uiText('Recipe steps')}><ol>{STEPS.map((step, i) => <li key={step} aria-current={i === stepIndex(game.phase) ? 'step' : undefined}><b>{i < stepIndex(game.phase) ? '✓' : i + 1}</b><span>{uiText(step)}</span></li>)}</ol></nav>
    <div className="cr-workspace" inert={game.paused || !syncReady}>
      <section className="cr-scene" aria-label={uiText('Kitchen preview')}><span className="cr-scene-note">{uiText('Little kitchen · Chef Capy')}</span>{game.phase === 'chop' && <p className="cr-knife-safety" role="note">{uiText('Knives are dangerous. Only use one while an adult is watching.')}</p>}<div className="cr-scene-art"><Scene game={game} dispatch={act} /></div>{game.phase === 'chop' && <div className="cr-chop-timing" aria-label={uiText('Chopping timing bar')}>
        <div className="cr-chop-row"><div className="cr-chop-track" role="meter" aria-label={uiText('Chopping pointer')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(chopPosition(game.chopClockMs))}>
          {chopTargets(game.chopPattern).map(([from, to], index) => <span key={`${from}-${to}`} className={`cr-chop-band cr-chop-band--target${game.cuts > index ? ' cr-chop-band--hit' : ''}`} style={{ left: `${from}%`, width: `${to - from}%` }} data-hit={game.cuts > index}><b>{game.cuts > index ? '✓' : index + 1}</b></span>)}
          <span className="cr-pointer" style={{ left: `${chopPosition(game.chopClockMs)}%` }} />
        </div></div><p id="cr-chop-guide">{uiText(game.ingredient === 3 && !game.onionPeeled ? 'Peel first, then chop.' : 'Tap the knife handle when the pointer reaches each green stripe.')}</p>
      </div>}{game.phase === 'simmer' ? <TimingBar game={game} /> : <p className="cr-scene-caption">{uiText(game.phase === 'fold' ? 'A leaf becomes a little parcel' : 'Made with care, one step at a time')}</p>}</section>
      <section className="cr-controls"><h2 ref={heading} tabIndex={-1}>{uiText(TITLES[game.phase])}</h2><p className="cr-hint">{uiText(game.phase === 'simmer' && game.cooking ? 'Stop the pointer in the green area for perfectly simmered rolls.' : HINTS[game.phase])}</p><fieldset className="cr-actions" disabled={!!game.motion}>{controls}</fieldset><p className="cr-feedback" role="status">{uiText(game.feedback)}</p></section>
    </div>
    {game.paused && <div className="cr-pause-scrim"><section onKeyDown={e => { if (e.key === "Tab") { e.preventDefault(); e.currentTarget.querySelector("button")?.focus(); } }} role="dialog" aria-modal="true" aria-labelledby="cr-pause-title" className="cr-pause"><h2 id="cr-pause-title">{uiText('Kitchen paused')}</h2><p>{uiText('Your food and timers are waiting for you.')}</p><Action onClick={() => dispatch({ type: 'pause', value: false })}>{uiText('Resume cooking')}</Action></section></div>}
  </main></AppShell>;
}
