"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Volume2 } from "lucide-react";
import { fetchRecording } from "../api";

/** Mandi calls are loud places on a phone speaker; 100% is often not enough. */
const MAX_BOOST = 4;

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A recording, playable in a table row.
 *
 * The native <audio> control collapses to an unusable stub in a narrow
 * column - the scrub bar disappears entirely and the rest hides behind a
 * kebab - so the transport is drawn here instead and given room: the row
 * expands when it opens, and the seek bar gets the full width.
 *
 * Volume can go past 100%. A call recorded over a mandi's noise is often too
 * quiet to make out at the element's own ceiling, and an <audio> volume is
 * hard-capped at 1. Routing through a Web Audio gain node lifts that; the
 * graph is built on first play and torn down with the component.
 *
 * Audio is fetched only when someone presses play. Every play is an
 * authenticated stream through our backend and then Exotel's S3, so loading
 * every row on render would cost real egress for calls nobody listens to.
 */
export default function RecordingPlayer({ callSid }: { callSid: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [boost, setBoost] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      void ctxRef.current?.close();
    },
    [],
  );

  /**
   * Wires the element through a gain node so volume can exceed 1. Built once,
   * on a user gesture - browsers refuse to start an AudioContext before one.
   */
  const attachGain = useCallback(() => {
    const el = audioRef.current;
    if (!el || gainRef.current) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = boost;
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
    } catch {
      // No Web Audio: the element still plays, just capped at 100%.
    }
  }, [boost]);

  const load = async () => {
    if (loading || src) return;
    setLoading(true);
    setFailed(false);
    try {
      const url = await fetchRecording(callSid);
      objectUrl.current = url;
      setSrc(url);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    attachGain();
    void ctxRef.current?.resume();
    if (el.paused) void el.play();
    else el.pause();
  };

  const changeBoost = (value: number) => {
    setBoost(value);
    if (gainRef.current) gainRef.current.gain.value = value;
  };

  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = value;
    setCurrent(value);
  };

  if (!src) {
    return (
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-[#4309ac]/40 hover:text-[#4309ac] disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Play className="size-3.5" />
        )}
        {failed ? "Not ready yet" : loading ? "Loading…" : "Play"}
      </button>
    );
  }

  return (
    <div className="min-w-[240px] space-y-1.5">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={src}
        autoPlay
        onPlay={() => {
          // autoPlay starts before any toggle, so wire the gain here too -
          // the click that loaded the clip is the gesture that allows it.
          attachGain();
          void ctxRef.current?.resume();
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setTotal(Number.isFinite(d) ? d : 0);
        }}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: "#4309ac" }}
        >
          {playing ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
        </button>

        {/* The whole point of the rewrite: a scrub bar wide enough to drag. */}
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={total || 0}
          step={0.1}
          value={current}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1.5 w-full min-w-[120px] flex-1 cursor-pointer accent-[#4309ac]"
        />

        <span className="shrink-0 text-[11px] tabular-nums text-gray-500">
          {clock(current)} / {clock(total)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Volume2 className="size-3.5 shrink-0 text-gray-400" />
        <input
          type="range"
          aria-label="Volume boost"
          min={0.5}
          max={MAX_BOOST}
          step={0.1}
          value={boost}
          onChange={(e) => changeBoost(Number(e.target.value))}
          className="h-1 w-full flex-1 cursor-pointer accent-emerald-600"
        />
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            boost > 1 ? "font-semibold text-emerald-700" : "text-gray-400"
          }`}
        >
          {Math.round(boost * 100)}%
        </span>
      </div>
    </div>
  );
}
