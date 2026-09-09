"use client";

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
import {
  AlertTriangle,
  Flame,
  PhoneCall,
  PhoneForwarded,
  Trophy,
} from "lucide-react";
import type { CommandCenterData, TeamMemberDay } from "../api";

const ACCENT = "#4309ac";
const TEAL = "#0f766e";
const RED = "#c2410c";
const GRID = "#f1f5f9";

/** The tooltip the rest of the admin dashboard uses. */
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

const SEVERITY_DOT: Record<string, string> = {
  red: "bg-rose-500",
  amber: "bg-amber-500",
  fire: "bg-emerald-500",
};

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
  tone = "slate",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  note?: React.ReactNode;
  tone?: "slate" | "rose" | "emerald";
}) {
  const valueTone =
    tone === "rose"
      ? "text-rose-600"
      : tone === "emerald"
        ? "text-emerald-600"
        : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className={`text-3xl font-semibold tracking-tight tabular-nums ${valueTone}`}>
        {value}
      </div>
      {note && <div className="mt-2 text-xs font-semibold">{note}</div>}
    </div>
  );
}

export default function CommandCenter({
  data,
  onPickMember,
}: {
  data: CommandCenterData;
  onPickMember: (userId: string) => void;
}) {
  const {
    kpis,
    attention,
    funnel,
    team,
    quality,
    campaign,
    opportunities,
    runway,
    trend,
  } = data;

  const delta = (today: number, yesterday: number) => {
    const diff = today - yesterday;
    if (diff === 0)
      return <span className="text-slate-400">same as yesterday</span>;
    const up = diff > 0;
    return (
      <span className={up ? "text-emerald-600" : "text-rose-600"}>
        {up ? "▲" : "▼"} {Math.abs(diff)} vs yesterday
      </span>
    );
  };

  const connectRate =
    kpis.callsToday > 0
      ? Math.round((kpis.connectsToday / kpis.callsToday) * 100)
      : 0;
  const verified = quality.levels
    .filter((l) => l.level >= 2)
    .reduce((acc, l) => acc + l.count, 0);
  const totalLeads = quality.levels.reduce((acc, l) => acc + l.count, 0);
  const wrongNumbers = quality.sources.reduce((a, s) => a + s.wrongNumbers, 0);

  const shown = attention.slice(0, 5);
  const overflow = attention.length - shown.length;

  // Stages are nested, so each bar is a share of the one above it.
  const funnelData = funnel.stages.map((stage, i) => {
    const prev = i > 0 ? funnel.stages[i - 1].count : null;
    const raw = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
    return {
      stage: stage.label,
      key: stage.key,
      count: stage.count,
      rate: raw !== null && raw <= 100 ? raw : null,
      leaking: funnel.worstDrop === stage.key,
    };
  });

  const trendData = trend.map((d) => ({
    ...d,
    label: new Date(`${d.day}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Today, in four numbers */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-12">
        <Stat
          label="Calls today"
          value={kpis.callsToday}
          icon={PhoneCall}
          note={delta(kpis.callsToday, kpis.callsYesterday)}
        />
        <Stat
          label="Connected"
          value={kpis.connectsToday}
          icon={PhoneForwarded}
          note={
            <span className="text-slate-500">
              {connectRate}% of calls answered
            </span>
          }
        />
        <Stat
          label="Hot leads"
          value={kpis.hot}
          icon={Flame}
          note={<span className="text-slate-500">interested or confirmed</span>}
        />
        <Stat
          label="Converted"
          value={kpis.converted}
          icon={Trophy}
          tone={kpis.converted > 0 ? "emerald" : "slate"}
          note={<span className="text-slate-500">on MandiPlus</span>}
        />
      </div>

      {/* Needs attention — the reason a manager opens this screen */}
      <div className="lg:col-span-5">
        {shown.length === 0 ? (
          <div className="flex h-full items-center rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">
              All clear — nothing needs you right now
            </p>
          </div>
        ) : (
          <div className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Needs attention
              </h3>
            </div>
            <ul className="divide-y divide-slate-50">
              {shown.map((alert) => (
                <li key={alert.key} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={`size-2 shrink-0 rounded-full ${SEVERITY_DOT[alert.severity]}`}
                  />
                  <p className="text-sm text-slate-700">
                    <span className="font-bold tabular-nums text-slate-900">
                      {alert.count}
                    </span>{" "}
                    {alert.label}
                    {alert.detail && (
                      <span className="text-slate-400"> — {alert.detail}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            {overflow > 0 && (
              <p className="border-t border-slate-50 px-4 py-2 text-xs text-slate-400">
                +{overflow} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Two weeks of calling */}
      <Card
        title="Calling activity"
        subtitle="Last 14 days"
        className="lg:col-span-7"
      >
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gConnects" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
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
                fill="url(#gCalls)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="connects"
                name="Connected"
                stroke={TEAL}
                strokeWidth={2}
                fill="url(#gConnects)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: ACCENT }} />
            Calls
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: TEAL }} />
            Connected
          </span>
        </div>
      </Card>

      {/* Where leads die */}
      <Card
        title="Calling funnel"
        subtitle={
          funnel.worstDrop
            ? `Weakest step: ${funnelData.find((f) => f.leaking)?.stage}`
            : "Every stage is a share of the one above it"
        }
        className="lg:col-span-7"
      >
        <div className="h-52">
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
                    fill={row.leaking ? RED : ACCENT}
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
            .filter((row) => row.rate !== null)
            .map((row) => (
              <span key={row.key}>
                {row.stage}{" "}
                <span
                  className={`font-semibold tabular-nums ${row.leaking ? "text-orange-700" : "text-slate-700"}`}
                >
                  {row.rate}%
                </span>
              </span>
            ))}
        </div>
        {funnel.worstDrop && (
          <p className="mt-2 text-xs font-medium text-orange-700">
            Leads die at {funnelData.find((f) => f.leaking)?.stage} — worth a
            listen to those calls
          </p>
        )}
      </Card>

      {/* The team, as a table: these rows exist to be compared */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-5 lg:row-span-2">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Team today</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Tap a caller to open their day
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Caller</th>
                <th className="whitespace-nowrap px-1.5 py-2 font-semibold">Done</th>
                <th className="px-1.5 py-2 text-right font-semibold">Overdue</th>
                <th className="px-1.5 py-2 text-right font-semibold">Due</th>
                <th className="px-1.5 py-2 text-right font-semibold">Hot</th>
                <th className="px-3 py-2 text-right font-semibold">Calls</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member: TeamMemberDay) => {
                const pct =
                  member.target > 0
                    ? Math.min(100, (member.covered / member.target) * 100)
                    : 0;
                return (
                  <tr
                    key={member.userId}
                    onClick={() => onPickMember(member.userId)}
                    className="cursor-pointer border-t border-slate-50 hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900">
                      {member.name}
                    </td>
                    <td className="px-1.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{ backgroundColor: ACCENT, width: `${pct}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-slate-500">
                          {member.covered}/{member.target}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`px-1.5 py-2.5 text-right tabular-nums ${member.overdue > 0 ? "font-semibold text-rose-600" : "text-slate-300"}`}
                    >
                      {member.overdue || "—"}
                    </td>
                    <td
                      className={`px-1.5 py-2.5 text-right tabular-nums ${member.dueToday > 0 ? "text-amber-600" : "text-slate-300"}`}
                    >
                      {member.dueToday || "—"}
                    </td>
                    <td className="px-1.5 py-2.5 text-right tabular-nums text-slate-600">
                      {member.hot || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {member.callsToday}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* High-value buyers */}
      {opportunities.length > 0 && (
        <Card
          title="High-value buyers in play"
          subtitle="Biggest vehicles a day, still open"
          className="lg:col-span-4"
        >
          <div className="divide-y divide-slate-50">
            {opportunities.slice(0, 5).map((opp) => (
              <div key={opp.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {opp.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[
                      opp.dailyVehicles ? `${opp.dailyVehicles} vehicles/day` : null,
                      opp.buyingVolume,
                      opp.mandi,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-slate-400">
                  {opp.assignee ?? "—"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Supply, quality, campaign */}
      {/* Static class names: Tailwind cannot extract an interpolated one. */}
      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1 ${
          opportunities.length > 0 ? "lg:col-span-3" : "lg:col-span-7"
        }`}
      >
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Data runway
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
            {runway.days !== null
              ? `${runway.days} ${runway.days === 1 ? "day" : "days"}`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {runway.freshRemaining} fresh leads left
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Data quality
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
            {totalLeads > 0 ? Math.round((verified / totalLeads) * 100) : 0}%
            <span className="ml-1 text-sm font-medium text-slate-400">verified</span>
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
            {campaign.sent}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            intro sent · {campaign.hotAudience} turned hot ·{" "}
            {campaign.audienceReady} ready
          </p>
        </Card>
      </div>
    </div>
  );
}
