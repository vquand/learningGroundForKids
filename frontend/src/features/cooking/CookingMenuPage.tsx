import { KidBackButton } from "../../components/KidBackButton";
import { useQuery } from '@tanstack/react-query';
import { fetchKitchenCompletions } from '../../api/kitchenCompletions';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { KitchenCompletionMedal } from './KitchenCompletionMedal';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../../components/Layout/AppShell";
import { FOOD_AND_DRINK_RECIPES } from "../food-and-drink/foodAndDrinkConfig";
import { COOKING_MEALS } from "./cookingMeals";
import { BurgerSprite } from "./burger/BurgerSprite";
import "./cooking.css";
import { MealArt } from "./cabbage-rolls/CabbageArt";
import "./cabbage-rolls/cabbage.css";

export function CookingMenuPage() {
  useUiLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const familyId = useFamilyStore(state => state.familyId);
  const generation = useFamilyStore(state => state.sessionGeneration);
  const profileId = useProfileStore(state => state.activeProfileId);
  const practice = location.pathname.startsWith('/uat/');
  const completions = useQuery({
    queryKey: familyQueryKey('kitchen-completions', familyId, generation, profileId),
    queryFn: familyScopedQuery(familyId, () => fetchKitchenCompletions(profileId!)),
    enabled: !!familyId && !!profileId && !practice,
    refetchOnMount: 'always', retry: false,
  });
  const counts = !practice && !completions.isError ? completions.data?.counts ?? {} : {};
  const cookingPath = location.pathname.startsWith("/uat/") ? "/uat/cooking" : "/cooking";
  const drinkPath = location.pathname.startsWith("/uat/") ? "/uat/food-and-drink" : "/food-and-drink";
  const backPath = location.pathname.startsWith("/uat/") ? "/uat" : "/playground";

  return (
    <AppShell>
      <main className="cooking-page cooking-menu-page">
        <header className="cooking-header cooking-menu-header kid-nav">
          <KidBackButton to={backPath}/>
          <div className="cooking-brand">
            <span className="cooking-brand__icon" aria-hidden="true">🍳</span>
            <div>
              <p className="cooking-kicker">{uiText("Little kitchen")}</p>
              <h1>{uiText("Cooking &amp; Drinks")}</h1>
            </div>
          </div>
        </header>

        <section className="cooking-menu-shell" aria-labelledby="cooking-menu-title">
          <div className="cooking-menu-intro">
            <div>
              <p className="cooking-kicker">{uiText("Today’s kitchen board")}</p>
              <h2 id="cooking-menu-title">{uiText("What shall we make?")}</h2>
              <p>{uiText("Choose a meal or drink. Every recipe has its own little kitchen rhythm.")}</p>
            </div>
            <span className="cooking-menu-intro__spark" aria-hidden="true">✦</span>
          </div>

          {completions.isError && !practice && <p role="status" className="cooking-counts-error">
            {uiText('Meal counts couldn’t load.')} <button type="button" onClick={() => void completions.refetch()}>{uiText('Try again')}</button>
          </p>}
          <ul className="cooking-menu-grid" aria-label={uiText("Available meals and drinks")}>
            {COOKING_MEALS.map((meal) => {
              const available = meal.availability === "available";
              const recipeId = meal.id === 'hamburger' ? 'burger' : meal.recipeId ?? meal.id;
              const count = counts[recipeId] ?? 0;
              const cardContent = (
                <>
                  <KitchenCompletionMedal count={count} recipeId={recipeId} />
                  <div className={`cooking-meal-card__art cooking-meal-card__art--${meal.id}`}>
                    {meal.id === "cabbage-rolls" ? <MealArt /> : meal.id === "hamburger" ? <BurgerSprite name="cheeseburger" /> : meal.imagePath ? (
                      <img src={meal.imagePath} alt="" aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true">{meal.icon}</span>
                    )}
                  </div>
                  <div className="cooking-meal-card__body">
                    <div className="cooking-meal-card__meta">
                      <span>{uiText(meal.station)}</span>
                      <span>{available ? uiText("Ready to cook") : uiText("Coming soon")}</span>
                    </div>
                    <h3>{uiText(meal.title)}</h3>
                    <p>{uiText(meal.description)}</p>
                    <span className="cooking-meal-card__action">
                      {available ? uiText("Cook this meal") : uiText("Recipe in the works")}
                      {available && <span aria-hidden="true"> →</span>}
                    </span>
                  </div>
                </>
              );

              return (
                <li key={meal.id}>
                  {available ? (
                    <button
                      type="button"
                      className="cooking-meal-card cooking-meal-card--available"
                      onClick={() => navigate(`${cookingPath}/${meal.id}`)}
                      aria-label={`Cook ${uiText(meal.title)}`}
                      aria-describedby={count > 0 ? `kitchen-finished-${recipeId}` : undefined}
                    >
                      {cardContent}
                    </button>
                  ) : (
                    <article className="cooking-meal-card cooking-meal-card--locked" aria-disabled="true">
                      {cardContent}
                    </article>
                  )}
                </li>
              );
            })}
            {FOOD_AND_DRINK_RECIPES.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  className="cooking-meal-card cooking-meal-card--available"
                  onClick={() => navigate(`${drinkPath}/${recipe.id}`)}
                  aria-label={`Make ${uiText(recipe.title)}`}
                  aria-describedby={(counts[recipe.id] ?? 0) > 0 ? `kitchen-finished-${recipe.id}` : undefined}
                >
                  <KitchenCompletionMedal count={counts[recipe.id] ?? 0} recipeId={recipe.id} />
                  <div className={`cooking-meal-card__art cooking-meal-card__art--drink-${recipe.id}`}>
                    <span aria-hidden="true">{recipe.id === "lemonade" ? "🍋" : recipe.id === "mint-tea" ? "🌿" : "☕"}</span>
                  </div>
                  <div className="cooking-meal-card__body">
                    <div className="cooking-meal-card__meta">
                      <span>{uiText("Drink")}</span>
                      <span>{uiText("Ready to mix")}</span>
                    </div>
                    <h3>{uiText(recipe.title)}</h3>
                    <p>{uiText(recipe.description)}</p>
                    <span className="cooking-meal-card__action">{uiText("Mix this drink ")}<span aria-hidden="true">→</span></span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
