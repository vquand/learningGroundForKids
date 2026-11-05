import { MinigameBadgesButton } from '../achievements/MinigameBadgesButton';
import { KidBackButton } from "../../components/KidBackButton";
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { fetchDrink, actDrink } from '../../api/town';
import type { DrinkSession } from '../../../../server/src/town-building/drinks';
import type { Cost } from '../../../../server/src/town-building/game';
import { useProfileStore } from '../../stores/profileStore';
import { getFamilySessionSnapshot, isCurrentFamilySession } from '../../lib/familyQueries';
import { TownRewardBar } from '../town-building/TownRewardBar';
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/Layout/AppShell";
import type { CapybaraAction } from "./CapybaraAvatar";
import { DEFAULT_FOOD_AND_DRINK_RECIPE, FOOD_AND_DRINK_CUP_OPTIONS, getFoodDrinkRecipe, type FoodDrinkCupOption, type FoodDrinkRecipe } from "./foodAndDrinkConfig";
import { createFoodDrinkGame, foodDrinkReducer, type FoodDrinkGameAction } from "./foodAndDrinkGame";
import { DrinkScene } from "./DrinkScene";
import { FoodDrinkSuccess } from "./FoodDrinkSuccess";
import "./foodAndDrink.css";

function actionForStep(kind: string | undefined): Exclude<CapybaraAction, "wrong"> {
  if (kind === "assemble") return "pour";
  if (kind === "mix") return "stir";
  if (kind === "decorate") return "celebrate";
  return "waiting";
}

