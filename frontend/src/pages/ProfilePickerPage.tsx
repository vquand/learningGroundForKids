import { FamilyOnboarding } from '../components/FamilyOnboarding';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { createProfileWithAvatar, fetchProfiles, uploadProfileAvatar } from "../api/profiles";
import {
  createFriendRequest,
  fetchFriendRequests,
  respondFriendRequest,
} from "../api/social";
import {FriendNotificationList} from '../components/ProfilePicker/FriendNotificationList';
import { EMPTY_CALENDAR_NOTIFICATIONS, useCalendarNotifications } from "../hooks/useCalendarNotifications";
import { FriendRequestDecisionModal } from "../components/ProfilePicker/FriendRequestDecisionModal";
import { FriendRequestModal } from "../components/ProfilePicker/FriendRequestModal";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { SeasonalScreen } from "../components/SeasonalScreen";
import {
  clearFamilyOwned,
  familyMutation,
  familyOwned,
  friendRequestQueryKey,
  invalidateFriendRequests,
  isFamilyMutationPending,
  updateFamilyOwned,
  visibleFamilyValue,
} from "../lib/friendRequestNotifications";
import { familyScopedQuery, profileQueryKey } from "../lib/familyQueries";
import type {
  FamilyMutation,
  FamilyOwned,
} from "../lib/friendRequestNotifications";
import {
  getFriendRequestNotificationPermission,
  requestFriendRequestNotificationPermission,
} from "../components/FriendRequestNotifications";
import { COUNTRY_OPTIONS, getCountryName } from "../lib/countries";
import { AVATAR_FRAMES, type AvatarFrameId } from "../lib/avatarFrames";
import { KID_AVATARS, resolveKidAvatar } from "../lib/kidAvatars";
import { COLOR_OPTIONS } from "../lib/profileAppearance";
import { useFamilyStore } from "../stores/familyStore";
import { useProfileStore } from "../stores/profileStore";
import type { ProfileCreate, ProfileWithStats } from "../types/profile";
import type { CreateFriendRequestInput, FriendRequest } from "../types/social";

interface FriendRequestModalState {
  error: string | null;
}

interface FriendDecisionModalState {
  request: FriendRequest;
  error: string | null;
}

type CreateFriendRequestMutation = FamilyMutation<CreateFriendRequestInput>;
type RespondFriendRequestMutation = FamilyMutation<{
  requestId: string;
  accept: boolean;
}>;

