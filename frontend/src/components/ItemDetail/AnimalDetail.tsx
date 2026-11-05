import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ItemDetail, AnimalRichFields } from '../../types/item';
import { TTSButton } from './TTSButton';
import YouTubeEmbed from './YouTubeEmbed';
import { extractYouTubeId } from './utils';

interface AnimalDetailProps {
  item: ItemDetail;
  onMediaInteract?: () => void;
}

const CLASSIFICATION_EMOJI: Record<string, string> = {
  mammal: '\uD83D\uDC3E',
  insect: '\uD83D\uDC1B',
  fish: '\uD83D\uDC1F',
  bird: '\uD83D\uDC26',
  reptile: '\uD83E\uDD8E',
  amphibian: '\uD83D\uDC38',
};

const ENDANGERED_COLORS: Record<string, string> = {
  'Extinct': 'bg-gray-800 text-white',
  'Critically Endangered': 'bg-red-600 text-white',
  'Endangered': 'bg-orange-500 text-white',
  'Vulnerable': 'bg-yellow-500 text-gray-800',
  'Near Threatened': 'bg-yellow-300 text-gray-800',
  'Least Concern': 'bg-green-500 text-white',
};

export function AnimalDetail({ item, onMediaInteract }: AnimalDetailProps) {
  useUiLanguage();
  const lang = item.translation?.lang ?? 'en';
  const rich = (item.rich_fields ?? {}) as AnimalRichFields;
  const youtubeId = item.youtube_url ? extractYouTubeId(item.youtube_url) : null;
  const isExtinct = rich.endangered_status === 'Extinct';

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

      {/* 2. Classification + Population row */}
      {(rich.classification || rich.population) && (
        <section data-checkpoint="classification" className="mb-6">
          <div className="flex flex-wrap items-start gap-3">
            {rich.classification && (
              <span className="rounded-full px-3 py-1 text-sm font-semibold bg-green-100 text-green-700">
                {CLASSIFICATION_EMOJI[rich.classification.toLowerCase()] ?? ''} {rich.classification}
              </span>
            )}
            {rich.population && (
              <div className={`rounded-2xl p-4 flex-1 min-w-[200px] ${isExtinct ? 'bg-gray-100 text-gray-800' : 'bg-green-50'}`}>
                <span className={`text-sm font-semibold ${isExtinct ? 'text-gray-600' : 'text-green-700'}`}>{uiText("How Many Are There?")}</span>
                <p className="text-lg font-bold">{rich.population}</p>
                {rich.endangered_status && (
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold inline-block mt-2 ${ENDANGERED_COLORS[rich.endangered_status] ?? 'bg-gray-200 text-gray-700'}`}>
                    {rich.endangered_status}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. Habitat */}
      {item.location_desc != null && (
        <section data-checkpoint="habitat" className="mb-6">
          <div className="flex items-center justify-between mt-6 mb-3">
            <h2 className="text-xl font-bold">{uiText("Habitat")}</h2>
            <TTSButton text={item.location_desc} lang={lang} />
          </div>
          <p className="text-base text-gray-600 bg-green-50 rounded-2xl p-4">
            {'\uD83C\uDF3F'} {item.location_desc}
          </p>
        </section>
      )}

      {/* 4. YouTube Embed */}
      {youtubeId && (
        <section data-checkpoint="video" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Watch")}</h2>
          <div onClick={() => { onMediaInteract?.(); }}>
            <YouTubeEmbed videoId={youtubeId} title={uiText("Video")} />
          </div>
        </section>
      )}

      {/* 5. Fun Facts */}
      {item.fun_facts != null && item.fun_facts.length > 0 && (
        <section data-checkpoint="fun-facts" className="mb-6">
          <div className="flex items-center justify-between mt-6 mb-3">
            <h2 className="text-xl font-bold">{uiText("Fun Facts")}</h2>
            <TTSButton text={item.fun_facts.join('. ')} lang={lang} />
          </div>
          <ul className="list-disc list-inside">
            {item.fun_facts.map((fact, index) => (
              <li key={index} className="text-base leading-relaxed py-1">
                {fact}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default AnimalDetail;
