import type { Ref } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText, uiMessage } from '../../i18n/uiText';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { DRILL_PARTS_ATLAS, drillPartSourceRect, DRILL_HEAD_SPIN_ATLAS, drillHeadSpinSourceRect, LASER_ACCESSORIES_ATLAS, laserAccessorySourceRect } from './assets';
import { getUpgrade } from './upgrades';
import type { UpgradePart } from './types';
import type { InfinidrillProfile, Slot } from './viewTypes';

export const SLOT_LABELS: Record<Slot, string> = { head: "Drill heads", cabin: "Cabin skins", accessory: "Fun extras", engine: "Engines", treads: "Tank treads" };
export function upgradeUiDescription(part: UpgradePart) {
  const index = part.tier - 1;
  if (part.slot === 'head') return uiMessage('Digs {width} tiles wide{extra}.', {width:index+4, extra:index%2===0 ? uiText(', with one extra tile on either side') : ''});
  if (part.slot === 'accessory') return uiMessage("Fires diagonal beams {width} tiles wide and {rows} rows down, stepping outward beyond the drill's reach.", {width:index<2 ? 1 : 3,rows:[2,4,4,6][index] ?? 2});
  return uiMessage('Adds {depth} visible tiles of depth per dig. Stacks with cabin, engine and treads.', {depth:part.tier});
}
export const SLOT_ICONS: Record<Slot, string> = { head: "⛏️", cabin: "🏠", accessory: "✨", engine: "⚙️", treads: "🛞" };
export function DrillAtlasPart({ slot, tier, className }: { slot: Slot; tier: number; className: string }) {
  useUiLanguage();
  const laser = slot === 'accessory' && tier > 0;
  const rect = laser ? laserAccessorySourceRect(tier) : drillPartSourceRect(slot, tier);
  const atlas = laser ? LASER_ACCESSORIES_ATLAS : DRILL_PARTS_ATLAS;
  return <span className={`infinidrill-part infinidrill-atlas-part ${className}`} data-slot={slot} data-tier={tier} aria-hidden="true">
    <svg viewBox={`0 0 ${rect.width} ${rect.height}`} preserveAspectRatio="xMidYMid meet">
      <svg width={rect.width} height={rect.height} overflow="hidden">
        <image href={atlas.src} x={-rect.x} y={-rect.y} width={atlas.width} height={atlas.height} />
      </svg>
    </svg>
  </span>;
}

function SpinningDrillHead({ tier }: { tier: number }) {
  useUiLanguage();
  return <span className="infinidrill-part infinidrill-part-head infinidrill-spin-head" data-slot="head" data-tier={tier} aria-hidden="true">{[0, 1, 2, 3].map(frame => {
    const rect = drillHeadSpinSourceRect(tier, frame);
    return <svg key={frame} className="infinidrill-spin-frame" data-spin-frame={frame} style={{ animationDelay: `${-((4 - frame) % 4) * .09}s` }} viewBox={`0 0 ${rect.width} ${rect.height}`}>
      <svg width={rect.width} height={rect.height} overflow="hidden"><image href={DRILL_HEAD_SPIN_ATLAS.src} x={-rect.x} y={-rect.y} width={DRILL_HEAD_SPIN_ATLAS.width} height={DRILL_HEAD_SPIN_ATLAS.height} /></svg>
    </svg>;
  })}</span>;
}

export function DrillMachine({ profile, equipped, glowing, anchorRef, spinning = false }: { profile: InfinidrillProfile; equipped: Readonly<Partial<Record<Slot, string>>>; glowing: Slot | null; anchorRef?: Ref<HTMLDivElement>; spinning?: boolean }) {
  useUiLanguage();
  const tier = (slot: Slot) => { const id = equipped[slot]; return id ? getUpgrade(id)?.tier ?? 0 : 0; };
  return <div ref={anchorRef} className={`infinidrill-machine ${glowing ? "is-glowing" : ""}`}>
    <div className="infinidrill-drill-body" />
    <div className="infinidrill-cabin"><DrillAtlasPart slot="cabin" tier={tier("cabin")} className="infinidrill-part-cabin" /><div className="infinidrill-cabin-window"><ProfileAvatar profile={profile} size="preview" /></div></div>
    {spinning ? <SpinningDrillHead tier={tier('head')} /> : <DrillAtlasPart slot="head" tier={tier("head")} className="infinidrill-part-head" />}
    <DrillAtlasPart slot="engine" tier={tier("engine")} className="infinidrill-part-engine" />
    <DrillAtlasPart slot="treads" tier={tier("treads")} className="infinidrill-part-treads" />
    <DrillAtlasPart slot="accessory" tier={tier("accessory")} className="infinidrill-part-accessory" />
  </div>;
}
