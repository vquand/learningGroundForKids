import type { CSSProperties } from 'react';
import type { WallStyle } from '../../api/mathWall';
import sprites from './wallSprites.json' with { type: 'json' };

export const WALL_MATERIALS = sprites;
export function wallMaterialStyle(style: WallStyle, frame = 0): CSSProperties {
  return {
    backgroundImage: `url(${sprites[style].src})`,
    backgroundSize: '100% 400%',
    backgroundPosition: `0% ${frame / 3 * 100}%`,
  };
}
/** Keep Minecraft's square tiles; use only the generated silhouette as a mask. */
export function wallMaskStyle(frame: number): CSSProperties {
  const image = `url(${sprites.blocks.src})`, position = `0% ${frame / 3 * 100}%`;
  return {
    maskImage: image, maskSize: '100% 400%', maskPosition: position, maskRepeat: 'no-repeat', maskMode: 'alpha',
    WebkitMaskImage: image, WebkitMaskSize: '100% 400%', WebkitMaskPosition: position, WebkitMaskRepeat: 'no-repeat',
  };
}
