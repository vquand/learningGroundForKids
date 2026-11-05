/** Canonical reviewed metadata and thresholds; only the server grades progress. */
export const MINIKU_ACHIEVEMENTS = [
  { id: 'miniku-first-solve', name: 'First Little Grid', description: 'Complete your first Miniku board.', badge: '/minigames/miniku/miniku-badges.png', badgeIndex: 0, badgeColumns: 4, badgeRows: 1, difficulty: 'easy', metric: 'minikuCompleted', target: 1 },
  { id: 'miniku-three-sizes', name: 'Grid Explorer', description: 'Complete a 3×3, 4×4, and 5×5 board.', badge: '/minigames/miniku/miniku-badges.png', badgeIndex: 1, badgeColumns: 4, badgeRows: 1, difficulty: 'medium', metric: 'minikuSizes', target: 3 },
  { id: 'miniku-five-boards', name: 'Puzzle Planner', description: 'Complete five Miniku boards.', badge: '/minigames/miniku/miniku-badges.png', badgeIndex: 2, badgeColumns: 4, badgeRows: 1, difficulty: 'hard', metric: 'minikuCompleted', target: 5 },
  { id: 'miniku-five-by-five', name: 'Big Grid Thinker', description: 'Complete a 5×5 Miniku board.', badge: '/minigames/miniku/miniku-badges.png', badgeIndex: 3, badgeColumns: 4, badgeRows: 1, difficulty: 'hard', metric: 'minikuFiveByFive', target: 1 },
] as const;

export function minikuAchievementMetrics(progress: { completed: number; completedBySize: Record<string, number> }) {
  return {
    minikuCompleted: progress.completed,
    minikuSizes: ['3', '4', '5'].filter(size => (progress.completedBySize[size] ?? 0) > 0).length,
    minikuFiveByFive: (progress.completedBySize['5'] ?? 0) > 0 ? 1 : 0,
  };
}
