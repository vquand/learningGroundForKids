import { create } from "zustand";
import { fetchAdminAccess, type AdminAccess } from "../api/adminSession.ts";
import { useFamilyStore } from "./familyStore.ts";

interface AdminState {
  access: AdminAccess | "checking" | "error";
  verifiedSessionGeneration: number | null;
  refresh: () => Promise<AdminAccess | "error">;
  logout: () => void;
}

let requestVersion = 0;

export const useAdminStore = create<AdminState>()((set) => ({
  access: "checking",
  verifiedSessionGeneration: null,
  refresh: async () => {
    const version = ++requestVersion;
    const sessionGeneration = useFamilyStore.getState().sessionGeneration;
    set({ access: "checking", verifiedSessionGeneration: null });
    try {
      const access = await fetchAdminAccess();
      if (version === requestVersion) {
        if (sessionGeneration === useFamilyStore.getState().sessionGeneration) {
          set({ access, verifiedSessionGeneration: sessionGeneration });
        } else {
          set({ access: "checking", verifiedSessionGeneration: null });
        }
      }
      return access;
    } catch {
      if (version === requestVersion) set({ access: "error", verifiedSessionGeneration: null });
      return "error";
    }
  },
  logout: () => {
    requestVersion += 1;
    set({ access: "signed-out", verifiedSessionGeneration: null });
  },
}));
