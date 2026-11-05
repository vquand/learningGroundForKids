import type { CabbageRollCommand, CabbageRollSession } from '../../../server/src/town-building/cabbage-rolls';
import type { Cost } from '../../../server/src/town-building/game';
import { coreRequest } from './core.ts';

const base = (profileId: string) => `/api/v1/profiles/${encodeURIComponent(profileId)}/cabbage-rolls`;

export const fetchCabbageRoll = (profileId: string) => coreRequest<CabbageRollSession>(base(profileId));

export const actCabbageRoll = (profileId: string, revision: number, command: CabbageRollCommand) =>
  coreRequest<CabbageRollSession & { townReward: Cost }>(`${base(profileId)}/action`, {
    method: 'POST',
    body: JSON.stringify({ revision, command }),
  });
