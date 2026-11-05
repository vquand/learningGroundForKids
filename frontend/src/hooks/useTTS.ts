import { useState, useCallback, useEffect } from 'react';

import { speechLanguage, matchingSpeechVoice } from '../lib/speechLanguage';

export function useTTS() {
  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [isSpeaking, setIsSpeaking] = useState(false);

  // Cancel any ongoing speech when the component using this hook unmounts
  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const speak = useCallback(
    (text: string, lang: string) => {
      if (!isSupported || !text.trim()) return;
      const synth = window.speechSynthesis;
      synth.cancel(); // stop anything already playing
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLanguage(lang);
      const voice = matchingSpeechVoice(synth.getVoices(), lang);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      synth.speak(utterance);
    },
    [isSupported],
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
