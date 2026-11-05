import { Sprite } from '../town-building/TownArt';
import './achievementBadgeArt.css';

/** Renders a single transparent-background badge from its catalog sprite atlas. */
export function AchievementBadgeArt({ source, index, columns, rows, size = 96, className = '' }: {
  source: string; index: number; columns: number; rows: number; size?: number; className?: string;
}) {
  if(source==='/minigames/town-building/badges.png') return <Sprite file="badges" index={index} columns={5} rows={1} className={className} style={{width:size,height:size}}/>;
  if(source==='/minigames/town-building/garden-badges.png') return <Sprite file="garden-badges" index={index} columns={2} rows={1} className={className} style={{width:size,height:size}}/>;
  // Miniku atlas: 2172×724, with four 543×724 portrait frames.
  const frameAspectRatio = source === '/minigames/miniku/miniku-badges.png' ? 543 / 724 : 1;
  const width = size * Math.min(frameAspectRatio, 1);
  const height = size / Math.max(frameAspectRatio, 1);
  const x = columns > 1 ? index % columns / (columns - 1) * 100 : 0;
  const y = rows > 1 ? Math.floor(index / columns) / (rows - 1) * 100 : 0;
  return <span aria-hidden="true" className={`achievement-badge-art ${className}`} style={{
    width, height, backgroundImage: `url("${source}")`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`, backgroundPosition: `${x}% ${y}%`,
  }} />;
}
