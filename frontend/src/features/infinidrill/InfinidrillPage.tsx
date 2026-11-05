import { BadgesIconButton } from '../achievements/BadgesIconButton';
import { KidBackButton } from "../../components/KidBackButton";
import { uiText } from '../../i18n/uiText';
import { DrillAtlasPart, DrillMachine, SLOT_LABELS } from './InfinidrillArt';
import { NumberPad, Workshop, CoreCelebration } from './InfinidrillPanels';
import { RewardFlightIcon } from './InfinidrillRewardFlights';
import { useInfinidrillAnimations } from './useInfinidrillAnimations';
import { useInfinidrillServerSession } from './useInfinidrillServerSession';
import type { InfinidrillProfile, Overlay, Slot } from './viewTypes';
export type { InfinidrillProfile } from './viewTypes';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { TownRewardBar } from '../town-building/TownRewardBar';
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfiles } from "../../api/profiles";
import { AchievementBadgeArt } from '../achievements/AchievementBadgeArt';
import { familyScopedQuery, profileQueryKey } from "../../lib/familyQueries";
import { useFamilyStore } from "../../stores/familyStore";
import { useProfileStore } from "../../stores/profileStore";
import { InfinidrillWorldScene, type DrillMovement } from "./InfinidrillWorldScene";
import { laserHorizontalReach } from '../../../../server/src/infinidrill/mining.ts';
import { INFINIDRILL_STARTER_EQUIPMENT } from "./game";
import { getUpgrade, isUpgradeUsable } from "./upgrades";
import { QuestionView } from '../../components/questions/QuestionView';
import { QUESTION_LEVEL_DESCRIPTIONS } from './questions';
import type { UpgradePart } from "./types";
import "./infinidrill.css";
import "./infinidrillNavigation.css";

