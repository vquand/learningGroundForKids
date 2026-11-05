interface LanguageToggleProps {
  available: string[];
  current: string;
  onChange: (lang: string) => void;
}

export function LanguageToggle({ available, current, onChange }: LanguageToggleProps) {
  if (available.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {available.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={
            lang === current
              ? 'px-4 py-2 rounded-full text-lg font-bold min-w-[64px] min-h-[64px] bg-blue-500 text-white'
              : 'px-4 py-2 rounded-full text-lg font-bold min-w-[64px] min-h-[64px] bg-gray-200 text-gray-600'
          }
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default LanguageToggle;
