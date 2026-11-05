export function speechLanguage(language: string): string {
  return language === 'vi' ? 'vi-VN' : language === 'en' ? 'en-US' : language;
}
export function matchingSpeechVoice<T extends { lang: string; default: boolean }>(voices: readonly T[], language: string): T | undefined {
  const tag = speechLanguage(language).toLowerCase();
  return voices.find(voice => voice.lang.toLowerCase() === tag)
    ?? voices.find(voice => voice.default && voice.lang.toLowerCase().split('-')[0] === tag.split('-')[0])
    ?? voices.find(voice => voice.lang.toLowerCase().split('-')[0] === tag.split('-')[0]);
}
