"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Clock,
  PhoneCall,
  PhoneOff,
  Mic,
  TrendingUp,
} from "lucide-react";
import {
  getCalls,
  type CallRecord,
  type CallsPage,
  type CallsSummary,
  type LeadCommodity,
  type OverviewCaller,
} from "../api";
import RecordingPlayer from "./RecordingPlayer";

const iso = (d: Date) => d.toISOString().slice(0, 10);

const PAGE_SIZE = 50;

const OUTCOMES: { value: string; label: string }[] = [
  { value: "", label: "Every outcome" },
  { value: "connected", label: "Spoke to the lead" },
  { value: "lead_no_answer", label: "Lead did not pick up" },
  { value: "caller_no_answer", label: "Caller did not pick up" },
  { value: "has_recording", label: "Has a recording" },
];

const OUTCOME_STYLE: Record<string, string> = {
  connected: "bg-emerald-50 text-emerald-700",
  lead_no_answer: "bg-amber-50 text-amber-700",
  caller_no_answer: "bg-slate-100 text-slate-600",
  failed: "bg-rose-50 text-rose-700",
};

const OUTCOME_LABEL: Record<string, string> = {
  connected: "Spoke",
  lead_no_answer: "No answer",
  caller_no_answer: "Missed by us",
  failed: "Failed",
};

const DISPOSITION_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONFIRMED_BUYER: "Confirmed buyer",
  INTERESTED: "Interested",
  FOLLOW_UP: "Follow-up",
  DEMO_BOOKED: "Demo booked",
  CONVERTED: "Customer",
  NOT_INTERESTED: "Not interested",
  NOT_REACHABLE: "Not connected",
  NOT_RELEVANT: "Not relevant",
  INVALID: "Wrong number",
};

