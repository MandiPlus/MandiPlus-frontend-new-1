"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  MessageCircle,
  Phone,
  PhoneCall,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAdmin } from "@/features/admin/context/AdminContext";
import {
  getLeadEvents,
  getLeadReport,
  getLeads,
  getLeadsBootstrap,
  getTodayPlan,
  logLeadCall,
  setDailyTarget,
  updateLead,
  type LeadBatchSummary,
  type LeadCommodity,
  type LeadEventRecord,
  type LeadRecord,
  type LeadReport,
  type LeadStatus,
  type LeadTeamMember,
  type LeadViewerInfo,
  type TodayPlan,
} from "@/features/leads/api";

const ACCENT = "#4309ac";

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-gray-100 text-gray-700" },
  CONTACTED: { label: "Contacted", className: "bg-blue-50 text-blue-700" },
  FOLLOW_UP: { label: "Follow-up", className: "bg-amber-50 text-amber-700" },
  INTERESTED: { label: "Interested", className: "bg-purple-50 text-[#4309ac]" },
  CONVERTED: { label: "Converted", className: "bg-emerald-50 text-emerald-700" },
  NOT_INTERESTED: { label: "Not interested", className: "bg-gray-100 text-gray-500" },
  NOT_REACHABLE: { label: "Not reachable", className: "bg-orange-50 text-orange-700" },
  INVALID: { label: "Invalid", className: "bg-red-50 text-red-600" },
};

const DISPOSITIONS: LeadStatus[] = [
  "CONTACTED",
  "FOLLOW_UP",
  "INTERESTED",
  "CONVERTED",
  "NOT_INTERESTED",
  "NOT_REACHABLE",
  "INVALID",
];

type Tab = "today" | "leads" | "mandiplus" | "converted" | "closed" | "reports";

const ACTIVE_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP",
  "INTERESTED",
  "NOT_REACHABLE",
];

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function followUpBucket(lead: LeadRecord): "overdue" | "today" | null {
  if (!lead.nextFollowUpAt) return null;
  const due = startOfDay(new Date(lead.nextFollowUpAt));
  const today = startOfDay(new Date());
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return null;
}

