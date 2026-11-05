import type { Animal } from '../../api/ufo';
import { AchievementBadgeArt } from '../achievements/AchievementBadgeArt';
import './ufo.css';
export const ANIMALS: { id: Animal; name: string }[] = [{ id: 'cow', name: 'Dairy cow' }, { id: 'highland', name: 'Highland cow' }, { id: 'sheep', name: 'Sheep' }, { id: 'capybara', name: 'Capybara' }];
export function AnimalSprite({ animal, pose = 0, surprised = false, className = '' }: { animal: Animal; pose?: number; surprised?: boolean; className?: string }) {

  const row = ANIMALS.findIndex(a => a.id === animal);

  return <span role="img" aria-label={ANIMALS[row]?.name} className={`ufo-animal-sprite ${surprised ? 'ufo-animal-surprised' : ''} ${animal === 'capybara' && pose === 1 ? 'ufo-capybara-eating' : ''} ${className}`} style={{ backgroundPosition: `${pose * 100 / 3}% ${row * 100 / 3}%` }} />;

}
export function BadgeLogo({ index, size = 100 }: { index: number; size?: number }) {
  return <AchievementBadgeArt source="/minigames/ufo/badges.png" index={index} columns={5} rows={3} size={size} className="ufo-badge-logo" />;

}
