import type { MathAnimal } from '../../api/mathWall';
import { ANIMAL_NAMES, ANIMAL_SPRITES, type AnimalPose } from './animalSprites';
import type { CSSProperties } from 'react';

export function AnimalSprite2D({ animal, pose = 'right', size = 64, groundAligned = false, label, walking = false, paused = false }: { animal: MathAnimal; pose?: AnimalPose; size?: number; groundAligned?: boolean; label?: string; walking?: boolean; paused?: boolean }) {
  const sheet = ANIMAL_SPRITES[animal], frame = sheet.frames[pose];
  const scale = size / (groundAligned ? sheet.bodyHeight : Math.max(frame.width, frame.height));
  const width = groundAligned ? frame.width * scale : size;
  const moving = walking && (pose === 'left' || pose === 'right');
  return <span className="math-animal-sprite" role="img" aria-label={label ?? ANIMAL_NAMES[animal][0]} data-pose={pose} data-walking={moving} data-paused={paused} style={{ width, height: size, '--math-walk-distance': `${frame.width * 6 * scale}px` } as CSSProperties}>
    <span className="math-animal-piece" style={{ width: frame.width * scale, height: frame.height * scale, left: (width - frame.width * scale) / 2, top: groundAligned ? size - frame.height * scale : (size - frame.height * scale) / 2 }}>
      <img src={sheet.src} alt="" aria-hidden="true" style={{ width: sheet.width * scale, height: sheet.height * scale, left: -frame.x * scale, top: -frame.y * scale }} />
    </span>
  </span>;
}
