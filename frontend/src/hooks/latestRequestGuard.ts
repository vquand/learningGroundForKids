export function createLatestRequestGuard() {
  let latestGeneration = 0;
  return {
    begin: () => ++latestGeneration,
    invalidate: () => { latestGeneration += 1; },
    isCurrent: (generation: number) => generation === latestGeneration,
  };
}
