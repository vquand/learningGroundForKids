import { KidBackButton } from "../../components/KidBackButton";
import type { CSSProperties, Dispatch } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { infinidrillReducer, INFINIDRILL_STARTER_EQUIPMENT } from './game';
import { getUpgrade, INFINIDRILL_UPGRADES, isUpgradeUsable } from './upgrades';
import { DrillAtlasPart, DrillMachine, SLOT_LABELS, SLOT_ICONS, upgradeUiDescription } from './InfinidrillArt';
import type { InfinidrillViewState, UpgradePart } from './types';
import type { InfinidrillProfile, Slot } from './viewTypes';

export function NumberPad({ value, onDigit, onBackspace, onSubmit, disabled = false }: { value: string; onDigit: (digit: number) => void; onBackspace: () => void; onSubmit: () => void; disabled?: boolean }) {
  useUiLanguage();
  return <div className="infinidrill-keypad" aria-label={uiText("Telephone number pad")}>
    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button key={digit} type="button" onClick={() => onDigit(digit)} disabled={disabled} aria-label={`Number ${digit}`}>{digit}</button>)}
    <button type="button" className="infinidrill-keypad-special" onClick={onBackspace} disabled={disabled} aria-label={uiText("Delete last digit")}>⌫</button><button type="button" onClick={() => onDigit(0)} disabled={disabled} aria-label={uiText("Number 0")}>0</button><button type="button" className="infinidrill-keypad-go" onClick={onSubmit} disabled={disabled || !value} aria-label={uiText("Check answer")}>✓</button>
  </div>;
}

