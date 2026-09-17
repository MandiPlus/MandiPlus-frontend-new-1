"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flame, PhoneCall, PhoneForwarded, Trophy, Users } from "lucide-react";
import { toast } from "react-toastify";
import { getOverview, type OverviewData } from "../api";
import LeadListDrawer from "./LeadListDrawer";

const ACCENT = "#4309ac";
const TEAL = "#0f766e";
const LEAK = "#c2410c";
const GRID = "#f1f5f9";

const TOOLTIP = {
  contentStyle: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    fontSize: 12,
  },
  labelStyle: { color: "#0f172a", fontWeight: 600 },
  itemStyle: { color: "#0f172a" },
};

const RANGES: { label: string; days: number | null }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
];

function iso(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Card({
  title,
  subtitle,
  className = "",
  children,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  note,
  onOpen,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  note?: string;
  onOpen?: () => void;
}) {
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      type={onOpen ? "button" : undefined}
      onClick={onOpen}
      className={`rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm ${
        onOpen
          ? "cursor-pointer transition-colors hover:border-[#4309ac]/40 hover:bg-slate-50/60"
          : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
        {value}
      </div>
      {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
      {onOpen && (
        <p className="mt-1 text-xs font-medium text-[#4309ac]">See the leads →</p>
      )}
    </Tag>
  );
}

/**
 * Everything cumulative. Deliberately separate from Today: a lifetime count
 * beside a count since this morning invites a comparison that means nothing.
 */
export default function OverviewBoard({
  commodityLabels = {},
}: {
  /** code -> display label, from the bootstrap list. Codes minted by Add data
   *  are not in it, so the select falls back to the code itself. */
  commodityLabels?: Record<string, string>;
}) {
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const [userId, setUserId] = useState("");
  const [commodityCode, setCommodityCode] = useState("");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<{
    metric: string;
    title: string;
    batchId?: string;
  } | null>(null);

  const window_ = (() => {
    const to = new Date();
    const from = rangeDays
      ? new Date(Date.now() - (rangeDays - 1) * 86400000)
      : null;
    return { from: from ? iso(from) : undefined, to: iso(to) };
  })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const to = new Date();
      const from = rangeDays
        ? new Date(Date.now() - (rangeDays - 1) * 86400000)
        : null;
      setData(
        await getOverview({
          from: from ? iso(from) : undefined,
          to: iso(to),
          userId: userId || undefined,
          commodityCode: commodityCode || undefined,
        }),
      );
    } catch {
      toast.error("Could not load the overview");
    } finally {
      setLoading(false);
    }
  }, [rangeDays, userId, commodityCode]);

  useEffect(() => {
    load();
  }, [load]);

  const selectClass =
    "h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30";

  const commodityName = (code: string) =>
    commodityLabels[code] ?? code.toLowerCase().replace(/_/g, " ");

  // Narrowing to one caller can drop the selected commodity out of the list.
  // Keeping it as an option means the filter still reads as applied instead of
  // silently showing an empty select over filtered numbers.
  const commodityOptions = (() => {
    const list = data?.commodities ?? [];
    return commodityCode && !list.some((c) => c.code === commodityCode)
      ? [...list, { code: commodityCode, leads: 0 }]
      : list;
  })();

  const funnelData = (data?.funnel.stages ?? []).map((stage, i, arr) => {
    const prev = i > 0 ? arr[i - 1].count : null;
    const raw = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
    return {
      stage: stage.label,
      key: stage.key,
      count: stage.count,
      rate: raw !== null && raw <= 100 ? raw : null,
      leaking: data?.funnel.worstDrop === stage.key,
    };
  });

  const trendData = (data?.trend ?? []).map((d) => ({
    ...d,
    label: new Date(`${d.day}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
  }));

  const verified = (data?.quality.levels ?? [])
    .filter((l) => l.level >= 2)
    .reduce((a, l) => a + l.count, 0);
  const totalLeads = (data?.quality.levels ?? []).reduce(
    (a, l) => a + l.count,
    0,
  );
  const wrongNumbers = (data?.quality.sources ?? []).reduce(
    (a, s) => a + s.wrongNumbers,
    0,
  );

  return (
    <section className="py-5">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-slate-200 bg-white p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className={`h-8 rounded-full px-3 text-sm font-medium transition-colors ${
                rangeDays === r.days
                  ? "text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              style={
                rangeDays === r.days ? { backgroundColor: ACCENT } : undefined
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Team member"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className={`${selectClass} ${userId ? "border-[#4309ac]/40 text-[#4309ac]" : ""}`}
        >
          <option value="">Whole team</option>
          {(data?.callers ?? []).map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Commodity"
          value={commodityCode}
          onChange={(e) => setCommodityCode(e.target.value)}
          className={`${selectClass} ${commodityCode ? "border-[#4309ac]/40 text-[#4309ac]" : ""}`}
        >
          <option value="">All commodities</option>
          {commodityOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {commodityName(c.code)}
              {c.leads ? ` (${c.leads})` : ""}
            </option>
          ))}
        </select>
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`h-28 animate-pulse rounded-2xl bg-slate-100 ${i < 4 ? "lg:col-span-3" : "lg:col-span-6"}`}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 lg:col-span-12">
            <Stat
              label="Leads"
              value={data.totals.leads_added}
              icon={Users}
              onOpen={() => setDrill({ metric: "leads", title: "Leads added" })}
            />
            <Stat
              label="Calls"
              value={data.totals.calls}
              icon={PhoneCall}
              onOpen={() => setDrill({ metric: "calls", title: "Leads called" })}
            />
            <Stat
              label="Connected"
              value={data.totals.connects}
              icon={PhoneForwarded}
              note={`${data.totals.connectRate}% answered`}
              onOpen={() =>
                setDrill({ metric: "connects", title: "Leads we reached" })
              }
            />
            <Stat
              label="Hot leads"
              value={data.totals.hot}
              icon={Flame}
              onOpen={() =>
                setDrill({ metric: "hot", title: "Interested and confirmed" })
              }
            />
            <Stat
              label="Converted"
              value={data.totals.converted}
              icon={Trophy}
              onOpen={() =>
                setDrill({ metric: "converted", title: "Now customers" })
              }
            />
          </div>

          <Card
            title="Calling activity"
            subtitle="Calls and answered calls per day"
            className="lg:col-span-7"
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="oCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="oConnects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAL} stopOpacity={0.24} />
                      <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={38}
                  />
                  <Tooltip {...TOOLTIP} />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    name="Calls"
                    stroke={ACCENT}
                    strokeWidth={2}
                    fill="url(#oCalls)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="connects"
                    name="Connected"
                    stroke={TEAL}
                    strokeWidth={2}
                    fill="url(#oConnects)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: ACCENT }}
                />
                Calls
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: TEAL }}
                />
                Connected
              </span>
            </div>
          </Card>

          <Card
            title="Calling funnel"
            subtitle={
              data.funnel.worstDrop
                ? `Weakest step: ${funnelData.find((f) => f.leaking)?.stage}`
                : "Each stage is a share of the one above"
            }
            className="lg:col-span-5"
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelData}
                  layout="vertical"
                  margin={{ top: 0, right: 46, left: 6, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    width={78}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip {...TOOLTIP} cursor={{ fill: "#f8fafc" }} />
                  <Bar
                    dataKey="count"
                    name="Leads"
                    radius={[0, 6, 6, 0]}
                    barSize={18}
                    minPointSize={4}
                    isAnimationActive={false}
                  >
                    {funnelData.map((row, i) => (
                      <Cell
                        key={row.key}
                        fill={row.leaking ? LEAK : ACCENT}
                        fillOpacity={row.leaking ? 0.9 : 1 - i * 0.13}
                      />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      offset={8}
                      style={{ fontSize: 11, fontWeight: 600, fill: "#334155" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {funnelData
                .filter((r) => r.rate !== null)
                .map((r) => (
                  <span key={r.key}>
                    {r.stage}{" "}
                    <span
                      className={`font-semibold tabular-nums ${r.leaking ? "text-orange-700" : "text-slate-700"}`}
                    >
                      {r.rate}%
                    </span>
                  </span>
                ))}
            </div>
          </Card>

          <Card
            title="Where leads come from"
            subtitle="Each import, and what it turned into"
            className="lg:col-span-5"
          >
            {(data.batches ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                No imports in this window
              </p>
            ) : (
              <div className="divide-y divide-slate-50">
                {(data.batches ?? []).map((b) => {
                  const workedPct =
                    b.leads > 0 ? Math.round((b.called / b.leads) * 100) : 0;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setDrill({
                          metric: "leads",
                          title: b.label,
                          batchId: b.id,
                        })
                      }
                      className="w-full py-2.5 text-left transition-colors hover:bg-slate-50/60"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {b.label}
                        </p>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                          {b.leads}
                        </p>
                      </div>
                      {/* How far through the batch the team has got. */}
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: ACCENT,
                            width: `${workedPct}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                        <span>{workedPct}% called</span>
                        {b.warm > 0 && (
                          <span className="font-medium text-emerald-700">
                            {b.warm} warm
                          </span>
                        )}
                        {b.wrongNumbers > 0 && (
                          <span className="text-orange-700">
                            {b.wrongNumbers} wrong numbers
                          </span>
                        )}
                        <span className="capitalize text-slate-400">
                          {b.source.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {(data.opportunities ?? []).length > 0 && (
            <Card
              title="High-value buyers in play"
              subtitle="Biggest vehicles a day, still open"
              className="lg:col-span-4"
            >
              <div className="divide-y divide-slate-50">
                {(data.opportunities ?? []).slice(0, 6).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {o.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {[
                          o.dailyVehicles ? `${o.dailyVehicles} vehicles/day` : null,
                          o.buyingVolume,
                          o.mandi,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-400">
                      {o.assignee ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-1">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Data runway
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                {data.runway.days !== null
                  ? `${data.runway.days} ${data.runway.days === 1 ? "day" : "days"}`
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.runway.freshRemaining} fresh leads left
              </p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Data quality
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                {totalLeads > 0 ? Math.round((verified / totalLeads) * 100) : 0}%
                <span className="ml-1 text-sm font-medium text-slate-400">
                  verified
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {wrongNumbers} wrong numbers found
              </p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Campaign
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                {data.campaign.sent}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                intro sent · {data.campaign.hotAudience} turned hot ·{" "}
                {data.campaign.audienceReady} ready
              </p>
            </Card>
          </div>
        </div>
      )}

      {drill && (
        <LeadListDrawer
          title={drill.title}
          metric={drill.metric}
          batchId={drill.batchId}
          from={window_.from}
          to={window_.to}
          userId={userId || undefined}
          commodityCode={commodityCode || undefined}
          onClose={() => setDrill(null)}
        />
      )}
    </section>
  );
}
