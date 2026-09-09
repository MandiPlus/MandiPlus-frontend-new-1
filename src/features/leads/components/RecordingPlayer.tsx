"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { fetchRecording } from "../api";

/**
 * Loads a recording only when someone asks for it. Every play is an
 * authenticated stream through our backend and then Exotel's S3, so loading
 * every row's audio on render would cost real egress for calls nobody listens
 * to - which is exactly how the invoices egress bill happened.
 */
export default function RecordingPlayer({ callSid }: { callSid: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

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

  if (src) {
    return (
      <audio controls autoPlay src={src} className="h-8 w-56 max-w-full" />
    );
  }

  return (
    <button
      type="button"
      onClick={load}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-[#4309ac]/40 hover:text-[#4309ac] disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Play className="size-3" />
      )}
      {failed ? "Not ready yet" : loading ? "Loading…" : "Play"}
    </button>
  );
}
