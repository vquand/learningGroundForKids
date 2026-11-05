import { coreRequest } from './core';
import type { KitchenCompletions } from '../../../server/src/kitchen/completions';

export function fetchKitchenCompletions(profileId: string): Promise<KitchenCompletions> {
  return coreRequest(`/api/v1/profiles/${encodeURIComponent(profileId)}/kitchen-completions`, { cache: 'no-store' });
}
