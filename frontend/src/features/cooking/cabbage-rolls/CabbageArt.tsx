import { useId, type CSSProperties } from 'react';
import type { CabbageGame, Outcome } from './cabbageGame';
import { CABBAGE_ATLASES, type SpriteSheet } from './cabbageAtlas';
const BASE = '/minigames/cooking/cabbage-rolls/';
/** An SVG viewport clips a measured rectangle without distorting the source image. */
export function CabbageSprite({ sheet, index, className = '', style }: { sheet: SpriteSheet; index: number; className?: string; style?: CSSProperties }) {
  const clipId = useId();
  // Reuse the authored whole/fine stages in setup and mixing, too.
  const ingredient = sheet === 'preparation' && index < 8;
  const atlas = CABBAGE_ATLASES[ingredient ? 'chopping' : sheet];
  const rect = atlas.rects[ingredient ? (index % 4) * 4 + (index >= 4 ? 3 : 0) : index]!;
  return <svg aria-hidden="true" className={`cr-sprite cr-sprite--${sheet} ${className}`} data-sprite={`${sheet}-${index}`}
    viewBox={rect.join(' ')} preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `${rect[2]} / ${rect[3]}`, ...style }}>
    <defs><clipPath id={clipId}><rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} /></clipPath></defs>
    <image clipPath={`url(#${clipId})`} href={`${BASE}${atlas.file}`} width={atlas.width} height={atlas.height} />
  </svg>;
}
export function MealArt({ outcome = 'perfect' }: { outcome?: Outcome }) {
  return <CabbageSprite sheet="meals" index={{ undercooked: 0, okay: 1, perfect: 2, burnt: 3 }[outcome]} className="cr-meal" />;
}
export function foldSprite(s: CabbageGame) {
  return s.torn ? 7 : !s.portion ? 0 : !s.folds.includes('bottom') ? 1 : s.folds.includes('left') && s.folds.includes('right') ? 5 : s.folds.includes('left') ? 3 : s.folds.includes('right') ? 4 : 2;
}
