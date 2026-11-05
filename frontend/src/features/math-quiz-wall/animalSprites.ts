import type { MathAnimal } from '../../api/mathWall';

export type AnimalPose = 'rear' | 'left' | 'right' | 'surprised';
export interface SpriteFrame { x: number; y: number; width: number; height: number }
interface SpriteSheet {
  src: string; width: number; height: number; bodyHeight: number;
  frames: Record<AnimalPose, SpriteFrame>;
  walks: Record<'left' | 'right', readonly SpriteFrame[]>;
}
const frame = (column: number, row: number): SpriteFrame => ({ x: column * 256, y: row * 192, width: 256, height: 192 });
function sheet(animal: MathAnimal): SpriteSheet {
  return {
    src: `/minigames/math-quiz-wall/${animal}-motion-v3.webp`, width: 1536, height: 576, bodyHeight: 160,
    frames: { rear: frame(0, 2), left: frame(0, 0), right: frame(0, 1), surprised: frame(3, 2) },
    walks: { left: Array.from({ length: 6 }, (_, i) => frame(i, 0)), right: Array.from({ length: 6 }, (_, i) => frame(i, 1)) },
  };
}
// Generated source bounds and foot alignment: docs/artwork/waddle-wall/chubby-v3/manifest.json.
export const ANIMAL_SPRITES: Record<MathAnimal, SpriteSheet> = {
  capybara: sheet('capybara'), cow: sheet('cow'), highland: sheet('highland'),
};
export const ANIMAL_NAMES = {
  capybara: ['Capybara', 'Capybara'], cow: ['Dairy cow', 'Bò sữa'], highland: ['Highland cow', 'Bò cao nguyên'],
};
export const POSE_NAMES = {
  rear: ['rear view', 'nhìn từ sau'], left: ['moving left', 'đi sang trái'],
  right: ['moving right', 'đi sang phải'], surprised: ['surprised', 'ngạc nhiên'],
};
