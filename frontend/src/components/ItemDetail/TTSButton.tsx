import { useEffect } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useTTS } from '../../hooks/useTTS';

interface TTSButtonProps {
  /** Text to read aloud */
  text: string;
  /** Language of the supplied learning content, independent of UI locale. */
  lang: string;
}

/**
 * Small icon button that reads a text block aloud using the browser's
 * built-in Web Speech API — free, no server calls, works on iPad Safari.
 * Renders nothing when the API is unavailable or text is empty.
 */
export function TTSButton({ text, lang }: TTSButtonProps) {
  useUiLanguage();
  const { speak, stop, isSpeaking, isSupported } = useTTS();

  useEffect(() => { stop(); }, [text, lang, stop]);

  if (!isSupported || !text.trim()) return null;

  return (
    <button
      type="button"
      onClick={() => (isSpeaking ? stop() : speak(text, lang))}
      aria-label={isSpeaking ? uiText("Stop reading") : uiText("Read aloud")}
      title={isSpeaking ? uiText("Stop reading") : uiText("Read aloud")}
      className={[
        'inline-flex items-center justify-center',
        'w-10 h-10 rounded-full transition-colors',
        isSpeaking
          ? 'bg-blue-100 text-blue-600 animate-pulse'
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600',
      ].join(' ')}
    >
      {isSpeaking ? '⏹' : '🔊'}
    </button>
  );
}