export function InfinidrillSession({ profile, onExit }: { profile: InfinidrillProfile; onExit?: () => void }) {
  const contentLanguage = useUiLanguage();
  const navigate = useNavigate();
  const leave = onExit ?? (() => navigate("/playground"));
  const { state, loading, busy, error, remote, requests, sync, dispatch } = useInfinidrillServerSession(profile.id, {
    sync: result => {
      setOverlay(result.game?.mode === 'paused' ? 'pause' : null);
      animations.sync(result.game);
    },
    action: (before, result, action) => {
      if (action.type === 'replay') {
        animations.resetForReplay();
        if (overlay === 'pause') { setOverlay(null); setSelectedUpgrade(null); }
        return;
      }
      animations.confirmAction(before, result, action);
    },
  });
  const [started, setStarted] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedUpgrade, setSelectedUpgrade] = useState<UpgradePart | null>(null);
  const [help, setHelp] = useState(false);
  const animations = useInfinidrillAnimations(state, profile, started, overlay, dispatch);
  const { quote, setQuote, firstInput, glowing, visualEquipment, transitionFrom, visualDepth,
    rewardFlights, drillMachineRef, inventoryButtonRef, transitioning, transitionLock,
    revealLock, renderState, modalActive, caveFall, reducedMotion } = animations;

  useEffect(() => {
    if (!modalActive) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = controls(); const first = items[0]; const last = items.at(-1);
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [modalActive, overlay, state.mode, busy]);

  function enterDigit(digit: number) {
    if (requests.busy || transitionLock.current || modalActive) return;
    firstInput.current = true;
    setQuote(null);
    dispatch({ type: "input-digit", digit });
  }
  function submit() {
    if (requests.busy || transitionLock.current || modalActive || !state.currentQuestion || !state.input) return;
    dispatch({ type: "submit-answer", questionId: state.currentQuestion.id });
  }
  function pauseGame() {
    if (requests.busy || transitionLock.current || modalActive || !started || (state.mode !== "playing" && state.mode !== "bonus-question")) return;
    dispatch({ type: "pause" }); setOverlay("pause");
  }
  function resumeGame() { if (requests.busy) return; dispatch({ type: "resume" }); setOverlay(null); }
  function startNewSession() {
    if (requests.busy || overlay !== 'pause') return;
    dispatch({ type: 'replay' });
  }
  function showAchievements() {
    if (requests.busy || transitionLock.current || modalActive) return;
    dispatch({ type: 'pause' });
    setOverlay('achievements');
  }
  useEffect(() => {
    if (!started || transitioning || modalActive || (state.mode !== "playing" && state.mode !== "bonus-question")) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (/^[0-9]$/.test(event.key)) { event.preventDefault(); enterDigit(Number(event.key)); }
      else if (event.key === "Backspace") { event.preventDefault(); dispatch({ type: "backspace" }); }
      else if (event.key === "Enter") { event.preventDefault(); submit(); }
      else if (event.key === "Escape") { event.preventDefault(); pauseGame(); }
    };
    const visibility = () => { if (document.hidden) pauseGame(); };
    window.addEventListener("keydown", keyboard);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => { window.removeEventListener("keydown", keyboard); document.removeEventListener("visibilitychange", visibility); };
  }, [started, transitioning, modalActive, state.mode, state.currentQuestion?.id, state.input]);

  function glow(slot: Slot, upgradeId?: string) {
    if (!upgradeId || state.equippedUpgradeIds[slot] === upgradeId || revealLock.current || (upgradeId !== INFINIDRILL_STARTER_EQUIPMENT[slot] && !isUpgradeUsable(state.ownedUpgradeIds, upgradeId))) return;
    dispatch({ type: "equip-upgrade", upgradeId });
  }
  function replay() {
    dispatch({ type: 'replay' }); setStarted(false); setOverlay(null);
    setSelectedUpgrade(null); animations.resetForReplay();
  }
  const movement: DrillMovement | null = useMemo(() => transitionFrom ? {
    id: transitionFrom.currentQuestion?.id ?? String(transitionFrom.mainQuestionsCompleted),
    from: transitionFrom.depthBlocks, to: state.depthBlocks,
    mined: state.destroyedBlocks - transitionFrom.destroyedBlocks,
    cave: caveFall ? { start: state.depthBlocks - (state.lastEvent.depth?.blocks ?? 0), end: state.depthBlocks } : undefined,
    laser: state.lastEvent.laser,
  } : null, [transitionFrom, state.depthBlocks, state.destroyedBlocks, state.lastEvent.depth?.blocks, state.lastEvent.laser, caveFall]);
  const machine = useMemo(() => <DrillMachine profile={profile} equipped={visualEquipment} glowing={glowing} anchorRef={drillMachineRef} spinning={transitioning && !reducedMotion} />, [profile, visualEquipment, glowing, transitioning, reducedMotion]);
  const thought = useMemo(() => quote ? <div className="infinidrill-thought" role="status"><span className="infinidrill-thought-avatar">{profile.emoji}</span><span>{quote}</span></div> : null, [quote, profile.emoji]);
  const isBonus = renderState.mode === "bonus-question"; const question = renderState.currentQuestion; const progress = renderState.mainQuestionsCompleted % 7;
  if (loading || error) return <div className="infinidrill-loading"><div className="infinidrill-loading-card">{loading ? <p role="status">{uiText("Loading your expedition…")}</p> : <><h1>{uiText("Expedition connection paused")}</h1><p role="alert">{error}</p><button type="button" className="infinidrill-primary-button" onClick={() => { void sync(); }}>{uiText("Sync game")}</button><KidBackButton className="kid-back--floating" onClick={leave}/></>}</div></div>;
  if (!started) return <div className="infinidrill-root infinidrill-setup" data-phase="setup" aria-busy={busy}><header className="kid-nav"><KidBackButton onClick={leave}/></header><div className="infinidrill-setup-art"><div className="infinidrill-planet-badge">🌎 <span>{uiText("Earth · Expedition 1")}</span></div><DrillMachine profile={profile} equipped={renderState.equippedUpgradeIds} glowing={null} /><div className="infinidrill-setup-ground" /></div><main className="infinidrill-setup-card"><p className="infinidrill-eyebrow">{uiText("A math-powered adventure")}</p><h1>{uiText("Infinidrill")}</h1><p>{uiText("Answer number puzzles to send your chubby drill deeper into Earth. Find minerals, discover caves, and build your dream machine.")}</p><div className="infinidrill-setup-actions"><button type="button" className="infinidrill-primary-button infinidrill-start-button" disabled={busy} onClick={() => { if (!remote.current?.game) dispatch({ type: "replay" }); setStarted(true); }}>{state.mainQuestionsCompleted > 0 ? uiText("Resume drilling") : uiText("Start drilling")} <span aria-hidden="true">→</span></button></div><button type="button" className="infinidrill-help-link" onClick={() => setHelp((visible) => !visible)} aria-expanded={help}>{uiText("How does it work?")}</button>{help && <p className="infinidrill-help-copy">{uiText("Get a question right to drill 2–3 blocks. Every 7 questions has a choice: keep drilling or try a bonus puzzle for a free part.")} {uiText("Every 10 rocks you earn also gives 1 bonus sand for your town.")}</p>}</main></div>;
  if (renderState.mode === "core") return <CoreCelebration profile={profile} state={state} equipped={visualEquipment} onReplay={replay} onExit={leave} />;
  if (renderState.mode === 'question-exhausted') return <div className="infinidrill-loading" data-phase="question-exhausted"><section className="infinidrill-loading-card"><h1>{uiText("You tried every puzzle in this layer!")}</h1><p>{uiText("Your rewards are saved. Start a new expedition for fresh puzzles.")}</p><button type="button" className="infinidrill-primary-button" onClick={replay} disabled={busy}>{uiText("Play again")}</button><KidBackButton onClick={leave} disabled={busy}/></section></div>;
  const challengeChoice = renderState.mode === "challenge-choice"; const rewardChoice = renderState.mode === "upgrade-reward";
  return <div className="infinidrill-root infinidrill-game" aria-busy={busy} data-phase={transitioning ? "drill-transition" : overlay ?? renderState.mode} data-depth-blocks={transitioning ? Math.floor(visualDepth / 6) : renderState.depthBlocks}>
    <div inert={modalActive}>
    <header className="infinidrill-topbar kid-nav">
      <KidBackButton disabled={busy || transitioning} onClick={() => { pauseGame(); setOverlay("exit"); }}/>
      <button type="button" className="kid-nav-action infinidrill-pause-button" onClick={pauseGame} disabled={busy || transitioning}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="5" height="18" rx="2"/><rect x="14" y="3" width="5" height="18" rx="2"/></svg>
        <span>{uiText("Pause game")}</span>
      </button>
      <BadgesIconButton onClick={showAchievements} disabled={busy || transitioning || modalActive} aria-haspopup="dialog" aria-expanded={overlay === 'achievements'} />
    </header>
    <div className="infinidrill-materialbar" aria-label={uiText("Drill materials")}>
      <div className="infinidrill-resource" data-resource="diamonds"><span role="img" aria-label={uiText("Diamonds")}>💎</span><strong>{state.resources.crystals}</strong><small>{uiText("diamonds")}</small></div>
      <div className="infinidrill-resource infinidrill-nugget" data-resource="materials"><span role="img" aria-label={uiText("Nuggets")}>🪙</span><strong>{state.resources.nuggets}</strong><small>{uiText("nuggets")}</small></div>
      <button ref={inventoryButtonRef} type="button" className="kid-nav-action infinidrill-inventory-button" onClick={() => { if (busy || transitioning) return; setSelectedUpgrade(null); dispatch({ type: "open-workshop" }); }} disabled={busy || renderState.mode === "workshop" || transitioning} aria-label={uiText("Open inventory")}><span aria-hidden="true">🧰</span><span>{uiText("Inventory")}</span></button>
    </div>
    <main className="infinidrill-main">
      <div className="infinidrill-world-panel">
      <InfinidrillWorldScene depth={transitioning ? visualDepth / 6 : renderState.depthBlocks} level={renderState.level}
        laserReach={laserHorizontalReach(getUpgrade(state.equippedUpgradeIds.head ?? '')?.tier ?? 0, getUpgrade(state.equippedUpgradeIds.accessory ?? '')?.tier ?? 0)}
        engineRunning={!modalActive} canPet={!modalActive && !transitioning && !busy && (state.mode === 'playing' || state.mode === 'bonus-question')}
        worldSeed={state.worldSeed} excavations={state.excavations} laserCuts={state.laserCuts} movement={movement} reducedMotion={reducedMotion}
        thought={thought}>
        {machine}
      </InfinidrillWorldScene>
      <div className="infinidrill-world-hud">
        <span className="infinidrill-brand-icon" aria-hidden="true"><DrillAtlasPart slot="head" tier={0} className="infinidrill-brand-head" /></span>
        <div className="infinidrill-depth"><span className="infinidrill-depth-label">{uiText("Depth")}</span><strong>{transitioning ? Math.floor(visualDepth) : renderState.depthMetres} m</strong><small>{transitioning ? Math.floor(visualDepth / 3) : renderState.depthBlocks * 2} {uiText(" tiles · 1 tile = 3 m")}</small></div>
        <TownRewardBar reward={remote.current?.townReward} event={remote.current?.revision} animate={false}/>
      </div>
      </div>
      <section className="infinidrill-question-card" aria-label={uiText("Math question")}><div className="infinidrill-question-heading"><div><p className="infinidrill-eyebrow">{uiText("Question ")}{renderState.mainQuestionsCompleted + 1}{isBonus ? uiText(" · bonus") : ""}</p><h1>{isBonus ? uiText("Bonus challenge") : QUESTION_LEVEL_DESCRIPTIONS[renderState.level]}</h1></div><span className="infinidrill-progress">{progress}/7</span></div>{isBonus && <p className="infinidrill-challenge-label">{uiText("One right answer earns a free drill part.")}</p>}<div className={`infinidrill-equation is-visual ${question?.card.kind === 'equation' && question.card.values.length > 2 ? "is-chain" : ""}`} aria-live="polite">{question ? <QuestionView question={question} input={renderState.input} language={contentLanguage}/> : uiText("Choose A or B")}</div>{transitioning ? <p className="infinidrill-feedback" role="status">{caveFall ? uiText("Cave shortcut! Down we go!") : state.lastEvent.depth?.kind === "practice" ? uiText("Practice to reach the next layer.") : state.lastEvent.deposits?.length ? `Found ${state.lastEvent.deposits.length} item${state.lastEvent.deposits.length === 1 ? '' : 's'}!` : uiText("Keep digging! No minerals this time.")}</p> : renderState.feedback && <p className="infinidrill-feedback is-wrong" role="status">{renderState.feedback === "wrong" ? uiText("Almost! Try the same question again.") : uiText("The free part opportunity is gone. Keep drilling!")}</p>}<NumberPad value={renderState.input} onDigit={enterDigit} onBackspace={() => dispatch({ type: "backspace" })} onSubmit={submit} disabled={transitioning || busy} /><p className="infinidrill-key-hint">{uiText("Type with the keypad or your keyboard · Enter to check")}</p></section>
    </main>
    </div>
    {overlay === 'achievements' && <div className="infinidrill-overlay" role="dialog" aria-modal="true" aria-labelledby="expedition-achievements-title"><section className="infinidrill-panel infinidrill-achievements-panel">
      <div className="infinidrill-panel-heading"><div><p className="infinidrill-eyebrow">{uiText("Your expedition collection")}</p><h2 id="expedition-achievements-title">{uiText("Infinidrill achievements")}</h2></div><button type="button" className="infinidrill-close" onClick={resumeGame} disabled={busy} aria-label={uiText("Close achievements")}>×</button></div>
      <p className="infinidrill-panel-copy">{remote.current?.achievements.filter(badge => badge.earnedAt).length ?? 0} {uiText(" of ")}{remote.current?.achievements.length ?? 0} {uiText(" earned · The drill is paused while you look.")}</p>
      <div className="infinidrill-achievements-grid">{remote.current?.achievements.map((badge, index) => <article key={badge.id} className={`infinidrill-achievement ${badge.earnedAt ? 'is-earned' : 'is-locked'}`} data-earned={!!badge.earnedAt}>
        <AchievementBadgeArt source={badge.badge} index={index} columns={5} rows={2} size={56} />
        <h3>{uiText(badge.name)}</h3><p className="infinidrill-achievement-difficulty">{uiText(badge.difficulty)}</p><p>{uiText(badge.description)}</p><strong>{badge.earnedAt ? uiText("Earned") : uiText("Not yet earned")}</strong>
      </article>)}</div>
      <button type="button" className="infinidrill-primary-button" onClick={resumeGame} disabled={busy}>{uiText("Back to drilling")}</button>
    </section></div>}
    {overlay === "pause" && <div className="infinidrill-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title"><section className="infinidrill-modal"><span className="infinidrill-modal-icon" aria-hidden="true">⏸️</span><h2 id="pause-title">{uiText("Drill paused")}</h2><p>{uiText("Resume this tunnel, or start at ground level with easier questions and a fresh drill inventory. Your badges and Town storage are saved.")}</p><button type="button" className="infinidrill-primary-button" onClick={resumeGame} disabled={busy}>{uiText("Resume")}</button><button type="button" className="infinidrill-secondary-button" onClick={startNewSession} disabled={busy}>{uiText("Start new session")}</button></section></div>}
    {overlay === "exit" && <div className="infinidrill-overlay" role="dialog" aria-modal="true" aria-labelledby="exit-title"><section className="infinidrill-modal"><span className="infinidrill-modal-icon">🚪</span><h2 id="exit-title">{uiText("Leave this expedition?")}</h2><p>{uiText("Your expedition and earned badges are saved. You can return later.")}</p><div className="infinidrill-modal-actions"><button type="button" className="infinidrill-secondary-button" onClick={resumeGame} disabled={busy}>{uiText("Resume")}</button><button type="button" className="infinidrill-danger-button" onClick={leave}>{uiText("Leave")}</button></div></section></div>}
    {renderState.mode === "workshop" && !overlay && <Workshop profile={profile} equipment={visualEquipment} glowing={glowing} state={state} selected={selectedUpgrade} onSelect={setSelectedUpgrade} dispatch={dispatch} onClose={() => dispatch({ type: "close-workshop" })} glow={glow} />}
    {challengeChoice && <div className="infinidrill-overlay" role="dialog" aria-modal="true" aria-labelledby="challenge-title"><section className="infinidrill-modal infinidrill-challenge-modal"><span className="infinidrill-modal-icon">🕳️</span><p className="infinidrill-eyebrow">{uiText("A cave crossroads")}</p><h2 id="challenge-title">{uiText("What should we do?")}</h2><p>{uiText("You have answered seven questions. Choose your route.")}</p><div className="infinidrill-choice-grid"><button type="button" className="infinidrill-choice-card" onClick={() => dispatch({ type: "choose-challenge", choice: "A" })}><strong>A</strong><span>{uiText("Keep drilling")}</span><small>{uiText("Continue down the tunnel.")}</small></button><button type="button" className="infinidrill-choice-card is-special" onClick={() => dispatch({ type: "choose-challenge", choice: "B" })}><strong>B</strong><span>{uiText("Try a bonus")}</span><small>{uiText("Answer one extra question for a free part.")}</small></button></div></section></div>}
    {rewardChoice && <div className="infinidrill-overlay" role="dialog" aria-modal="true" aria-labelledby="reward-title"><section className="infinidrill-modal infinidrill-reward-modal"><span className="infinidrill-modal-icon">🎁</span><p className="infinidrill-eyebrow">{uiText("Free upgrade")}</p><h2 id="reward-title">{uiText("Pick one for your stash or equip it")}</h2><p className="infinidrill-reward-copy">{uiText("Equipment you can use now will be equipped as soon as you receive it.")}</p><div className="infinidrill-reward-grid">{renderState.upgradeChoices.map((id) => { const upgrade = getUpgrade(id); if (!upgrade) return null; const equipable = isUpgradeUsable([...state.ownedUpgradeIds, upgrade.id], upgrade.id); const actionLabel = equipable ? "Receive and equip" : "Receive to stash"; return <button type="button" className="infinidrill-reward-choice" key={upgrade.id} onClick={() => dispatch({ type: "choose-upgrade-reward", upgradeId: upgrade.id })} aria-label={`${uiText(upgrade.name)}: ${uiText(actionLabel)}`}><div className="infinidrill-reward-preview"><DrillAtlasPart slot={upgrade.slot} tier={upgrade.tier} className="infinidrill-preview-part" /></div><strong>{uiText(upgrade.name)}</strong><small>{uiText(SLOT_LABELS[upgrade.slot])} {uiText(" · tier ")}{upgrade.tier}</small><span className="infinidrill-reward-action">{uiText(actionLabel)}</span></button>; })}</div></section></div>}
    {rewardFlights.length > 0 && <div className="infinidrill-reward-flight-layer" aria-hidden="true">{rewardFlights.map((reward) => <span key={reward.id} className={`infinidrill-reward-flight is-${reward.kind}`} data-reward-kind={reward.kind} style={{ "--from-x": `${reward.fromX}px`, "--from-y": `${reward.fromY}px`, "--to-x": `${reward.toX}px`, "--to-y": `${reward.toY}px`, "--flight-delay": `${reward.delay}ms` } as CSSProperties}><RewardFlightIcon reward={reward} />{reward.count ? <strong>+{reward.count}</strong> : null}</span>)}</div>}
  </div>;
}

