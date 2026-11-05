import type { FriendRequestRecord } from "./contracts/db.js";

export const FRIEND_REQUEST_MAX_LIST = 100;

export type FriendRequestScope = "profile" | "family";
export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export function normalizeTargetCode(value: string): string {
  return value.trim().toUpperCase();
}

export function friendScopeLabel(scope: FriendRequestScope, name: string): string {
  return scope === "profile" ? `${name} only` : `${name} family (all kids now and later)`;
}

export function friendRequestMessage(
  requestingLabel: string,
  targetLabel: string,
  targetCode: string,
  targetProfileName: string,
): string {
  return `${requestingLabel} wants to be friends with ${targetLabel}. Target code: ${targetCode} (${targetProfileName}).`;
}

export function friendRequestResponse(request: FriendRequestRecord): Record<string, unknown> {
  return {
    ...(request.requesting_party?{requesting_party:request.requesting_party}:{}),
    ...(request.target_party?{target_party:request.target_party}:{}),
    id: request.id,
    requesting_family_id: request.requesting_family_id,
    requesting_scope: request.requesting_scope,
    requesting_profile_id: request.requesting_profile_id,
    requesting_label: request.requesting_label,
    target_family_id: request.target_family_id,
    target_scope: request.target_scope,
    target_profile_id: request.target_profile_id,
    target_label: request.target_label,
    target_code: request.target_code,
    requester_message: request.requester_message,
    status: request.status,
    created_at: request.created_at instanceof Date ? request.created_at.toISOString() : request.created_at,
    responded_at: request.responded_at === null
      ? null
      : request.responded_at instanceof Date ? request.responded_at.toISOString() : request.responded_at,
    responded_by_family_id: request.responded_by_family_id,
  };
}
