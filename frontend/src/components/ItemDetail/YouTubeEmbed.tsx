import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
// @ts-ignore
import 'lite-youtube-embed/src/lite-yt-embed.css';
// @ts-ignore
import 'lite-youtube-embed/src/lite-yt-embed.js';
import { ErrorBoundary } from '../ErrorBoundary';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
}

const videoUnavailable = (
  <div
    style={{ borderRadius: '12px' }}
    className="bg-gray-100 flex items-center justify-center py-8 text-gray-400 text-sm gap-2"
  >
    <span className="text-xl">🎬</span>
    {uiText("Video unavailable")}</div>
);

export default function YouTubeEmbed({ videoId, title }: YouTubeEmbedProps) {
  useUiLanguage();
  if (!videoId) return null;

  return (
    <ErrorBoundary fallback={videoUnavailable}>
      <div
        style={{
          maxWidth: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <lite-youtube
          videoid={videoId}
          playlabel={title ?? uiText("Play video")}
        />
      </div>
    </ErrorBoundary>
  );
}