/** "6:00 pm" for today, "9 Sep, 6:00 pm" otherwise. */
function formatWhen(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (startOfDay(d).getTime() === startOfDay(new Date()).getTime()) return time;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

/** A local datetime-local value ("2026-09-09T18:00") for an offset from now. */
function localInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function atTime(dayOffset: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function last10(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

export default function LeadsPage() {
  const { accessProfile } = useAdmin();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [team, setTeam] = useState<LeadTeamMember[]>([]);
  const [commodities, setCommodities] = useState<LeadCommodity[]>([]);
  const [batches, setBatches] = useState<LeadBatchSummary[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("today");
  const [viewAs, setViewAs] = useState<string>("");
  const [viewAsResolved, setViewAsResolved] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [commodityFilter, setCommodityFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [events, setEvents] = useState<LeadEventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const [callLead, setCallLead] = useState<LeadRecord | null>(null);
  const [callDisposition, setCallDisposition] = useState<LeadStatus | null>(null);
  const [callNote, setCallNote] = useState("");
  const [callFollowUpDate, setCallFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [viewer, setViewer] = useState<LeadViewerInfo | null>(null);
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planFor, setPlanFor] = useState<string>("");
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [targetDraft, setTargetDraft] = useState<string>("");

  const [report, setReport] = useState<LeadReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFrom, setReportFrom] = useState(() =>
    toISODate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
  );
  const [reportTo, setReportTo] = useState(() => toISODate(new Date()));

  const loadAll = useCallback(async () => {
    try {
      const [bootstrap, data] = await Promise.all([
        getLeadsBootstrap(),
        getLeads(),
      ]);
      setTeam(bootstrap.team);
      setCommodities(bootstrap.commodities);
      setBatches(bootstrap.batches);
      setRegions(bootstrap.regions);
      setViewer(bootstrap.viewer);
      setLeads(data);
      if (bootstrap.viewer && !bootstrap.viewer.isManager) {
        // A caller only ever receives their own leads, so no client filter.
        setViewAs("");
        setViewAsResolved(true);
      }
    } catch {
      toast.error("Could not load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("leads.viewAs");
    } catch {
      // ignore
    }
    if (stored !== null) {
      setViewAs(stored);
      setViewAsResolved(true);
    }
    loadAll();
  }, [loadAll]);

  // First visit: default to the signed-in person's own leads, matched on mobile.
  useEffect(() => {
    if (viewAsResolved || !team.length) return;
    if (viewer && !viewer.isManager) return;
    const mine = last10(accessProfile?.account?.mobileNumber);
    const match = mine
      ? team.find((member) => last10(member.mobileNumber) === mine)
      : undefined;
    if (match) setViewAs(match.id);
    setViewAsResolved(true);
  }, [accessProfile, team, viewAsResolved, viewer]);

  useEffect(() => {
    if (tab !== "reports") return;
    let cancelled = false;
    setReportLoading(true);
    getLeadReport(reportFrom, reportTo)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load the report");
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, reportFrom, reportTo]);

  const loadPlan = useCallback(
    async (userId?: string) => {
      setPlanLoading(true);
      try {
        const data = await getTodayPlan(userId || undefined);
        setPlan(data);
        setTargetDraft(String(data.target));
      } catch {
        toast.error("Could not load today's plan");
      } finally {
        setPlanLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tab !== "today" || !viewer) return;
    loadPlan(viewer.isManager ? planFor : undefined);
  }, [tab, viewer, planFor, loadPlan]);

  // Keeps the day honest: a 6pm callback climbs into "Call now" on its own,
  // without the caller thinking to reload.
  useEffect(() => {
    if (tab !== "today" || !viewer) return;
    if (focusIndex !== null) return;
    const target = viewer.isManager ? planFor : undefined;
    const tick = () => {
      if (document.visibilityState === "visible") loadPlan(target);
    };
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [tab, viewer, planFor, focusIndex, loadPlan]);

  const changeViewAs = (value: string) => {
    setViewAs(value);
    try {
      localStorage.setItem("leads.viewAs", value);
    } catch {
      // ignore
    }
  };

  const refreshLeads = useCallback(async () => {
    try {
      setLeads(await getLeads());
    } catch {
      toast.error("Refresh failed");
    }
  }, []);

  const baseFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (viewAs && lead.assignedToUserId !== viewAs) return false;
      if (statusFilter && lead.status !== statusFilter) return false;
      if (regionFilter && lead.region !== regionFilter) return false;
      if (commodityFilter && lead.commodityCode !== commodityFilter) return false;
      if (roleFilter && lead.role !== roleFilter) return false;
      if (batchFilter && lead.batchId !== batchFilter) return false;
      if (query) {
        const haystack = [
          lead.displayName,
          lead.region,
          lead.review,
          lead.batchLabel,
          ...lead.phones.map((p) => p.e164),
          ...lead.phones.map((p) => p.raw ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [
    leads,
    viewAs,
    search,
    statusFilter,
    regionFilter,
    commodityFilter,
    roleFilter,
    batchFilter,
  ]);

  const tabCounts = useMemo(() => {
    const counts = { leads: 0, mandiplus: 0, converted: 0, closed: 0 };
    for (const lead of baseFiltered) {
      if (lead.status === "CONVERTED") counts.converted += 1;
      else if (lead.matchedUserId) counts.mandiplus += 1;
      else if (ACTIVE_STATUSES.includes(lead.status)) counts.leads += 1;
      else counts.closed += 1;
    }
    return counts;
  }, [baseFiltered]);

  const visible = useMemo(() => {
    const inTab = baseFiltered.filter((lead) => {
      if (tab === "converted") return lead.status === "CONVERTED";
      if (tab === "mandiplus")
        return !!lead.matchedUserId && lead.status !== "CONVERTED";
      if (tab === "closed")
        return (
          !lead.matchedUserId &&
          (lead.status === "NOT_INTERESTED" || lead.status === "INVALID")
        );
      return !lead.matchedUserId && ACTIVE_STATUSES.includes(lead.status);
    });
    const rank = (lead: LeadRecord) => {
      const bucket = followUpBucket(lead);
      if (bucket === "overdue") return 0;
      if (bucket === "today") return 1;
      if (lead.status === "NEW") return 2;
      return 3;
    };
    return inTab.sort((a, b) => {
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [baseFiltered, tab]);

  const stats = useMemo(() => {
    const mine = baseFiltered.filter((l) => !l.matchedUserId);
    return {
      open: mine.filter((l) => ACTIVE_STATUSES.includes(l.status)).length,
      dueToday: mine.filter((l) => followUpBucket(l) === "today").length,
      overdue: mine.filter((l) => followUpBucket(l) === "overdue").length,
      converted: baseFiltered.filter((l) => l.status === "CONVERTED").length,
    };
  }, [baseFiltered]);

  const hasFilters =
    !!search ||
    !!statusFilter ||
    !!regionFilter ||
    !!commodityFilter ||
    !!roleFilter ||
    !!batchFilter;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setRegionFilter("");
    setCommodityFilter("");
    setRoleFilter("");
    setBatchFilter("");
  };

  const toggleExpand = async (lead: LeadRecord) => {
    if (expandedId === lead.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(lead.id);
    setNoteDraft("");
    setEvents([]);
    setEventsLoading(true);
    try {
      setEvents(await getLeadEvents(lead.id));
    } catch {
      // silent — timeline just stays empty
    } finally {
      setEventsLoading(false);
    }
  };

  const submitNote = async (lead: LeadRecord) => {
    const note = noteDraft.trim();
    if (!note) return;
    setSaving(true);
    try {
      await updateLead(lead.id, { note });
      setNoteDraft("");
      setEvents(await getLeadEvents(lead.id));
    } catch {
      toast.error("Could not save note");
    } finally {
      setSaving(false);
    }
  };

  const reassign = async (lead: LeadRecord, userId: string) => {
    try {
      if (userId) {
        await updateLead(lead.id, { assignedToUserId: userId });
      } else {
        await updateLead(lead.id, { clearAssignee: true });
      }
      await refreshLeads();
    } catch {
      toast.error("Could not reassign");
    }
  };

  const focusQueue = plan?.queue ?? [];
  const focusLead =
    focusIndex !== null ? (focusQueue[focusIndex] ?? null) : null;

  const startFocus = () => {
    if (!focusQueue.length) return;
    setFocusIndex(0);
    setCallDisposition(null);
    setCallNote("");
    setCallFollowUpDate("");
  };

  const submitFocusCall = async () => {
    if (!focusLead || !callDisposition) return;
    if (callDisposition === "FOLLOW_UP" && !callFollowUpDate) {
      toast.error("Pick a follow-up time");
      return;
    }
    setSaving(true);
    try {
      await logLeadCall(focusLead.id, {
        disposition: callDisposition,
        note: callNote.trim() || undefined,
        nextFollowUpAt:
          callDisposition === "FOLLOW_UP"
            ? new Date(callFollowUpDate).toISOString()
            : undefined,
      });
      setCallDisposition(null);
      setCallNote("");
      setCallFollowUpDate("");
      setFocusIndex((i) => (i === null ? null : i + 1));
      // The plan and the board move on in the background; the queue in hand
      // stays put so the caller is never re-ordered mid-session.
      refreshLeads();
      getTodayPlan(viewer?.isManager ? planFor || undefined : undefined)
        .then((data) => setPlan((prev) => (prev ? { ...data, queue: prev.queue } : data)))
        .catch(() => undefined);
    } catch {
      toast.error("Could not log the call");
    } finally {
      setSaving(false);
    }
  };

  const saveTarget = async () => {
    const value = Number(targetDraft);
    const userId = plan?.userId;
    if (!userId || !Number.isFinite(value) || value < 1 || value > 500) {
      toast.error("Target must be between 1 and 500");
      return;
    }
    try {
      await setDailyTarget(userId, Math.round(value));
      await loadPlan(viewer?.isManager ? planFor : undefined);
      toast.success("Target updated");
    } catch {
      toast.error("Could not update the target");
    }
  };

  const followUpChips: { label: string; value: Date }[] = (() => {
    const now = new Date();
    const chips: { label: string; value: Date }[] = [
      { label: "In 2 hours", value: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
    ];
    if (now.getHours() < 17) chips.push({ label: "Today 6pm", value: atTime(0, 18) });
    chips.push({ label: "Tomorrow 11am", value: atTime(1, 11) });
    chips.push({ label: "Tomorrow 5pm", value: atTime(1, 17) });
    return chips;
  })();

  const renderFollowUpPicker = () => (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap gap-2">
        {followUpChips.map((chip) => {
          const value = localInputValue(chip.value);
          const active = callFollowUpDate === value;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => setCallFollowUpDate(value)}
              className={`h-9 rounded-full border px-3 text-xs font-medium ${
                active ? "border-transparent text-white" : "border-gray-200 text-gray-700"
              }`}
              style={active ? { backgroundColor: ACCENT } : undefined}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <input
        type="datetime-local"
        aria-label="Follow-up time"
        value={callFollowUpDate}
        onChange={(e) => setCallFollowUpDate(e.target.value)}
        min={localInputValue(new Date())}
        className="h-12 w-full rounded-full border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30"
      />
    </div>
  );

  const openCallSheet = (lead: LeadRecord) => {
    setCallLead(lead);
    setCallDisposition(null);
    setCallNote("");
    setCallFollowUpDate("");
  };

  const submitCall = async () => {
    if (!callLead || !callDisposition) return;
    if (callDisposition === "FOLLOW_UP" && !callFollowUpDate) {
      toast.error("Pick a follow-up time");
      return;
    }
    setSaving(true);
    try {
      await logLeadCall(callLead.id, {
        disposition: callDisposition,
        note: callNote.trim() || undefined,
        nextFollowUpAt:
          callDisposition === "FOLLOW_UP"
            ? new Date(callFollowUpDate).toISOString()
            : undefined,
      });
      setCallLead(null);
      await refreshLeads();
    } catch {
      toast.error("Could not log the call");
    } finally {
      setSaving(false);
    }
  };

  const commodityLabel = (code: string | null) => {
    if (!code) return "—";
    const item = commodities.find((c) => c.code === code);
    return item ? `${item.emoji ?? ""} ${item.label}`.trim() : code;
  };

  const selectClass =
    "h-9 rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30";

  const renderDetail = (lead: LeadRecord) => (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        {lead.phones.length > 1 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-gray-400">All numbers</p>
            <div className="flex flex-wrap gap-2">
              {lead.phones.map((phone) => (
                <a
                  key={phone.e164}
                  href={`tel:${phone.e164}`}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs tabular-nums text-gray-600 hover:border-gray-300"
                >
                  {phone.e164.replace("+91", "")}
                  {phone.isLandline ? " · landline" : ""}
                </a>
              ))}
            </div>
          </div>
        )}
        {lead.review && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-gray-400">Review</p>
            <p className="text-sm text-gray-600">{lead.review}</p>
          </div>
        )}
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs font-medium text-gray-400">Assigned</p>
          <select
            aria-label="Assignee"
            value={lead.assignedToUserId ?? ""}
            onChange={(e) => reassign(lead, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="h-8 rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none"
          >
            <option value="">Unassigned</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        {lead.batchLabel && (
          <p className="text-xs text-gray-400">Batch · {lead.batchLabel}</p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNote(lead);
            }}
            placeholder="Add a note"
            className="h-10 min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30"
          />
          <button
            type="button"
            disabled={saving || !noteDraft.trim()}
            onClick={(e) => {
              e.stopPropagation();
              submitNote(lead);
            }}
            className="h-10 rounded-full px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            Save
          </button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-gray-400">History</p>
        {eventsLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto pr-2">
            {events.map((event) => (
              <li key={event.id} className="text-sm">
                <span className="text-gray-800">
                  {event.type === "CALL"
                    ? `Call — ${event.disposition ? STATUS_META[event.disposition as LeadStatus]?.label ?? event.disposition : ""}`
                    : event.type === "STATUS_CHANGE"
                      ? `Status → ${STATUS_META[event.toStatus as LeadStatus]?.label ?? event.toStatus}`
                      : event.type === "NOTE"
                        ? "Note"
                        : event.type === "ASSIGNMENT"
                          ? "Assignment"
                          : "Added"}
                </span>
                {event.note && (
                  <span className="text-gray-500"> · {event.note}</span>
                )}
                <span className="text-xs text-gray-400">
                  {" "}
                  ·{" "}
                  {new Date(event.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {event.byAdminName ? ` · ${event.byAdminName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const connectRate = report && report.totals.calls > 0
    ? Math.round((report.totals.connected / report.totals.calls) * 100)
    : 0;

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      <ToastContainer position="bottom-right" autoClose={2500} hideProgressBar />

      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              L
            </div>
            <h1 className="text-base font-semibold">Leads</h1>
          </div>
          <button
            type="button"
            aria-label="Refresh"
            onClick={refreshLeads}
            className="flex size-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24">
        <nav className="-mx-4 overflow-x-auto px-4">
          <div className="flex w-max min-w-full gap-1 border-b border-gray-100">
            {(
              [
                ["today", "Today"],
                ["leads", "Leads"],
                ["mandiplus", "On Mandiplus"],
                ["converted", "Converted"],
                ["closed", "Closed"],
                ["reports", "Reports"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative -mb-px whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  tab === key
                    ? "border-b-2 text-[#4309ac]"
                    : "text-gray-500 hover:text-gray-800"
                }`}
                style={tab === key ? { borderColor: ACCENT } : undefined}
              >
                {label}
                {key !== "reports" && key !== "today" && (
                  <span className="ml-1.5 text-xs tabular-nums text-gray-400">
                    {tabCounts[key as keyof typeof tabCounts]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {tab === "today" ? (
          <section className="py-5">
            {viewer?.isManager && (
              <select
                aria-label="Whose day"
                value={planFor}
                onChange={(e) => setPlanFor(e.target.value)}
                className={`${selectClass} mb-4`}
              >
                <option value="">Whole team</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            )}

            {planLoading || !plan ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-50" />
                ))}
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-gray-100 p-4 sm:flex sm:items-center sm:gap-4">
                  <div className="flex items-center gap-4 sm:flex-1">
                    <ProgressRing value={plan.covered} max={plan.target} />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold">
                        {plan.covered} of {plan.target} covered today
                        {plan.scope === "team" ? " (team)" : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {plan.callsToday} {plan.callsToday === 1 ? "call" : "calls"} made
                        {" · "}
                        {plan.pending} to call now
                        {plan.scheduledLater > 0
                          ? ` · ${plan.scheduledLater} later today`
                          : ""}
                        {plan.scope === "member" && plan.nextAction
                          ? ` · next: ${plan.nextAction}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {plan.scope === "member" && (
                    <button
                      type="button"
                      onClick={startFocus}
                      disabled={!plan.queue.length}
                      className="mt-4 h-12 w-full shrink-0 rounded-full px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:mt-0 sm:h-11 sm:w-auto"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {plan.queue.length ? "Start calling" : "All done"}
                    </button>
                  )}
                </div>

                {viewer?.isManager && plan.scope === "member" && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs text-gray-500" htmlFor="target">
                      Daily target
                    </label>
                    <input
                      id="target"
                      type="number"
                      min={1}
                      max={500}
                      value={targetDraft}
                      onChange={(e) => setTargetDraft(e.target.value)}
                      className="h-9 w-20 rounded-full border border-gray-200 px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30"
                    />
                    <button
                      type="button"
                      onClick={saveTarget}
                      className="h-9 rounded-full border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Save
                    </button>
                  </div>
                )}

                {plan.scope === "team" ? (
                  <div className="mt-6 space-y-3">
                    {(plan.members ?? []).length === 0 ? (
                      <p className="py-10 text-center text-sm text-gray-400">
                        Nobody has leads assigned yet
                      </p>
                    ) : (
                      (plan.members ?? []).map((member) => (
                        <button
                          key={member.userId}
                          type="button"
                          onClick={() => setPlanFor(member.userId)}
                          className="w-full rounded-2xl border border-gray-100 p-4 text-left hover:border-gray-200"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm tabular-nums text-gray-500">
                              {member.covered}/{member.target}
                            </p>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: ACCENT,
                                width: `${member.target > 0 ? Math.min(100, (member.covered / member.target) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-gray-500">
                            {member.overdue > 0 && (
                              <span className="font-medium text-red-600">
                                {member.overdue} overdue
                              </span>
                            )}
                            {member.dueToday > 0 && (
                              <span className="text-amber-600">
                                {member.dueToday} due today
                              </span>
                            )}
                            {member.hot > 0 && <span>{member.hot} interested</span>}
                            <span>{member.fresh} new</span>
                            <span>{member.callsToday} calls today</span>
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                ) : plan.queue.length === 0 ? (
                  <p className="py-16 text-center text-sm text-gray-400">
                    Nothing left to call today
                  </p>
                ) : (
                  <div className="mt-6 space-y-6">
                    {(
                      [
                        ["overdue", "Overdue follow-ups", "text-red-600"],
                        ["dueNow", "Due now", "text-red-600"],
                        ["laterToday", "Later today", "text-amber-600"],
                        ["hot", "Interested", "text-[#4309ac]"],
                        ["fresh", "New leads", "text-gray-900"],
                        ["recall", "Not connected", "text-orange-600"],
                      ] as const
                    ).map(([key, label, tone]) => {
                      const list = plan.sections[key];
                      if (!list.length) return null;
                      return (
                        <div key={key}>
                          <h2 className={`mb-2 text-sm font-semibold ${tone}`}>
                            {label}
                            <span className="ml-1.5 text-xs font-normal tabular-nums text-gray-400">
                              {list.length}
                            </span>
                          </h2>
                          <div className="divide-y divide-gray-100">
                            {list.map((lead) => (
                              <div
                                key={lead.id}
                                className="flex items-center justify-between gap-3 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {lead.displayName}
                                  </p>
                                  <p className="truncate text-xs text-gray-400">
                                    {(lead.reason || lead.nextFollowUpAt) && (
                                      <span
                                        className={
                                          key === "laterToday"
                                            ? "font-medium text-amber-600"
                                            : key === "overdue" || key === "dueNow"
                                              ? "font-medium text-red-600"
                                              : "font-medium text-gray-600"
                                        }
                                      >
                                        {lead.reason ??
                                          formatWhen(lead.nextFollowUpAt)}
                                        {" · "}
                                      </span>
                                    )}
                                    {lead.phones[0]?.e164.replace("+91", "") ?? "—"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  {lead.phones[0] && (
                                    <a
                                      href={`tel:${lead.phones[0].e164}`}
                                      aria-label="Call"
                                      className="flex size-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 active:bg-gray-50"
                                    >
                                      <Phone className="size-4" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openCallSheet(lead)}
                                    className="h-10 rounded-full px-4 text-sm font-medium text-white"
                                    style={{ backgroundColor: ACCENT }}
                                  >
                                    Log
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        ) : tab === "reports" ? (
          <section className="py-5">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="From date"
                value={reportFrom}
                max={reportTo}
                onChange={(e) => setReportFrom(e.target.value)}
                className={selectClass}
              />
              <span className="text-sm text-gray-400">to</span>
              <input
                type="date"
                aria-label="To date"
                value={reportTo}
                min={reportFrom}
                onChange={(e) => setReportTo(e.target.value)}
                className={selectClass}
              />
            </div>

            {reportLoading || !report ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-50" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Calls made", value: report.totals.calls },
                    { label: "Connected", value: `${report.totals.connected} · ${connectRate}%` },
                    { label: "Converted", value: report.totals.converted },
                    { label: "Follow-ups set", value: report.totals.followUpsSet },
                    { label: "Interested", value: report.totals.interested },
                    { label: "Not interested", value: report.totals.notInterested },
                    { label: "New leads added", value: report.totals.leadsAdded },
                    {
                      label: "Untouched · Overdue",
                      value: `${report.totals.untouched} · ${report.totals.overdue}`,
                      alert: report.totals.untouched + report.totals.overdue > 0,
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="rounded-2xl border border-gray-100 px-4 py-3"
                    >
                      <p
                        className={`text-xl font-semibold tabular-nums ${
                          card.alert ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        {card.value}
                      </p>
                      <p className="text-xs text-gray-500">{card.label}</p>
                    </div>
                  ))}
                </div>

                <h2 className="mt-8 mb-3 text-sm font-semibold text-gray-900">
                  Team
                </h2>
                <div className="space-y-3 md:hidden">
                  {report.perMember.map((member) => (
                    <div
                      key={member.userId}
                      className="rounded-2xl border border-gray-100 p-4"
                    >
                      <p className="mb-2 font-medium">{member.name}</p>
                      <div className="grid grid-cols-3 gap-y-2 text-center">
                        {[
                          ["Calls", member.calls],
                          ["Connected", member.connected],
                          ["Converted", member.converted],
                          ["Follow-ups", member.followUpsSet],
                          ["Open", member.openLeads],
                          ["Overdue", member.overdue],
                        ].map(([label, value]) => (
                          <div key={label as string}>
                            <p className="text-base font-semibold tabular-nums">
                              {value}
                            </p>
                            <p className="text-[11px] text-gray-400">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-400">
                        {["Name", "Calls", "Connected", "Interested", "Converted", "Follow-ups", "Not interested", "Open", "Untouched", "Overdue"].map(
                          (h) => (
                            <th key={h} className="border-b border-gray-100 px-3 py-2">
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {report.perMember.map((m) => (
                        <tr key={m.userId}>
                          <td className="border-b border-gray-50 px-3 py-2.5 font-medium">
                            {m.name}
                          </td>
                          {[m.calls, m.connected, m.interested, m.converted, m.followUpsSet, m.notInterested, m.openLeads, m.untouched].map(
                            (v, i) => (
                              <td key={i} className="border-b border-gray-50 px-3 py-2.5 tabular-nums text-gray-600">
                                {v}
                              </td>
                            ),
                          )}
                          <td
                            className={`border-b border-gray-50 px-3 py-2.5 tabular-nums ${m.overdue > 0 ? "font-medium text-red-600" : "text-gray-600"}`}
                          >
                            {m.overdue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h2 className="mt-8 mb-3 text-sm font-semibold text-gray-900">
                  By day
                </h2>
                {report.perDay.length === 0 ? (
                  <p className="text-sm text-gray-400">No activity in this range</p>
                ) : (
                  <table className="w-full max-w-md border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-400">
                        {["Date", "Calls", "Connected", "Converted"].map((h) => (
                          <th key={h} className="border-b border-gray-100 px-3 py-2">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.perDay.map((d) => (
                        <tr key={d.day}>
                          <td className="border-b border-gray-50 px-3 py-2.5 text-gray-700">
                            {new Date(`${d.day}T00:00:00`).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </td>
                          <td className="border-b border-gray-50 px-3 py-2.5 tabular-nums text-gray-600">{d.calls}</td>
                          <td className="border-b border-gray-50 px-3 py-2.5 tabular-nums text-gray-600">{d.connected}</td>
                          <td className="border-b border-gray-50 px-3 py-2.5 tabular-nums text-gray-600">{d.converted}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
              {[
                { label: "Open", value: stats.open },
                { label: "Due today", value: stats.dueToday },
                { label: "Overdue", value: stats.overdue, alert: stats.overdue > 0 },
                { label: "Converted", value: stats.converted },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-gray-100 px-4 py-3"
                >
                  <p
                    className={`text-2xl font-semibold tabular-nums ${
                      card.alert ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {card.value}
                  </p>
                  <p className="text-xs text-gray-500">{card.label}</p>
                </div>
              ))}
            </section>

            <section className="flex flex-wrap items-center gap-2 pb-4">
              {viewer?.isManager && (
                <select
                  aria-label="Team member"
                  value={viewAs}
                  onChange={(e) => changeViewAs(e.target.value)}
                  className={`${selectClass} ${viewAs ? "border-[#4309ac]/40 text-[#4309ac]" : ""}`}
                >
                  <option value="">Everyone</option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative min-w-0 flex-1 basis-40">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="h-9 w-full rounded-full border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30"
                />
              </div>
              <select
                aria-label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">Status</option>
                {Object.entries(STATUS_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Region"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">Region</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <select
                aria-label="Commodity"
                value={commodityFilter}
                onChange={(e) => setCommodityFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">Commodity</option>
                {commodities.map((commodity) => (
                  <option key={commodity.code} value={commodity.code}>
                    {commodity.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">Role</option>
                <option value="BUYER">Buyer</option>
                <option value="SUPPLIER">Supplier</option>
                <option value="TRANSPORTER">Transporter</option>
              </select>
              <select
                aria-label="Batch"
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">Batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex h-9 items-center gap-1 rounded-full px-3 text-sm text-gray-500 hover:bg-gray-50"
                >
                  <X className="size-3.5" /> Clear
                </button>
              )}
            </section>

            {loading ? (
              <div className="space-y-2 py-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-50" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">
                No leads here
              </p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {visible.map((lead) => {
                    const bucket = followUpBucket(lead);
                    const expanded = expandedId === lead.id;
                    const primary = lead.phones[0];
                    return (
                      <div key={lead.id} className="py-3.5">
                        <div
                          onClick={() => toggleExpand(lead)}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{lead.displayName}</p>
                            <p className="mt-0.5 truncate text-xs text-gray-400">
                              {[
                                lead.region,
                                commodityLabel(lead.commodityCode),
                                lead.role
                                  ? lead.role.charAt(0) + lead.role.slice(1).toLowerCase()
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_META[lead.status].className}`}
                          >
                            {STATUS_META[lead.status].label}
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {primary && (
                              <>
                                <a
                                  href={`tel:${primary.e164}`}
                                  className="flex h-10 items-center gap-2 rounded-full border border-gray-200 pl-3 pr-4 text-sm tabular-nums text-gray-700 active:bg-gray-50"
                                >
                                  <Phone className="size-4 text-gray-400" />
                                  {primary.e164.replace("+91", "")}
                                </a>
                                {!primary.isLandline && (
                                  <a
                                    href={`https://wa.me/${primary.e164.replace("+", "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="WhatsApp"
                                    className="flex size-10 items-center justify-center rounded-full border border-gray-200 text-emerald-600 active:bg-emerald-50"
                                  >
                                    <MessageCircle className="size-4" />
                                  </a>
                                )}
                                {lead.phones.length > 1 && (
                                  <span className="text-xs text-gray-400">
                                    +{lead.phones.length - 1}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openCallSheet(lead)}
                            className="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-white"
                            style={{ backgroundColor: ACCENT }}
                          >
                            <PhoneCall className="size-3.5" /> Log call
                          </button>
                        </div>
                        <div
                          onClick={() => toggleExpand(lead)}
                          className="mt-2 flex items-center justify-between text-xs text-gray-400"
                        >
                          <span>
                            {lead.assignedToName ?? "Unassigned"}
                            {lead.attemptCount > 0
                              ? ` · ${lead.attemptCount} ${lead.attemptCount === 1 ? "attempt" : "attempts"}`
                              : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            {lead.nextFollowUpAt && (
                              <span
                                className={`tabular-nums ${
                                  bucket === "overdue"
                                    ? "font-medium text-red-600"
                                    : bucket === "today"
                                      ? "font-medium text-amber-600"
                                      : ""
                                }`}
                              >
                                {formatWhen(lead.nextFollowUpAt)}
                              </span>
                            )}
                            <ChevronDown
                              className={`size-4 text-gray-300 transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </span>
                        </div>
                        {expanded && (
                          <div className="mt-3 rounded-2xl bg-gray-50/70 p-4">
                            {renderDetail(lead)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-400">
                        <th className="border-b border-gray-100 px-3 py-2">Name</th>
                        <th className="border-b border-gray-100 px-3 py-2">Phone</th>
                        <th className="border-b border-gray-100 px-3 py-2">Region</th>
                        <th className="border-b border-gray-100 px-3 py-2">Commodity</th>
                        <th className="border-b border-gray-100 px-3 py-2">Role</th>
                        <th className="border-b border-gray-100 px-3 py-2">Status</th>
                        <th className="border-b border-gray-100 px-3 py-2">Follow-up</th>
                        <th className="border-b border-gray-100 px-3 py-2">Assigned</th>
                        <th className="border-b border-gray-100 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((lead) => {
                        const bucket = followUpBucket(lead);
                        const expanded = expandedId === lead.id;
                        const primary = lead.phones[0];
                        return (
                          <FragmentRow key={lead.id}>
                            <tr
                              className="cursor-pointer align-middle hover:bg-gray-50/60"
                              onClick={() => toggleExpand(lead)}
                            >
                              <td className="border-b border-gray-50 px-3 py-3">
                                <p className="font-medium text-gray-900">
                                  {lead.displayName}
                                </p>
                                {lead.attemptCount > 0 && (
                                  <p className="text-xs text-gray-400">
                                    {lead.attemptCount}{" "}
                                    {lead.attemptCount === 1 ? "attempt" : "attempts"}
                                  </p>
                                )}
                              </td>
                              <td className="border-b border-gray-50 px-3 py-3">
                                {primary && (
                                  <div
                                    className="flex items-center gap-1.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="tabular-nums text-gray-700">
                                      {primary.e164.replace("+91", "")}
                                    </span>
                                    <a
                                      href={`tel:${primary.e164}`}
                                      aria-label="Call"
                                      className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                    >
                                      <Phone className="size-3.5" />
                                    </a>
                                    {!primary.isLandline && (
                                      <a
                                        href={`https://wa.me/${primary.e164.replace("+", "")}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label="WhatsApp"
                                        className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                                      >
                                        <MessageCircle className="size-3.5" />
                                      </a>
                                    )}
                                    {lead.phones.length > 1 && (
                                      <span className="text-xs text-gray-400">
                                        +{lead.phones.length - 1}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="border-b border-gray-50 px-3 py-3 text-gray-600">
                                {lead.region ?? "—"}
                              </td>
                              <td className="border-b border-gray-50 px-3 py-3 text-gray-600">
                                {commodityLabel(lead.commodityCode)}
                              </td>
                              <td className="border-b border-gray-50 px-3 py-3 text-gray-600">
                                {lead.role
                                  ? lead.role.charAt(0) + lead.role.slice(1).toLowerCase()
                                  : "—"}
                              </td>
                              <td className="border-b border-gray-50 px-3 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_META[lead.status].className}`}
                                >
                                  {STATUS_META[lead.status].label}
                                </span>
                              </td>
                              <td className="border-b border-gray-50 px-3 py-3">
                                <span
                                  className={`text-sm tabular-nums ${
                                    bucket === "overdue"
                                      ? "font-medium text-red-600"
                                      : bucket === "today"
                                        ? "font-medium text-amber-600"
                                        : "text-gray-500"
                                  }`}
                                >
                                  {formatWhen(lead.nextFollowUpAt)}
                                </span>
                              </td>
                              <td className="border-b border-gray-50 px-3 py-3 text-gray-600">
                                {lead.assignedToName ?? (
                                  <span className="text-gray-400">Unassigned</span>
                                )}
                              </td>
                              <td
                                className="border-b border-gray-50 px-3 py-3 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openCallSheet(lead)}
                                    className="flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-white"
                                    style={{ backgroundColor: ACCENT }}
                                  >
                                    <PhoneCall className="size-3.5" /> Log call
                                  </button>
                                  <ChevronDown
                                    className={`size-4 text-gray-300 transition-transform ${expanded ? "rotate-180" : ""}`}
                                  />
                                </div>
                              </td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td
                                  colSpan={9}
                                  className="border-b border-gray-100 bg-gray-50/50 px-6 py-4"
                                >
                                  {renderDetail(lead)}
                                </td>
                              </tr>
                            )}
                          </FragmentRow>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {focusLead && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="text-sm tabular-nums text-gray-500">
              {(focusIndex ?? 0) + 1} of {focusQueue.length}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setFocusIndex(null)}
              className="flex size-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 pt-6">
            <h2 className="text-xl font-semibold">{focusLead.displayName}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {[
                focusLead.region,
                commodityLabel(focusLead.commodityCode),
                focusLead.role
                  ? focusLead.role.charAt(0) + focusLead.role.slice(1).toLowerCase()
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {focusLead.attemptCount > 0 && (
              <p className="mt-1 text-xs text-gray-400">
                {focusLead.attemptCount}{" "}
                {focusLead.attemptCount === 1 ? "previous attempt" : "previous attempts"}
              </p>
            )}
            {focusLead.review && (
              <p className="mt-3 rounded-2xl bg-gray-50 p-3 text-sm text-gray-600">
                {focusLead.review}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              {focusLead.phones[0] && (
                <a
                  href={`tel:${focusLead.phones[0].e164}`}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Phone className="size-5" />
                  {focusLead.phones[0].e164.replace("+91", "")}
                </a>
              )}
              {focusLead.phones[0] && !focusLead.phones[0].isLandline && (
                <a
                  href={`https://wa.me/${focusLead.phones[0].e164.replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  className="flex size-14 items-center justify-center rounded-2xl border border-gray-200 text-emerald-600"
                >
                  <MessageCircle className="size-5" />
                </a>
              )}
            </div>
            {focusLead.phones.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {focusLead.phones.slice(1).map((phone) => (
                  <a
                    key={phone.e164}
                    href={`tel:${phone.e164}`}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs tabular-nums text-gray-600"
                  >
                    {phone.e164.replace("+91", "")}
                    {phone.isLandline ? " · landline" : ""}
                  </a>
                ))}
              </div>
            )}

            <p className="mb-2 mt-6 text-xs font-medium text-gray-400">
              How did it go?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setCallDisposition(status)}
                  className={`h-12 rounded-full border text-sm font-medium ${
                    callDisposition === status
                      ? "border-transparent text-white"
                      : "border-gray-200 text-gray-700"
                  }`}
                  style={
                    callDisposition === status
                      ? { backgroundColor: ACCENT }
                      : undefined
                  }
                >
                  {STATUS_META[status].label}
                </button>
              ))}
            </div>
            {callDisposition === "FOLLOW_UP" && renderFollowUpPicker()}
            <textarea
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              placeholder="Note (optional)"
              rows={2}
              className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30"
            />
          </div>

          <div
            className="border-t border-gray-100 px-5 pt-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              disabled={!callDisposition || saving}
              onClick={submitFocusCall}
              className="h-12 w-full rounded-full text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
            >
              {saving
                ? "Saving…"
                : (focusIndex ?? 0) + 1 < focusQueue.length
                  ? "Save and next"
                  : "Save and finish"}
            </button>
            <button
              type="button"
              onClick={() => setFocusIndex((i) => (i === null ? null : i + 1))}
              className="mt-1 h-10 w-full rounded-full text-sm text-gray-500"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {focusIndex !== null && !focusLead && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
          <p className="text-lg font-semibold">Queue finished</p>
          <p className="text-sm text-gray-500">
            {plan ? `${plan.covered} of ${plan.target} covered today` : ""}
          </p>
          <button
            type="button"
            onClick={() => {
              setFocusIndex(null);
              loadPlan(viewer?.isManager ? planFor : undefined);
            }}
            className="h-11 rounded-full px-6 text-sm font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            Done
          </button>
        </div>
      )}

      {callLead && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/20 sm:items-center sm:p-4"
          onClick={() => !saving && setCallLead(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
            style={{
              paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold">{callLead.displayName}</h2>
                <p className="text-sm tabular-nums text-gray-500">
                  {callLead.phones[0]?.e164}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setCallLead(null)}
                className="flex size-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setCallDisposition(status)}
                  className={`h-11 rounded-full border text-sm font-medium transition-colors ${
                    callDisposition === status
                      ? "border-transparent text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                  style={
                    callDisposition === status
                      ? { backgroundColor: ACCENT }
                      : undefined
                  }
                >
                  {STATUS_META[status].label}
                </button>
              ))}
            </div>
            {callDisposition === "FOLLOW_UP" && renderFollowUpPicker()}
            <textarea
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              placeholder="Note (optional)"
              rows={2}
              className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30"
            />
            <button
              type="button"
              disabled={!callDisposition || saving}
              onClick={submitCall}
              className="mt-4 h-12 w-full rounded-full text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ProgressRing({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#f1f1f4" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={ACCENT}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        fontSize="15"
        fontWeight="600"
        fill="#111"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}
