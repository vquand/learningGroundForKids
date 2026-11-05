import { useUiLanguage } from '../../hooks/useUiLanguage';
import { MaterialArt } from '../town-building/TownArt';
import { getUpgrade } from './upgrades';
import { DrillAtlasPart } from './InfinidrillArt';

type RewardFlightKind = "crystals" | "nuggets" | "upgrade" | "sand" | "rock" | "metal";
export interface RewardFlight {
  readonly id: string;
  readonly kind: RewardFlightKind;
  readonly label: string;
  readonly count?: number;
  readonly upgradeId?: string;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly delay: number;
}

export function RewardFlightIcon({ reward }: { reward: RewardFlight }) {
  useUiLanguage();
  if (reward.kind === "upgrade" && reward.upgradeId) {
    const upgrade = getUpgrade(reward.upgradeId);
    if (upgrade) return <DrillAtlasPart slot={upgrade.slot} tier={upgrade.tier} className="infinidrill-reward-flight-part" />;
  }
  if(reward.kind==='sand'||reward.kind==='rock'||reward.kind==='metal') return <MaterialArt material={reward.kind}/>;
  return <span className="infinidrill-reward-flight-emoji" role="img" aria-label={reward.label}>{reward.kind === "crystals" ? "💎" : "🪙"}</span>;
}
