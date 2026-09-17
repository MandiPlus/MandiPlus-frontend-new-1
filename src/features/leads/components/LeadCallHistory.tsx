"use client";

import { useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import { getCalls, type CallRecord } from "../api";
import RecordingPlayer from "./RecordingPlayer";

const OUTCOME_LABEL: Record<string, string> = {
  connected: "Spoke",
  lead_no_answer: "No answer",
  caller_no_answer: "Missed by us",
  failed: "Failed",
};

const OUTCOME_STYLE: Record<string, string> = {
  connected: "bg-emerald-50 text-emerald-700",
  lead_no_answer: "bg-amber-50 text-amber-700",
  caller_no_answer: "bg-slate-100 text-slate-600",
  failed: "bg-rose-50 text-rose-700",
};

function duration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Every call ever placed to this lead, newest first.
 *
 * A lead is usually worked over several attempts, and the recordings are the
 * only record of what was actually said across them - so they belong on the
 * lead, not only in a global list a manager has to go filter.
 */
export default function LeadCallHistory({ leadId }: { leadId: string }) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  // Which lead the rows in state belong to. Derived loading rather than a
  // synchronous setState in the effect, so switching leads never shows the
  // previous lead's calls for a frame.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== leadId;

  useEffect(() => {
    let alive = true;
    getCalls({ leadId, limit: 50 })
      .then((data) => {
        if (alive) setCalls(data.calls ?? []);
      })
      .catch(() => {
        if (alive) setCalls([]);
      })
      .finally(() => {
        if (alive) setLoadedFor(leadId);
      });
    return () => {
      alive = false;
    };
  }, [leadId]);

  if (loading) {
    return <div className="h-12 animate-pulse rounded-xl bg-gray-100" />;
  }

  if (calls.length === 0) {
    return <p className="text-sm text-gray-400">No calls placed yet</p>;
  }

  return (
    <ul className="max-h-56 space-y-2 overflow-y-auto pr-2">
      {calls.map((call) => (
        <li
          key={call.callSid}
          className="rounded-xl border border-gray-100 px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <PhoneCall className="size-3 text-gray-400" />
            <span className="text-xs text-gray-500">
              {new Date(call.at).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                OUTCOME_STYLE[call.outcome] ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {OUTCOME_LABEL[call.outcome] ?? call.outcome}
            </span>
            {duration(call.talkSeconds) && (
              <span className="text-xs tabular-nums text-gray-500">
                {duration(call.talkSeconds)}
              </span>
            )}
            {call.placedBy && (
              <span className="text-xs text-gray-400">· {call.placedBy}</span>
            )}
          </div>

          {call.note && (
            <p className="mt-1 text-xs text-gray-500">{call.note}</p>
          )}

          <div className="mt-1.5">
            {call.hasRecording ? (
              <RecordingPlayer callSid={call.callSid} />
            ) : (
              <span className="text-[11px] text-gray-400">
                {(call.talkSeconds ?? 0) > 0
                  ? "recording processing…"
                  : "no recording"}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
