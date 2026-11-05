import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { CSSProperties } from "react";
import { getRecipeIngredient, getRecipeIngredients, type FoodDrinkCupOption, type FoodDrinkIngredient, type FoodDrinkStep, type FoodDrinkRecipe } from "./foodAndDrinkConfig";
import { CapybaraAvatar, type CapybaraAction } from "./CapybaraAvatar";
import { CupPicker } from "./CupPicker";
import { CupPreview } from "./CupPreview";
import { IngredientButton } from "./IngredientButton";

interface DrinkSceneProps {
  recipe: FoodDrinkRecipe;
  currentStep: FoodDrinkStep | undefined;
  avatarAction: CapybaraAction;
  onSelect: (ingredientId: string) => void;
  cup: FoodDrinkCupOption;
  cupOptions: readonly FoodDrinkCupOption[];
  fillLevel: number;
  addedIngredientIds: readonly string[];
  onCupSelect: (cup: FoodDrinkCupOption) => void;
}

function DecorativeShelf({ ingredients }: { ingredients: readonly FoodDrinkIngredient[] }) {
  useUiLanguage();
  return (
    <section className="food-drink-decorative-shelf" aria-label={uiText("Recipe ingredients on the open shelf")}>
      <div className="food-drink-decorative-shelf__scroll" aria-hidden="true">
        {ingredients.map((ingredient) => (
          <span className="food-drink-decorative-shelf__item" key={ingredient.id}>
            <img src={ingredient.imagePath} alt="" />
          </span>
        ))}
      </div>
    </section>
  );
}

function machineForRecipe(recipe: FoodDrinkRecipe) {
  if (recipe.id === "mint-tea") return "/minigames/food-and-drink/kitchen/kettle.png";
  if (recipe.id === "iced-coffee") return "/minigames/food-and-drink/kitchen/coffee-machine-boxy.png";
  return "/minigames/food-and-drink/kitchen/blender-boxy.png";
}

function ingredientForStep(recipe: FoodDrinkRecipe, step: FoodDrinkStep) {
  return getRecipeIngredient(recipe, step.expectedIngredientId);
}

export function DrinkScene({ recipe, currentStep, avatarAction, onSelect, cup, cupOptions, fillLevel, addedIngredientIds, onCupSelect }: DrinkSceneProps) {
  useUiLanguage();
  const currentStepIndex = currentStep ? recipe.steps.indexOf(currentStep) : recipe.steps.length;
  const shelfIngredients = getRecipeIngredients(recipe, "shelf");
  const dispenserIngredients = getRecipeIngredients(recipe, "dispenser");
  const choices = getRecipeIngredients(recipe);

  return (
    <section className="food-drink-scene" aria-label={uiText("Drink making station")}>
      <div className="food-drink-kitchen-wall">
        <DecorativeShelf ingredients={shelfIngredients} />
        <div className="food-drink-machine-zone" aria-label={uiText("Large kitchen appliances")}>
          <div className="food-drink-machine-grid">
            <div
              className="food-drink-machine-unit food-drink-machine-unit--fridge"
              aria-hidden="true"
            >
              <img src="/minigames/food-and-drink/kitchen/mint-refrigerator-boxy.png" alt="" />
            </div>
            <div
              className={`food-drink-machine-unit food-drink-machine-unit--water${dispenserIngredients.length > 0 ? "" : " food-drink-machine-unit--disabled"}`}
              aria-hidden={dispenserIngredients.length === 0}
            >
              <img src="/minigames/food-and-drink/kitchen/water-dispenser-kit-boxy.png" alt="" />
            </div>
          </div>
        </div>
        <div className={`food-drink-small-machine-zone food-drink-small-machine-zone--${recipe.id}`} aria-label={uiText("Small kitchen appliance")}>
          <div className="food-drink-small-machine-cabinet" aria-hidden="true">
            <span className="food-drink-small-machine-cabinet__side food-drink-small-machine-cabinet__side--left" />
            <span className="food-drink-small-machine-cabinet__side food-drink-small-machine-cabinet__side--right" />
          </div>
          <div className="food-drink-machine-unit food-drink-machine-unit--recipe">
            <img src={machineForRecipe(recipe)} alt="" aria-hidden="true" />
          </div>
        </div>
        <div className="food-drink-helper" aria-hidden="true">
          <CapybaraAvatar action={avatarAction} />
        </div>
      </div>

      <div className="food-drink-counter">
        <div className="food-drink-counter__front" aria-hidden="true" />
        <div className="food-drink-cup-area">
          <CupPreview recipe={recipe} cup={cup} fillLevel={fillLevel} addedIngredientIds={addedIngredientIds} />
        </div>
        <div className="food-drink-step-card" aria-live="polite" style={{ "--step-accent": recipe.accent } as CSSProperties}>
          <span className="food-drink-step-card__number" aria-hidden="true">{currentStep ? uiText(currentStep.label) : uiText("Ready")}</span>
          <p>{uiText(currentStep?.instruction ?? "Your drink is ready!")}</p>
        </div>
        <CupPicker cups={cupOptions} selectedId={cup.id} onSelect={onCupSelect} />
      </div>

      <section className="food-drink-choice-panel" aria-labelledby="food-drink-choice-title">
        <p className="food-drink-eyebrow">{uiText("Choose next")}</p>
        <h3 id="food-drink-choice-title">{uiText("What goes in?")}</h3>
        <div className="food-drink-choice-grid" role="list">
          {choices.map((ingredient) => (
            <IngredientButton key={ingredient.id} ingredient={ingredient} onSelect={onSelect} />
          ))}
        </div>
      </section>

      <div className="food-drink-process" aria-label={`Recipe path for ${uiText(recipe.title)}`}>
        <div className="food-drink-process__item food-drink-process__item--cup" aria-label={uiText("Choose a cup")}>
          <img src={cup.imagePath} alt="" aria-hidden="true" />
          <span>{uiText("Cup")}</span>
        </div>
        {recipe.steps.map((step, index) => {
          const ingredient = ingredientForStep(recipe, step);
          const isCurrent = index === currentStepIndex;
          const isDone = index < currentStepIndex;
          const actionAsset = step.kind === "mix" ? "/minigames/food-and-drink/kitchen/spoon.png" : ingredient?.imagePath;
          return (
            <div className="food-drink-process__segment" key={step.id}>
              <span className="food-drink-process__arrow" aria-hidden="true">→</span>
              <div
                className={`food-drink-process__item${isCurrent ? " food-drink-process__item--current" : ""}${isDone ? " food-drink-process__item--done" : ""}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {actionAsset ? <img src={actionAsset} alt="" aria-hidden="true" /> : <span aria-hidden="true">{ingredient?.emoji ?? "•"}</span>}
                <span>{uiText(step.label)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
