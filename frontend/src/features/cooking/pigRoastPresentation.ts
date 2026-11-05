export const GRILL_GLAZE_DURATION_MS = 4200;
// Matching six-view raw/warming/golden sheets, including their transparent gutters.
export const PIG_ROTATION_CROPS = [
  [4, 100, 550, 315], [561, 100, 550, 315], [1118, 100, 550, 315],
  [4, 535, 550, 315], [561, 535, 550, 315], [1118, 535, 550, 315],
] as const;

/** Presentation only: golden readiness and burn limits remain in the game reducer. */
export function roastAppearance(turns: number, rawRoundLimit: number) {
  const progress = Math.max(0, Math.min(1, turns / (rawRoundLimit + 1)));
  const warming = Math.max(0, Math.min(1, (progress - .18) / .44));
  const golden = Math.max(0, Math.min(1, (progress - .72) / .28));
  return { warming, golden, label: progress >= 1 ? 'Golden roasted' : progress > .18 ? 'Lightly toasted' : 'Uncooked' };
}
