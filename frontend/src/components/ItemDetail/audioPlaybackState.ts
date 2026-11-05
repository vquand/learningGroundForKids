export interface PlaybackRejectionResult {
  playing: boolean;
  loadError: boolean;
}

function errorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) return undefined;
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

export function isAbortPlaybackError(error: unknown): boolean {
  return errorName(error) === "AbortError";
}

export function isKnownPlaybackError(error: unknown): boolean {
  const name = errorName(error);
  return name === "NotAllowedError" || name === "NotSupportedError";
}

/** Keeps a pending media request tied to the latest user intent. */
export class AudioPlaybackController {
  private mounted = true;
  private token = 0;
  private wantsPlayback = false;

  mount(): void { this.mounted = true; }

  toggle(): { shouldPlay: boolean; token: number } {
    this.wantsPlayback = !this.wantsPlayback;
    this.token += 1;
    return { shouldPlay: this.wantsPlayback, token: this.token };
  }

  pause(): void {
    this.wantsPlayback = false;
    this.token += 1;
  }

  isMounted(): boolean { return this.mounted; }
  isCurrent(token: number): boolean { return this.mounted && token === this.token; }
  isPlaybackWanted(): boolean { return this.mounted && this.wantsPlayback; }

  reject(token: number, error: unknown): PlaybackRejectionResult | null {
    if (!this.isCurrent(token) || !this.wantsPlayback) return null;
    this.wantsPlayback = false;
    return { playing: false, loadError: isKnownPlaybackError(error) };
  }

  mediaError(): boolean {
    if (!this.mounted) return false;
    this.wantsPlayback = false;
    this.token += 1;
    return true;
  }

  unmount(): void {
    this.mounted = false;
    this.wantsPlayback = false;
    this.token += 1;
  }
}
