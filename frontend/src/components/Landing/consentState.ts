export function hasReachedConsentEnd(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  tolerance = 8,
): boolean {
  return scrollHeight <= clientHeight + tolerance
    || scrollHeight - scrollTop - clientHeight <= tolerance;
}
