import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ItemDetail, LandmarkRichFields } from '../../types/item';
import { TTSButton } from './TTSButton';

interface LandmarkDetailProps {
  item: ItemDetail;
}

const STAT_EMOJI: Record<string, string> = {
  height: '\uD83D\uDCCF',
  width: '\u2194\uFE0F',
  depth: '\u2B07\uFE0F',
  area: '\u2B1B',
};

export function LandmarkDetail({ item }: LandmarkDetailProps) {
  useUiLanguage();
  const lang = item.translation?.lang ?? 'en';
  const rich = (item.rich_fields ?? {}) as LandmarkRichFields;

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

      {/* 2. Country */}
      {item.country_code && (
        <section data-checkpoint="country" className="mb-6">
          <span className="rounded-full px-3 py-1 text-sm font-semibold bg-green-100 text-green-700">
            {item.country_code}
          </span>
        </section>
      )}

      {/* 3. Key Stats Grid */}
      {rich.key_stats && Object.keys(rich.key_stats).length > 0 && (
        <section data-checkpoint="key-stats" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Key Facts")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(rich.key_stats).map(([key, value]) => (
              <div key={key} className="rounded-xl bg-green-50 p-4">
                <span className="text-sm font-semibold text-green-700">
                  {STAT_EMOJI[key.toLowerCase()] ?? '\u2B50'} {key}
                </span>
                <p className="text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Location */}
      {item.location_desc != null && (
        <section data-checkpoint="location" className="mb-6">
          <div className="flex items-center justify-between mt-6 mb-3">
            <h2 className="text-xl font-bold">{uiText("Location")}</h2>
            <TTSButton text={item.location_desc} lang={lang} />
          </div>
          <p className="text-base text-gray-600 bg-green-50 rounded-2xl p-4">
            {'\uD83D\uDCCD'} {item.location_desc}
          </p>
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

export default LandmarkDetail;
