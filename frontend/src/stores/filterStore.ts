import { create } from "zustand";

import type { ExploreProgress } from '../types/explore.ts';

interface FilterState {
  progressByProfile: Record<string, ExploreProgress>;
  progressSession: string;
  setProgress: (session: string, profile: string, progress: ExploreProgress) => void;
  activeCategories: string[];
  toggleCategory: (category: string) => void;
  clearFilters: () => void;
  activeYear: number | null;
  setActiveYear: (year: number | null) => void;
  clearEra: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  progressByProfile: {},
  progressSession: '',
  setProgress: (session, profile, progress) => set(state => ({
    progressSession: session,
    progressByProfile: { ...(state.progressSession === session ? state.progressByProfile : {}), [profile]: progress },
  })),
  activeCategories: [],
  toggleCategory: (category: string) =>
    set((state) => ({
      activeCategories: state.activeCategories.includes(category)
        ? state.activeCategories.filter((c) => c !== category)
        : [...state.activeCategories, category],
    })),
  clearFilters: () => set({ activeCategories: [] }),
  activeYear: null,
  setActiveYear: (year: number | null) => set({ activeYear: year }),
  clearEra: () => set({ activeYear: null }),
}));

export function profileProgress(state: Pick<FilterState, 'progressSession' | 'progressByProfile'>, session: string, profile: string): ExploreProgress {
  return state.progressSession === session ? state.progressByProfile[profile] ?? 'todo' : 'todo';
}
