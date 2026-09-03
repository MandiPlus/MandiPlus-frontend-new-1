'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FALLBACK_DISPLAY_NAME,
  getPromoCopy,
  isValidPromoCode,
  type PromoCopy,
} from './copy';
import { buildYouTubeEmbedUrl, postToPlayer, toYouTubeId } from './video';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export type PromoLink = {
  name: string;
  language: string;
  campaign: string;
  videoUrl: string | null;
  playStoreUrl: string;
  appStoreUrl: string;
};

/**
 * One message on screen at a time, each replacing the last, ending in the
 * video. The illustration underneath goes from an empty yard to a full one —
 * the return told in pictures, using the app's own splash layers.
 */
type Stage = 'gate' | 'yard' | 'scene' | 'name' | 'headline' | 'tagline' | 'video';

const ORDER: Stage[] = [
  'gate',
  'yard',
  'scene',
  'name',
  'headline',
  'tagline',
  'video',
];

const BEATS: Array<{ stage: Stage; at: number; haptic: number | number[] }> = [
  { stage: 'yard', at: 0, haptic: 10 },
  { stage: 'scene', at: 700, haptic: 15 },
  { stage: 'name', at: 1700, haptic: 25 },
  { stage: 'headline', at: 4400, haptic: 20 },
  { stage: 'tagline', at: 7700, haptic: 20 },
  { stage: 'video', at: 9700, haptic: [15, 60, 25] },
];

function reached(current: Stage, target: Stage) {
  return ORDER.indexOf(current) >= ORDER.indexOf(target);
}

/** Android fires real vibration; iOS Safari has never shipped the API. */
function vibrate(pattern: number | number[]) {
  if (!pattern) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nicety, never a dependency.
  }
}

