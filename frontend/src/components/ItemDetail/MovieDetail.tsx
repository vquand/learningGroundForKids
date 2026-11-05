import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { Link } from 'react-router-dom';
import type { ItemDetail, MovieRichFields, FranchiseSibling } from '../../types/item';
import YouTubeEmbed from './YouTubeEmbed';
import { TTSButton } from './TTSButton';
import { extractYouTubeId } from './utils';
import { CharacterCard } from './CharacterCard';

interface MovieDetailProps {
  item: ItemDetail;
  onMediaInteract?: () => void;
}

export function MovieDetail({ item, onMediaInteract }: MovieDetailProps) {
  useUiLanguage();
  const trailerId = item.trailer_url ? extractYouTubeId(item.trailer_url) : null;
  const lang = item.translation?.lang ?? 'en';
  const rich = (item.rich_fields ?? {}) as MovieRichFields;

  return (
    <div>
      {/* 1. Description */}
      <section data-checkpoint="description" className="mb-6">
        <div className="flex justify-end mb-1">
          <TTSButton text={item.translation?.description ?? ''} lang={lang} />
        </div>
        <p className="text-lg leading-relaxed min-h-[3rem]">
          {item.translation?.description ?? ''}
        </p>
      </section>

      {/* 2. Story Blurb (only if distinct from description) */}
      {rich.story_blurb && rich.story_blurb !== item.translation?.description && (
        <section className="mb-6">
          <blockquote className="border-l-4 border-pink-200 pl-4 italic text-base text-gray-700 mb-6">
            {rich.story_blurb}
          </blockquote>
        </section>
      )}

      {/* 3. Trailer */}
      {trailerId != null && (
        <section data-checkpoint="trailer" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Trailer")}</h2>
          <div onClick={() => { onMediaInteract?.(); }}>
            <YouTubeEmbed videoId={trailerId} title={uiText("Trailer")} />
          </div>
        </section>
      )}

      {/* 4. Characters (horizontal scroll with snap) */}
      {item.characters != null && item.characters.length > 0 && (
        <section data-checkpoint="characters" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Characters")}</h2>
          <div
            className="overflow-x-auto flex gap-4 pb-2 -mx-4 px-4"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
            role="list"
          >
            {item.characters.map((character, index) => (
              <div key={index} style={{ scrollSnapAlign: 'start' }} role="listitem" className="shrink-0">
                <CharacterCard character={character} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Franchise Links */}
      {item.franchise_siblings != null && item.franchise_siblings.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("More in This Series")}</h2>
          <div
            className="overflow-x-auto flex gap-4 pb-2 -mx-4 px-4"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
            role="list"
          >
            {item.franchise_siblings.map((sib: FranchiseSibling) => (
              <Link
                key={sib.id}
                to={`/items/${sib.id}`}
                className="shrink-0 w-[140px] min-h-[64px] rounded-2xl bg-pink-50 border border-pink-100 p-3 flex items-center justify-center active:scale-95 transition-transform duration-150"
                style={{ scrollSnapAlign: 'start' }}
                role="listitem"
              >
                <span className="text-sm font-semibold text-center">{sib.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default MovieDetail;