function duration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function Stat({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  note?: string;
  icon: typeof PhoneCall;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums text-gray-900">
        {value}
      </div>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

/**
 * Every call the team has placed, with the recording behind it.
 *
 * A disposition is what a caller says happened; a recording is what happened.
 * Putting them in the same row is the point of this screen - the filters exist
 * so a manager can go from "connect rate dropped on ginger" to the audio of
 * the calls that made it drop.
 */
export default function CallsBoard({
  commodities,
  callers,
  isManager,
  onOpenLead,
}: {
  commodities: LeadCommodity[];
  callers: OverviewCaller[];
  isManager: boolean;
  onOpenLead?: (leadId: string) => void;
}) {
  const [rangeDays, setRangeDays] = useState<number | null>(7);
  const [userId, setUserId] = useState("");
  const [commodityCode, setCommodityCode] = useState("");
  const [outcome, setOutcome] = useState("");
  const [query, setQuery] = useState("");
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [summary, setSummary] = useState<CallsSummary | null>(null);
  const [page, setPage] = useState<CallsPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const to = new Date();
      const from = rangeDays
        ? new Date(Date.now() - (rangeDays - 1) * 86400000)
        : null;
      const data = await getCalls({
        from: from ? iso(from) : undefined,
        to: iso(to),
        userId: userId || undefined,
        commodityCode: commodityCode || undefined,
        outcome: outcome || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setCalls(data.calls ?? []);
      setSummary(data.summary ?? null);
      setPage(data.page ?? null);
    } catch {
      toast.error("Could not load the calls");
    } finally {
      setLoading(false);
    }
  }, [rangeDays, userId, commodityCode, outcome, offset]);

  useEffect(() => {
    load();
  }, [load]);

  // A filter change makes the current page meaningless - page 4 of the old
  // result set is not page 4 of the new one.
  useEffect(() => {
    setOffset(0);
  }, [rangeDays, userId, commodityCode, outcome]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter((c) =>
      [c.leadName, c.leadPhone, c.mandi, c.region, c.placedBy, c.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [calls, query]);

  const selectClass =
    "h-9 w-full min-w-0 rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30 sm:w-auto";

  const commodityLabel = (code: string | null) => {
    if (!code) return "—";
    const item = commodities.find((c) => c.code === code);
    return item ? `${item.emoji ?? ""} ${item.label}`.trim() : code;
  };

  const talkMinutes = summary ? Math.round(summary.talkSeconds / 60) : 0;

  return (
    <section>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select
          value={rangeDays ?? ""}
          onChange={(e) =>
            setRangeDays(e.target.value ? Number(e.target.value) : null)
          }
          className={selectClass}
        >
          <option value="1">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="">All time</option>
        </select>

        {isManager && (
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={selectClass}
          >
            <option value="">Everyone</option>
            {callers.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={commodityCode}
          onChange={(e) => setCommodityCode(e.target.value)}
          className={selectClass}
        >
          <option value="">Every commodity</option>
          {commodities.map((c) => (
            <option key={c.code} value={c.code}>
              {`${c.emoji ?? ""} ${c.label}`.trim()}
            </option>
          ))}
        </select>

        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className={selectClass}
        >
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, number, mandi…"
          className="col-span-2 h-9 w-full rounded-full border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30 sm:min-w-[200px] sm:flex-1"
        />
      </div>

      {summary && !loading && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Calls" value={summary.total} icon={PhoneCall} />
          <Stat
            label="Spoke"
            value={summary.connected}
            note={`${summary.connectRate}% of calls`}
            icon={TrendingUp}
          />
          <Stat
            label="Talk time"
            value={`${talkMinutes}m`}
            note={
              summary.avgTalkSeconds
                ? `${duration(summary.avgTalkSeconds)} average`
                : undefined
            }
            icon={Clock}
          />
          <Stat
            label="Recordings"
            value={summary.recordings}
            note={
              summary.connected > summary.recordings
                ? `${summary.connected - summary.recordings} still processing`
                : "all ready"
            }
            icon={Mic}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        {loading ? (
          <div className="space-y-2 p-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <PhoneOff className="mx-auto mb-2 size-5 text-gray-300" />
            <p className="text-sm text-gray-400">
              No calls here yet. Place one from a lead and it will show up.
            </p>
          </div>
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                  {[
                    "When",
                    "Lead",
                    "Commodity",
                    "Mandi",
                    "Caller",
                    "Outcome",
                    "Talk",
                    "Logged as",
                    "Recording",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap border-b border-gray-100 px-3 py-2 font-semibold first:pl-5 last:pr-5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.callSid} className="hover:bg-gray-50/60">
                    <td className="whitespace-nowrap border-b border-gray-50 py-2.5 pl-5 pr-3 text-gray-500">
                      {new Date(c.at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="border-b border-gray-50 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenLead?.(c.leadId)}
                        className="text-left font-medium text-gray-900 hover:text-[#4309ac]"
                      >
                        {c.leadName}
                      </button>
                      {c.leadPhone && (
                        <p className="text-[11px] tabular-nums text-gray-400">
                          {c.leadPhone.replace("+91", "")}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-50 px-3 py-2.5 text-gray-600">
                      {commodityLabel(c.commodityCode)}
                    </td>
                    <td className="border-b border-gray-50 px-3 py-2.5 text-gray-600">
                      {c.mandi ?? c.region ?? "—"}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-50 px-3 py-2.5 text-gray-600">
                      {c.placedBy ?? c.assignee ?? "—"}
                    </td>
                    <td className="border-b border-gray-50 px-3 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          OUTCOME_STYLE[c.outcome] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {OUTCOME_LABEL[c.outcome] ?? c.outcome}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-50 px-3 py-2.5 tabular-nums text-gray-600">
                      {duration(c.talkSeconds)}
                    </td>
                    <td className="border-b border-gray-50 px-3 py-2.5 text-gray-600">
                      {c.disposition ? (
                        <>
                          {DISPOSITION_LABEL[c.disposition] ?? c.disposition}
                          {c.note && (
                            <p className="max-w-[220px] truncate text-[11px] text-gray-400">
                              {c.note}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300">not logged</span>
                      )}
                    </td>
                    <td className="w-[280px] min-w-[280px] border-b border-gray-50 py-2.5 pl-3 pr-5">
                      {c.hasRecording ? (
                        <RecordingPlayer callSid={c.callSid} />
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          {(c.talkSeconds ?? 0) > 0 ? "processing…" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Narrow screens: a nine-column table is unreadable on a phone, so
            each call becomes a card carrying the same facts. */}
        {!loading && visible.length > 0 && (
          <ul className="divide-y divide-gray-50 md:hidden">
            {visible.map((c) => (
              <li key={c.callSid} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenLead?.(c.leadId)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-medium text-gray-900">
                      {c.leadName}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {[
                        commodityLabel(c.commodityCode),
                        c.mandi ?? c.region,
                      ]
                        .filter((v) => v && v !== "—")
                        .join(" · ")}
                    </p>
                  </button>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      OUTCOME_STYLE[c.outcome] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {OUTCOME_LABEL[c.outcome] ?? c.outcome}
                  </span>
                </div>

                <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-gray-400">
                  <span>
                    {new Date(c.at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {(c.talkSeconds ?? 0) > 0 && (
                    <span className="tabular-nums">
                      · {duration(c.talkSeconds)}
                    </span>
                  )}
                  {(c.placedBy ?? c.assignee) && (
                    <span>· {c.placedBy ?? c.assignee}</span>
                  )}
                  {c.leadPhone && (
                    <span className="tabular-nums">
                      · {c.leadPhone.replace("+91", "")}
                    </span>
                  )}
                </p>

                {c.disposition && (
                  <p className="mt-1 text-xs text-gray-600">
                    {DISPOSITION_LABEL[c.disposition] ?? c.disposition}
                    {c.note && (
                      <span className="text-gray-400"> · {c.note}</span>
                    )}
                  </p>
                )}

                <div className="mt-2">
                  {c.hasRecording ? (
                    <RecordingPlayer callSid={c.callSid} />
                  ) : (
                    <span className="text-[11px] text-gray-400">
                      {(c.talkSeconds ?? 0) > 0
                        ? "recording processing…"
                        : "no recording"}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page && page.total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {page.offset + 1}&ndash;{page.offset + visible.length} of{" "}
            {page.total}
            {query && " on this page"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={loading || offset === 0}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={loading || !page.hasMore}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
