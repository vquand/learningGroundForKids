import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { FoodDrinkCupOption } from "./foodAndDrinkConfig";

interface CupPickerProps {
  cups: readonly FoodDrinkCupOption[];
  selectedId: string;
  onSelect: (cup: FoodDrinkCupOption) => void;
}

export function CupPicker({ cups, selectedId, onSelect }: CupPickerProps) {
  useUiLanguage();
  return (
    <fieldset className="food-drink-cup-picker">
      <legend>{uiText("Choose any cup")}</legend>
      <div>
        {cups.map((cup) => (
          <button
            key={cup.id}
            type="button"
            aria-pressed={cup.id === selectedId}
            aria-label={uiText(cup.label)}
            className={cup.id === selectedId ? "food-drink-cup-choice food-drink-cup-choice--selected" : "food-drink-cup-choice"}
            onClick={() => onSelect(cup)}
          >
            <img src={cup.imagePath} alt="" aria-hidden="true" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
