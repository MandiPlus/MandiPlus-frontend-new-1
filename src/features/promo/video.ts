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

/**
 * Fullscreen must be requested inside a user gesture — Chrome's activation
 * expires within seconds, so asking after the ten-second sequence is refused.
 * It is requested on the tap that submits the code instead, which makes the
 * whole reveal immersive and leaves us already fullscreen for the video.
 */
export async function enterFullscreen(el: HTMLElement | null): Promise<boolean> {
  if (!el) return false;
  const target = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const doc = document as Document & { webkitFullscreenElement?: Element };

  if (doc.fullscreenElement || doc.webkitFullscreenElement) return true;

  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // Refused (no activation, or an iframed page without allowfullscreen).
  }
  return false;
}

/**
 * Landscape lock needs fullscreen first and does not exist on iOS Safari at
 * all, so a false return is expected there and the caller rotates with CSS.
 */
export async function lockLandscape(): Promise<boolean> {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    if (!orientation?.lock) return false;
    await orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

export function exitImmersive(): void {
  try {
    (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.();
  } catch {
    // Never locked in the first place.
  }
  try {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitCancelFullScreen?: () => void;
    };
    if (doc.fullscreenElement) void doc.exitFullscreen();
    else if (doc.webkitFullscreenElement) doc.webkitCancelFullScreen?.();
  } catch {
    // Already out.
  }
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
