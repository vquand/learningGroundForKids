import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useRef, useState } from 'react';
import { AudioPlaybackController } from './audioPlaybackState';

interface AudioPlayerProps {
  src: string;
  label?: string;
  onPlay?: () => void;
  onTimeUpdate?: (progress: number) => void;
}

export default function AudioPlayer({
  src,
  label,
  onPlay,
  onTimeUpdate,
}: AudioPlayerProps) {
  useUiLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const playbackAcknowledgedRef = useRef(false);
  const playbackControllerRef = useRef(new AudioPlaybackController());

  useEffect(() => {
    const controller = playbackControllerRef.current;
    controller.mount();
    return () => {
      controller.unmount();
      playbackAcknowledgedRef.current = false;
      audioRef.current?.pause();
    };
  }, []);

  async function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;

    const { shouldPlay, token } = playbackControllerRef.current.toggle();
    if (!shouldPlay) {
      audio.pause();
      setPlaying(false);
      playbackAcknowledgedRef.current = false;
    } else {
      setLoadError(false);
      setPlaying(true);
      playbackAcknowledgedRef.current = false;
      try {
        await audio.play();
      } catch (error) {
        const result = playbackControllerRef.current.reject(token, error);
        if (!result) return;
        playbackAcknowledgedRef.current = false;
        setPlaying(result.playing);
        setLoadError(result.loadError);
      }
    }
  }

  function handlePlay() {
    if (playbackControllerRef.current.isPlaybackWanted()) setPlaying(true);
  }

  function handlePlaying() {
    if (!playbackControllerRef.current.isPlaybackWanted()) return;
    setPlaying(true);
    if (!playbackAcknowledgedRef.current) {
      playbackAcknowledgedRef.current = true;
      onPlay?.();
    }
  }

  function handlePause() {
    if (!playbackControllerRef.current.isMounted()) return;
    playbackControllerRef.current.pause();
    playbackAcknowledgedRef.current = false;
    setPlaying(false);
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const p = (audio.currentTime / audio.duration) * 100;
    setProgress(p);
    onTimeUpdate?.(p);
  }

  function handleEnded() {
    if (!playbackControllerRef.current.isMounted()) return;
    playbackControllerRef.current.pause();
    playbackAcknowledgedRef.current = false;
    setPlaying(false);
    setProgress(0);
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-3 py-2 text-gray-400 text-sm">
        <span className="text-xl">🎵</span>
        {label && <span className="font-semibold">{label}</span>}
        <span>{uiText("Audio unavailable")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={handlePlayPause}
        aria-label={playing ? uiText("Pause") : uiText("Play")}
        className="w-14 h-14 rounded-full shrink-0 bg-amber-400 flex items-center justify-center border-none cursor-pointer"
      >
        {playing ? (
          // Pause icon
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <rect x="4" y="3" width="4" height="14" rx="1" />
            <rect x="12" y="3" width="4" height="14" rx="1" />
          </svg>
        ) : (
          // Play icon
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <polygon points="5,3 17,10 5,17" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {label && (
          <p className="text-sm font-semibold truncate mb-1">{label}</p>
        )}
        <div className="h-1.5 rounded-full bg-amber-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-500 transition-[width] duration-100 linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        onPlay={handlePlay}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => {
          if (!playbackControllerRef.current.mediaError()) return;
          playbackAcknowledgedRef.current = false;
          setPlaying(false);
          setLoadError(true);
        }}
      />
    </div>
  );
}
