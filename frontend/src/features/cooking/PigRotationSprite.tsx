import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useId } from "react";
import { PIG_ROTATION_CROPS, roastAppearance } from './pigRoastPresentation';

export function PigRotationSprite({ turns, rawRoundLimit }: { turns: number; rawRoundLimit: number }) {
  useUiLanguage();
  const clipId = useId();
  const frame = Math.floor(turns * 6 + 1e-8) % 6;
  const [x, y, width, height] = PIG_ROTATION_CROPS[frame]!;
  const appearance = roastAppearance(turns, rawRoundLimit);
  return <svg className="cooking-grill-visual__food cooking-grill-visual__food--rotation"
    viewBox={`${x} ${y} ${width} ${height}`} overflow="hidden" role="img"
    aria-label={`${uiText(appearance.label)} ${uiText('pig')}`} data-frame={frame} data-roast-stage={appearance.label}
    style={{ transform: "translate(-50%, -50%)" }}>
    <defs><clipPath id={clipId}><rect x={x} y={y} width={width} height={height} /></clipPath></defs>
    {(['raw', 'warming', 'good'] as const).map((stage, index) => <image key={stage} clipPath={`url(#${clipId})`} href={`/minigames/cooking/grill/${stage}-pork-rotation.png`} width="1672" height="941" opacity={[1, appearance.warming, appearance.golden][index]} />)}
  </svg>;
}
