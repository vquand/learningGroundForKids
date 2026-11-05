import { MinigameBadgesButton } from '../achievements/MinigameBadgesButton';
import { useVerifiedKitchen } from '../../hooks/useVerifiedKitchen';
import { KidBackButton } from "../../components/KidBackButton";
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { AppShell } from "../../components/Layout/AppShell";
import { CookingPan } from "./CookingPan";
import { HeatControl } from "./HeatControl";
import { GrillActionPrompt } from "./GrillActionPrompt";
import { GRILL_GLAZE_DURATION_MS } from "./pigRoastPresentation";
import { GrillControl } from "./GrillControl";
import { IngredientTray } from "./IngredientTray";
import {
  getCookingIngredient,
  getCookingRecipe,
  getPlacementIngredientIds,
  STEAK_PAN_RECIPE,
  type CookingPlacementPhase,
} from "./cookingConfig";
import {
  cookingGameReducer,
  createCookingGame,
  isPhaseReady,
  type CookingFeedbackKind,
  type CookingGameAction,
} from "./cookingGame";
import { playGrillSound, unlockGrillSound } from "./grillSound";
import "./cooking.css";

const FEEDBACK_COPY: Record<CookingFeedbackKind, string> = {
  "wrong-ingredient": "That ingredient is for a later step.",
  outside: "Keep every part of the ingredient inside the cooking vessel.",
  blocked: "That space is already filled on this layer. Try another spot.",
  "needs-effect-overlap": "The steak needs at least 4 squares over the melted butter.",
  "needs-ingredient-overlap": "Lay the herbs across 2 steak squares.",
  "not-ready": "Add a little more before moving to the next step.",
  "wrong-heat": "Not quite—try a different heat for this recipe.",
  "wrong-rotation": "Keep turning until the roast is golden.",
  "seasoning-missing": "Choose a seasoning from the buttons to build the crust.",
};

