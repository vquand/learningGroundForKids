import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { updateProfile, uploadProfileAvatar } from "../../api/profiles";
import { ProfileAvatar } from "../ProfileAvatar";
import { COUNTRY_OPTIONS } from "../../lib/countries";
import { AVATAR_FRAMES, type AvatarFrameId } from "../../lib/avatarFrames";
import { KID_AVATARS, normalizeKidAvatarId } from "../../lib/kidAvatars";
import { COLOR_OPTIONS, EMOJI_OPTIONS } from "../../lib/profileAppearance";
import { familyScopedQuery, getFamilySessionSnapshot, isCurrentFamilySession, InactiveFamilySessionError, profileQueryKey } from "../../lib/familyQueries";
import { useFamilyStore } from "../../stores/familyStore";
import { useProfileStore } from "../../stores/profileStore";
import type { ProfileUpdate, ProfileWithStats } from "../../types/profile";

export function ProfilePersonalizationDialog({ profile: editingProfile, onClose }: {
  profile: ProfileWithStats;
  onClose: () => void;
}) {
  useUiLanguage();
  const familyId = useFamilyStore((state) => state.familyId);
  const owner = useRef(getFamilySessionSnapshot()).current;
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(editingProfile.name);
  const [editEmoji, setEditEmoji] = useState(editingProfile.emoji);
  const [editColor, setEditColor] = useState(editingProfile.color);
  const [editAvatarId, setEditAvatarId] = useState(editingProfile.avatar_type === "default" && editingProfile.avatar_url ? normalizeKidAvatarId(editingProfile.avatar_url) : "capybara-calm");
  const [editAvatarType, setEditAvatarType] = useState<"default" | "custom" | "emoji">(editingProfile.avatar_type === "custom" ? "custom" : editingProfile.avatar_type === "default" ? "default" : "emoji");
  const [editAvatarFrame, setEditAvatarFrame] = useState<AvatarFrameId | null>(editingProfile.avatar_frame && AVATAR_FRAMES.some((frame) => frame.id === editingProfile.avatar_frame) ? editingProfile.avatar_frame : null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreviewUrl, setEditAvatarPreviewUrl] = useState<string | null>(null);
  const [editAvatarError, setEditAvatarError] = useState<string | null>(null);
  const [editNativeCountryCode, setEditNativeCountryCode] = useState(editingProfile.native_country_code ?? "");
  const [editNativeCity, setEditNativeCity] = useState(editingProfile.native_city ?? "");

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (!editAvatarFile) { setEditAvatarPreviewUrl(null); return; }
    const url = URL.createObjectURL(editAvatarFile);
    setEditAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editAvatarFile]);

  const updateMutation = useMutation({
    mutationFn: ({ data, file }: { data: ProfileUpdate; file: File | null }) => familyScopedQuery(familyId, async () => {
      const saved = await updateProfile(editingProfile.id, data);
      if (!file) return saved;
      if (!isCurrentFamilySession(owner)) throw new InactiveFamilySessionError();
      return uploadProfileAvatar(editingProfile.id, file);
    })(),
    onSuccess: (saved) => {
      if (!isCurrentFamilySession(owner)) return;
      queryClient.setQueryData<ProfileWithStats[]>(profileQueryKey(familyId), (current) => current?.map((profile) => profile.id === saved.id ? { ...profile, ...saved } : profile));
      void queryClient.invalidateQueries({ queryKey: profileQueryKey(familyId) });
      if (useProfileStore.getState().activeProfileId === editingProfile.id) onClose();
    },
  });

  function handleEditFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setEditAvatarFile(null);
      setEditAvatarError("Choose a PNG, JPEG, or WebP image up to 5 MB.");
      event.target.value = "";
      return;
    }
    setEditAvatarError(null);
    setEditAvatarFile(file);
    setEditAvatarType("custom");
    event.target.value = "";
  }

  function handleEditSubmit() {
    if (!editName.trim() || updateMutation.isPending) return;
    if (editAvatarType === "custom" && !editAvatarFile && editingProfile.avatar_type !== "custom") {
      setEditAvatarError("Choose a photo before saving this avatar.");
      return;
    }
    const avatarSelection: Partial<ProfileUpdate> = editAvatarType === "default"
      ? { avatar_type: "default", avatar_url: editAvatarId }
      : editAvatarType === "emoji"
        ? { avatar_type: "emoji", avatar_url: null }
        : {};
    updateMutation.mutate({
      data: {
        name: editName.trim(),
        emoji: editEmoji,
        color: editColor,
        avatar_frame: editAvatarFrame,
        native_country_code: editNativeCountryCode || null,
        native_city: editNativeCity.trim() || null,
        ...avatarSelection,
      },
      file: editAvatarFile,
    });
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="profile-personalization-title"
      onCancel={(event) => { event.preventDefault(); if (!updateMutation.isPending) onClose(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-3xl bg-white p-0 shadow-2xl backdrop:bg-black/40 open:flex min-[800px]:max-w-5xl">
      <header className="shrink-0 bg-white px-6 pt-6 pb-4 min-[800px]:pb-3">
        <h2 id="profile-personalization-title" className="text-center text-2xl font-bold text-gray-800">
          {uiText("Your avatar")}</h2>
      </header>

      <div className="min-h-0 overflow-y-auto overscroll-contain px-6">
      <div className="grid grid-cols-1 min-[800px]:grid-cols-3 min-[800px]:gap-x-5 min-[800px]:gap-y-3">
      <div className="mb-4 min-[800px]:col-start-1 min-[800px]:row-start-1 min-[800px]:mb-0">
        <label htmlFor="edit-explorer-name" className="mb-1 block text-sm font-medium text-gray-700">{uiText("Name")}</label>
        <input
          id="edit-explorer-name"
          type="text"
          maxLength={20}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-blue-400 focus:outline-none"
        />
      </div>

      <div className="hidden min-[800px]:col-start-2 min-[800px]:row-start-1 min-[800px]:block">
        <label htmlFor="edit-explorer-country-desktop" className="mb-1 block text-sm font-medium text-gray-700">{uiText("Native country")}</label>
        <select
          id="edit-explorer-country-desktop"
          value={editNativeCountryCode}
          onChange={(e) => setEditNativeCountryCode(e.target.value)}
          className="h-14 w-full rounded-xl border-2 border-gray-200 px-4 text-base focus:border-blue-400 focus:outline-none"
        >
          <option value="">{uiText("Choose country...")}</option>
          {COUNTRY_OPTIONS.map((country) => (
            <option key={country.code} value={country.code}>{country.name}</option>
          ))}
        </select>
      </div>

      <div className="hidden min-[800px]:col-start-3 min-[800px]:row-start-1 min-[800px]:block">
        <label htmlFor="edit-explorer-city-desktop" className="mb-1 block text-sm font-medium text-gray-700">{uiText("Native city or province")}</label>
        <input
          id="edit-explorer-city-desktop"
          type="text"
          maxLength={40}
          value={editNativeCity}
          onChange={(e) => setEditNativeCity(e.target.value)}
          placeholder={uiText("Hanoi, Ontario, California...")}
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg focus:border-blue-400 focus:outline-none"
        />
      </div>

      <div className="mb-5 min-[800px]:col-start-1 min-[800px]:row-start-2 min-[800px]:row-span-3 min-[800px]:mb-0 min-[800px]:self-start">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">{uiText("Preview profile")}</span>
          <span aria-live="polite" className="text-xs text-gray-500">
            {AVATAR_FRAMES.find((frame) => frame.id === editAvatarFrame)?.name ?? uiText("No frame")}
          </span>
        </div>
        <div
          role="img"
          aria-label={`Profile preview with ${AVATAR_FRAMES.find((frame) => frame.id === editAvatarFrame)?.name ?? uiText("No frame")} and selected background color`}
          className="mx-auto flex aspect-square w-52 max-w-full items-center justify-center rounded-2xl border border-gray-200 bg-transparent min-[800px]:w-full min-[1000px]:max-w-64"
        >
          <ProfileAvatar
            profile={{
              avatar_type: editAvatarType,
              avatar_url: editAvatarType === "custom"
                ? editAvatarPreviewUrl ?? (editingProfile.avatar_type === "custom" ? editingProfile.avatar_url : undefined)
                : editAvatarType === "default" ? editAvatarId : undefined,
              avatar_frame: editAvatarFrame,
              emoji: editEmoji,
              color: editColor,
            }}
            size="preview"
          />
        </div>
      </div>

      <div className="mb-5 min-[800px]:col-span-2 min-[800px]:col-start-2 min-[800px]:row-start-2 min-[800px]:mb-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">{uiText("Pick an avatar")}</label>
        <div role="group" aria-label={uiText("Choose avatar type")} className="mb-3 flex gap-2">
          {([
            ["default", "Friends"],
            ["custom", "Photo"],
            ["emoji", "Emoji"],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setEditAvatarType(type);
                if (type !== "custom") setEditAvatarFile(null);
                setEditAvatarError(null);
              }}
              aria-pressed={editAvatarType === type}
              className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition-all ${
                editAvatarType === type ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {uiText(label)}
            </button>
          ))}
        </div>

        {editAvatarType === "default" && (
          <div role="group" aria-label={uiText("Choose an avatar")} className="grid max-h-44 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2 overflow-y-auto p-1 min-[800px]:max-h-40">
            {KID_AVATARS.map((avatar) => {
              const selected = editAvatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setEditAvatarId(avatar.id)}
                  aria-label={`Select ${avatar.name} avatar`}
                  aria-pressed={selected}
                  title={`${avatar.name} · ${avatar.category}`}
                  className={`aspect-square w-full justify-self-center rounded-lg p-1 transition-all ${selected ? "bg-blue-100 ring-2 ring-blue-400" : "hover:bg-gray-100"}`}
                >
                  <img src={avatar.src} alt="" loading="lazy" decoding="async" className="aspect-square w-full rounded-md object-cover" />
                </button>
              );
            })}
          </div>
        )}

        {editAvatarType === "custom" && (
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
            {(editAvatarPreviewUrl ?? (editingProfile.avatar_type === "custom" ? editingProfile.avatar_url : null)) ? (
              <img
                src={editAvatarPreviewUrl ?? editingProfile.avatar_url}
                alt={uiText("Avatar preview")}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl" aria-hidden="true">📷</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-700">
                {editAvatarFile ? editAvatarFile.name : editingProfile.avatar_type === "custom" ? uiText("Current photo") : uiText("Choose a photo")}
              </p>
              <p className="text-xs text-gray-500">{uiText("PNG, JPG, or WebP · up to 5 MB")}</p>
            </div>
            <button
              type="button"
              onClick={() => editFileInputRef.current?.click()}
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
            >
              {editAvatarFile || editingProfile.avatar_type === "custom" ? uiText("Change") : uiText("Choose")}
            </button>
            <input
              ref={editFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleEditFileSelect}
              className="hidden"
            />
          </div>
        )}

        {editAvatarType === "emoji" && (
          <div>
            <p className="mb-1 text-xs text-gray-500">{uiText("Choose an emoji avatar")}</p>
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setEditEmoji(emoji)}
                  aria-label={`Choose ${emoji} avatar`}
                  aria-pressed={editEmoji === emoji}
                  className={`rounded-lg p-1 text-2xl transition-all ${editEmoji === emoji ? "bg-blue-100 ring-2 ring-blue-400" : "hover:bg-gray-100"}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        {editAvatarError && <p role="alert" className="mt-2 text-sm text-red-600">{editAvatarError}</p>}
      </div>

      <div className="mb-5 min-[800px]:col-span-2 min-[800px]:col-start-2 min-[800px]:row-start-3 min-[800px]:mb-0">
        <span className="mb-2 block text-sm font-medium text-gray-700">{uiText("Choose a frame")}</span>
        <div role="group" aria-label={uiText("Choose an avatar frame")} className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-5">
          {AVATAR_FRAMES.map((frame) => {
            const selected = editAvatarFrame === frame.id;
            return (
              <button
                key={frame.id ?? "no-frame"}
                type="button"
                onClick={() => setEditAvatarFrame(frame.id)}
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

      <div className="mb-4 min-[800px]:col-span-2 min-[800px]:col-start-2 min-[800px]:row-start-4 min-[800px]:mb-0">
        <span className="mb-2 block text-sm font-medium text-gray-700">{uiText("Pick a background color")}</span>
        <div className="flex gap-3 justify-center min-[800px]:justify-start min-[800px]:pl-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setEditColor(color)}
              aria-label={`Select ${color} background color`}
              aria-pressed={editColor === color}
              className={`w-9 h-9 rounded-full transition-all ${
                editColor === color ? "ring-4 ring-offset-2 scale-110" : "hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="mb-4 min-[800px]:hidden">
        <label htmlFor="edit-explorer-country-mobile" className="block text-sm font-medium text-gray-700 mb-1">{uiText("Native country")}</label>
        <select
          id="edit-explorer-country-mobile"
          value={editNativeCountryCode}
          onChange={(e) => setEditNativeCountryCode(e.target.value)}
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
        <label htmlFor="edit-explorer-city-mobile" className="block text-sm font-medium text-gray-700 mb-1">{uiText("Native city or province")}</label>
        <input
          id="edit-explorer-city-mobile"
          type="text"
          maxLength={40}
          value={editNativeCity}
          onChange={(e) => setEditNativeCity(e.target.value)}
          placeholder={uiText("Hanoi, Ontario, California...")}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-blue-400 focus:outline-none"
        />
      </div>
      </div>
      </div>

      <footer className="shrink-0 bg-white px-6 pt-4 pb-6 min-[800px]:pt-2">
      <div className="flex gap-3 min-[800px]:justify-end">
        <button
          onClick={onClose}
          disabled={updateMutation.isPending}
          className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-all min-[800px]:max-w-44"
        >
          {uiText("Cancel")}</button>
        <button
          onClick={handleEditSubmit}
          disabled={!editName.trim() || updateMutation.isPending}
          className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-[800px]:max-w-44"
        >
          {updateMutation.isPending ? uiText("Saving...") : uiText("Save")}
        </button>
      </div>

      {updateMutation.isError && (
        <p role="alert" className="mt-3 text-red-500 text-sm text-center">
          {updateMutation.error instanceof Error ? updateMutation.error.message : uiText("Failed to update profile. Please try again.")}
        </p>
      )}
      </footer>
    </dialog>
  );
}
