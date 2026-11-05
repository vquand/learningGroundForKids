import { getRecipeIngredient, type FoodDrinkCupOption, type FoodDrinkIngredient, type FoodDrinkRecipe } from "./foodAndDrinkConfig";

interface CupPreviewProps {
  recipe: FoodDrinkRecipe;
  cup: FoodDrinkCupOption;
  fillLevel: number;
  addedIngredientIds: readonly string[];
}

function getGarnishes(recipe: FoodDrinkRecipe, addedIngredientIds: readonly string[]): FoodDrinkIngredient[] {
  const added = new Set(addedIngredientIds);
  return recipe.steps
    .filter((step) => step.kind === "decorate" && added.has(step.expectedIngredientId))
    .map((step) => getRecipeIngredient(recipe, step.expectedIngredientId))
    .filter((ingredient): ingredient is FoodDrinkIngredient => Boolean(ingredient));
}

export function CupPreview({ recipe, cup, fillLevel, addedIngredientIds }: CupPreviewProps) {
  const garnishes = getGarnishes(recipe, addedIngredientIds);

  return (
    <div className={`food-drink-cup food-drink-cup--${cup.size}`} aria-label={`${cup.label}, ${Math.round(fillLevel * 100)} percent full`}>
      <span className="food-drink-cup__interior" aria-hidden="true">
        <span className={`food-drink-cup__fill food-drink-cup__fill--${recipe.id}`} style={{ height: `calc(var(--cup-fill-height) * ${Math.max(0, Math.min(1, fillLevel))})` }} aria-hidden="true" />
      </span>
      <img className="food-drink-cup__glass" src={cup.imagePath} alt="" aria-hidden="true" />
      {garnishes.map((garnish) => (
        <img
          className={`food-drink-cup__garnish food-drink-cup__garnish--${garnish.id}`}
          key={garnish.id}
          src={garnish.imagePath}
          alt=""
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
