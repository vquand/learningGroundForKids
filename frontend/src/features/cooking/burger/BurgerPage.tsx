import { MinigameBadgesButton } from '../../achievements/MinigameBadgesButton';
import { useVerifiedKitchen } from '../../../hooks/useVerifiedKitchen';
import { KidBackButton } from "../../../components/KidBackButton";
import { useUiLanguage } from '../../../hooks/useUiLanguage';
import { uiText } from '../../../i18n/uiText';
import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "../../../components/Layout/AppShell";
import { Bun, BurgerScene, DecorativePick, SauceArt, ToppingArt } from "./BurgerArt";
import { BurgerSprite } from "./BurgerSprite";
import { BUN_SHAPES, BURGER_STEPS, burgerReducer, createBurgerGame, isBurgerStepReady, tomatoAnswers, type BurgerAction, type BurgerGame, type BurgerStep } from "./burgerGame";
import "./burger.css";

const COPY: Record<BurgerStep, { title: string; hint: string; short: string }> = {
  shape: { title: "What shape shall we bake?", hint: "Tap a shape and watch your dough get a little makeover.", short: "Shape" },
  toast: { title: "Toast those little buns", hint: "Let's make them golden and cozy. Choose a toast level.", short: "Toast" },
  cook: { title: "A little sizzle, a little flip", hint: "Choose a gentle heat for your patty, then flip it over.", short: "Patty" },
  cheese: { title: "Make it a cheeseburger!", hint: "Add a blanket of cheese and watch it melt.", short: "Cheese" },
  sauce: { title: "A squiggle of sauce", hint: "Try each sauce on your burger. Tap Next to keep your favorite.", short: "Sauce" },
  topping: { title: "One crunchy little topping", hint: "Tap to swap. Choose lettuce, tomato, or pickles, then tap Next.", short: "Topping" },
  tomato: { title: "Let's count tomato slices", hint: "Each slice is 1 cm thick. How many can we make?", short: "Slice" },
  decorate: { title: "The finishing touch", hint: "Choose a little pick for the top. Our chef is ready to celebrate!", short: "Decorate" },
  serve: { title: "Made by you. Loved by Chef Capy!", hint: "One cozy cheeseburger, made just the way you like it.", short: "Serve" },
};

function Choice({ label, selected, onClick, children }: { label: string; selected: boolean; onClick: () => void; children: ReactNode }) {
  useUiLanguage();
  return <button type="button" className="burger-choice" aria-pressed={selected} onClick={onClick}>
    <span className="burger-choice-art" aria-hidden="true">{children}</span>
    <span>{label}</span>{selected && <span className="burger-choice-check" aria-hidden="true">✓</span>}
  </button>;
}

function MiniArt({ children }: { children: ReactNode }) {
  useUiLanguage();
  return <span className="burger-mini-art">{children}</span>;
}

function BurgerChoices({ game, dispatch }: { game: BurgerGame; dispatch: (action: BurgerAction) => void }) {
  useUiLanguage();
  switch (game.step) {
    case "shape": return <div className="burger-choices burger-choices--shapes">{BUN_SHAPES.map((shape) => <Choice key={shape} label={shape === "square" ? uiText("Soft square") : shape[0]!.toUpperCase() + shape.slice(1)} selected={game.shape === shape} onClick={() => dispatch({ type: "shape", value: shape })}><MiniArt><Bun shape={shape} toasted={false} /></MiniArt></Choice>)}</div>;
    case "toast": return <div className="burger-choices">{(["pale", "golden", "dark"] as const).map((value) => <Choice key={value} label={{ pale: uiText("Still pale"), golden: uiText("Golden"), dark: uiText("Too toasty") }[value]} selected={value === "golden" && game.toasted} onClick={() => dispatch({ type: "toast", value })}><span className={`burger-toast-swatch burger-toast-swatch--${value}`}><Bun shape={game.shape ?? "round"} toasted={value !== "pale"} /></span></Choice>)}</div>;
    case "cook": return <>
      <div className="burger-choices">{(["low", "medium", "high"] as const).map((value, i) => <Choice key={value} label={{ low: uiText("Low heat"), medium: uiText("Medium heat"), high: uiText("High heat") }[value]} selected={value === "medium" && game.heated} onClick={() => dispatch({ type: "heat", value })}><span className="burger-heat-icon">{Array.from({ length: i + 1 }, (_, n) => <BurgerSprite key={n} name="flame" />)}</span></Choice>)}</div>
      <button className="burger-action" type="button" disabled={!game.heated || game.flipped} onClick={() => dispatch({ type: "flip" })}>{game.flipped ? uiText("Beautifully flipped ✓") : uiText("Flip the patty")}</button>
    </>;
    case "cheese": return <button className="burger-action burger-action--cheese" type="button" disabled={game.cheese} onClick={() => dispatch({ type: "cheese" })}><MiniArt><BurgerSprite name="cheese" /></MiniArt>{game.cheese ? uiText("Melty and ready ✓") : uiText("Add & melt cheese")}</button>;
    case "sauce": return <div className="burger-choices">{(["ketchup", "mayo", "burger-sauce"] as const).map((value) => <Choice key={value} label={{ ketchup: uiText("Ketchup"), mayo: uiText("Mayo"), "burger-sauce": uiText("Burger sauce") }[value]} selected={game.sauce === value} onClick={() => dispatch({ type: "sauce", value })}><MiniArt><SauceArt sauce={value} /></MiniArt></Choice>)}</div>;
    case "topping": return <div className="burger-choices">{(["lettuce", "tomato", "pickles"] as const).map((value) => <Choice key={value} label={{ lettuce: uiText("Lettuce"), tomato: uiText("Tomato"), pickles: uiText("Pickles") }[value]} selected={game.topping === value} onClick={() => dispatch({ type: "topping", value })}><MiniArt><ToppingArt topping={value} /></MiniArt></Choice>)}</div>;
    case "tomato": return <>
      <p className="burger-math">{uiText("This tomato is ")}<strong>{game.thickness} {uiText(" cm thick")}</strong>{uiText(". We cut it into slices that are each ")}<strong>{uiText("1 cm thick")}</strong>{uiText(". How many slices can we make?")}</p>
      <div className="burger-choices">{tomatoAnswers(game.thickness).map((value) => <Choice key={value} label={`${value} slices`} selected={game.sliced && value === game.thickness} onClick={() => dispatch({ type: "answer", value })}><span className="burger-answer-number">{value}</span></Choice>)}</div>
    </>;
    case "decorate": return <div className="burger-choices">{(["flower", "star", "heart"] as const).map((value) => <Choice key={value} label={value[0]!.toUpperCase() + value.slice(1)} selected={game.pick === value} onClick={() => dispatch({ type: "pick", value })}><MiniArt><DecorativePick kind={value} /></MiniArt></Choice>)}</div>;
    case "serve": return null;
  }
}