export function ProfilePickerPage({ preserveRoute = false }: { preserveRoute?: boolean } = {}) {
  useUiLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile);
  const familyId = useFamilyStore((s) => s.familyId);
  const familyName = useFamilyStore((s) => s.familyName);
  const clearSession = useFamilyStore((s) => s.clearSession);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [friendRequestModal, setFriendRequestModal] = useState<
    FamilyOwned<FriendRequestModalState> | null
  >(null);
  const [friendDecisionModal, setFriendDecisionModal] = useState<
    FamilyOwned<FriendDecisionModalState> | null
  >(null);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => getFriendRequestNotificationPermission());
  const [newName, setNewName] = useState("");
  const [selectedAvatarId, setSelectedAvatarId] = useState("capybara-calm");
  const [newAvatarFrame, setNewAvatarFrame] = useState<AvatarFrameId | null>(null);
  const [newColor, setNewColor] = useState("#3B82F6");
  const [newEmoji, setNewEmoji] = useState("🌟");
  const [newNativeCountryCode, setNewNativeCountryCode] = useState("");
  const [newNativeCity, setNewNativeCity] = useState("");
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [createdProfileAwaitingAvatar, setCreatedProfileAwaitingAvatar] = useState<ProfileWithStats | null>(null);
  const [avatarType, setAvatarType] = useState<"default" | "custom">("default");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    clearSession();
    useProfileStore.getState().clearProfile();
    try {
      await logout();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  useEffect(() => {
    if (!selectedAvatarFile) {
      setCustomAvatarUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(selectedAvatarFile);
    setCustomAvatarUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedAvatarFile]);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: profileQueryKey(familyId),
    queryFn: familyScopedQuery(familyId, fetchProfiles),
    enabled: Boolean(familyId),
    retry: false,
  });

  const { data: friendRequests = [] } = useQuery({
    queryKey: friendRequestQueryKey(familyId),
    queryFn: familyScopedQuery(familyId, fetchFriendRequests),
    enabled: Boolean(familyId),
  });
  const { data: calendarNotifications = EMPTY_CALENDAR_NOTIFICATIONS } = useCalendarNotifications();

  useEffect(() => {
    setFriendRequestModal((current) =>
      current?.familyId === familyId ? current : null,
    );
    setFriendDecisionModal((current) =>
      current?.familyId === familyId ? current : null,
    );
  }, [familyId]);

  const createMutation = useMutation({
    mutationFn: ({ data, file }: { data: ProfileCreate; file: File | null }) => familyScopedQuery(familyId, () => createProfileWithAvatar(data, file))(),
    onSuccess: ({ profile, avatarUploadError }) => {
      cacheCreatedProfile(profile);
      if (avatarUploadError) {
        setCreatedProfileAwaitingAvatar(profile);
        setAvatarError(avatarUploadError);
        setShowCreateForm(false);
        return;
      }
      resetCreateForm();
      handleSelectProfile(profile.id);
    },
  });

  const retryAvatarMutation = useMutation({
    mutationFn: ({ profileId, file }: { profileId: string; file: File }) => familyScopedQuery(familyId, () => uploadProfileAvatar(profileId, file))(),
    onSuccess: (profile) => {
      cacheCreatedProfile(profile);
      resetCreateForm();
      handleSelectProfile(profile.id);
    },
    onError: (error) => setAvatarError(error instanceof Error ? error.message : "Avatar upload failed."),
  });

  const createFriendRequestMutation = useMutation({
    mutationFn: ({ request: input }: CreateFriendRequestMutation) =>
      createFriendRequest(input),
    onSuccess: (_request, variables) => {
      setFriendRequestModal((current) =>
        clearFamilyOwned(current, variables.originFamilyId, variables.operationId),
      );
    },
    onError: (error, variables) => {
      const message = error instanceof Error ? error.message : "Could not send friend request";
      setFriendRequestModal((current) =>
        updateFamilyOwned(current, variables.originFamilyId, variables.operationId, (modal) => ({
          ...modal,
          error: message,
        })),
      );
    },
    onSettled: async (_request, _error, variables) => {
      await invalidateFriendRequests(queryClient, variables.originFamilyId);
    },
  });

  const respondFriendRequestMutation = useMutation({
    mutationFn: ({ request: { requestId, accept } }: RespondFriendRequestMutation) =>
      respondFriendRequest(requestId, accept),
    onSuccess: (_request, variables) => {
      setFriendDecisionModal((current) =>
        clearFamilyOwned(current, variables.originFamilyId, variables.operationId),
      );
    },
    onError: (error, variables) => {
      const message = error instanceof Error ? error.message : "Could not update friend request";
      setFriendDecisionModal((current) =>
        updateFamilyOwned(current, variables.originFamilyId, variables.operationId, (modal) => ({
          ...modal,
          error: message,
        })),
      );
    },
    onSettled: async (_request, _error, variables) => {
      await invalidateFriendRequests(queryClient, variables.originFamilyId);
    },
  });

  function resetCreateForm() {
    setShowCreateForm(false);
    setNewName("");
    setNewEmoji("🌟");
    setSelectedAvatarId("capybara-calm");
    setNewAvatarFrame(null);
    setNewColor("#3B82F6");
    setCustomAvatarUrl(null);
    setSelectedAvatarFile(null);
    setAvatarError(null);
    setCreatedProfileAwaitingAvatar(null);
    setAvatarType("default");
    setNewNativeCountryCode("");
    setNewNativeCity("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSelectProfile(profileId: string) {
    setActiveProfile(profileId);
    if (!preserveRoute) navigate("/playground");
  }

  function cacheCreatedProfile(profile: ProfileWithStats) {
    const queryKey = profileQueryKey(familyId);
    // The mutation response is server-owned. Install it before selecting so a
    // stale list cannot clear the new child while reconciliation is pending.
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData<ProfileWithStats[]>(queryKey, current => [...(current ?? []).filter(p => p.id !== profile.id), profile]);
    void queryClient.invalidateQueries({ queryKey, exact: true });
  }

  function handleCreateSubmit() {
    if (!newName.trim()) return;
    if (avatarType === "custom" && !selectedAvatarFile) {
      setAvatarError("Choose an image before creating this explorer.");
      return;
    }

    const selectedAvatar = resolveKidAvatar(selectedAvatarId);
    if (!selectedAvatar) {
      setAvatarError("Choose an avatar before creating this explorer.");
      return;
    }
    createMutation.mutate({
      data: {
        name: newName.trim(),
        emoji: newEmoji,
        color: newColor,
        avatar_type: "default",
        avatar_url: selectedAvatar.id,
        avatar_frame: newAvatarFrame,
        native_country_code: newNativeCountryCode || undefined,
        native_city: newNativeCity.trim() || undefined,
      },
      file: avatarType === "custom" ? selectedAvatarFile : null,
    });
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setSelectedAvatarFile(null);
      setAvatarError("Choose a PNG, JPEG, or WebP image up to 5 MB.");
      event.target.value = "";
      return;
    }
    setAvatarError(null);
    setSelectedAvatarFile(file);
    setAvatarType("custom");
    event.target.value = "";
  }

  function handleOpenFriendRequestModal() {
    if (!familyId) return;
    setFriendRequestModal(familyOwned(familyId, { error: null }));
  }

  function handleOpenDecision(request: FriendRequest) {
    if (!familyId) return;
    setFriendDecisionModal(familyOwned(familyId, { request, error: null }));
  }

  function handleCreateFriendRequest(input: CreateFriendRequestInput) {
    if (!familyId || friendRequestModal?.familyId !== familyId) return;
    createFriendRequestMutation.mutate(
      familyMutation(familyId, input, friendRequestModal.operationId),
    );
  }

  function handleRespondFriendRequest(requestId: string, accept: boolean) {
    if (!familyId) return;
    respondFriendRequestMutation.mutate(
      familyMutation(
        familyId,
        { requestId, accept },
        friendDecisionModal?.familyId === familyId
          ? friendDecisionModal.operationId
          : undefined,
      ),
    );
  }

  async function handleEnableNotifications() {
    const permission = await requestFriendRequestNotificationPermission();
    setNotificationPermission(permission);
  }

  const visibleFriendRequestModal = visibleFamilyValue(friendRequestModal, familyId);
  const visibleFriendDecisionModal = visibleFamilyValue(friendDecisionModal, familyId);
  const isCreatingFriendRequest = isFamilyMutationPending(
    createFriendRequestMutation.isPending,
    createFriendRequestMutation.variables,
    familyId,
    friendRequestModal?.familyId === familyId ? friendRequestModal.operationId : undefined,
  );
  const isRespondingToFriendRequest = isFamilyMutationPending(
    respondFriendRequestMutation.isPending,
    respondFriendRequestMutation.variables,
    familyId,
    friendDecisionModal?.familyId === familyId ? friendDecisionModal.operationId : undefined,
  );

  return (
    <SeasonalScreen className="profile-picker-page flex min-h-screen flex-col items-center justify-start p-4 py-8">
      <header className="mb-5 flex w-full max-w-2xl items-center justify-center gap-3 text-center sm:gap-5 sm:text-left">
        <img
          src="/illustrations/rice-grain-explorer-pastel.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-20 w-20 shrink-0 object-contain sm:h-28 sm:w-28"
        />
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 sm:text-3xl">
            {uiText("Who's joining today?")}</h1>
          {familyName && (
            <p className="mt-1 font-semibold text-blue-600">{familyName}{uiText("'s members")}</p>
          )}
          <p className="mt-1 text-gray-600">{uiText("Choose the Keeper of the Castle or an explorer to get started!")}</p>
        </div>
      </header>

      <div className="w-full max-w-2xl"><FamilyOnboarding key={familyId} onAddChild={() => setShowCreateForm(true)} onAddFriends={handleOpenFriendRequestModal} /></div>

      {createdProfileAwaitingAvatar && (
        <div role="alert" className="mb-4 w-full max-w-lg rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">{createdProfileAwaitingAvatar.name} {uiText(" was created, but the photo did not upload.")}</p>
          <p className="mt-1 text-sm">{avatarError ?? uiText("You can retry the photo or continue with the default avatar.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selectedAvatarFile || retryAvatarMutation.isPending}
              onClick={() => {
                if (selectedAvatarFile) retryAvatarMutation.mutate({ profileId: createdProfileAwaitingAvatar.id, file: selectedAvatarFile });
              }}
              className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {retryAvatarMutation.isPending ? uiText("Uploading...") : uiText("Retry photo")}
            </button>
            <button
              type="button"
              disabled={retryAvatarMutation.isPending}
              onClick={() => {
                const profileId = createdProfileAwaitingAvatar.id;
                resetCreateForm();
                handleSelectProfile(profileId);
              }}
              className="rounded-full border border-amber-400 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {uiText("Continue without photo")}</button>
          </div>
        </div>
      )}

      {notificationPermission !== "unsupported" && notificationPermission !== "granted" && (
        <div className="mb-6 w-full max-w-2xl rounded-[2rem] border border-amber-200 bg-amber-50 px-5 py-4 text-left shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-amber-900">{uiText("News")}</h2>
              <p className="text-sm text-amber-800">
                {uiText("Turn on browser notifications so friend requests and upcoming events pop up right away.")}</p>
            </div>
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-95"
            >
              {uiText("Enable alerts")}</button>
          </div>
        </div>
      )}

      <FriendNotificationList key={familyId} requests={friendRequests} profiles={profiles} familyId={familyId} calendarItems={calendarNotifications} responding={isRespondingToFriendRequest} onAccept={handleOpenDecision} onReject={request=>handleRespondFriendRequest(request.id,false)}/>

      {isLoading ? (
        <div className="text-gray-400 text-lg">{uiText("Loading profiles...")}</div>
      ) : (
        <div role="group" aria-label={uiText("Family members")} className="grid w-full grid-cols-2 gap-4 p-2 sm:grid-cols-3 sm:p-6 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => { useProfileStore.getState().clearProfile(); navigate("/parent"); }}
            className="min-h-[140px] min-w-[120px] w-full rounded-2xl border-2 border-sky-200 bg-sky-50 p-4 shadow-md flex flex-col items-center justify-center gap-2 transition-all hover:border-sky-300 hover:bg-sky-100 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-sky-200 active:scale-95"
          >
            <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-4xl">👑</span>
            <span className="text-center text-lg font-bold leading-tight text-gray-800">{uiText("Keeper of the Castle")}</span>
            <span className="text-center text-sm text-slate-500">{uiText("Set the rules. Lead the quests!")}</span>
          </button>
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="min-h-[140px] min-w-[120px]"
            >
              <button
                onClick={() => handleSelectProfile(profile.id)}
                className="w-full bg-white rounded-2xl border-2 shadow-md flex flex-col items-center justify-center p-4 gap-2 hover:shadow-lg active:scale-95 transition-all"
                style={{ borderColor: profile.color }}
              >
                <ProfileAvatar profile={profile} size="lg" />
                <span className="font-bold text-lg text-gray-800 text-center leading-tight">
                  {profile.name}

                </span>
                <span className="text-sm text-gray-500">{profile.total_done} {uiText(" explored")}</span>
                {profile.native_country_code && (
                  <span className="text-xs text-gray-400 text-center">
                    {profile.native_city
                      ? `${profile.native_city}, ${getCountryName(profile.native_country_code)}`
                      : getCountryName(profile.native_country_code)}
                  </span>
                )}
                {profile.public_id && (
                  <span className="text-xs font-mono text-gray-400 tracking-wide">
                    {profile.public_id}
                  </span>
                )}
              </button>
            </div>
          ))}

          <div className="profile-picker-actions col-span-full grid grid-cols-2 gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              disabled={profiles.length >= 5 || !!createdProfileAwaitingAvatar}
              className="min-h-[140px] min-w-0 bg-white rounded-2xl border-dashed border-2 border-gray-300 shadow-md flex flex-col items-center justify-center p-4 gap-2 hover:shadow-lg active:scale-95 transition-all text-slate-600 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true" className="text-5xl leading-none">+</span>
              <span className="font-medium text-base text-center leading-tight">{uiText("New Explorer")}</span>
              {profiles.length >= 5 && <span className="text-xs text-center">{uiText("Up to 5 explorers per family.")}</span>}
            </button>
            <button
              type="button"
              onClick={handleOpenFriendRequestModal}
              className="min-h-[140px] min-w-0 bg-violet-50 rounded-2xl border-dashed border-2 border-violet-300 shadow-md flex flex-col items-center justify-center p-4 gap-2 hover:shadow-lg active:scale-95 transition-all text-violet-800 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            >
              <span aria-hidden="true" className="text-4xl leading-none">🤝</span>
              <span className="font-medium text-base text-center leading-tight">{uiText("Connect with a Friend")}</span>
            </button>
          </div>
        </div>
      )}

      {visibleFriendRequestModal && (
        <FriendRequestModal
          profiles={profiles}
          onClose={() => setFriendRequestModal(null)}
          onSubmit={handleCreateFriendRequest}
          isSubmitting={isCreatingFriendRequest}
          errorMessage={visibleFriendRequestModal.error}
        />
      )}

      {visibleFriendDecisionModal && (
        <FriendRequestDecisionModal
          request={visibleFriendDecisionModal.request}
          onClose={() => setFriendDecisionModal(null)}
          onReject={() =>
            handleRespondFriendRequest(visibleFriendDecisionModal.request.id, false)
          }
          onAccept={() =>
            handleRespondFriendRequest(visibleFriendDecisionModal.request.id, true)
          }
          isSubmitting={isRespondingToFriendRequest}
          errorMessage={visibleFriendDecisionModal.error}
        />
      )}

      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
      >
        {uiText("Sign out")}</button>
      {signOutError && (
        <p role="alert" className="mt-2 text-xs text-red-600">{signOutError}</p>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="create-explorer-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl min-[800px]:max-w-5xl">
            <h2 id="create-explorer-title" className="text-2xl font-bold text-gray-800 mb-4 text-center min-[800px]:mb-3">
              {uiText("Create Explorer")}</h2>

            <div className="grid grid-cols-1 min-[800px]:grid-cols-3 min-[800px]:gap-x-5 min-[800px]:gap-y-3">
            <div className="mb-4 min-[800px]:col-start-1 min-[800px]:row-start-1 min-[800px]:mb-0">
              <label htmlFor="create-explorer-name" className="block text-sm font-medium text-gray-700 mb-1">{uiText("Name")}</label>
              <input
                id="create-explorer-name"
                type="text"
                maxLength={20}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={uiText("Explorer name...")}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div className="hidden min-[800px]:col-start-2 min-[800px]:row-start-1 min-[800px]:block">
              <label htmlFor="create-explorer-country-desktop" className="block text-sm font-medium text-gray-700 mb-1">{uiText("Native country")}</label>
              <select
                id="create-explorer-country-desktop"
                value={newNativeCountryCode}
                onChange={(e) => setNewNativeCountryCode(e.target.value)}
                className="h-14 w-full rounded-xl border-2 border-gray-200 px-4 text-base focus:border-blue-400 focus:outline-none"
              >
                <option value="">{uiText("Choose country...")}</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden min-[800px]:col-start-3 min-[800px]:row-start-1 min-[800px]:block">
              <label htmlFor="create-explorer-city-desktop" className="block text-sm font-medium text-gray-700 mb-1">{uiText("Native city or province")}</label>
              <input
                id="create-explorer-city-desktop"
                type="text"
                maxLength={40}
                value={newNativeCity}
                onChange={(e) => setNewNativeCity(e.target.value)}
                placeholder={uiText("Hanoi, Ontario, California...")}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div className="mb-5 min-[800px]:col-start-1 min-[800px]:row-start-2 min-[800px]:row-span-3 min-[800px]:mb-0 min-[800px]:self-start">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">{uiText("Preview profile")}</span>
                <span aria-live="polite" className="text-xs text-gray-500">
                  {AVATAR_FRAMES.find((frame) => frame.id === newAvatarFrame)?.name ?? uiText("No frame")}
                </span>
              </div>
              <div
                role="img"
                aria-label={`Profile preview with ${AVATAR_FRAMES.find((frame) => frame.id === newAvatarFrame)?.name ?? uiText("No frame")} and selected background color`}
                className="mx-auto flex aspect-square w-52 max-w-full items-center justify-center rounded-2xl border border-gray-200 bg-transparent min-[800px]:w-full min-[1000px]:max-w-64"
              >
                <ProfileAvatar
                  profile={{
                    avatar_type: avatarType === "custom" ? "custom" : "default",
                    avatar_url: avatarType === "custom" ? customAvatarUrl ?? undefined : selectedAvatarId,
                    avatar_frame: newAvatarFrame,
                    emoji: newEmoji,
                    color: newColor,
                  }}
                  size="preview"
                />
              </div>
            </div>

            <div className="mb-4 min-[800px]:col-span-2 min-[800px]:col-start-2 min-[800px]:row-start-2 min-[800px]:mb-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">{uiText("Pick an avatar")}</label>
              
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setAvatarType("default")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    avatarType === "default"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {uiText("Default")}</button>
                <button
                  onClick={() => setAvatarType("custom")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    avatarType === "custom"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {uiText("Upload")}</button>
              </div>

              {avatarType === "default" && (
                <div role="group" aria-label={uiText("Choose an avatar")} className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2 overflow-y-auto p-1 min-[800px]:max-h-40">
                  {KID_AVATARS.map((avatar) => {
                    const selected = selectedAvatarId === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatarId(avatar.id)}
                        className={`aspect-square w-full justify-self-center rounded-lg p-1 transition-all ${
                          selected
                            ? "bg-blue-100 ring-2 ring-blue-400 scale-105"
                            : "hover:bg-gray-100"
                        }`}
                        aria-label={`Select ${avatar.name} avatar`}
                        aria-pressed={selected}
                        title={`${avatar.name} · ${avatar.category}`}
                      >
                        <img
                          src={avatar.src}
                          alt=""
                          className="aspect-square w-full rounded-md object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {avatarType === "custom" && (
                <div className="space-y-2">
                  {customAvatarUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <img src={customAvatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                      <button
                        onClick={() => {
                          setSelectedAvatarFile(null);
                          setAvatarError(null);
                          setAvatarType("default");
                        }}
                        className="text-red-500 text-sm hover:underline"
                      >
                        {uiText("Remove")}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-500 hover:text-blue-500"
                    >
                      <div className="text-3xl mb-1">📷</div>
                      <div className="text-sm font-medium">{uiText("Click to upload")}</div>
                      <div className="text-xs text-gray-400 mt-1">{uiText("PNG, JPG, WebP up to 5 MB")}</div>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}
              {avatarError && <p role="alert" className="mt-2 text-sm text-red-600">{avatarError}</p>}
            </div>

            <div className="mb-5 min-[800px]:col-span-2 min-[800px]:col-start-2 min-[800px]:row-start-3 min-[800px]:mb-0">
              <span className="mb-2 block text-sm font-medium text-gray-700">{uiText("Choose a frame")}</span>
              <div role="group" aria-label={uiText("Choose an avatar frame")} className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-5">
                {AVATAR_FRAMES.map((frame) => {
                  const selected = newAvatarFrame === frame.id;
                  return (
                    <button
                      key={frame.id ?? "no-frame"}
                      type="button"
                      onClick={() => setNewAvatarFrame(frame.id)}
                      aria-label={frame.name}
                      aria-pressed={selected}
                      title={frame.name}
                      className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-1 transition-colors min-[800px]:min-h-14 ${selected ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-blue-200"}`}
                    >
                      {frame.src ? (
                        <img src={frame.src} alt="" className="h-9 w-9 object-contain" loading="eager" decoding="async" />
                      ) : (
                        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-300 text-lg leading-none text-gray-500">−</span>
                      )}
                      <span className="w-full truncate text-center text-[10px] font-medium leading-tight text-gray-600">{frame.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6 min-[800px]:col-span-2 min-[800px]:col-start-2 min-[800px]:row-start-4 min-[800px]:mb-0">
              <span className="block text-sm font-medium text-gray-700 mb-2">{uiText("Pick a background color")}</span>
              <div className="flex gap-3 justify-center min-[800px]:justify-start min-[800px]:pl-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    aria-label={`Select ${color} background color`}
                    aria-pressed={newColor === color}
                    className={`w-9 h-9 rounded-full transition-all ${
                      newColor === color ? "ring-4 ring-offset-2 scale-110" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4 min-[800px]:hidden">
              <label htmlFor="create-explorer-country-mobile" className="block text-sm font-medium text-gray-700 mb-1">{uiText("Native country")}</label>
              <select
                id="create-explorer-country-mobile"
                value={newNativeCountryCode}
                onChange={(e) => setNewNativeCountryCode(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-400 focus:outline-none"
              >
                <option value="">{uiText("Choose country...")}</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6 min-[800px]:hidden">
              <label htmlFor="create-explorer-city-mobile" className="block text-sm font-medium text-gray-700 mb-1">{uiText("Native city or province")}</label>
              <input
                id="create-explorer-city-mobile"
                type="text"
                maxLength={40}
                value={newNativeCity}
                onChange={(e) => setNewNativeCity(e.target.value)}
                placeholder={uiText("Hanoi, Ontario, California...")}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-blue-400 focus:outline-none"
              />
            </div>
            </div>

            <div className="flex gap-3 min-[800px]:mt-2 min-[800px]:justify-end">
              <button
                onClick={resetCreateForm}
                disabled={createMutation.isPending}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-all disabled:opacity-50 min-[800px]:max-w-44"
              >
                {uiText("Cancel")}</button>
              <button
                onClick={handleCreateSubmit}
                disabled={!newName.trim() || createMutation.isPending || (avatarType === "custom" && !selectedAvatarFile)}
                className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-[800px]:max-w-44"
              >
                {createMutation.isPending ? uiText("Creating...") : uiText("Let's Go!")}
              </button>
            </div>

            {createMutation.isError && (
              <p className="mt-3 text-red-500 text-sm text-center">
                {uiText("Failed to create profile. Please try again.")}</p>
            )}
          </div>
        </div>
      )}

    </SeasonalScreen>
  );
}