export function CookingPage() {
  useUiLanguage();
  const location = useLocation();
  const { mealId } = useParams<{ mealId: string }>();
  const cookingMenuPath = location.pathname.startsWith("/uat/") ? "/uat/cooking" : "/cooking";
  const recipe = getCookingRecipe(mealId ?? "") ?? STEAK_PAN_RECIPE;
  const kitchen=useVerifiedKitchen(recipe.id,()=>createCookingGame(recipe),(state,action:CookingGameAction)=>cookingGameReducer(state,action,recipe),location.pathname.startsWith("/uat/"));
  const {game}=kitchen;
  const [selectedActionPieceId, setSelectedActionPieceId] = useState<string | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const kitchenDispatch=useRef(kitchen.dispatch);kitchenDispatch.current=kitchen.dispatch;
  const [isGlazing, setIsGlazing] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    if (recipe.station.kind !== "grill") return;
    for (const path of [recipe.ingredients[0]?.imagePath, recipe.ingredients[0]?.cookedImagePath, recipe.ingredients[0]?.burntImagePath, recipe.resultImagePath, "/minigames/cooking/grill/raw-pork-rotation.png", "/minigames/cooking/grill/good-pork-rotation.png", "/minigames/cooking/grill/warming-pork-rotation.png", "/minigames/cooking/grill/serving-dish.png"]) {
      if (path) { const image = new Image(); image.src = path; }
    }
  }, [recipe]);
  const previousSoundStatus = useRef(game.status);
  useEffect(() => {
    const changed = previousSoundStatus.current !== game.status;
    previousSoundStatus.current = game.status;
    if (!changed || recipe.station.kind !== "grill" || muted) return;
    if (game.status === "failed") playGrillSound("fail");
    if (game.status === "completed") playGrillSound("success");
  }, [game.status, recipe.station.kind, muted]);
  useEffect(() => {
    if (!isFlipping || recipe.station.kind !== "grill") return;
    const timer = window.setTimeout(() => { setIsFlipping(false); kitchenDispatch.current({ type: "flip" }); }, 1600);
    return () => window.clearTimeout(timer);
  }, [isFlipping, recipe]);
  const phase = recipe.phases[game.phaseIndex];
  useEffect(() => {
    if (!isGlazing) return;
    if (phase?.kind !== "seasoning" || game.status !== "playing") { setIsGlazing(false); return; }
    // AnimationEnd finishes normal/reduced-motion brushing; the timer also
    // releases the control if a hidden tab or interrupted animation loses it.
    const timer = window.setTimeout(() => setIsGlazing(false), GRILL_GLAZE_DURATION_MS + 200);
    return () => window.clearTimeout(timer);
  }, [isGlazing, game.seasoningIds, game.status, phase?.kind]);
  const placementPhase = phase?.kind === "placement" ? phase : undefined;
  const placementIngredientIds = placementPhase ? getPlacementIngredientIds(placementPhase) : [];
  const placementIngredients = placementIngredientIds
    .map((ingredientId) => getCookingIngredient(recipe, ingredientId))
    .filter((ingredient): ingredient is NonNullable<typeof ingredient> => Boolean(ingredient));
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(
    recipe.ingredients[0]?.id ?? null,
  );
  const ready = isPhaseReady(game, recipe);
  const progress = Math.round((game.phaseIndex / recipe.phases.length) * 100);

  const placedCells = useMemo(() => {
    if (!placementPhase) return 0;
    return game.pieces
      .filter((piece) => placementIngredientIds.includes(piece.ingredientId))
      .reduce((sum, piece) => sum + piece.cells.length, 0);
  }, [game.pieces, placementIngredientIds, placementPhase]);

  function dispatch(action: CookingGameAction) {
    if (recipe.station.kind === "grill" && !muted) unlockGrillSound();
    kitchen.dispatch(action);
  }

  function advancePlacement(currentPhase: CookingPlacementPhase) {
    dispatch({ type: "advance" });
    const nextPhase = recipe.phases[game.phaseIndex + 1];
    if (ready && nextPhase?.kind === "placement") setSelectedIngredientId(nextPhase.ingredientId);
    if (currentPhase.kind === "placement" && ready && nextPhase?.kind !== "placement") setSelectedIngredientId(null);
  }

  const actionPhase = phase?.kind === "action" ? phase : undefined;
  const actionNeedsSelection = Boolean(actionPhase?.targetIngredientId);
  const canStartAction = Boolean(actionPhase) && (!actionNeedsSelection || selectedActionPieceId !== null) && !isFlipping;

  if(!kitchen.ready)return <AppShell><main className="cooking-page"><header className="kid-nav"><KidBackButton to={cookingMenuPath} label="Back to kitchen"/></header><p role={kitchen.error?'alert':'status'}>{uiText(kitchen.error?'Your recipe couldn’t be saved. Please try again.':'Getting your recipe ready…')}</p>{kitchen.error&&<button type="button" className="kid-nav-action" onClick={kitchen.retry}>{uiText('Try again')}</button>}</main></AppShell>;

  return (
    <AppShell>
      <main className={`cooking-page${recipe.station.kind === "grill" ? " cooking-page--grill" : ""}`}>
        <header className="cooking-header kid-nav">
          <KidBackButton to={cookingMenuPath} label="Back to kitchen"/>
          <div className="cooking-brand">
            <span className="cooking-brand__icon" aria-hidden="true">🍳</span>
            <div>
              <p className="cooking-kicker">{uiText("Little kitchen · ")}{recipe.station.kind}</p>
              <h1>{uiText(recipe.title)}</h1>
            </div>
          </div>
          <MinigameBadgesButton groupIds={['cooking']} />
          {recipe.station.kind === "grill" && <button type="button" className="kid-nav-action" aria-pressed={muted} onClick={() => setMuted((value) => !value)}>{muted ? uiText("Sound off") : uiText("Sound on")}</button>}
          <div className="cooking-progress" aria-label={`Cooking progress: ${progress}%`}>
            <span>{uiText("Step ")}{Math.min(game.phaseIndex + 1, recipe.phases.length)} {uiText(" of ")}{recipe.phases.length}</span>
            <span className="cooking-progress__track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </span>
          </div>
        </header>

        <div className="cooking-layout">
          <nav className="cooking-steps" aria-label={`${uiText(recipe.title)} cooking steps`}>
            <p className="cooking-kicker">{uiText("Recipe")}</p>
            <h2>{uiText(recipe.title)}</h2>
            <ol>
              {recipe.phases.map((item, index) => (
                <li
                  key={item.id}
                  className={`${index === game.phaseIndex ? "cooking-step--current" : ""}${index < game.phaseIndex ? " cooking-step--done" : ""}`}
                  aria-current={index === game.phaseIndex ? "step" : undefined}
                >
                  <span>{index < game.phaseIndex ? "✓" : index + 1}</span>
                  <div>
                    <strong>{uiText(item.title)}</strong>
                    <small>{item.kind === "placement" ? `${item.minCells} squares` : item.kind === "rotation" ? uiText("Count turns") : item.kind === "seasoning" ? uiText("Seasoning") : item.kind === "heat" ? uiText("Heat choice") : item.actionId === "flip-steak" ? uiText("Turn it over") : uiText("Finish")}</small>
                  </div>
                </li>
              ))}
            </ol>
          </nav>

          <section className="cooking-workbench" aria-labelledby="cooking-phase-title">
            {game.status === "completed" ? (
              <div className="cooking-success" role="status">
                <span className="cooking-success__sparkle" aria-hidden="true">✦</span>
                {recipe.station.kind === "grill" ? <div className="cooking-served-roast"><img src="/minigames/cooking/grill/serving-dish.png" alt={uiText("Big serving dish")} /><img src={recipe.resultImagePath} alt={uiText("Golden roast ready to share")} /></div> : <img src={recipe.resultImagePath} alt={uiText(recipe.title)} />}
                <p className="cooking-kicker">{uiText(recipe.title)} {uiText(" complete")}</p>
                <h2>{recipe.resultTitle ?? uiText("Cozy and ready!")}</h2>
                <p>{uiText(recipe.resultDescription ?? recipe.description)}</p>
                {recipe.station.kind !== "grill" && <button type="button" className="cooking-primary-button" onClick={() => {
                  dispatch({ type: "restart" });
                  setSelectedIngredientId(recipe.ingredients[0]?.id ?? null);
                  setSelectedActionPieceId(null);
                  setIsFlipping(false);
                }}>
                  {uiText("Cook another meal")}</button>}
              </div>
            ) : (
              <>
                <div className="cooking-phase-card" aria-live="polite">
                  <div>
                    <p className="cooking-kicker">{uiText("Now cooking")}</p>
                    <h2 id="cooking-phase-title">{uiText(phase?.title ?? "")}</h2>
                  </div>
                  <p>{uiText(phase?.instruction ?? "")}</p>
                  {placementPhase && (
                    <span className="cooking-phase-card__count">
                      {Math.min(placedCells, placementPhase.minCells)} / {placementPhase.minCells} {uiText("squares")}</span>
                  )}
                </div>

                {recipe.station.kind === "grill" && phase ? (
                  <GrillControl
                    recipe={recipe}
                    phase={phase}
                    game={game}
                    onRotate={(turns) => dispatch({ type: "rotate", turns })}
                    onSeason={(seasoningId) => { if (!game.seasoningIds.includes(seasoningId)) { setIsGlazing(true); dispatch({ type: "season", seasoningId }); } }}
                    onGlazed={() => setIsGlazing(false)}
                    onSelectHeat={(level) => dispatch({ type: "selectHeat", level })}
                    serving={isFlipping}
                    onServed={() => { setIsFlipping(false); dispatch({ type: "flip" }); }}
                  />
                ) : (
                  <CookingPan
                    recipe={recipe}
                    game={game}
                    phase={placementPhase}
                    selectedIngredientId={selectedIngredientId}
                    actionTargetIngredientId={phase?.kind === "action" ? phase.targetIngredientId : undefined}
                    selectedActionPieceId={selectedActionPieceId}
                    flippingPieceId={isFlipping ? selectedActionPieceId : null}
                    onPlace={(ingredientId, x, y) => dispatch({ type: "place", ingredientId, x, y })}
                    onMove={(pieceId, x, y) => dispatch({ type: "move", pieceId, x, y })}
                    onRemove={(pieceId) => dispatch({ type: "remove", pieceId })}
                    onSelectActionPiece={(pieceId) => setSelectedActionPieceId(pieceId)}
                    onFlipAnimationEnd={() => {
                      if (!isFlipping) return;
                      setIsFlipping(false);
                      dispatch({ type: "flip" });
                    }}
                  />
                )}

                {placementPhase && placementIngredients.length > 0 && (
                  <div className="cooking-controls cooking-controls--placement">
                    <div className="cooking-trays">
                      <IngredientTray
                        ingredients={placementIngredients}
                        selectedIngredientId={selectedIngredientId}
                        onSelect={setSelectedIngredientId}
                      />
                    </div>
                    <button
                      type="button"
                      className="cooking-primary-button"
                      disabled={!ready}
                      onClick={() => advancePlacement(placementPhase)}
                    >
                      {uiText(placementPhase.actionLabel)}
                    </button>
                  </div>
                )}

                {recipe.station.kind !== "grill" && phase?.kind === "heat" && (
                  <HeatControl
                    stationKind={recipe.station.kind}
                    onSelect={(level) => dispatch({ type: "selectHeat", level })}
                  />
                )}

                {recipe.station.kind !== "grill" && actionPhase && game.status === "playing" && (
                  <div className="cooking-flip">
                    <p>{actionNeedsSelection
                      ? (selectedActionPieceId ? uiText("Ready—turn over the selected steak.") : uiText("Tap the steak in the pot, then serve it."))
                      : actionPhase.actionId === "finish-grill" ? uiText("The roast is ready. Lift it from the spit and serve it warm.")
                        : uiText("The soup is ready. Give it one last stir, then serve.")}</p>
                    <button
                      type="button"
                      className="cooking-primary-button"
                      disabled={!canStartAction}
                      onClick={() => {
                        if (actionNeedsSelection) setIsFlipping(true);
                        else dispatch({ type: "flip" });
                      }}
                    >
                      <span aria-hidden="true">{actionNeedsSelection ? "↻" : "✦"}</span> {isFlipping ? uiText("Flipping…") : actionPhase.actionLabel}
                    </button>
                  </div>
                )}

                {game.feedback && (
                  <div className="cooking-feedback" role="status">
                    <span aria-hidden="true">🌼</span>
                    <span>{FEEDBACK_COPY[game.feedback.kind]}</span>
                    <button type="button" onClick={() => dispatch({ type: "dismissFeedback" })}>{uiText("Got it")}</button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
        {recipe.station.kind === "grill" && <GrillActionPrompt game={game} phase={phase} serving={isFlipping} glazing={isGlazing} onAction={dispatch} onServe={() => { if (!muted) unlockGrillSound(); setIsFlipping(true); }} />}
      </main>
    </AppShell>
  );
}
