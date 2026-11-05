import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { CSSProperties } from "react";
import type { FoodDrinkRecipe } from "./foodAndDrinkConfig";

interface RecipePickerProps {
  recipes: readonly FoodDrinkRecipe[];
  selectedId: string;
  onSelect: (recipe: FoodDrinkRecipe) => void;
}

export function RecipePicker({ recipes, selectedId, onSelect }: RecipePickerProps) {
  useUiLanguage();
  return (
    <section className="food-drink-recipes" aria-labelledby="food-drink-recipes-title">
      <div>
        <p className="food-drink-eyebrow">{uiText("Pick a recipe")}</p>
        <h2 id="food-drink-recipes-title" className="food-drink-section-title">{uiText("What shall we make?")}</h2>
      </div>
      <div className="food-drink-recipe-list" role="list">
        {recipes.map((recipe) => {
          const selected = recipe.id === selectedId;
          return (
            <button
              key={recipe.id}
              type="button"
              role="listitem"
              className={`food-drink-recipe-card${selected ? " food-drink-recipe-card--selected" : ""}`}
              style={{ "--recipe-accent": recipe.accent } as CSSProperties}
              aria-pressed={selected}
              onClick={() => onSelect(recipe)}
            >
              <span className="food-drink-recipe-card__drink" aria-hidden="true">
                {recipe.id === "lemonade" ? "🍋" : recipe.id === "mint-tea" ? "🌿" : "☕"}
              </span>
              <span className="food-drink-recipe-card__copy">
                <span className="food-drink-recipe-card__title">{uiText(recipe.title)}</span>
                <span className="food-drink-recipe-card__meta">{recipe.difficulty}</span>
              </span>
              {selected && <span className="food-drink-recipe-card__check" aria-label={uiText("Selected")}>✓</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
