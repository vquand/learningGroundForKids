import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ItemDetail, FoodRichFields } from '../../types/item';
import { TTSButton } from './TTSButton';
import YouTubeEmbed from './YouTubeEmbed';
import { extractYouTubeId } from './utils';

interface FoodDetailProps {
  item: ItemDetail;
  onMediaInteract?: () => void;
}

export function FoodDetail({ item, onMediaInteract }: FoodDetailProps) {
  useUiLanguage();
  const lang = item.translation?.lang ?? 'en';
  const rich = (item.rich_fields ?? {}) as FoodRichFields;
  const youtubeId = item.youtube_url ? extractYouTubeId(item.youtube_url) : null;

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

      {/* 2. Origin Info */}
      {(rich.origin_date || rich.inventor) && (
        <section data-checkpoint="origin" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Where It Comes From")}</h2>
          <div className="flex flex-wrap gap-6 rounded-2xl bg-amber-50/50 p-4">
            {rich.origin_date && (
              <div>
                <span className="text-sm font-semibold text-amber-700">
                  {'\uD83D\uDCC5'} {uiText("Origin Date")}</span>
                <p className="text-base">{rich.origin_date}</p>
              </div>
            )}
            {rich.inventor && (
              <div>
                <span className="text-sm font-semibold text-amber-700">
                  {'\uD83D\uDC64'} {uiText("Inventor")}</span>
                <p className="text-base">{rich.inventor}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. History */}
      {item.translation?.history != null && (
        <section data-checkpoint="history" className="mb-6">
          <div className="flex items-center justify-between mt-6 mb-3">
            <h2 className="text-xl font-bold">{uiText("History")}</h2>
            <TTSButton text={item.translation.history} lang={lang} />
          </div>
          <p className="text-base leading-relaxed text-gray-700 min-h-[2rem]">
            {item.translation.history}
          </p>
        </section>
      )}

      {/* 4. Ingredients Table */}
      {rich.ingredients != null && rich.ingredients.length > 0 && (
        <section data-checkpoint="ingredients" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Ingredients")}</h2>
          <div className="rounded-2xl bg-amber-50 p-4 max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-amber-50 z-10">
                <tr>
                  <th className="py-2 pr-4 text-sm font-bold text-amber-800 text-left">{uiText("Ingredient")}</th>
                  <th className="py-2 text-sm font-bold text-amber-800 text-left">{uiText("Quantity")}</th>
                </tr>
              </thead>
              <tbody>
                {rich.ingredients.map((ing, idx) => (
                  <tr key={idx} className="border-b border-amber-50">
                    <td className="py-2 pr-4 text-base">{ing.name}</td>
                    <td className="py-2 text-base text-gray-600">{ing.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. Recipe Steps (rich) or plain recipe fallback */}
      {rich.recipe_steps != null && rich.recipe_steps.length > 0 ? (
        <section data-checkpoint="recipe" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("How to Make It")}</h2>
          <div className="rounded-2xl bg-amber-50/50 p-4">
            <ol className="list-none m-0 p-0">
              {rich.recipe_steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 mb-4 last:mb-0">
                  <span className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 font-bold text-sm flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-base leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : item.recipe != null ? (
        <section data-checkpoint="recipe" className="mb-6">
          <div className="flex items-center justify-between mt-6 mb-3">
            <h2 className="text-xl font-bold">{uiText("Recipe")}</h2>
            <TTSButton text={item.recipe} lang={lang} />
          </div>
          <p className="whitespace-pre-line bg-amber-50 rounded-2xl p-4 text-base">
            {item.recipe}
          </p>
        </section>
      ) : null}

      {/* 6. YouTube Embed */}
      {youtubeId && (
        <section data-checkpoint="video" className="mb-6">
          <h2 className="text-xl font-bold mt-6 mb-3">{uiText("Watch")}</h2>
          <div onClick={() => { onMediaInteract?.(); }}>
            <YouTubeEmbed videoId={youtubeId} title={uiText("Video")} />
          </div>
        </section>
      )}

      {/* 7. Fun Facts */}
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

export default FoodDetail;
