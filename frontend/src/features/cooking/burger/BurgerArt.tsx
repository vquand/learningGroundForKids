import { useUiLanguage } from '../../../hooks/useUiLanguage';
import { uiText } from '../../../i18n/uiText';
import type { CSSProperties, ReactNode } from "react";
import type { BunShape, BurgerGame, Pick, Sauce, Topping } from "./burgerGame";
import { BurgerSprite, type BurgerSpriteName } from "./BurgerSprite";

export function Bun({ shape, toasted = true }: { shape: BunShape; toasted?: boolean }) {
  useUiLanguage();
  return <BurgerSprite name={`${toasted ? "bun" : "dough"}-${shape}`} />;
}
export function ToppingArt({ topping }: { topping: Topping }) {
  useUiLanguage();
  return <BurgerSprite name={topping === "tomato" ? "tomato-slice" : topping} />;
}
export function SauceArt({ sauce }: { sauce: Sauce }) {
  useUiLanguage(); return <BurgerSprite name={sauce} />; }
export function DecorativePick({ kind }: { kind: Pick }) {
  useUiLanguage(); return <BurgerSprite name={`pick-${kind}`} />; }

/** Logical 620×450 scene coordinates preserve the tablet composition at every size. */
function Jiggle({ children, label, className, style }: {
  children: ReactNode; label: string; className: string; style?: CSSProperties;
}) {
  useUiLanguage();
  return <button type="button" className={`burger-jiggle ${className}`} style={style} aria-label={`Jiggle ${label}`} onClick={(event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const item = event.currentTarget;
    item.getAnimations().forEach((animation) => animation.cancel());
    item.animate([
      { transform: "scale(1)" }, { transform: "scale(.94, 1.06)" },
      { transform: "scale(1.06, .94)" }, { transform: "scale(.98, 1.03)" },
      { transform: "scale(1.01, .99)" }, { transform: "scale(1)" },
    ], { duration: 550, easing: "ease-out" });
  }}>
    <span className="burger-jiggle-motion">{children}</span>
  </button>;
}

const foodSprites = new Set<BurgerSpriteName>([
  "bottom-bun", "raw-patty", "patty", "cheese", "ketchup", "mayo", "burger-sauce",
  "tomato", "tomato-slice", "lettuce", "pickles",
]);

function Item({ name, x, y, width, height, className = "", animationKey,
  interactive = name.startsWith("dough-") || name.startsWith("bun-") || foodSprites.has(name), clipBottom }: {
  name: BurgerSpriteName; x: number; y: number; width: number; height: number;
  className?: string; animationKey?: string | number; interactive?: boolean; clipBottom?: number;
}) {
  useUiLanguage();
  const style = { left: `${x / 620 * 100}%`, top: `${y / 450 * 100}%`, width: `${width / 620 * 100}%`, height: `${height / 450 * 100}%`,
    ...(clipBottom === undefined ? {} : { clipPath: `inset(0 0 ${clipBottom}% 0)` }) };
  const art = <span key={animationKey} className={`burger-scene-item-inner ${className}`}><BurgerSprite name={name} /></span>;
  return interactive ? <Jiggle label={name.replace(/-/g, " ")} className="burger-scene-item" style={style}>{art}</Jiggle>
    : <span className="burger-scene-item burger-scene-item--decorative" style={style}>{art}</span>;
}

function ArtFrame({ children, label }: { children: ReactNode; label: string }) {
  useUiLanguage();
  return <div className="burger-scene-art" role="group" aria-label={label}><div className="burger-raster-scene">{children}</div></div>;
}

