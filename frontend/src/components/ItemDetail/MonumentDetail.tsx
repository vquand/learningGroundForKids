import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ItemDetail, MonumentRichFields } from '../../types/item';
import { TTSButton } from './TTSButton';

interface MonumentDetailProps {
  item: ItemDetail;
}

const DIMENSION_EMOJI: Record<string, string> = {
  height: '\uD83D\uDCCF',
  width: '\u2194\uFE0F',
  area: '\u2B1B',
};

export function MonumentDetail({ item }: MonumentDetailProps) {
  useUiLanguage();
  const lang = item.translation?.lang ?? 'en';
  const rich = (item.rich_fields ?? {}) as MonumentRichFields;

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

      {/* 2. Builder Info */}
      {(rich.ordered_by || rich.designed_by || rich.construction_date) && (
        <section data-checkpoint="builder-info" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Who Built It?")}</h2>
          <div className="rounded-2xl bg-blue-50/50 p-4 flex flex-col gap-2">
            {rich.ordered_by && (
              <div>
                <span className="text-sm font-semibold text-blue-600">{uiText("Ordered by")}</span>
                <p className="text-base">{rich.ordered_by}</p>
              </div>
            )}
            {rich.designed_by && (
              <div>
                <span className="text-sm font-semibold text-blue-600">{uiText("Designed by")}</span>
                <p className="text-base">{rich.designed_by}</p>
              </div>
            )}
            {rich.construction_date && (
              <div>
                <span className="text-sm font-semibold text-blue-600">{uiText("Built")}</span>
                <p className="text-base">{rich.construction_date}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. Dimensions Card */}
      {rich.dimensions && Object.keys(rich.dimensions).length > 0 && (
        <section data-checkpoint="dimensions" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("How Big Is It?")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(rich.dimensions).map(([key, value]) => (
              <div key={key} className="rounded-xl bg-blue-50 p-4">
                <span className="text-sm font-semibold text-blue-700">
                  {DIMENSION_EMOJI[key.toLowerCase()] ?? '\u2B50'} {key}
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
          <p className="text-base text-gray-600 bg-blue-50 rounded-2xl p-4">
            {'\uD83D\uDCCD'} {item.location_desc}
          </p>
        </section>
      )}

      {/* 5. Floor Plan Image */}
      {rich.floor_plan_url && (
        <section data-checkpoint="floor-plan" className="mb-6">
          <img
            src={rich.floor_plan_url}
            alt={uiText("Floor Plan")}
            loading="lazy"
            className="w-full rounded-2xl"
          />
          <p className="text-sm text-gray-500 italic text-center mt-2">{uiText("Floor Plan")}</p>
        </section>
      )}

      {/* 6. Fun Facts */}
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

export default MonumentDetail;
