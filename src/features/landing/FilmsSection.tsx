"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import styles from "@/features/landing/FilmsSection.module.css";
import { LANDING_FILM } from "@/features/landing/landingData";

/**
 * The film band: one testimonial, centred under its heading.
 *
 * On sound: every current browser refuses `play()` on an unmuted video until the page has been
 * interacted with, so "autoplay with sound" cannot be guaranteed by anyone. What happens here is
 * the closest the platform allows —
 *   1. try unmuted first, which succeeds for a visitor who has already clicked something,
 *   2. otherwise fall back to muted playback so the film still runs, and
 *   3. unmute on the very first tap/keypress anywhere on the page.
 * A visible control always shows the current state, both so the viewer knows sound is coming
 * and so it can be switched off again (WCAG 1.4.2 — audio over three seconds needs a stop).
 */
export default function FilmsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [motionOk, setMotionOk] = useState(true);
  /** Set once the viewer works the control themselves — after that we stop touching sound. */
  const wantsSilence = useRef(false);

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
    // Try with sound first. If the browser refuses — the usual case on a cold visit — fall
    // straight back to muted so the film still runs rather than sitting frozen.
    const start = async () => {
      if (!wantsSilence.current) {
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
  }, [src, onScreen, motionOk]);

  // Any gesture anywhere on the page is a moment the browser will allow audio, so take it —
  // unless the viewer has already asked for quiet.
  //
  // Deliberately NOT `{ once: true }`: that removes the listener the first time it fires, even
  // when this handler bails out early, so a tap while the film was still buffering used to burn
  // the one chance to turn sound on and it never re-armed. It now unhooks only once sound is
  // genuinely playing.
  useEffect(() => {
    if (!muted || wantsSilence.current) return;

    const EVENTS = ["pointerdown", "touchstart", "keydown", "click"] as const;
    const detach = () =>
      EVENTS.forEach((e) => document.removeEventListener(e, unmute, true));

    function unmute() {
      const video = videoRef.current;
      if (!video || wantsSilence.current) return;

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
  }, [muted]);

  const toggleSound = () => {
    const next = !muted;
    wantsSilence.current = next;
    applyMuted(next);
    if (!next) void videoRef.current?.play().catch(() => {});
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

        <div className={styles.frame}>
          <video
            ref={videoRef}
            className={styles.film}
            src={src ?? undefined}
            poster={LANDING_FILM.poster}
            preload={src ? "metadata" : "none"}
            muted={muted}
            playsInline
            controls={false}
            aria-label={LANDING_FILM.label}
            onClick={toggleSound}
          />

          <button
            type="button"
            className={styles.sound}
            onClick={toggleSound}
            aria-pressed={!muted}
            aria-label={muted ? "Awaaz chalu karein" : "Awaaz band karein"}
          >
            {muted ? (
              <VolumeX size={18} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Volume2 size={18} strokeWidth={2} aria-hidden="true" />
            )}
            <span className={styles.soundText}>
              {muted ? "Awaaz chalu karein" : "Awaaz"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