export function InfinidrillPage() {
  useUiLanguage();
  const navigate = useNavigate(); const familyId = useFamilyStore((state) => state.familyId); const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const { data: profiles = [], isLoading, isError, refetch } = useQuery({ queryKey: profileQueryKey(familyId), queryFn: familyScopedQuery(familyId, fetchProfiles), enabled: Boolean(familyId), retry: false });
  const generation = useFamilyStore(state => state.sessionGeneration);
  const profile = profiles.find((item) => item.id === activeProfileId);
  if (isLoading) return <div className="infinidrill-loading" role="status">{uiText("Loading your drill cabin…")}</div>;
  if (isError || !profile) return <div className="infinidrill-loading"><div className="infinidrill-loading-card"><span aria-hidden="true">🛠️</span><h1>{uiText("Your cabin needs a profile")}</h1><p>{isError ? uiText("We could not load this profile yet.") : uiText("Choose a kid profile before starting an expedition.")}</p><button type="button" className="infinidrill-primary-button" onClick={() => { void refetch(); }}>{uiText("Try again")}</button><button type="button" className="infinidrill-secondary-button" onClick={() => navigate("/")}>{uiText("Back to profiles")}</button></div></div>;
  return <InfinidrillSession key={`${generation}:${familyId}:${activeProfileId ?? profile.id}`} profile={profile} onExit={() => navigate("/playground")} />;
}

export default InfinidrillPage;
