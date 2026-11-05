/**
 * Extracts a YouTube video ID from a youtube.com or youtu.be URL.
 * Returns null if the URL is not a recognized YouTube URL.
 */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Handle youtu.be short URLs
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      return id || null;
    }
    // Handle youtube.com watch URLs
    if (
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'youtube.com'
    ) {
      const id = parsed.searchParams.get('v');
      return id || null;
    }
    return null;
  } catch {
    return null;
  }
}