export default function PromoReveal({
  link,
  token,
}: {
  link: PromoLink;
  token?: string;
}) {
  const copy = getPromoCopy(link.language);
  const [stage, setStage] = useState<Stage>('gate');
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const timers = useRef<number[]>([]);

  const videoId = toYouTubeId(link.videoUrl);

  const sendEvent = useCallback(
    (type: 'code' | 'reveal' | 'video') => {
      if (!token) return;
      void fetch(`${API_BASE_URL}/promo/p/${encodeURIComponent(token)}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [token],
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const skipToVideo = useCallback(() => {
    clearTimers();
    setStage('video');
    sendEvent('reveal');
    sendEvent('video');
  }, [clearTimers, sendEvent]);

  const open = useCallback(() => {
    if (!isValidPromoCode(code)) {
      setWrong(true);
      vibrate([20, 50, 20]);
      window.setTimeout(() => setWrong(false), 400);
      return;
    }

    sendEvent('code');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      skipToVideo();
      return;
    }

    BEATS.forEach((beat) => {
      const id = window.setTimeout(() => {
        setStage(beat.stage);
        vibrate(beat.haptic);
        if (beat.stage === 'video') {
          sendEvent('reveal');
          sendEvent('video');
        }
      }, beat.at);
      timers.current.push(id);
    });
  }, [code, sendEvent, skipToVideo]);

  const scriptStyle = copy.fontVar
    ? { fontFamily: `var(${copy.fontVar}), var(--font-manrope), sans-serif` }
    : undefined;

  if (stage === 'video') {
    return (
      <VideoScreen
        copy={copy}
        link={link}
        videoId={videoId}
        scriptStyle={scriptStyle}
      />
    );
  }

  const showingSequence = stage !== 'gate';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#eeeafc]">
      <div className="relative h-dvh w-full max-w-[430px] overflow-hidden bg-[#eeeafc]">
        <img
          src="/promo/yard-tall.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-500 ease-out"
          style={{ filter: reached(stage, 'yard') ? 'none' : 'blur(3px)' }}
        />
        <img
          src="/promo/scene-tall.webp"
          alt="Mandi yard with a trader, a loaded truck and crates of produce"
          className="absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-out"
          style={{
            opacity: reached(stage, 'scene') ? 1 : 0,
            transform: reached(stage, 'scene')
              ? 'none'
              : 'translateY(14px) scale(1.035)',
          }}
        />

        {/* One message at a time, each fading out as the next arrives. */}
        <div className="pointer-events-none absolute inset-x-0 top-[11%] px-6 text-center">
          <Message shown={stage === 'name'}>
            <p
              className="text-base font-medium text-[#4a4770]"
              style={scriptStyle}
            >
              {copy.greeting}
            </p>
            <p
              className="mt-1 break-words text-[clamp(1.75rem,8vw,2.4rem)] font-extrabold leading-[1.05] tracking-tight text-[#241a52]"
              style={scriptStyle}
            >
              {link.name}
              {link.name === FALLBACK_DISPLAY_NAME ? '' : copy.honorific}
            </p>
          </Message>

          <Message shown={stage === 'headline'}>
            <p
              className="break-words text-[clamp(1.6rem,7.5vw,2.2rem)] font-extrabold leading-[1.1] tracking-tight text-[#241a52]"
              style={scriptStyle}
            >
              {copy.headline}
            </p>
          </Message>

          <Message shown={stage === 'tagline'}>
            <p
              className="text-[clamp(1.25rem,6vw,1.7rem)] font-extrabold leading-tight tracking-tight text-[#241a52]"
              style={scriptStyle}
            >
              {copy.tagline}
            </p>
          </Message>
        </div>

        {showingSequence ? (
          <button
            type="button"
            onClick={skipToVideo}
            className="absolute bottom-6 right-5 rounded-full bg-white/80 px-4 py-2 text-xs font-bold text-[#4a4770]"
            style={scriptStyle}
          >
            {copy.skip}
          </button>
        ) : null}

        {stage === 'gate' ? (
          <CodeGate
            copy={copy}
            code={code}
            wrong={wrong}
            scriptStyle={scriptStyle}
            onChange={setCode}
            onSubmit={open}
          />
        ) : null}
      </div>
    </main>
  );
}

/** Absolutely stacked so messages cross-fade in place rather than shifting. */
function Message({
  shown,
  children,
}: {
  shown: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!shown}
      className="absolute inset-x-0 top-0 px-6 transition-all duration-500 ease-out"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(10px)',
      }}
    >
      {children}
    </div>
  );
}

function CodeGate({
  copy,
  code,
  wrong,
  scriptStyle,
  onChange,
  onSubmit,
}: {
  copy: PromoCopy;
  code: string;
  wrong: boolean;
  scriptStyle?: React.CSSProperties;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#eeeafc]/45 px-8">
      <p className="text-sm font-bold text-[#4a4770]" style={scriptStyle}>
        {wrong ? copy.wrongCode : copy.codeLabel}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="flex w-full max-w-[280px] gap-2"
        style={wrong ? { animation: 'promo-shake 0.36s' } : undefined}
      >
        <input
          value={code}
          onChange={(event) => onChange(event.target.value)}
          placeholder={copy.codePlaceholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label={copy.codeLabel}
          className="min-w-0 flex-1 rounded-xl border-[1.5px] border-[#cec7ea] bg-white px-4 py-3 text-center text-base font-semibold tracking-[0.16em] text-[#241a52] outline-none placeholder:text-[#a49dc4] focus:border-[#4309ac]"
        />
        <button
          type="submit"
          className="rounded-xl bg-[#4309ac] px-5 py-3 text-sm font-extrabold text-white"
          style={scriptStyle}
        >
          {copy.openCta}
        </button>
      </form>
      <style>{`@keyframes promo-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}`}</style>
    </div>
  );
}

/**
 * The video sits on the mandi scene, blurred and dimmed, so the frame reads as
 * part of the same world rather than a bare black player.
 */
function VideoScreen({
  copy,
  link,
  videoId,
  scriptStyle,
}: {
  copy: PromoCopy;
  link: PromoLink;
  videoId: string | null;
  scriptStyle?: React.CSSProperties;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Autoplay has to start muted — that is the only kind every browser allows.
  // Ask for sound once the player is ready: Chrome and Android usually grant it
  // because the visitor typed the code. Where it is refused, YouTube's own
  // controls carry the unmute.
  useEffect(() => {
    if (!videoId) return;
    const id = window.setTimeout(() => {
      postToPlayer(frameRef.current, 'unMute');
      postToPlayer(frameRef.current, 'setVolume', [100]);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [videoId]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#1b1436] px-4 py-6">
      <img
        src="/promo/scene-tall.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-lg"
      />
      <div className="absolute inset-0 bg-[#1b1436]/45" aria-hidden="true" />

      <div className="relative flex w-full max-w-[430px] flex-col items-center gap-6">
        <div className="w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
          <div className="relative aspect-video w-full">
            {videoId ? (
              <iframe
                ref={frameRef}
                src={buildYouTubeEmbedUrl(videoId)}
                title={copy.videoCta}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : link.videoUrl ? (
              <video
                src={link.videoUrl}
                autoPlay
                muted
                controls
                playsInline
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <p className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white/70">
                Video jaldi aa raha hai
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <p
            className="text-xs font-bold uppercase tracking-[0.12em] text-white/60"
            style={scriptStyle}
          >
            {copy.downloadLabel}
          </p>
          <div className="flex w-full gap-3">
            <StoreButton
              href={link.playStoreUrl}
              label="Play Store"
              icon={<PlayStoreIcon />}
            />
            <StoreButton
              href={link.appStoreUrl}
              label="App Store"
              icon={<AppStoreIcon />}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function StoreButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#1b1436]"
    >
      {icon}
      {label}
    </a>
  );
}

function PlayStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path
        fill="currentColor"
        d="M3.6 2.3a1 1 0 0 0-.5.9v17.6a1 1 0 0 0 .5.9l9.3-9.7L3.6 2.3Zm10.7 8.3 2.9-3-9.9-5.2 7 8.2Zm0 2.8-7 8.2 9.9-5.2-2.9-3Zm4.4-1.4-2.4-2.5-3 3 3 3 2.4-2.5a.8.8 0 0 0 0-1Z"
      />
    </svg>
  );
}

function AppStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path
        fill="currentColor"
        d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.6-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.9-1.2 1.2-2.4 1.2-2.5 0 0-2.4-.9-2.4-3.6ZM14.2 5.3c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.5 2.7-1.3Z"
      />
    </svg>
  );
}
