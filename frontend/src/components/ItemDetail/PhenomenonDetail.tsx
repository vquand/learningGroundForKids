import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ItemDetail, PhenomenonRichFields } from '../../types/item';
import { TTSButton } from './TTSButton';

interface PhenomenonDetailProps {
  item: ItemDetail;
}

const METRIC_EMOJI: Record<string, string> = {
  wind_speed: '\uD83D\uDCA8',
  temperature: '\uD83C\uDF21\uFE0F',
  richter_scale: '\uD83C\uDF0B',
  speed: '\uD83D\uDE80',
  size: '\uD83D\uDCCF',
};

export function PhenomenonDetail({ item }: PhenomenonDetailProps) {
  useUiLanguage();
  const lang = item.translation?.lang ?? 'en';
  const rich = (item.rich_fields ?? {}) as PhenomenonRichFields;

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

      {/* 2. Kid Metrics */}
      {rich.kid_metrics && Object.keys(rich.kid_metrics).length > 0 && (
        <section data-checkpoint="kid-metrics" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Cool Numbers")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(rich.kid_metrics).map(([key, value]) => (
              <div key={key} className="rounded-xl bg-orange-50 p-4">
                <span className="text-sm font-semibold text-orange-700">
                  {METRIC_EMOJI[key.toLowerCase()] ?? '\u26A1'} {key}
                </span>
                <p className="text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Fun Facts */}
      {item.fun_facts != null && item.fun_facts.length > 0 && (
        <section data-checkpoint="fun-facts" className="mb-6">
          <div className="flex items-center justify-between mt-6 mb-3">
            <h2 className="text-xl font-bold">{uiText("Fun Facts")}</h2>
            <TTSButton text={item.fun_facts.join('. ')} lang={lang} />
          </div>
          <ul className="list-disc list-inside bg-orange-50 rounded-2xl p-4">
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

export default PhenomenonDetail;
