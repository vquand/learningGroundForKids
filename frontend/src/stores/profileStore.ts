import { create } from "zustand";

interface ProfileState {
  activeProfileId: string | null;
  setActiveProfile: (id: string) => void;
  clearProfile: () => void;
}

// Child identity stays in session memory. Remove the previous device-persisted
// selection; a fresh page chooses a child after server-owned profile loading.
try { if (typeof localStorage !== 'undefined') localStorage.removeItem('plg-active-profile'); } catch { /* Storage can be disabled. */ }
export const useProfileStore = create<ProfileState>()((set) => ({
  activeProfileId: null,
  setActiveProfile: (id) => set({ activeProfileId: id }),
  clearProfile: () => set({ activeProfileId: null }),
}));
