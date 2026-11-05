import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useFamilyStore } from "../stores/familyStore.ts";

export interface FamilySessionSnapshot {
  familyId: string | null;
  sessionGeneration: number;
}

export function familyQueryKey(
  prefix: string,
  familyId: string | null,
  ...parts: readonly unknown[]
): readonly [string, string | null, ...unknown[]] {
  return [prefix, familyId, ...parts];
}

export function profileQueryKey(familyId: string | null) {
  return familyQueryKey("profiles", familyId);
}

export function sessionQueryKey(
  prefix: string,
  sessionGeneration: number,
  ...parts: readonly unknown[]
) {
  return [prefix, sessionGeneration, ...parts] as const;
}

export function getFamilySessionSnapshot(): FamilySessionSnapshot {
  const { familyId, sessionGeneration } = useFamilyStore.getState();
  return { familyId, sessionGeneration };
}

export function isCurrentFamilySession(
  expected: FamilySessionSnapshot,
): boolean {
  const current = getFamilySessionSnapshot();
  return Boolean(
    expected.familyId &&
    current.familyId === expected.familyId &&
    current.sessionGeneration === expected.sessionGeneration,
  );
}

export class InactiveFamilySessionError extends Error {
  constructor() {
    super("The family session is no longer active.");
    this.name = "InactiveFamilySessionError";
  }
}

export function familyScopedQuery<T>(
  familyId: string | null,
  request: () => Promise<T>,
  getSnapshot: () => FamilySessionSnapshot = getFamilySessionSnapshot,
): () => Promise<T> {
  const snapshot = getSnapshot();

  return async () => {
    if (
      !familyId ||
      snapshot.familyId !== familyId ||
      getSnapshot().familyId !== familyId ||
      getSnapshot().sessionGeneration !== snapshot.sessionGeneration
    ) {
      throw new InactiveFamilySessionError();
    }

    const result = await request();
    const current = getSnapshot();
    if (
      current.familyId !== familyId ||
      current.sessionGeneration !== snapshot.sessionGeneration
    ) {
      throw new InactiveFamilySessionError();
    }
    return result;
  };
}

const PRIVATE_QUERY_PREFIXES = new Set([
  "items",
  "item",
  "profiles",
  "friend-requests",
  "recent-activity",
  "adventures",
  "kitchen-session",
  "kitchen-completions",
  "parent-lesson-catalog",
  "parent-share-targets",
  "parent-lessons",
  "parent-reports",
  "parent-calendar",
  "family-onboarding",
  "parent-lesson",
  "progress",
  "achievements",
  "badges",
  "ufo",
  "infinidrill-badges",
  "math-wall",
  "math-wall-leaders",
  "town",
  "town-name",
  "town-environment",
  "town-friends",
  "town-visit",
  "town-basket",
  "town-raft",
  "miniku",
  "miniku-puzzles",
  "miniku-settings",
  "fishing",
  "profile-achievement-groups",
  "profile-tour",
  "quiz-status",
  "quiz-questions",
  "daily-quiz-settings",
  "daily-quiz-status",
  "daily-quiz-questions",
  "calendar",
  "calendar-participants",
  "parent-calendar-settings",
  "calendar-weather",
  "calendar-notifications",
  "flashcard-deck",
  "flashcard-options",
  "admin-flashcards",
  "admin-quiz",
  "admin-inspection",
]);

export function isPrivateQueryKey(queryKey: QueryKey): boolean {
  const prefix = queryKey[0];
  return typeof prefix === "string" && PRIVATE_QUERY_PREFIXES.has(prefix);
}

export async function clearPrivateQueryCache(
  queryClient: Pick<QueryClient, "cancelQueries" | "removeQueries">,
): Promise<void> {
  const filters = { predicate: (query: { queryKey: QueryKey }) => isPrivateQueryKey(query.queryKey) };
  await queryClient.cancelQueries(filters);
  queryClient.removeQueries(filters);
}
