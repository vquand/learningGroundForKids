import { handlePreparedMapError, PreparedViewCache } from './preparedMapLoader.ts';
import type { ExploreProgress, ExploreTimelineYear, ExploreView } from '../types/explore.ts';

/** The two server projections must agree before starting a filtered request. */
export function completionRevision(progress: ExploreProgress, total: number | undefined, done: Set<string>, loaded: boolean): string | null {
  if (progress === 'all') return '';
  if (!loaded || total === undefined || total !== done.size) return null;
  return JSON.stringify([total, [...done].sort()]);
}

export function timelineKey(years: ExploreTimelineYear[], version: string | undefined, progress: ExploreProgress, categories: string[]) {
  return JSON.stringify([version, progress, [...categories].sort(), years.map(entry => [entry.year, entry.count])]);
}

/** Shared by the React hook and Node tests; cancellation guards all side effects. */
export class PreparedMapLifecycle {
  private cache = new PreparedViewCache();
  private serial = 0;
  private state: { identity: string; key: string; revision: string | null; view: ExploreView | null; busy: boolean; error: boolean } | undefined;

  read(identity: string, key: string, revision: string | null) {
    const cached = this.cache.read(identity, key, revision);
    const state = this.state;
    const matches = state?.identity === identity && state.key === key && state.revision === revision;
    return {
      view: matches ? state.view : cached.view,
      busy: !matches || state.busy,
      error: Boolean(matches && state.error),
      ready: Boolean(matches && revision !== null && !state.busy && !state.error && state.view),
    };
  }

  load(identity: string, key: string, revision: string | null, fetch: (signal: AbortSignal) => Promise<ExploreView>, changed: () => void,
    timeline?: (years: ExploreTimelineYear[], version: string) => void) {
    const controller = new AbortController();
    const serial = ++this.serial;
    const current = () => !controller.signal.aborted && serial === this.serial;
    const cached = this.cache.read(identity, key, revision);
    this.state = { identity, key, revision, view: cached.view, busy: true, error: false };
    changed();
    const done = revision === null ? Promise.resolve() : Promise.resolve().then(() => {
      if (!current()) return;
      return fetch(controller.signal);
    }).then(view => {
      if (!view || !current()) return;
      this.cache.put(identity, key, view, revision);
      this.state = { identity, key, revision, view, busy: false, error: false };
      changed();
      timeline?.(view.timeline, view.version);
    }).catch(error => {
      if (!current()) return;
      const revoked = handlePreparedMapError(error);
      if (revoked) this.cache.clear();
      this.state = { identity, key, revision, view: revoked ? null : cached.view, busy: false, error: true };
      changed();
    });
    return { done, cancel: () => controller.abort() };
  }
}
