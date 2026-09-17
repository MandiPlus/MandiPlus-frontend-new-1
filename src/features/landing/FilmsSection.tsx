"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import styles from "@/features/landing/FilmsSection.module.css";
import { LANDING_FILM } from "@/features/landing/landingData";

/**
 * The film band: one testimonial, centred under its heading.
 *
 * On sound: every current browser refuses `play()` on an unmuted video until the page has been
 * interacted with, so "autoplay with sound" cannot be guaranteed by anyone. What happens here is
 * the closest the platform allows —
 *   1. start muted immediately (with sound instead when the page already holds activation),
 *   2. upgrade to sound on the very first tap/keypress anywhere on the page, and
 *   3. if even the muted start is refused — Low Power Mode, reduced motion — surface a large
 *      centred "Video chalayein" control so the recovery tap is obvious.
 * A visible control always shows the current state, both so the viewer knows sound is coming
 * and so it can be switched off again (WCAG 1.4.2 — audio over three seconds needs a stop).
 */
export default function FilmsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // React sets the muted PROPERTY but never renders the ATTRIBUTE, and iOS checks the
  // attribute when deciding whether a video may start unattended — the known reason a muted
  // video autoplays everywhere except iPhones. Written here, before iOS ever evaluates it.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) {
      el.muted = true;
      el.setAttribute("muted", "");
    }
  }, []);

  const [src, setSrc] = useState<string | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [motionOk, setMotionOk] = useState(true);
  /** The muted-playback sound invitation: big and centred first, then the corner pill. */
  const [prompt, setPrompt] = useState<"big" | "pill">("big");
  /** True once the viewer mutes on purpose — after that we stop touching sound. */
  const [userMuted, setUserMuted] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setMotionOk(!motion.matches);
    decide();
    motion.addEventListener("change", decide);
    return () => motion.removeEventListener("change", decide);
  }, []);

  // Nothing is fetched until the band is close, so a visitor who never scrolls this far pays
  // nothing for a film that would otherwise start itself.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry.isIntersecting);
        if (entry.isIntersecting && !src) {
          setSrc(
            window.innerWidth <= 700
              ? LANDING_FILM.srcNarrow
              : LANDING_FILM.srcWide,
          );
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  const applyMuted = useCallback((next: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = next;
    setMuted(next);
  }, []);

  // Play while it is on screen, stop when it is not — nobody should be hearing a film that has
  // scrolled away, and a paused film off-screen stops spending bandwidth too.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (!onScreen || !motionOk) {
      video.pause();
      return;
    }

    let cancelled = false;
    // Lead with sound only when the page already holds real user activation — on a cold
    // visit ask for the guaranteed muted start straight away, rather than opening with a
    // doomed request that some WebKit builds answer by stalling the element for a beat.
    const hasActivation =
      (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } })
        .userActivation?.hasBeenActive === true;
    const start = async () => {
      if (!userMuted && hasActivation) {
        video.muted = false;
        try {
          await video.play();
          if (!cancelled) setMuted(false);
          return;
        } catch {
          /* blocked by the autoplay policy; fall through to muted */
        }
      }
      if (cancelled) return;
      video.muted = true;
      setMuted(true);
      try {
        await video.play();
      } catch {
        /* nothing else to try */
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [src, onScreen, motionOk, userMuted]);

  // Any gesture anywhere on the page is a moment the browser will allow audio, so take it —
  // unless the viewer has already asked for quiet.
  //
  // Deliberately NOT `{ once: true }`: that removes the listener the first time it fires, even
  // when this handler bails out early, so a tap while the film was still buffering used to burn
  // the one chance to turn sound on and it never re-armed. It now unhooks only once sound is
  // genuinely playing.
  useEffect(() => {
    if (!muted || userMuted) return;

    // pointerup and touchend matter most: on a phone, activation is granted at the END of a
    // tap, so a touchstart-only listener asks a moment too early, is refused, and the granted
    // moment slips past. keydown covers keyboards; the rest are belt and braces.
    const EVENTS = [
      "pointerup",
      "touchend",
      "pointerdown",
      "keydown",
      "click",
    ] as const;
    const detach = () =>
      EVENTS.forEach((e) => document.removeEventListener(e, unmute, true));

    function unmute(event: Event) {
      const video = videoRef.current;
      if (!video) return;
      // A tap on the film itself belongs to the frame's own control. Handling it here too
      // meant one tap ran both handlers — pointerup unmuted, then the click toggle saw
      // "already unmuted" and muted it straight back. That was the tap-twice bug.
      if (
        event.target instanceof Node &&
        frameRef.current?.contains(event.target)
      ) {
        return;
      }

      // Done inside the gesture, which is exactly when the autoplay policy relents.
      video.muted = false;
      const started = video.paused ? video.play() : Promise.resolve();
      void started
        .then(() => {
          // Some browsers answer a disallowed unmute by pausing rather than rejecting.
          if (video.paused || video.muted) throw new Error("still blocked");
          setMuted(false);
          detach();
        })
        .catch(() => {
          video.muted = true; // keep it running silently and wait for the next gesture
        });
    }

    EVENTS.forEach((e) => document.addEventListener(e, unmute, true));
    return detach;
  }, [muted, userMuted]);

  // Hold the big invitation for the first few seconds of muted playback, then step aside.
  // It never returns once dismissed — and never shows at all for a viewer who muted on
  // purpose.
  useEffect(() => {
    if (!muted) return;
    const id = window.setTimeout(() => setPrompt("pill"), 5000);
    return () => window.clearTimeout(id);
  }, [muted, src]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    // Read the element, not state: state can lag the same tap's earlier handlers. Anything
    // not already playing with sound means the viewer wants it on — never the other way.
    const enable = video.muted || video.paused;
    setUserMuted(!enable);
    applyMuted(!enable);
    if (enable) void video.play().catch(() => {});
  };

  return (
    <section
      ref={sectionRef}
      className={styles.films}
      aria-labelledby="film-title"
    >
      <div className={styles.inner}>
        <h2 id="film-title" className={styles.title}>
          {LANDING_FILM.title.lead}{" "}
          <span className={styles.titleAccent}>
            {LANDING_FILM.title.accent}
          </span>
        </h2>

        <div ref={frameRef} className={styles.frame}>
          <video
            ref={attachVideo}
            className={styles.film}
            src={src ?? undefined}
            poster={LANDING_FILM.poster}
            preload={src ? "metadata" : "none"}
            muted={muted}
            autoPlay={motionOk}
            playsInline
            controls={false}
            aria-label={LANDING_FILM.label}
            onClick={toggleSound}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />

          <button
            type="button"
            className={`${styles.sound} ${
              (!playing || (muted && prompt === "big")) && !userMuted
                ? styles.soundBig
                : ""
            }`}
            onClick={toggleSound}
            aria-pressed={!muted}
            aria-label={
              !playing
                ? "Video chalayein"
                : muted
                  ? "Awaaz chalu karein"
                  : "Awaaz band karein"
            }
          >
            {!playing ? (
              <Play size={18} strokeWidth={2} aria-hidden="true" />
            ) : muted ? (
              <VolumeX size={18} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Volume2 size={18} strokeWidth={2} aria-hidden="true" />
            )}
            <span className={styles.soundText}>
              {!playing
                ? "Video chalayein"
                : muted
                  ? "Awaaz chalu karein"
                  : "Awaaz"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
