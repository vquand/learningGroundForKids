import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { GRILL_GLAZE_DURATION_MS } from './pigRoastPresentation';
import type { CookingHeatLevel, CookingPhase, CookingRecipe } from "./cookingConfig";
import { PigRotationSprite } from "./PigRotationSprite";
import { HeatControl } from "./HeatControl";
import type { CookingGameState } from "./cookingGame";

interface GrillControlProps {
  recipe: CookingRecipe;
  phase: CookingPhase;
  game: CookingGameState;
  onRotate: (turns: number) => void;
  onSeason: (id: string) => void;
  onSelectHeat: (level: CookingHeatLevel) => void;
  serving?: boolean;
  onServed: () => void;
  onGlazed: () => void;
}

function RotationWheel({ onRotate }: { onRotate: (turns: number) => void }) {
  useUiLanguage();
  const drag = useRef<{ id: number; angle: number } | null>(null);
  const [angle, setAngle] = useState(-Math.PI / 2);
  function pointerAngle(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientY - bounds.y - bounds.height / 2, event.clientX - bounds.x - bounds.width / 2);
  }
  function release(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyTurn(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    setAngle((value) => value + direction * Math.PI / 4);
    onRotate(1 / 8);
  }
  return <div className="cooking-grill-rotation-wheel-wrap">
    <div className="cooking-grill-rotation-wheel" aria-label={uiText("Rotation wheel")}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        const next = pointerAngle(event);
        drag.current = { id: event.pointerId, angle: next };
        setAngle(next);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const previous = drag.current;
        if (previous?.id !== event.pointerId) return;
        const next = pointerAngle(event);
        const delta = Math.atan2(Math.sin(next - previous.angle), Math.cos(next - previous.angle));
        drag.current = { id: event.pointerId, angle: next };
        setAngle(next);
        onRotate(Math.abs(delta) / (Math.PI * 2));
      }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={() => { drag.current = null; }}>
      <span className="cooking-grill-rotation-wheel__ring" aria-hidden="true" />
      <span className="cooking-grill-rotation-wheel__center" aria-hidden="true" />
      <button type="button" className="cooking-grill-rotation-wheel__knob"
        style={{ left: `${50 + Math.cos(angle) * 36}%`, top: `${50 + Math.sin(angle) * 36}%` }}
        onKeyDown={keyTurn} aria-label={uiText("Turn handle with drag or arrow keys")} />
    </div>
    <span className="cooking-grill-rotation-wheel__hint">{uiText("Drag around the wheel, or use arrow keys. Any pace!")}</span>
  </div>;
}

export function GrillControl({ recipe, phase, game, onRotate, onSeason, onSelectHeat, serving, onServed, onGlazed }: GrillControlProps) {
  useUiLanguage();
  const food = recipe.ingredients[0];
  const image = serving ? "/minigames/cooking/grill/served-pork.png" : game.grillDoneness === "burnt" ? food?.burntImagePath : game.grillDoneness === "good" ? food?.cookedImagePath : food?.imagePath;
  return <div className="cooking-grill-stage">
    <div className={`cooking-grill-visual${serving ? " cooking-grill-visual--serving" : ""}`}>
      <img className="cooking-grill-visual__station" src={recipe.station.imagePath} alt="" />
      {game.selectedHeat && !serving && <div className={`cooking-grill-fire cooking-grill-fire--${game.selectedHeat}`} role="img" aria-label={`${game.selectedHeat} flame under the pig`}>
        {[0, 1, 2].map((index) => <svg key={index} viewBox="0 0 64 80" preserveAspectRatio="none" aria-hidden="true"><path vectorEffect="non-scaling-stroke" d="M35 3c2 15-8 17-6 30 1 6 6 8 8 13 3-5 5-12 3-20 13 9 21 22 19 35-2 12-12 19-27 19C14 80 4 69 5 54 6 39 17 31 23 18c3 8 2 15 0 21C31 30 36 20 35 3Z" /><path className="cooking-grill-fire__core" d="M33 43c1 8-7 11-6 19 1 5 4 8 8 8 6 0 10-4 10-10 0-6-4-11-8-15 0 5-1 8-3 10-2-3-2-7-1-12Z" /></svg>)}
      </div>}
      {game.selectedHeat && !serving && <img className="cooking-grill-visual__station cooking-grill-visual__front-stones" src={recipe.station.imagePath} alt="" />}
      {serving && <img className="cooking-grill-visual__dish" src="/minigames/cooking/grill/serving-dish.png" alt={uiText("Big serving dish")} />}
      {phase.kind === "rotation" && game.status === "playing" ? <PigRotationSprite turns={game.rotationTurns} rawRoundLimit={game.rawRoundLimit} /> : <img className={`cooking-grill-visual__food cooking-grill-visual__food--${game.grillDoneness}${serving ? " cooking-grill-visual__food--serving" : ""}`}
        src={image} alt={`${game.grillDoneness === "good" ? uiText("Golden roasted") : game.grillDoneness === "burnt" ? uiText("Burnt") : uiText("Uncooked")} pig`}
        style={serving ? undefined : { transform: "translate(-50%, -50%)" }}
        onAnimationEnd={(event) => { if (serving && event.animationName === "cooking-pig-serve") onServed(); }} />}
      {game.seasoningIds.length > 0 && !serving && <div key={game.seasoningIds.join()} className={`cooking-seasoning-animation cooking-seasoning-animation--brush cooking-seasoning-animation--${game.seasoningIds[0]}`} style={{ "--grill-glaze-duration": `${GRILL_GLAZE_DURATION_MS}ms` } as CSSProperties} aria-hidden="true" onAnimationEnd={event => { if (event.animationName === "cooking-grill-brush-z") onGlazed(); }}><span className="cooking-seasoning-animation__brush" /><svg className="cooking-seasoning-animation__glaze" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M40 38H69L40 54H69" pathLength="1" /></svg></div>}
    </div>
    {game.status === "failed" ? null : phase.kind === "rotation" ? <section className="cooking-grill-control" aria-labelledby="grill-turn-title">
      <h3 id="grill-turn-title">{uiText("Turn until golden")}</h3>
      <RotationWheel onRotate={onRotate} />
    </section> : phase.kind === "seasoning" ? <section className="cooking-grill-control" aria-labelledby="grill-glaze-title">
      <h3 id="grill-glaze-title">{uiText("Choose your glaze")}</h3>
      <ul className="cooking-seasoning-options" aria-label={uiText("Seasoning choices")}>{phase.seasoningOptions.map((option) => <li key={option.id}><button type="button" className="cooking-seasoning-option" aria-pressed={game.seasoningIds.includes(option.id)} onClick={() => onSeason(option.id)}><span className="cooking-seasoning-option__icon" aria-hidden="true">{option.icon}</span><span>{uiText(option.label)}</span><small>{uiText("Brush on")}</small></button></li>)}</ul>
    </section> : phase.kind === "heat" ? <HeatControl stationKind="grill" onSelect={onSelectHeat} selectedLevel={game.selectedHeat} /> : null}
  </div>;
}