export function BurgerPage() {
  useUiLanguage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const kitchenPath = location.pathname.startsWith("/uat/") ? "/uat/cooking" : "/cooking";
  const kitchen=useVerifiedKitchen("burger",()=>createBurgerGame(),(state,action:BurgerAction|{type:"restart"})=>action.type==="restart"?createBurgerGame(Math.random(),state.thickness):burgerReducer(state,action),location.pathname.startsWith("/uat/"));
  const {game}=kitchen;
  const copy = COPY[game.step];
  const steps = BURGER_STEPS.filter((step) => step !== "tomato" || game.topping === "tomato");
  const stepIndex = steps.indexOf(game.step);
  const ready = isBurgerStepReady(game);
  const completed = game.step === "serve";
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [game.step]);
  function dispatch(action: BurgerAction) { kitchen.dispatch(action); }

  if(!kitchen.ready)return <AppShell><main className="burger-page"><header className="kid-nav"><KidBackButton to={kitchenPath} label="Back to kitchen"/></header><p role={kitchen.error?"alert":"status"}>{uiText(kitchen.error?"Your recipe couldn’t be saved. Please try again.":"Getting your recipe ready…")}</p>{kitchen.error&&<button type="button" className="kid-nav-action" onClick={kitchen.retry}>{uiText("Try again")}</button>}</main></AppShell>;

  return <AppShell><main className="burger-page">
    <header className="burger-header kid-nav">
      <KidBackButton to={kitchenPath} label="Back to kitchen"/>
      <div><p className="burger-kicker">{uiText("Little kitchen · Chef Capy's counter")}</p><h1>{uiText("Cozy cheeseburger")}</h1></div>
      <MinigameBadgesButton groupIds={['burger']} />
      <span className="burger-step-count">{completed ? uiText("Made with love!") : `Step ${stepIndex + 1} of ${steps.length}`}</span>
    </header>
    <nav className="burger-progress" aria-label={uiText("Burger recipe steps")}><ol>{steps.map((step, i) => <li key={step} aria-current={game.step === step ? "step" : undefined} className={i < stepIndex ? "burger-step-done" : ""}><span>{i < stepIndex ? "✓" : i + 1}</span>{uiText(COPY[step].short)}</li>)}</ol></nav>
    <div className={`burger-workspace${completed ? " burger-workspace--served" : ""}`}>
      <section className="burger-preview" aria-label={uiText("Kitchen preview")}>
        <div className="burger-preview-note"><span aria-hidden="true">✦</span> {completed ? uiText("A little flower party for our little chef") : uiText("Your own little kitchen creation")}</div>
        <BurgerScene game={game} />
        <p className="burger-preview-caption">{game.step === "shape" ? uiText("A bun with a little personality") : game.step === "tomato" ? uiText("A little counting, a little cooking") : completed ? uiText("High paws, little chef!") : uiText("Tap a choice. Watch the magic.")}</p>
      </section>
      <section className="burger-controls" aria-labelledby="burger-step-title">
        <p className="burger-kicker">{completed ? uiText("Order up!") : `Let's make something lovely · ${COPY[game.step].short}`}</p>
        <h2 id="burger-step-title" ref={headingRef} tabIndex={-1}>{uiText(copy.title)}</h2>
        <p className="burger-hint">{copy.hint}</p>
        <BurgerChoices game={game} dispatch={dispatch} />
        <p className="burger-feedback" role="status">{game.feedback || (ready ? game.step === "tomato" ? `That's right! ${game.thickness} little slices. Nicely counted!` : uiText("Lovely choice! Ready when you are.") : "")}</p>
        <div className="burger-next-row">{completed ? <>
          <button className="burger-next" type="button" onClick={() => kitchen.dispatch({type:"restart"})}>{uiText("Make another burger ↻")}</button>
        </> : <button className="burger-next" type="button" disabled={!ready} onClick={() => dispatch({ type: "next" })}>{game.step === "decorate" ? uiText("Serve my burger ✦") : uiText("Next →")}</button>}</div>
      </section>
    </div>
  </main></AppShell>;
}