export function BurgerScene({ game }: { game: BurgerGame }) {
  useUiLanguage();
  const shape = game.shape ?? "round";
  const complete = game.step === "serve";
  const toastBunY = game.toasted ? 186 : 210;
  const toasterFrontY = 218 + 215 * .15;
  if (game.step === "shape") return <ArtFrame label={game.shape ? `${shape} dough bun` : uiText("Dough on a wooden board")}>
    <Item name="board" x={78} y={161} width={464} height={237} />
    <Item name="rolling-pin" x={107} y={103} width={405} height={110} />
    <Item name={`dough-${shape}`} x={185} y={197} width={250} height={174} animationKey={game.animation} className={game.shape ? "burger-shape-animation" : ""} />
  </ArtFrame>;
  if (game.step === "toast") return <ArtFrame label={game.toasted ? `Golden ${shape} bun popping from the toaster` : uiText("Bun ready to toast")}>
    <Item name="toaster" x={132} y={218} width={356} height={215} />
    {/* Clip the hidden bun's hit area so tapping the toaster body does nothing. */}
    <Item name={`${game.toasted ? "bun" : "dough"}-${shape}`} x={222} y={toastBunY} width={156} height={116} animationKey={game.animation} className={game.toasted ? "burger-toast-animation" : ""} clipBottom={(toastBunY + 116 - toasterFrontY) / 116 * 100} />
    {/* The front lip occludes the bun, keeping it inside the slot even at the pop's peak. */}
    <Item name="toaster" x={132} y={218} width={356} height={215} className="burger-toaster-front" />
    {game.toasted && <Item name="steam" x={236} y={93} width={128} height={80} className="burger-steam" interactive={false} />}
  </ArtFrame>;
  if (game.step === "cook" || game.step === "cheese") return <ArtFrame label={`${game.flipped ? uiText("Cooked") : uiText("Cooking")} patty${game.cheese ? uiText(" with melted cheese") : ""} in a pan`}>
    <Item name="pan" x={83} y={139} width={454} height={289} />
    <Item name={game.heated ? "patty" : "raw-patty"} x={155} y={189} width={230} height={105} animationKey={game.flipped ? "flipped" : "raw"} className={game.flipped ? "burger-flip-animation" : ""} />
    {game.cheese && <Item name="cheese" x={153} y={184} width={234} height={108} className="burger-cheese-animation" />}
    {game.heated && <Item name="steam" x={206} y={80} width={128} height={90} className="burger-steam" interactive={false} />}
  </ArtFrame>;
  if (game.step === "tomato") return <ArtFrame label={game.sliced ? `${game.thickness} tomato slices on the board` : `${game.thickness} cm thick tomato on the board`}>
    <Item name="board" x={67} y={179} width={482} height={246} />
    {!game.sliced ? <>
      <Item name="tomato" x={211} y={209} width={183} height={166} />
      <span className="burger-tomato-measure">↔ {game.thickness} cm</span>
    </> : <div className="burger-slice-animation">{Array.from({ length: game.thickness }, (_, i) => <div key={i} data-tomato-slice="true">
      <Item name="tomato-slice" x={111 + (i % 3) * 139} y={235 + Math.floor(i / 3) * 83} width={106} height={70} />
    </div>)}</div>}
    <Item name="knife" x={328} y={136} width={210} height={69} className={game.sliced ? "burger-knife-animation" : ""} />
  </ArtFrame>;
  const center = complete ? 220 : 310;
  const closed = game.step === "decorate" || complete;
  const bunTop = closed ? 169 : 125;
  return <ArtFrame label={`${complete ? uiText("Finished") : uiText("Your")} ${shape} cheeseburger with ${game.sauce ?? uiText("no sauce yet")}, ${game.topping ?? uiText("no topping yet")}${complete ? uiText(", beside a capybara chef") : ""}`}>
    {complete && <Item name="capybara" x={397} y={95} width={183} height={282} />}
    <Item name="plate" x={center - 164} y={331} width={328} height={91} />
    <Item name="bottom-bun" x={center - 126} y={301} width={252} height={67} />
    <Item name="patty" x={center - 128} y={269} width={256} height={68} />
    <Item name="cheese" x={center - 135} y={254} width={270} height={65} />
    {game.sauce && <Item name={game.sauce} x={center - 115} y={251} width={230} height={34} animationKey={`sauce-${game.sauce}-${game.step === "sauce" ? game.animation : 0}`} className={game.step === "sauce" ? "burger-fall-animation" : ""} />}
    {game.topping && <div data-burger-topping={game.topping}><Item name={game.topping === "tomato" ? "tomato-slice" : game.topping} x={center - 130} y={230} width={260} height={55} animationKey={`topping-${game.topping}-${game.step === "topping" ? game.animation : 0}`} className={game.step === "topping" ? "burger-fall-animation" : ""} /></div>}
    <div className={`burger-top-bun ${game.step === "decorate" ? "burger-close-animation" : ""}`}>
      <Item name={`bun-${shape}`} x={center - 129} y={bunTop} width={258} height={94} />
    </div>
    {game.pick && <Item name={`pick-${game.pick}`} x={center - 31} y={81} width={62} height={110} animationKey={game.pick} className="burger-fall-animation" />}
    {complete && <div className="burger-flower-burst">{[[77, 68], [324, 30], [534, 70], [37, 225], [563, 286], [343, 173]].map(([x, y], i) => <Item key={i} name="flower" x={x!} y={y!} width={36} height={34} interactive={false} />)}</div>}
  </ArtFrame>;
}
