/**
 * The campaign video may be a YouTube link today and a CDN mp4 later, so the
 * page accepts either and the backend only has to hand over a URL.
 */
export function toYouTubeId(url?: string | null): string | null {
  const value = String(url || '').trim();
  if (!value) return null;

  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Muted autoplay is the only kind every browser allows — iOS Safari never
 * permits sound without a direct tap. So it starts muted and the page offers
 * one obvious control to turn sound on.
 */
export function buildYouTubeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/** Controls the embed without pulling in the whole IFrame Player API. */
export function postToPlayer(
  frame: HTMLIFrameElement | null,
  func: 'unMute' | 'mute' | 'playVideo' | 'setVolume',
  args: Array<number | string> = [],
) {
  try {
    frame?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*',
    );
  } catch {
    // The embed may not be ready yet; the visible control stays as the fallback.
  }
}
