import { useEffect, useRef, useState } from 'react';
import { drillHaptics } from '../../lib/drillHaptics';
import type { InfinidrillState } from '../../api/infinidrill';
import type { TownDeposit } from '../../../../server/src/town-building/rewards';
import { createInfinidrillGame } from './game';
import { getUpgrade } from './upgrades';
import { getInfinidrillQuote } from './quotes';
import { worldViewport } from './world';
import { SLOT_LABELS } from './InfinidrillArt';
import type { Deposit, InfinidrillViewState } from './types';
import type { InfinidrillProfile, Slot, Overlay, DrillAction } from './viewTypes';
import type { RewardFlight } from './InfinidrillRewardFlights';

/** Visual state never grades answers or grants rewards. Timers belong to this view. */
export function useInfinidrillAnimations(state: InfinidrillViewState, profile: InfinidrillProfile,
  started: boolean, overlay: Overlay, dispatch: (action: DrillAction) => void) {
  const [quote, setQuote] = useState<string | null>(null);
  const [glowing, setGlowing] = useState<Slot | null>(null);
  const [visualEquipment, setVisualEquipment] = useState(state.equippedUpgradeIds);
  const [transitionFrom, setTransitionFrom] = useState<InfinidrillViewState | null>(null);
  const [visualDepth, setVisualDepth] = useState(0);
  const [rewardFlights, setRewardFlights] = useState<RewardFlight[]>([]);
  const drillMachineRef = useRef<HTMLDivElement>(null);
  const inventoryButtonRef = useRef<HTMLButtonElement>(null);
  const rewardFlightTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const transitioning = transitionFrom !== null;
  const transitionLock = useRef(false);
  const revealLock = useRef(false);
  const quoteCount = useRef(0);
  const previousQuote = useRef<string | undefined>(undefined);
  const firstInput = useRef(false);
  const wrongCooldownUntil = useRef(0);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const renderState = transitionFrom ?? state;
  const modalActive = !transitioning && Boolean(overlay || state.mode === "workshop" || state.mode === "paused" || state.mode === "challenge-choice" || state.mode === "upgrade-reward");
  const caveFall = transitioning && state.lastEvent.depth?.kind === "cave-fall";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    setQuote(null); quoteCount.current = 0; firstInput.current = false;
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
  }, [state.questionCounter]);
  useEffect(() => () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    revealTimers.current.forEach(clearTimeout);
    rewardFlightTimers.current.forEach(clearTimeout);
  }, []);

  function startRewardFlights(before: InfinidrillViewState, next: InfinidrillViewState, townDeposits: TownDeposit[] = []) {
    const rewards: Array<Pick<RewardFlight, "kind" | "label" | "count" | "upgradeId"> & { deposit?: Pick<Deposit, "row" | "column"> }> = [];
    const crystals = next.resources.crystals - before.resources.crystals;
    const nuggets = next.resources.nuggets - before.resources.nuggets;
    const deposits = crystals > 0 || nuggets > 0 ? next.lastEvent.deposits ?? [] : [];
    for (const deposit of deposits) rewards.push({ kind: deposit.kind, label: deposit.kind === 'crystals' ? 'Diamonds' : 'Nuggets', count: 1, deposit });
    if (!deposits.length) {
      if (crystals > 0) rewards.push({ kind: "crystals", label: "Diamonds", count: crystals });
      if (nuggets > 0) rewards.push({ kind: "nuggets", label: "Nuggets", count: nuggets });
    }
    const upgradeId = next.lastEvent.kind === "upgrade-reward" ? next.lastEvent.upgrade?.upgradeId : undefined;
    if (upgradeId && !before.ownedUpgradeIds.includes(upgradeId)) {
      rewards.push({ kind: "upgrade", label: getUpgrade(upgradeId)?.name ?? "Equipment", upgradeId });
    }
    for (const deposit of townDeposits.slice(0, 12)) rewards.push({ kind: deposit.kind, label: deposit.kind, count: 1, deposit });
    if (rewards.length === 0) return;
    const source = drillMachineRef.current?.getBoundingClientRect();
    const target = inventoryButtonRef.current?.getBoundingClientRect();
    if (!source || !target) return;
    const fromX = source.left + source.width / 2 - 22;
    const fromY = source.top + source.height / 2 - 22;
    const toX = target.left + target.width / 2 - 22;
    const toY = target.top + target.height / 2 - 22;
    const scene = document.querySelector<HTMLElement>('.infinidrill-world-scene');
    const sceneBounds = scene?.getBoundingClientRect();
    const view = scene ? worldViewport(before.depthBlocks, scene.clientWidth, scene.clientHeight, Number(scene.dataset.laserReach ?? 0)) : null;
    rewardFlightTimers.current.forEach(clearTimeout);
    rewardFlightTimers.current = [];
    const townTarget = document.querySelector<HTMLElement>('[data-town-storage]')?.getBoundingClientRect();
    const flights = rewards.map((reward, index) => {
      const block = reward.deposit ? document.querySelector<HTMLElement>(`.infinidrill-world-block[data-world-row="${reward.deposit.row}"][data-world-column="${reward.deposit.column}"]`)?.getBoundingClientRect() : undefined;
      const depositX = reward.deposit && view && sceneBounds ? sceneBounds.left + view.width / 2 + reward.deposit.column * view.cellSize - 22 : fromX;
      const depositY = reward.deposit && view && sceneBounds ? sceneBounds.top + (reward.deposit.row - view.cameraRow) * view.tileSize + view.cellSize / 2 - 22 : fromY;
      return {
        ...reward,
        id: `reward-flight-${Date.now()}-${index}`,
        fromX: block ? block.left + block.width / 2 - 22 : depositX,
        fromY: block ? block.top + block.height / 2 - 22 : depositY,
        toX: townTarget && ['sand','rock','metal'].includes(reward.kind) ? townTarget.left + townTarget.width / 2 - 22 : toX,
        toY: townTarget && ['sand','rock','metal'].includes(reward.kind) ? townTarget.top + townTarget.height / 2 - 22 : toY,
        delay: index * 90,
      };
    });
    setRewardFlights(flights);
    const duration = (reducedMotion ? 100 : 950) + flights.length * 90;
    rewardFlightTimers.current.push(setTimeout(() => setRewardFlights([]), duration));
  }

  function showThought() {
    const text = getInfinidrillQuote(profile.avatar_type === "default" ? profile.avatar_url : undefined, Math.random, previousQuote.current);
    previousQuote.current = text;
    setQuote(text);
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = setTimeout(() => setQuote(null), 3000);
  }
  useEffect(() => {
    if (!started || transitioning || modalActive || (state.mode !== "playing" && state.mode !== "bonus-question")) return;
    const interval = setInterval(() => {
      if (firstInput.current) return;
      const elapsed = Date.now() - state.questionStartedAt;
      const threshold = quoteCount.current === 0 ? 10000 : 25000 + (quoteCount.current - 1) * 20000;
      if (elapsed <= threshold) return;
      quoteCount.current++;
      showThought();
    }, 250);
    return () => clearInterval(interval);
  }, [started, transitioning, modalActive, state.mode, state.questionStartedAt, state.questionCounter, profile.avatar_type, profile.avatar_url]);
  useEffect(() => { if (modalActive) setQuote(null); }, [modalActive]);

  useEffect(() => {
    if (!transitionFrom) return;
    const laser = state.lastEvent.laser;
    const duration = reducedMotion ? 40 : caveFall || laser ? 1600 : 1000;
    const normalEnd = laser ? laser.from * 6 : state.depthMetres;
    const digDuration = laser ? caveFall ? 400 : 1000 : duration;
    const fireDuration = laser ? caveFall ? 400 : 600 : 0;
    const start = Date.now();
    setVisualDepth(transitionFrom.depthMetres);
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const fraction = Math.min(1, elapsed / digDuration);
      let depth = transitionFrom.depthMetres + (normalEnd - transitionFrom.depthMetres) * fraction;
      if (laser && elapsed > digDuration + fireDuration) depth = normalEnd + (state.depthMetres - normalEnd) * Math.min(1, (elapsed - digDuration - fireDuration) / (duration - digDuration - fireDuration));
      if (reducedMotion) depth = state.depthMetres;
      setVisualDepth(depth);
    }, 16);
    const finish = setTimeout(() => {
      clearInterval(tick);
      setVisualDepth(state.depthMetres);
      if (state.currentQuestion) dispatch({ type: "question-ready", questionId: state.currentQuestion.id });
      transitionLock.current = false;
      setTransitionFrom(null);
    }, duration);
    return () => { clearInterval(tick); clearTimeout(finish); };
  }, [transitionFrom, state.depthMetres, state.currentQuestion?.id, state.lastEvent.laser, caveFall, reducedMotion]);

  function confirmAction(before: InfinidrillViewState, result: InfinidrillState, action: DrillAction) {
    if (!result.game) return;
    startRewardFlights(before, result.game, result.townDeposits);
    const equippedSlot = (Object.keys(SLOT_LABELS) as Slot[]).find(slot => result.game!.equippedUpgradeIds[slot] !== before.equippedUpgradeIds[slot]);
    if (equippedSlot) revealEquipment(equippedSlot, result.game.equippedUpgradeIds);
    if (action.type === 'submit-answer' && result.game.mainQuestionsCompleted > before.mainQuestionsCompleted) {
      drillHaptics();
      transitionLock.current = true; setTransitionFrom(before);
    }
    if (result.game.feedback === 'wrong' && Date.now() >= wrongCooldownUntil.current) {
      showThought(); wrongCooldownUntil.current = Date.now() + 10000;
    }
  }
  function revealEquipment(slot: Slot, equipment: InfinidrillViewState['equippedUpgradeIds']) {
    revealTimers.current.forEach(clearTimeout); revealTimers.current = [];
    if (reducedMotion) { setVisualEquipment(equipment); return; }
    revealLock.current = true; setGlowing(slot);
    revealTimers.current.push(setTimeout(() => setVisualEquipment(equipment), 750));
    revealTimers.current.push(setTimeout(() => { setGlowing(null); revealLock.current = false; }, 1600));
  }
  function resetForReplay() {
    setTransitionFrom(null); setVisualDepth(0);
    rewardFlightTimers.current.forEach(clearTimeout); rewardFlightTimers.current = [];
    setRewardFlights([]);
    setQuote(null); firstInput.current = false; previousQuote.current = undefined;
    revealTimers.current.forEach(clearTimeout); revealTimers.current = [];
    revealLock.current = false; transitionLock.current = false; setGlowing(null);
    setVisualEquipment(createInfinidrillGame().equippedUpgradeIds);
  }
  function sync(game: InfinidrillViewState | null) {
    if (game) setVisualEquipment(game.equippedUpgradeIds);
    setTransitionFrom(null); transitionLock.current = false;
  }
  return { quote, setQuote, firstInput, glowing, visualEquipment, transitionFrom, visualDepth,
    rewardFlights, drillMachineRef, inventoryButtonRef, transitioning, transitionLock,
    revealLock, renderState, modalActive, caveFall, reducedMotion, confirmAction, sync, resetForReplay };
}
