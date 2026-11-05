// Shared pure engine; persistence and grading are owned by Render.
export * from "../../../../server/src/infinidrill/types.ts";
import type { PublicQuestion } from '../../../../server/src/questions/projection';
import type { InfinidrillGameState as ServerInfinidrillGameState } from '../../../../server/src/infinidrill/types';

/** Browser state contains the server-owned public question projection. */
export type InfinidrillViewState = Omit<ServerInfinidrillGameState, 'currentQuestion'> & {
  readonly currentQuestion: PublicQuestion | null;
};
