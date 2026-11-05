import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import type { BadgeInfo } from '../../types/profile';
import './BadgeCelebration.css';

interface BadgeCelebrationProps {
  badge: BadgeInfo | null;
  onDismiss: () => void;
}

function emojiForBadgeType(type: string): string {
  const map: Record<string, string> = {
    global: '🌍',
    food: '🍳',
    monument: '🏛️',
    landmark: '📍',
    music: '🎵',
    movie: '🎬',
  };
  return map[type] ?? '⭐';
}

export function BadgeCelebration({ badge, onDismiss }: BadgeCelebrationProps) {
  useUiLanguage();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!badge) return;

    // Reset exit state when a new badge arrives
    setExiting(false);

    const dismissTimer = setTimeout(() => {
      setExiting(true);
      const fadeTimer = setTimeout(() => {
        onDismiss();
      }, 300);
      return () => clearTimeout(fadeTimer);
    }, 3000);

    return () => clearTimeout(dismissTimer);
  }, [badge, onDismiss]);

  if (!badge) return null;

  function handleDismiss() {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleDismiss();
      }}
    >
      <div
        className={`flex flex-col items-center gap-4 p-8 bg-white rounded-3xl shadow-2xl max-w-xs mx-4 ${
          exiting ? 'badge-celebrate-exit' : 'badge-celebrate-enter badge-celebrate-glow'
        }`}
      >
        <span className="text-6xl">{emojiForBadgeType(badge.badge_type)}</span>
        <h2 className="text-2xl font-bold text-center text-yellow-600">
          {uiText("Badge Earned!")}</h2>
        <p className="text-xl font-semibold text-center">{badge.name}</p>
        <p className="text-sm text-gray-500 text-center">{badge.description}</p>
        <p className="text-xs text-gray-400 mt-2">{uiText("Tap to continue")}</p>
      </div>
    </div>
  );
}
