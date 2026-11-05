import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useState } from "react";

export type CapybaraAction = "waiting" | "pour" | "stir" | "celebrate" | "wrong";

interface CapybaraAvatarProps {
  action: CapybaraAction;
}

const ACTION_ASSET: Record<CapybaraAvatarProps["action"], string> = {
  waiting: "capybara-idle",
  pour: "capybara-lean-right",
  stir: "capybara-mix-drink",
  celebrate: "capybara-celebrate",
  wrong: "capybara-wrong-choice",
};

export function CapybaraAvatar({ action }: CapybaraAvatarProps) {
  useUiLanguage();
  const [imageBroken, setImageBroken] = useState(false);
  return (
    <div className="food-drink-avatar" aria-label={uiText("Your capybara drink helper")}>
      {!imageBroken && (
        <img
          className="food-drink-avatar__image"
          src={`/minigames/food-and-drink/capybara/${ACTION_ASSET[action]}.png`}
          alt=""
          onError={() => setImageBroken(true)}
        />
      )}
      {imageBroken && <span className="food-drink-avatar__fallback" aria-hidden="true">🦫</span>}
    </div>
  );
}
