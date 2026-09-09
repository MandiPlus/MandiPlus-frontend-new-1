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
import { AlertTriangle, Flame, PhoneCall, PhoneForwarded, Target } from "lucide-react";
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
  const { kpis, attention, team, teamTotals } = data;
  const overdue =
    attention.find((a) => a.key === "overdueFollowups")?.count ?? 0;

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
  const shown = attention.slice(0, 5);
  const overflow = attention.length - shown.length;

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
          label="Covered"
          value={`${teamTotals.covered}/${teamTotals.target}`}
          icon={Target}
          note={
            <span className="text-slate-500">
              {Math.max(0, teamTotals.target - teamTotals.covered)} left today
            </span>
          }
        />
        <Stat
          label="Overdue"
          value={overdue}
          icon={Flame}
          tone={overdue > 0 ? "rose" : "slate"}
          note={
            <span className="text-slate-500">
              {overdue > 0 ? "promises already missed" : "nothing missed"}
            </span>
          }
        />
      </div>

      {/* Needs attention — the reason a manager opens this screen */}
      <div className="lg:col-span-6">
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

      {/* The team, as a table: these rows exist to be compared */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-6">
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

    </div>
  );
}
