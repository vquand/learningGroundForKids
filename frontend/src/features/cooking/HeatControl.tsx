import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { CookingHeatLevel } from "./cookingConfig";
import { HEAT_LEVEL_PRESENTATION } from "./heatPresentation";

interface HeatControlProps {
  onSelect: (level: CookingHeatLevel) => void;
  stationKind?: string;
  selectedLevel?: CookingHeatLevel | null;
}

export function HeatControl({ onSelect, stationKind = "pan", selectedLevel }: HeatControlProps) {
  useUiLanguage();
  return (
    <section className="cooking-heat" aria-labelledby="cooking-heat-title">
      <div>
        <p className="cooking-kicker">{uiText("Heat control")}</p>
        <h3 id="cooking-heat-title">{uiText("How hot should the ")}{stationKind} {uiText(" be?")}</h3>
      </div>
      <div className="cooking-heat__choices">
        {HEAT_LEVEL_PRESENTATION.map(({ level, accessibleLabel, flameSize, colorToken }) => (
          <button
            type="button"
            className={`cooking-heat-option cooking-heat-option--${colorToken}`}
            key={level}
            aria-label={accessibleLabel}
            aria-pressed={selectedLevel === undefined ? undefined : selectedLevel === level}
            onClick={() => onSelect(level)}
          >
            <svg
              className="cooking-heat-option__flame"
              width={flameSize}
              height={Math.round(flameSize * 1.24)}
              viewBox="0 0 64 80"
              aria-hidden="true"
            >
              <path
                className="cooking-heat-option__flame-outer"
                d="M35 3c2 15-8 17-6 30 1 6 6 8 8 13 3-5 5-12 3-20 13 9 21 22 19 35-2 12-12 19-27 19C14 80 4 69 5 54 6 39 17 31 23 18c3 8 2 15 0 21C31 30 36 20 35 3Z"
              />
              <path
                className="cooking-heat-option__flame-inner"
                d="M33 43c1 8-7 11-6 19 1 5 4 8 8 8 6 0 10-4 10-10 0-6-4-11-8-15 0 5-1 8-3 10-2-3-2-7-1-12Z"
              />
            </svg>
          </button>
        ))}
      </div>
      <p className="cooking-heat__hint" aria-live="polite">{uiText("Choose one heat level to continue.")}</p>
    </section>
  );
}
