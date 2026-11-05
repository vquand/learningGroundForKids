import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useState } from 'react';
import type { Character } from '../../types/item';

const AVATAR_COLORS = [
  'bg-amber-200 text-amber-800',
  'bg-purple-200 text-purple-800',
  'bg-blue-200 text-blue-800',
  'bg-green-200 text-green-800',
  'bg-pink-200 text-pink-800',
  'bg-orange-200 text-orange-800',
  'bg-teal-200 text-teal-800',
  'bg-red-200 text-red-800',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? 'bg-gray-200 text-gray-800';
}

interface CharacterCardProps {
  character: Character;
}

export function CharacterCard({ character }: CharacterCardProps) {
  useUiLanguage();
  const [expanded, setExpanded] = useState(false);
  const colorClass = avatarColor(character.name);

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer select-none transition-all ${
        expanded ? 'bg-purple-50 border-purple-200' : 'bg-white'
      }`}
      style={{ width: '120px' }}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
      aria-expanded={expanded}
    >
      {/* Face */}
      <div className="w-full h-28 overflow-hidden">
        {character.image_url ? (
          <img
            src={character.image_url}
            alt={character.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-4xl font-bold ${colorClass}`}>
            {character.name[0]?.toUpperCase() ?? '?'}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="px-2 py-2 text-center">
        <p className="text-sm font-bold leading-tight break-words">{character.name}</p>
      </div>

      {/* Expanded description */}
      {expanded && (
        <div className="px-3 pb-3 text-xs text-purple-900 leading-relaxed border-t border-purple-100 pt-2">
          {character.description ?? uiText("More info coming soon!")}
        </div>
      )}
    </div>
  );
}

export default CharacterCard;
