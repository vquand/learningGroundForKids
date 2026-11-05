import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText, uiMessage } from '../../i18n/uiText';
import { CupPreview } from "./CupPreview";
import type { FoodDrinkCupOption, FoodDrinkRecipe } from "./foodAndDrinkConfig";

interface FoodDrinkSuccessProps {
  recipe: FoodDrinkRecipe;
  cup: FoodDrinkCupOption;
  addedIngredientIds: readonly string[];
  onRestart: () => void;
  onChooseAnother: () => void;
}

export function FoodDrinkSuccess({ recipe, cup, addedIngredientIds, onRestart, onChooseAnother }: FoodDrinkSuccessProps) {
  useUiLanguage();
  return (
    <section className="food-drink-success" aria-labelledby="food-drink-success-title">
      <div className="food-drink-success__cup-preview">
        <CupPreview recipe={recipe} cup={cup} fillLevel={1} addedIngredientIds={addedIngredientIds} />
      </div>
      <img
        className="food-drink-success__art"
        src="/minigames/food-and-drink/capybara/capybara-celebrate.png"
        alt=""
        aria-hidden="true"
      />
      <p className="food-drink-eyebrow">{uiText("Recipe complete")}</p>
      <h2 id="food-drink-success-title">{uiMessage("Your {drink} is ready!", {drink:uiText(recipe.title)})}</h2>
      <p className="food-drink-success__copy">{uiText("You made every step your own. Give your drink a pretend sip and enjoy!")}</p>
      <div className="food-drink-success__actions">
        <button type="button" className="food-drink-primary-button" onClick={onRestart}>{uiText("Make it again")}</button>
        <button type="button" className="food-drink-secondary-button" onClick={onChooseAnother}>{uiText("Choose another recipe")}</button>
      </div>
    </section>
  );
}
