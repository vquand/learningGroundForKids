import { useState } from "react";
import type { FoodDrinkIngredient } from "./foodAndDrinkConfig";

interface IngredientButtonProps {
  ingredient: FoodDrinkIngredient;
  onSelect: (ingredientId: string) => void;
  disabled?: boolean;
  variant?: "card" | "shelf";
}

export function IngredientButton({ ingredient, onSelect, disabled = false, variant = "card" }: IngredientButtonProps) {
  const [imageBroken, setImageBroken] = useState(false);
  return (
    <button
      type="button"
      className={`food-drink-ingredient food-drink-ingredient--${variant}`}
      onClick={() => onSelect(ingredient.id)}
      disabled={disabled}
      aria-label={`${ingredient.label}: ${ingredient.hint}`}
    >
      <span className="food-drink-ingredient__art" aria-hidden="true">
        {!imageBroken && (
          <img
            src={ingredient.imagePath}
            alt=""
            loading="lazy"
            onError={() => setImageBroken(true)}
          />
        )}
        {imageBroken && <span>{ingredient.emoji}</span>}
      </span>
      <span className="food-drink-ingredient__label">{ingredient.label}</span>
    </button>
  );
}
