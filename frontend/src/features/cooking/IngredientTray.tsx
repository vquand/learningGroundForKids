import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { DragEvent } from "react";
import type { CookingIngredient } from "./cookingConfig";

interface IngredientTrayProps {
  ingredients: readonly CookingIngredient[];
  selectedIngredientId: string | null;
  onSelect: (ingredientId: string) => void;
}

export function IngredientTray({ ingredients, selectedIngredientId, onSelect }: IngredientTrayProps) {
  useUiLanguage();
  const titleId = "cooking-tray-title";
  function handleDragStart(event: DragEvent<HTMLButtonElement>, ingredientId: string) {
    event.dataTransfer.setData("text/plain", ingredientId);
    event.dataTransfer.effectAllowed = "copy";
    onSelect(ingredientId);
  }

  return (
    <aside className="cooking-tray" aria-labelledby={titleId}>
      <div className="cooking-tray__intro">
        <p className="cooking-kicker">{uiText("Ingredient tray")}</p>
        <h3 id={titleId}>{uiText("Ready to add")}</h3>
      </div>
      <ul className="cooking-ingredient-list" aria-label={uiText("Ingredients ready to add")}>
        {ingredients.map((ingredient) => {
          const selected = selectedIngredientId === ingredient.id;
          return (
            <li key={ingredient.id}>
              <button
                type="button"
                className={`cooking-ingredient${selected ? " cooking-ingredient--selected" : ""}`}
                draggable
                onClick={() => onSelect(ingredient.id)}
                onDragStart={(event) => handleDragStart(event, ingredient.id)}
                aria-pressed={selected}
                aria-label={`${uiText(ingredient.label)}, ${ingredient.width} by ${ingredient.height} squares`}
                title={`${uiText(ingredient.label)} · ${ingredient.width} × ${ingredient.height} squares`}
              >
                <span
                  className="cooking-ingredient__shape"
                  style={{ aspectRatio: `${ingredient.width} / ${ingredient.height}` }}
                >
                  <img src={ingredient.imagePath} alt="" aria-hidden="true" />
                </span>
                <span className="cooking-ingredient__name">{uiText(ingredient.label)}</span>
                <span className="cooking-ingredient__size">
                  {ingredient.width} × {ingredient.height}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="cooking-tray__hint">{uiText("Drag it in, or tap it and choose a square.")}</p>
    </aside>
  );
}
