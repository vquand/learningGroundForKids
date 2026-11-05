import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { Link } from 'react-router-dom';
import type { ItemDetail, MusicRichFields } from '../../types/item';
import AudioPlayer from './AudioPlayer';
import YouTubeEmbed from './YouTubeEmbed';
import { TTSButton } from './TTSButton';
import { extractYouTubeId } from './utils';

interface MusicDetailProps {
  item: ItemDetail;
  onMediaInteract?: () => void;
}

export function MusicDetail({ item, onMediaInteract }: MusicDetailProps) {
  useUiLanguage();
  const youtubeId = item.youtube_url ? extractYouTubeId(item.youtube_url) : null;
  const lang = item.translation?.lang ?? 'en';
  const rich = (item.rich_fields ?? {}) as MusicRichFields;

  const hasComposerInfo = rich.composer || (rich.vocalists && rich.vocalists.length > 0) || rich.release_year;

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

      {/* 2. Composer Info */}
      {hasComposerInfo && (
        <section className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("About the Music")}</h2>
          <div className="rounded-2xl bg-purple-50/50 p-4">
            {rich.composer && (
              <div className="mb-2">
                <span className="text-sm font-semibold text-purple-700">{uiText("Composer")}</span>
                <p className="text-base font-bold">{rich.composer}</p>
              </div>
            )}
            {rich.vocalists && rich.vocalists.length > 0 && (
              <div className="mb-2">
                <span className="text-sm font-semibold text-purple-700">{uiText("Vocalists")}</span>
                <p className="text-base">{rich.vocalists.join(', ')}</p>
              </div>
            )}
            {rich.release_year && (
              <div className="mb-2">
                <span className="text-sm font-semibold text-purple-700">{uiText("Released")}</span>
                <p className="text-base">{rich.release_year}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. Audio clips */}
      {item.audio_urls != null && item.audio_urls.length > 0 && (
        <section data-checkpoint="audio" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Listen")}</h2>
          {item.audio_urls.map((entry, index) => (
            <AudioPlayer
              key={index}
              src={entry.url}
              label={entry.label}
              onPlay={() => { onMediaInteract?.(); }}
            />
          ))}
        </section>
      )}

      {/* 4. YouTube */}
      {youtubeId != null && (
        <section data-checkpoint="video" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Watch")}</h2>
          <div onClick={() => { onMediaInteract?.(); }}>
            <YouTubeEmbed videoId={youtubeId} />
          </div>
        </section>
      )}

      {item.youtube_url && youtubeId == null && (
        <section data-checkpoint="video" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Listen")}</h2>
          <a
            href={item.youtube_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
            onClick={() => { onMediaInteract?.(); }}
          >
            {uiText("Search this song on YouTube")}</a>
        </section>
      )}

      {/* 5. Related Movies */}
      {rich.related_movie_ids && rich.related_movie_ids.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Featured in Movies")}</h2>
          <div
            className="overflow-x-auto flex gap-4 pb-2 -mx-4 px-4"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
            role="list"
          >
            {rich.related_movie_ids.map((movieId) => (
              <Link
                key={movieId}
                to={`/items/${movieId}`}
                className="shrink-0 w-[140px] min-h-[64px] rounded-2xl bg-purple-50 border border-purple-100 p-3 flex items-center justify-center active:scale-95 transition-transform duration-150"
                style={{ scrollSnapAlign: 'start' }}
                role="listitem"
              >
                <span className="text-sm font-semibold text-center">{uiText("Movie")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default MusicDetail;
