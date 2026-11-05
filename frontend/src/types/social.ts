export type FriendScope = "profile" | "family";

export type FriendRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface FriendRequestParty {
  name: string;
  emoji?: string;
  color?: string;
  avatar_type?: 'default'|'custom'|'emoji'|null;
  avatar_url?: string|null;
  avatar_frame?: string|null;
}

export interface FriendRequest {
  requesting_party?: FriendRequestParty;
  target_party?: FriendRequestParty;
  id: string;
  requesting_family_id: string;
  requesting_scope: FriendScope;
  requesting_profile_id: string | null;
  requesting_label: string;
  target_family_id: string;
  target_scope: FriendScope;
  target_profile_id: string | null;
  target_label: string;
  target_code: string;
  requester_message: string;
  status: FriendRequestStatus;
  created_at: string;
  responded_at: string | null;
  responded_by_family_id: string | null;
}

export interface CreateFriendRequestInput {
  requestingScope: FriendScope;
  requestingProfileId: string | null;
  targetCode: string;
  targetScope: FriendScope;
}