export function Workshop({ profile, equipment, glowing, state, selected, onSelect, dispatch, onClose, glow }: { profile: InfinidrillProfile; equipment: InfinidrillViewState["equippedUpgradeIds"]; glowing: Slot | null; state: InfinidrillViewState; selected: UpgradePart | null; onSelect: (part: UpgradePart) => void; dispatch: Dispatch<Parameters<typeof infinidrillReducer>[1]>; onClose: () => void; glow: (slot: Slot, upgradeId?: string) => void }) {
  useUiLanguage();
  const canUse = (part: UpgradePart) => isUpgradeUsable(state.ownedUpgradeIds, part.id);
  const canBuy = (part: UpgradePart) => part.prerequisiteId === null || isUpgradeUsable(state.ownedUpgradeIds, part.prerequisiteId);
  return <div className="infinidrill-overlay" role="dialog" aria-modal="true" aria-labelledby="workshop-title"><section className="infinidrill-panel infinidrill-workshop-panel">
    <div className="infinidrill-panel-heading"><div><p className="infinidrill-eyebrow">{uiText("The parts shed")}</p><h2 id="workshop-title">{uiText("Workshop tree")}</h2></div><button className="infinidrill-close" type="button" onClick={onClose} disabled={!!glowing} aria-label={uiText("Close workshop")}>×</button></div>
    <p className="infinidrill-panel-copy">{uiText("Each branch has four tiers. Free parts may wait in your stash until the previous tier is unlocked.")}</p>
    <div className="infinidrill-workshop-layout"><div className="infinidrill-tree" aria-label={uiText("Upgrade tree")}>
      {(Object.keys(SLOT_LABELS) as Slot[]).map((slot) => <div className="infinidrill-branch" key={slot}><div className="infinidrill-branch-label"><span>{SLOT_ICONS[slot]}</span>{uiText(SLOT_LABELS[slot])}</div><div className="infinidrill-branch-nodes">
        {INFINIDRILL_UPGRADES.filter(part => part.slot === slot).map(part => {
          const owned = state.ownedUpgradeIds.includes(part.id);
          const status = owned ? !canUse(part) ? "In stash" : state.equippedUpgradeIds[slot] === part.id ? "Equipped" : "Owned" : canBuy(part) ? "Available" : "Locked";
          return <button key={part.id} type="button" className={`infinidrill-node ${selected?.id === part.id ? "is-selected" : ""} ${status === "Locked" ? "is-locked" : ""} ${status === "In stash" ? "is-stashed" : ""}`} style={{ "--node-color": part.color } as CSSProperties} onClick={() => onSelect(part)} aria-label={`${part.name}, ${status.toLowerCase()}`}>
            <DrillAtlasPart slot={part.slot} tier={part.tier} className="infinidrill-preview-part" />
            <span className="infinidrill-node-caption">{uiText("Tier ")}{part.tier} · {status}</span>
          </button>;
        })}
      </div></div>)}
    </div><aside className="infinidrill-detail-card" aria-live="polite">{selected ? <><div className="infinidrill-workshop-preview"><DrillMachine profile={profile} equipped={equipment} glowing={glowing} /></div><div className="infinidrill-detail-part"><DrillAtlasPart slot={selected.slot} tier={selected.tier} className="infinidrill-detail-part-sprite" /></div><p className="infinidrill-eyebrow">{uiText(SLOT_LABELS[selected.slot])}</p><h3>{uiText(selected.name)}</h3><p>{upgradeUiDescription(selected)}</p><p className="infinidrill-prerequisite">{uiText("Requires: ")}{selected.prerequisiteId ? uiText(getUpgrade(selected.prerequisiteId)?.name ?? "") : uiText("Starter drill")}</p><p className="infinidrill-cost">💎 {selected.crystals} {uiText(" diamonds · 🪙 ")}{selected.nuggets} {uiText(" nuggets")}</p>{state.ownedUpgradeIds.includes(selected.id) && !canUse(selected) && <p className="infinidrill-stash-note">{uiText("In stash · unlock the previous tier to use it.")}</p>}{state.ownedUpgradeIds.includes(selected.id) ? <button type="button" className="infinidrill-primary-button" disabled={!canUse(selected) || !!glowing} onClick={() => glow(selected.slot, selected.id)}>{canUse(selected) ? uiText("Equip part") : uiText("Unlock previous tier")}</button> : <button type="button" className="infinidrill-primary-button" onClick={() => dispatch({ type: "purchase-upgrade", upgradeId: selected.id })} disabled={!canBuy(selected) || state.resources.crystals < selected.crystals || state.resources.nuggets < selected.nuggets}>{!canBuy(selected) ? uiText("Unlock previous tier") : state.resources.crystals < selected.crystals || state.resources.nuggets < selected.nuggets ? uiText("Need more materials") : uiText("Buy part")}</button>}{state.equippedUpgradeIds[selected.slot] !== INFINIDRILL_STARTER_EQUIPMENT[selected.slot] && <button type="button" className="infinidrill-secondary-button infinidrill-unequip-button" disabled={!!glowing} onClick={() => glow(selected.slot, INFINIDRILL_STARTER_EQUIPMENT[selected.slot])}>{uiText("Return to basic")}</button>}</> : <div className="infinidrill-empty-detail"><span>🧰</span><p>{uiText("Pick a node to inspect a part.")}</p></div>}</aside></div>
    <div className="infinidrill-stash"><strong>{uiText("Stash")}</strong><span>{state.ownedUpgradeIds.length ? `${state.ownedUpgradeIds.length} owned part${state.ownedUpgradeIds.length === 1 ? "" : "s"}` : uiText("No parts yet")}</span><span className="infinidrill-stash-wallet">💎 {state.resources.crystals} · 🪙 {state.resources.nuggets}</span></div>
  </section></div>;
}

export function CoreCelebration({ profile, state, equipped, onReplay, onExit }: { profile: InfinidrillProfile; state: InfinidrillViewState; equipped: Readonly<Partial<Record<Slot, string>>>; onReplay: () => void; onExit: () => void }) {
  useUiLanguage();
  return <div className="infinidrill-root infinidrill-core-screen" data-phase="core"><header className="kid-nav"><KidBackButton onClick={onExit}/></header><div className="infinidrill-core-glow" aria-hidden="true" /><div className="infinidrill-core-card"><div className="infinidrill-core-avatar"><ProfileAvatar profile={profile} size="xl" /></div><div className="infinidrill-core-machine"><DrillMachine profile={profile} equipped={equipped} glowing={null} /></div><span className="infinidrill-core-orb" role="img" aria-label={uiText("Glowing Earth core")} /><p className="infinidrill-eyebrow">{uiText("Earth expedition complete")}</p><h1>{uiText("You found the core!")}</h1><p>{uiText("You drilled ")}<strong>{state.depthMetres.toLocaleString()} m</strong> {uiText(" through dirt, rock, and lava-lit stone.")}</p><p className="infinidrill-core-stats">{state.mainQuestionsCompleted} {uiText(" questions · 💎 ")}{state.resources.crystals} {uiText(" diamonds · 🪙 ")}{state.resources.nuggets} {uiText(" nuggets")}</p><div className="infinidrill-core-actions"><button type="button" className="infinidrill-primary-button" onClick={onReplay}>{uiText("Play again")}</button></div></div></div>;
}
