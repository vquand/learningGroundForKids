import type { ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import './badgesIconButton.css';

/** Shares the fixed top-right navigation row with the language selector. */
export function BadgesIconButton(props: ComponentProps<'button'>) {
  useUiLanguage();
  return createPortal(<button {...props} type="button" className="minigame-badges-button" aria-label={uiText('Badges')} title={uiText('Badges')}>
    <img src="/minigames/achievements/badges-button.png" alt="" aria-hidden="true" draggable={false} />
  </button>, document.body);
}
