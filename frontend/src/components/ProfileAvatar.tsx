import { useEffect, useState } from "react";
import { DEFAULT_AVATARS } from "../lib/defaultAvatars";
import { AVATAR_FRAMES } from "../lib/avatarFrames";
import { transparentKidAvatarSource } from "../lib/avatarBackdrop";
import { resolveKidAvatar } from "../lib/kidAvatars";
import { avatarBackgroundStyle } from "../lib/avatarPresentation";
import type { AvatarType } from "../types/profile";

export interface ProfileAvatarProps {
  profile: {
    avatar_type?: AvatarType;
    avatar_url?: string;
    avatar_frame?: string | null;
    emoji: string;
    color?: string;
  };
  size?: "sm" | "md" | "lg" | "xl" | "preview";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "w-6 h-6 text-sm",
  md: "w-9 h-9 text-lg",
  lg: "w-16 h-16 text-5xl",
  xl: "w-20 h-20 text-6xl",
  preview: "w-44 h-44 text-8xl",
};

export function ProfileAvatar({ profile, size = "md", className = "" }: ProfileAvatarProps) {
  const selectedFrame = AVATAR_FRAMES.find((frame) => frame.id === (profile.avatar_frame ?? null));
  const hasFrame = Boolean(selectedFrame?.src);
  const kidAvatar = profile.avatar_type === "default"
    ? resolveKidAvatar(profile.avatar_url)
    : undefined;
  const [transparentAvatar, setTransparentAvatar] = useState<{ source: string; url: string } | null>(null);

  useEffect(() => {
    if (!kidAvatar || ("transparent" in kidAvatar && kidAvatar.transparent)) return;
    let active = true;
    void transparentKidAvatarSource(kidAvatar.src).then((url) => {
      if (active) setTransparentAvatar({ source: kidAvatar.src, url });
    }).catch(() => {
      // Keep the original illustration if canvas processing is unavailable.
    });
    return () => { active = false; };
  }, [kidAvatar]);

  let avatar = <span>{profile.emoji}</span>;

  if (profile.avatar_type === "custom" && profile.avatar_url) {
    avatar = <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />;
  } else if (profile.avatar_type === "default" && profile.avatar_url) {
    const defaultAvatar = DEFAULT_AVATARS.find((item) => item.id === profile.avatar_url);
    if (kidAvatar) {
      avatar = <img src={transparentAvatar?.source === kidAvatar.src ? transparentAvatar.url : kidAvatar.src} alt="" className="h-full w-full object-cover" decoding="async" />;
    } else if (defaultAvatar) {
      const AvatarComponent = defaultAvatar.component;
      avatar = <AvatarComponent className="h-full w-full" />;
    }
  }

  return (
    <span className={`${SIZE_CLASSES[size]} relative inline-flex shrink-0 items-center justify-center ${className}`}>
      <span
        aria-hidden="true"
        className={`${hasFrame ? "h-[76%] w-[76%]" : "h-full w-full"} absolute inset-0 m-auto rounded-full`}
        style={avatarBackgroundStyle(profile.color)}
      />
      <span
        className={`${hasFrame ? "h-[76%] w-[76%]" : "h-[84%] w-[84%]"} relative inline-flex items-center justify-center overflow-hidden rounded-full leading-none`}
      >
        {avatar}
      </span>
      {hasFrame && selectedFrame?.src && (
        <img
          src={selectedFrame.src}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      )}
    </span>
  );
}
