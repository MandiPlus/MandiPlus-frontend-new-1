"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { PhoneCall, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import { getCallStatus, placeLeadCall } from "../api";

type Phase = "idle" | "placing" | "ringing" | "talking" | "ended";

const SETTLED = ["completed", "failed", "busy", "no-answer", "canceled"];

/**
 * Places an Exotel call: our caller's own phone rings first, and only when
 * they pick up does the lead's phone ring. The lead sees the ExoPhone, never
 * a personal number, and both legs are recorded.
 *
 * The button reports what is happening on the *other* end of the caller's
 * phone, which they cannot see while it is held to their ear - and when the
 * call ends it hands the callSid to onEnded so the disposition that follows
 * is stitched to the recording of the call it describes.
 */
export default function PlaceCallButton({
  leadId,
  phone,
  disabled,
  compact,
  className,
  label: idleLabel,
  icon = true,
  variant = "default",
  onEnded,
}: {
  leadId: string;
  phone?: string;
  disabled?: boolean;
  compact?: boolean;
  /** Layout from the caller - sizing belongs to whoever places the button. */
  className?: string;
  /** Shown when idle. Lets a phone number itself be the call trigger. */
  label?: React.ReactNode;
  icon?: boolean;
  /** "primary" is the filled accent button used where calling is the whole
   *  point of the screen, like Today's focus sheet. */
  variant?: "default" | "primary";
  onEnded?: (callSid: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const poller = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;


  const stopPolling = useCallback(() => {
    if (poller.current) clearInterval(poller.current);
    poller.current = null;
  }, []);

  useEffect(
    () => () => {
      if (poller.current) clearInterval(poller.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const watch = useCallback(
    (callSid: string) => {
      stopPolling();
      let attempts = 0;
      poller.current = setInterval(async () => {
        // ~4 minutes: past that the call is not coming back, and a tab left
        // open should not keep asking forever.
        if (++attempts > 80) {
          stopPolling();
          setPhase("idle");
          return;
        }
        try {
          const status = await getCallStatus(callSid);
          if (!status) return;
          if ((status.talkSeconds ?? 0) > 0 || status.answeredAt) {
            setPhase("talking");
          }
          if (status.status && SETTLED.includes(status.status)) {
            stopPolling();
            setPhase("ended");
            onEndedRef.current?.(callSid);
            // Leave the finished state up briefly so it is legible.
            settleTimer.current = setTimeout(() => setPhase("idle"), 2500);
          }
        } catch {
          // A dropped poll is not a failed call - keep watching.
        }
      }, 3000);
    },
    [stopPolling],
  );

  const place = async () => {
    if (phase !== "idle") return;
    setPhase("placing");
    try {
      const call = await placeLeadCall(leadId, phone);
      setPhase("ringing");
      toast.info("Your phone is ringing - pick up and we'll dial the lead");
      watch(call.callSid);
    } catch (err) {
      setPhase("idle");
      const message =
        axios.isAxiosError(err) &&
        (err.response?.data as { message?: string } | undefined)?.message;
      toast.error(message || "Could not place the call");
    }
  };

  const label =
    phase === "placing"
      ? "Connecting…"
      : phase === "ringing"
        ? "Ringing you…"
        : phase === "talking"
          ? "On call"
          : phase === "ended"
            ? "Call ended"
            : (idleLabel ?? "Place call");

  const busy = phase === "placing" || phase === "ringing";
  const active = phase !== "idle";

  const tone =
    phase === "talking"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : variant === "primary"
        ? "border-transparent bg-[#4309ac] text-white disabled:opacity-70"
        : active
          ? "border-[#4309ac]/30 bg-[#4309ac]/5 text-[#4309ac]"
          : "border-gray-200 bg-white text-gray-700 hover:border-[#4309ac]/40 hover:text-[#4309ac] disabled:opacity-40";

  return (
    <button
      type="button"
      onClick={place}
      disabled={disabled || active}
      title={
        disabled
          ? "This lead has no phone number"
          : "Rings your phone first, then the lead"
      }
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors disabled:cursor-not-allowed ${
        compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
      } ${tone} ${className ?? ""}`}
    >
      {busy ? (
        <Loader2
          className={compact ? "size-3 animate-spin" : "size-3.5 animate-spin"}
        />
      ) : icon ? (
        <PhoneCall className={compact ? "size-3" : "size-3.5"} />
      ) : null}
      {label}
    </button>
  );

}
