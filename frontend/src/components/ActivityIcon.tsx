import { RacingAnimal } from '../features/animal-racing/RacingArt';
import {WOMENS_DAY_BLOB_ART} from '../features/town-building/womensDayArt';
import { DRILL_PARTS_ATLAS, drillPartSourceRect } from '../features/infinidrill/assets';
import {townArtHref} from '../features/town-building/townArtScale';
import {LakeArt} from '../features/town-building/maps/lake/LakeArt';
import './activityIcon.css';

const head = drillPartSourceRect('head', 0);
const aliases: Record<string, string> = {
  exploring: 'explore', 'shoo-shoo-ufo': 'ufo', 'waddle-wall': 'math-wall',
  'infinidrill-earth': 'infinidrill', 'town-building': 'town',
  cooking: 'kitchen', 'food-and-drink': 'kitchen', burger: 'kitchen', 'cabbage-rolls': 'kitchen',
};
const symbols: Record<string, string> = {
  'daily-quiz': '🌞', avatar: '🎨', badges: '🏆', calendar: '🗓️', explore: '🗺️', kitchen: '🍳', ufo: '🛸',
  'math-wall': '🧱', miniku: '🔢', flashcards: '▱', 'xmas-2026': '⛄',
};

/** One activity identity across the child's Playground and parent reports. */
export function ActivityIcon({ activity }: { activity: string }) {
  const id = aliases[activity] ?? activity;
  return <span className="activity-icon" data-activity-icon={id} aria-hidden="true">
    {id === 'town-lake' ? <LakeArt index={1}/> : id === 'road-racing' ? <RacingAnimal animal="capybara" face/> : id === 'womens-day-2026' ? <svg className="town-icon" viewBox={WOMENS_DAY_BLOB_ART.crops[0].join(' ')}><image href={WOMENS_DAY_BLOB_ART.source} width={WOMENS_DAY_BLOB_ART.width} height={WOMENS_DAY_BLOB_ART.height}/></svg> : id === 'fishing' ? <svg className="town-icon" viewBox="0 0 1 1"><image href="/minigames/fishing/catches.png" width="4" height="3" preserveAspectRatio="none" /></svg> : id === 'halloween' ? <img className="town-icon" src="/minigames/town-building/halloween-v1/ghostly-sky.png" alt=""/> : id === 'town' ? <svg className="town-icon" viewBox="481 62 368 360"><image href={townArtHref('buildings-minimal-v2')} width="1774" height="887" /></svg>
      : id === 'infinidrill' ? <svg className="town-icon activity-icon-drill" viewBox={`0 0 ${head.width} ${head.height}`}><svg className="town-icon" width={head.width} height={head.height} overflow="hidden"><image href={DRILL_PARTS_ATLAS.src} x={-head.x} y={-head.y} width={DRILL_PARTS_ATLAS.width} height={DRILL_PARTS_ATLAS.height} /></svg></svg>
        : symbols[id] ?? '⭐'}
  </span>;
}
