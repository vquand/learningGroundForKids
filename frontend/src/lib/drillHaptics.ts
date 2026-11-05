/** Optional device feedback after server-verified grading. Safari/iPad has no Vibration API. */
export function drillHaptics(device: Pick<Navigator, 'vibrate'> | undefined = typeof navigator === 'undefined' ? undefined : navigator,
  reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches): boolean {
  if (reducedMotion || typeof device?.vibrate !== 'function') return false;
  try { return device.vibrate([35, 45, 35]); } catch { return false; }
}
