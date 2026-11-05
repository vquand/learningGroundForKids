import { coreRequest } from "./core.ts";
import type { CreateFriendRequestInput, FriendRequest } from "../types/social";

export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  return coreRequest<FriendRequest[]>("/api/v1/friend-requests");
}

export async function createFriendRequest(
  input: CreateFriendRequestInput,
): Promise<FriendRequest> {
  return coreRequest<FriendRequest>("/api/v1/friend-requests", {
    method: "POST",
    body: JSON.stringify({
      requesting_scope: input.requestingScope,
      requesting_profile_id: input.requestingProfileId,
      target_code: input.targetCode.trim().toUpperCase(),
      target_scope: input.targetScope,
    }),
  });
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean,
): Promise<FriendRequest> {
  return coreRequest<FriendRequest>(
    `/api/v1/friend-requests/${encodeURIComponent(requestId)}/respond`,
    {
      method: "POST",
      body: JSON.stringify({ accept }),
    },
  );
}
