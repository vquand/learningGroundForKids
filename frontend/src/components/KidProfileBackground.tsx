import { useEffect, useState, type CSSProperties } from "react";
import { transparentKidAvatarSource } from "../lib/avatarBackdrop";
import { backgroundSpritePosition, getKidProfileBackground } from "../lib/kidProfileBackground";
import type { Profile } from "../types/profile";
import "./KidProfileBackground.css";

export function KidProfileBackground({ profile }: { profile?: Profile }) {
  const background = getKidProfileBackground(profile);
  const face = background.face;
  const [cutout, setCutout] = useState<{ source: string; url: string } | null>(null);

  useEffect(() => {
    if (!face || face.transparent) return;
    let active = true;
    void transparentKidAvatarSource(face.src).then((url) => {
      if (active) setCutout({ source: face.src, url });
    }).catch(() => {
      // Omit decoration if its transparent cutout is unavailable.
    });
    return () => { active = false; };
  }, [face]);

  const faceSource = face?.transparent ? face.src : cutout?.source === face?.src ? cutout?.url : undefined;
  const style = { "--kid-tint": background.tint } as CSSProperties;
  return (
    <div className="kid-profile-background" style={style} aria-hidden="true" data-testid="kid-profile-background">
      <div className="kid-profile-background__wash" />
      <div className="kid-profile-background__scene" data-theme={background.themeId}
        style={{ backgroundPosition: backgroundSpritePosition(background.themeIndex, 4, 4) }} />
      {face && faceSource && (
        <svg className="kid-profile-background__face" data-avatar={face.id}
          viewBox={background.faceViewBox} focusable="false" preserveAspectRatio="xMidYMid meet">
          <image href={faceSource} width="512" height="512" />
        </svg>
      )}
    </div>
  );
}
