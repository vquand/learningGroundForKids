import type { QueryClient } from "@tanstack/react-query";
import { fetchFriendRequests } from "../api/social.ts";
import {
  familyQueryKey,
  familyScopedQuery,
} from "./familyQueries.ts";
import type { FriendRequest } from "../types/social";

export const FRIEND_REQUEST_POLL_INTERVAL_MS = 15_000;

export function buildFriendRequestNotificationCopy() {
  return {
    title: "New friend request",
    body: "You have a new friend request to review.",
  };
}

export interface FamilyOwned<T> {
  familyId: string;
  operationId: string;
  value: T;
}

export interface FamilyMutation<T> {
  originFamilyId: string;
  operationId: string;
  request: T;
}

let familyOperationSequence = 0;

function createFamilyOperationId(): string {
  familyOperationSequence += 1;
  return `family-operation-${familyOperationSequence}`;
}

export function familyOwned<T>(
  familyId: string,
  value: T,
  operationId = createFamilyOperationId(),
): FamilyOwned<T> {
  return { familyId, operationId, value };
}

export function visibleFamilyValue<T>(
  owned: FamilyOwned<T> | null,
  familyId: string | null,
): T | null {
  return familyId && owned?.familyId === familyId ? owned.value : null;
}

export function visibleFamilyValues<T>(
  owned: ReadonlyArray<FamilyOwned<T>>,
  familyId: string | null,
): T[] {
  if (!familyId) return [];
  return owned
    .filter((entry) => entry.familyId === familyId)
    .map((entry) => entry.value);
}

export function clearFamilyOwned<T>(
  owned: FamilyOwned<T> | null,
  originFamilyId: string,
  operationId?: string,
): FamilyOwned<T> | null {
  return owned?.familyId === originFamilyId &&
      (!operationId || owned.operationId === operationId)
    ? null
    : owned;
}

export function updateFamilyOwned<T>(
  owned: FamilyOwned<T> | null,
  originFamilyId: string,
  operationId: string | undefined,
  update: (value: T) => T,
): FamilyOwned<T> | null {
  if (
    !owned ||
    owned.familyId !== originFamilyId ||
    (operationId !== undefined && owned.operationId !== operationId)
  ) return owned;
  return familyOwned(originFamilyId, update(owned.value), owned.operationId);
}

export function familyMutation<T>(
  originFamilyId: string,
  request: T,
  operationId = createFamilyOperationId(),
): FamilyMutation<T> {
  return { originFamilyId, operationId, request };
}

export function isFamilyMutationPending(
  isPending: boolean,
  variables: FamilyMutation<unknown> | undefined,
  familyId: string | null,
  operationId?: string,
): boolean {
  return Boolean(
    isPending &&
    familyId &&
    variables?.originFamilyId === familyId &&
    (!operationId || variables.operationId === operationId),
  );
}

export function friendRequestQueryKey(familyId: string | null) {
  return familyQueryKey("friend-requests", familyId);
}

export function createFriendRequestQueryOptions(familyId: string | null) {
  const isActive = Boolean(familyId);
  const refetchInterval: number | false = isActive
    ? FRIEND_REQUEST_POLL_INTERVAL_MS
    : false;

  return {
    queryKey: friendRequestQueryKey(familyId),
    queryFn: familyScopedQuery(familyId, fetchFriendRequests),
    enabled: isActive,
    refetchInterval,
    refetchIntervalInBackground: isActive,
  };
}

export interface ClosableNotification {
  close: () => void;
}

export function clearFamilyOwnedNotificationHandles(
  handles: ReadonlyArray<FamilyOwned<ClosableNotification>>,
): void {
  for (const { value } of handles) value.close();
}

export async function invalidateFriendRequests(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  familyId: string | null,
): Promise<void> {
  if (!familyId) return;
  await queryClient.invalidateQueries({
    queryKey: friendRequestQueryKey(familyId),
    exact: true,
  });
}

export interface FriendRequestObservationState {
  familyId: string | null;
  seenRequestIds: Set<string>;
  hasEstablishedBaseline: boolean;
}

interface FriendRequestObservation {
  newRequests: FriendRequest[];
  state: FriendRequestObservationState;
}

export function createFriendRequestObservationState(
  familyId: string | null = null,
): FriendRequestObservationState {
  return {
    familyId,
    seenRequestIds: new Set<string>(),
    hasEstablishedBaseline: false,
  };
}

export function observeFriendRequests(
  requests: FriendRequest[],
  familyId: string,
  state: FriendRequestObservationState,
): FriendRequestObservation {
  const isSameFamily = state.familyId === familyId;
  const nextSeenRequestIds = isSameFamily
    ? new Set(state.seenRequestIds)
    : new Set<string>();
  const newRequests = isSameFamily && state.hasEstablishedBaseline
    ? requests.filter(
        (request) =>
          request.target_family_id === familyId &&
          request.status === "pending" &&
          !nextSeenRequestIds.has(request.id),
      )
    : [];

  for (const request of requests) nextSeenRequestIds.add(request.id);

  return {
    newRequests,
    state: {
      familyId,
      seenRequestIds: nextSeenRequestIds,
      hasEstablishedBaseline: true,
    },
  };
}
