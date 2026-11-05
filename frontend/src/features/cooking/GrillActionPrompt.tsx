import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { CookingPhase } from "./cookingConfig";
import type { CookingGameAction, CookingGameState } from "./cookingGame";

export function GrillActionPrompt({ game, phase, serving, glazing, onAction, onServe }: {
  game: CookingGameState;
  phase: CookingPhase | undefined;
  serving: boolean;
  glazing: boolean;
  onAction: (action: CookingGameAction) => void;
  onServe: () => void;
}) {
  useUiLanguage();
  let message = "Ready to serve?";
  let label = "Serve pork";
  let disabled = serving;
  let act = onServe;
  if (game.status !== "playing") {
    message = game.status === "failed" ? "Ohhh! A little too crispy. Let’s try again!" : "Ready to share! Cook another roast?";
    label = "Replay";
    act = () => onAction({ type: "restart" });
  } else if (phase?.kind === "heat") {
    message = game.selectedHeat === "medium" ? "Happy with this flame?" : "Choose a warm medium flame.";
    label = "Heat OK";
    disabled = game.selectedHeat !== phase.targetLevel;
    act = () => onAction({ type: "confirmHeat" });
  } else if (phase?.kind === "rotation") {
    message = "Watch your roast as you turn.";
    label = "Done grilling";
    disabled = game.grillDoneness !== "good";
    act = () => onAction({ type: "lockRotation" });
  } else if (phase?.kind === "seasoning") {
    message = "Choose your favourite glaze.";
    label = "Done seasoning";
    disabled = game.seasoningIds.length === 0 || glazing;
    if (glazing) message = "Brushing on your glaze…";
    act = () => onAction({ type: "confirmSeasoning" });
  }
  return <section className="cooking-action-prompt" aria-label={uiText("Cooking action prompt")}>
    <p role={game.status === "failed" ? "alert" : "status"}>{uiText(message)}</p>
    <button type="button" className="cooking-primary-button" disabled={disabled} onClick={act}>{serving ? uiText("Serving…") : uiText(label)}</button>
  </section>;
}