export function FoodAndDrinkPage() {
  useUiLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { recipeId } = useParams<{ recipeId: string }>();
  const requestedRecipe = getFoodDrinkRecipe(recipeId ?? "");
  const kitchenPath = location.pathname.startsWith("/uat/") ? "/uat/kitchen" : "/kitchen";
  const [recipe, setRecipe] = useState<FoodDrinkRecipe>(DEFAULT_FOOD_AND_DRINK_RECIPE);
  const [cup, setCup] = useState<FoodDrinkCupOption>(FOOD_AND_DRINK_CUP_OPTIONS[1]!);
  const [game, setGame] = useState(() => createFoodDrinkGame(DEFAULT_FOOD_AND_DRINK_RECIPE));
  const currentStep = recipe.steps[game.stepIndex];
  const profileId=useProfileStore(s=>s.activeProfileId);
  const practice=location.pathname.startsWith('/uat/');
  const remote=useRef<DrinkSession|null>(null);
  const flight=useRef(false);
  const [connectionError,setConnectionError]=useState('');
  const [busy,setBusy]=useState(!practice);
  const [townReward,setTownReward]=useState<Cost>({});
  const [rewardEvent,setRewardEvent]=useState(0);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(practice||!profileId) return;
    let active=true;const snapshot=getFamilySessionSnapshot();setBusy(true);setConnectionError('');remote.current=null;
    void fetchDrink(profileId).then(async saved=>saved.game.recipeId===requestedRecipe.id?saved:await actDrink(profileId,saved.revision,{type:'start',recipeId:requestedRecipe.id as 'lemonade'|'mint-tea'|'iced-coffee'})).then(saved=>{
      if(!active||!isCurrentFamilySession(snapshot)) return;remote.current=saved;setRecipe(getFoodDrinkRecipe(saved.game.recipeId));setGame(saved.game);
    }).catch(e=>{if(active)setConnectionError(e instanceof Error?e.message:'Recipe unavailable.');}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[practice,profileId,requestedRecipe.id,retry]);

  useEffect(() => {
    if (recipe.id === requestedRecipe.id) return;
    setRecipe(requestedRecipe);
    setGame(createFoodDrinkGame(requestedRecipe));
  }, [recipe.id, requestedRecipe]);
  const progressLabel = useMemo(
    () => `${Math.min(game.stepIndex + 1, recipe.steps.length)} of ${recipe.steps.length}`,
    [game.stepIndex, recipe.steps.length],
  );

  function dispatch(action: FoodDrinkGameAction) {
    if(practice){setGame(previous=>foodDrinkReducer(previous,action,recipe));return;}
    if(!profileId||!remote.current||flight.current||busy) return;
    const snapshot=getFamilySessionSnapshot();const saved=remote.current;flight.current=true;setBusy(true);setConnectionError('');
    void actDrink(profileId,saved.revision,action).then(next=>{
      if(!isCurrentFamilySession(snapshot)||useProfileStore.getState().activeProfileId!==profileId) return;
      remote.current=next;setGame(next.game);setTownReward(next.townReward);setRewardEvent(next.revision);
    }).catch(e=>{if(isCurrentFamilySession(snapshot)){setConnectionError(e instanceof Error?e.message:'Unable to save recipe.');remote.current=null;}}).finally(()=>{flight.current=false;setBusy(false);});
  }

  return (
    <AppShell>
      <main className="food-drink-page">
        <header className="food-drink-header kid-nav">
          <KidBackButton to={kitchenPath} label="Back to kitchen"/>
          <div className="food-drink-brand">
            <span className="food-drink-brand__icon" aria-hidden="true">🥤</span>
            <div>
              <p className="food-drink-eyebrow">{uiText("Kitchen recipe")}</p>
              <h1>{uiText("Cooking &amp; Drinks")}</h1>
            </div>
          </div>
          <MinigameBadgesButton groupIds={['food-and-drink']} />
          <div className="food-drink-progress" aria-label={`Recipe progress: ${progressLabel}`}>
            <span>{progressLabel}</span>
            <span className="food-drink-progress__bar" aria-hidden="true">
              <span style={{ width: `${(game.stepIndex / recipe.steps.length) * 100}%` }} />
            </span>
          </div>
        </header>

        {!practice&&<TownRewardBar reward={townReward} event={rewardEvent}/>}
        {connectionError&&<div role="alert">{connectionError} <button onClick={()=>setRetry(v=>v+1)}>{uiText("Sync recipe")}</button></div>}
        <div className="food-drink-layout" aria-busy={busy}>
          <section inert={busy} className="food-drink-play" aria-labelledby="food-drink-play-title">
            <div className="food-drink-play__intro">
              <h2 id="food-drink-play-title">{uiText("Making ")}{uiText(recipe.title)}</h2>
            </div>

            {game.status === "completed" ? (
              <FoodDrinkSuccess
                recipe={recipe}
                cup={cup}
                addedIngredientIds={game.addedIngredientIds}
                onRestart={() => dispatch({ type: "restart" })}
                onChooseAnother={() => navigate(kitchenPath)}
              />
            ) : (
              <>
                <DrinkScene
                  recipe={recipe}
                  currentStep={currentStep}
                  avatarAction={game.feedback ? "wrong" : actionForStep(currentStep?.kind)}
                  onSelect={(ingredientId) => dispatch({ type: "selectIngredient", ingredientId })}
                  cup={cup}
                  cupOptions={FOOD_AND_DRINK_CUP_OPTIONS}
                  fillLevel={game.stepIndex / recipe.steps.length}
                  addedIngredientIds={game.addedIngredientIds}
                  onCupSelect={setCup}
                />
                <div className="food-drink-actions">
                  {currentStep?.optional && (
                    <button type="button" className="food-drink-skip-button" onClick={() => dispatch({ type: "skipOptionalStep" })}>
                      {uiText("Skip garnish")}</button>
                  )}
                  {game.feedback && (
                    <div className="food-drink-feedback" role="status">
                      <span aria-hidden="true">🌼</span>
                      <span>{uiText("That one can wait. Look for the ingredient in the step above.")}</span>
                      <button type="button" onClick={() => dispatch({ type: "dismissFeedback" })} aria-label={uiText("Dismiss hint")}>{uiText("Got it")}</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
