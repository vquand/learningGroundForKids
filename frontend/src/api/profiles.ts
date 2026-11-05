import { coreRequest } from "./core.ts";
import type { MarkDoneResponse, ProfileCreate, ProfileUpdate, ProfileWithStats } from "../types/profile.ts";
import type { ProgressResponse } from "../types/progress.ts";

export { fetchAchievements, fetchBadges, fetchProfileLessons, fetchRecentActivity, fetchJourney } from "./profileExtras.ts";

export function fetchProfiles(): Promise<ProfileWithStats[]> {
  return coreRequest<ProfileWithStats[]>("/api/v1/profiles");
}

export function createProfile(data: ProfileCreate): Promise<ProfileWithStats> {
  return coreRequest<ProfileWithStats>("/api/v1/profiles", { method: "POST", body: JSON.stringify(data) });
}

export function updateProfile(profileId: string, data: ProfileUpdate): Promise<ProfileWithStats> {
  return coreRequest<ProfileWithStats>(`/api/v1/profiles/${encodeURIComponent(profileId)}`, {
    method: "PUT", body: JSON.stringify(data),
  });
}

export function uploadProfileAvatar(profileId: string, file: File): Promise<ProfileWithStats> {
  const body = new FormData();
  body.append("file", file);
  return coreRequest<ProfileWithStats>(`/api/v1/profiles/${encodeURIComponent(profileId)}/avatar`, {
    method: "POST",
    body,
  });
}

export async function createProfileWithAvatar(
  data: ProfileCreate,
  avatarFile: File | null,
): Promise<{ profile: ProfileWithStats; avatarUploadError?: string }> {
  const profile = await createProfile(data);
  if (!avatarFile) return { profile };
  try {
    return { profile: await uploadProfileAvatar(profile.id, avatarFile) };
  } catch (error) {
    return {
      profile,
      avatarUploadError: error instanceof Error ? error.message : "Avatar upload failed.",
    };
  }
}

export async function deleteProfile(profileId: string): Promise<void> {
  await coreRequest<void>(`/api/v1/profiles/${encodeURIComponent(profileId)}`, { method: "DELETE" });
}

export function fetchProgress(profileId: string): Promise<ProgressResponse> {
  return coreRequest<ProgressResponse>(`/api/v1/profiles/${encodeURIComponent(profileId)}/progress`);
}

export async function checkItemDone(profileId: string, itemId: string): Promise<boolean> {
  const result = await coreRequest<{ done: boolean }>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/progress/${encodeURIComponent(itemId)}`,
  );
  return result.done;
}

export function markItemDone(profileId: string, itemId: string): Promise<MarkDoneResponse> {
  return coreRequest<MarkDoneResponse>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/progress/${encodeURIComponent(itemId)}`,
    { method: "POST" },
  );
}

export interface ProfileTourStatus {
  completed: boolean;
}

export function fetchProfileTour(profileId: string): Promise<ProfileTourStatus> {
  return coreRequest<ProfileTourStatus>(`/api/v1/profiles/${encodeURIComponent(profileId)}/tour`);
}

export function completeProfileTour(profileId: string): Promise<ProfileTourStatus> {
  return coreRequest<ProfileTourStatus>(`/api/v1/profiles/${encodeURIComponent(profileId)}/tour/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
