import sprites from "./burgerSprites.json";
import "./burgerSprite.css";

export type BurgerSpriteName = keyof typeof sprites;

/** Crop a generated PNG atlas in CSS without resampling the original artwork. */
export function BurgerSprite({ name, className = "" }: { name: BurgerSpriteName; className?: string }) {
  const sprite = sprites[name];
  const [width = 1, height = 1] = sprite.size;
  const [x = 0, y = 0, cropWidth = 1, cropHeight = 1] = sprite.crop;
  return <span aria-hidden="true" className={`burger-sprite ${className}`} data-burger-sprite={name} style={{
    backgroundImage: `url(/minigames/cooking/burger/${sprite.sheet}.png?v=2)`,
    backgroundSize: `${width / cropWidth * 100}% ${height / cropHeight * 100}%`,
    backgroundPosition: `${width === cropWidth ? 0 : x / (width - cropWidth) * 100}% ${height === cropHeight ? 0 : y / (height - cropHeight) * 100}%`,
    aspectRatio: `${cropWidth} / ${cropHeight}`,
  }} />;
}
