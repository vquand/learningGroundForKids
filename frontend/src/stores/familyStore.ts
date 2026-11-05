import { create } from "zustand";
import { useProfileStore } from './profileStore.ts';
import {
  fetchSession,
  type AuthSession,
} from "../api/auth.ts";

interface FamilyState {
  // Core session state
  session: AuthSession | null;
  familyId: string | null;
  familyName: string | null;
  sessionGeneration: number;
  isInitializing: boolean;

  // Actions
  clearSession: () => void;
  initSession: () => Promise<void>;
}

// A logout or newer refresh invalidates responses from requests already in flight.
let sessionRequestVersion = 0;

export const useFamilyStore = create<FamilyState>()((set) => ({
  session: null,
  familyId: null,
  familyName: null,
  sessionGeneration: 0,
  isInitializing: true,

  clearSession: () => {
    sessionRequestVersion += 1;
    useProfileStore.getState().clearProfile();
    set((state) => ({
      session: null,
      familyId: null,
      familyName: null,
      isInitializing: false,
      sessionGeneration: state.familyId ? state.sessionGeneration + 1 : state.sessionGeneration,
    }));
  },

  initSession: async () => {
    const requestVersion = ++sessionRequestVersion;
    set({ isInitializing: true });

    try {
      const session = await fetchSession();

      set((state) => {
        if (requestVersion !== sessionRequestVersion) return state;
        const familyId = session?.user.id ?? null;
        if (familyId !== state.familyId) useProfileStore.getState().clearProfile();
        return {
          session,
          familyId,
          familyName: session?.user.name ?? null,
          sessionGeneration:
            state.familyId === familyId
              ? state.sessionGeneration
              : state.sessionGeneration + 1,
          isInitializing: false,
        };
      });
    } catch {
      if (requestVersion === sessionRequestVersion) useProfileStore.getState().clearProfile();
      set((state) => requestVersion === sessionRequestVersion ? ({
        session: null,
        familyId: null,
        familyName: null,
        sessionGeneration: state.familyId ? state.sessionGeneration + 1 : state.sessionGeneration,
        isInitializing: false,
      }) : state);
    }
  },
}));
