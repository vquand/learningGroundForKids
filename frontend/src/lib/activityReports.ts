import type { ChildReport, GameReport } from '../api/parentReports';

/** Preserve metric units and reporting scopes when combining a family. */
export function aggregateActivityGames(children: ChildReport[]): GameReport[] {
  const templates = new Map(children.flatMap(child => child.games).map(game => [game.id, game]));
  return [...templates.values()].map(template => {
    const rows = children.flatMap(child => child.games.filter(game => game.id === template.id));
    return { ...template, recorded: rows.some(game => game.recorded),
      metrics: template.metrics.map(metric => ({ ...metric, value: metric.value === null ? null
        : rows.reduce((sum, game) => sum + (game.metrics.find(entry => entry.key === metric.key)?.value ?? 0), 0) })),
      achievements: rows.flatMap(game => game.achievements),
    };
  });
}

export function hasRecordedLearning(child: ChildReport): boolean {
  return child.exploring_completed > 0 || child.quiz_attempts > 0 || child.games.some(game =>
    ['road-racing', 'flashcards', 'shoo-shoo-ufo', 'waddle-wall', 'infinidrill-earth', 'miniku', 'food-and-drink', 'fishing'].includes(game.id)
      && ((game.metrics[0]?.value ?? 0) > 0 || game.id === 'fishing' && (game.metrics.find(metric => metric.key === 'questions')?.value ?? 0) > 0));
}

export function latestSavedActivity(children: ChildReport[]): string | null {
  return children.reduce<string | null>((latest, child) => child.last_activity_at &&
    (!latest || child.last_activity_at > latest) ? child.last_activity_at : latest, null);
}
