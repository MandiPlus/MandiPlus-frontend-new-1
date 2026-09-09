"use client";

import type { CommandCenterData, TeamMemberDay } from "../api";

const ACCENT = "#4309ac";

const SEVERITY_DOT: Record<string, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  fire: "bg-emerald-500",
};

/**
 * The manager's single screen. Exceptions lead and everything else is context:
 * the reward loop is watching the attention panel empty itself, so it is
 * capped at five and goes green the moment nothing needs a human.
 */
export default function CommandCenter({
  data,
  onPickMember,
}: {
  data: CommandCenterData;
  onPickMember: (userId: string) => void;
}) {
  const { kpis, attention, funnel, team, quality, campaign, opportunities, runway } =
    data;

  const delta = (today: number, yesterday: number) => {
    const diff = today - yesterday;
    if (diff === 0) return null;
    return (
      <span
        className={`ml-1 text-xs font-medium ${diff > 0 ? "text-emerald-600" : "text-red-500"}`}
      >
        {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
      </span>
    );
  };

  const maxStage = Math.max(...funnel.stages.map((s) => s.count), 1);
  const connectRate =
    kpis.callsToday > 0
      ? Math.round((kpis.connectsToday / kpis.callsToday) * 100)
      : 0;
  const verified = quality.levels
    .filter((l) => l.level >= 2)
    .reduce((acc, l) => acc + l.count, 0);
  const totalLeads = quality.levels.reduce((acc, l) => acc + l.count, 0);
  const wrongNumbers = quality.sources.reduce(
    (acc, s) => acc + s.wrongNumbers,
    0,
  );

  const shown = attention.slice(0, 5);
  const overflow = attention.length - shown.length;

  return (
    <div className="space-y-5">
      {/* 1 — what needs a human, or the good news that nothing does */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <p className="text-sm font-medium text-emerald-700">
            All clear — nothing needs you right now
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100">
          <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Needs attention
          </p>
          <div className="divide-y divide-gray-50">
            {shown.map((alert) => (
              <div key={alert.key} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`size-2 shrink-0 rounded-full ${SEVERITY_DOT[alert.severity]}`}
                />
                <p className="text-sm">
                  <span className="font-semibold tabular-nums">{alert.count}</span>{" "}
                  {alert.label}
                  {alert.detail && (
                    <span className="text-gray-400"> — {alert.detail}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
          {overflow > 0 && (
            <p className="border-t border-gray-50 px-4 py-2 text-xs text-gray-400">
              +{overflow} more
            </p>
          )}
        </div>
      )}

      {/* 2 — today, in four numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Calls today",
            value: kpis.callsToday,
            extra: delta(kpis.callsToday, kpis.callsYesterday),
          },
          {
            label: `Connected · ${connectRate}%`,
            value: kpis.connectsToday,
            extra: delta(kpis.connectsToday, kpis.connectsYesterday),
          },
          { label: "Hot leads", value: kpis.hot, extra: null },
          { label: "Converted", value: kpis.converted, extra: null },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">
              {card.value}
              {card.extra}
            </p>
            <p className="text-xs text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* 3 — the funnel, with the leak named */}
      <div className="rounded-2xl border border-gray-100 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Calling funnel
        </p>
        <div className="space-y-2">
          {funnel.stages.map((stage, i) => {
            const prev = i > 0 ? funnel.stages[i - 1].count : null;
            const rawRate =
              prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
            // Stages are nested, so a rate over 100 would mean the query is
            // wrong; show nothing rather than an impossible number.
            const rate = rawRate !== null && rawRate <= 100 ? rawRate : null;
            const leaking = funnel.worstDrop === stage.key;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <p
                  className={`w-24 shrink-0 text-xs ${leaking ? "font-semibold text-red-600" : "text-gray-500"}`}
                >
                  {stage.label}
                </p>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-50">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: leaking ? "#dc2626" : ACCENT,
                      opacity: leaking ? 0.85 : 1 - i * 0.1,
                      width: `${Math.max(2, (stage.count / maxStage) * 100)}%`,
                    }}
                  />
                </div>
                <p className="w-20 shrink-0 text-right text-xs tabular-nums text-gray-600">
                  {stage.count}
                  {rate !== null && (
                    <span className={leaking ? "text-red-500" : "text-gray-400"}>
                      {" "}
                      · {rate}%
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {funnel.inFollowUp} leads currently sitting in follow-up
        </p>
        {funnel.worstDrop && (
          <p className="mt-2 text-xs text-red-600">
            Leads die at{" "}
            {funnel.stages.find((s) => s.key === funnel.worstDrop)?.label} — worth a
            listen to those calls
          </p>
        )}
      </div>

      {/* 4 — the team, one card each */}
      <div className="space-y-3">
        {team.map((member: TeamMemberDay) => (
          <button
            key={member.userId}
            type="button"
            onClick={() => onPickMember(member.userId)}
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
                <span className="text-amber-600">{member.dueToday} due today</span>
              )}
              {member.hot > 0 && <span>{member.hot} interested</span>}
              <span>{member.fresh} new</span>
              <span>{member.callsToday} calls today</span>
            </p>
          </button>
        ))}
      </div>

      {/* 5 — high-value buyers worth a manager's own eyes */}
      {opportunities.length > 0 && (
        <div className="rounded-2xl border border-gray-100 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            High-value buyers in play
          </p>
          <div className="divide-y divide-gray-50">
            {opportunities.map((opp) => (
              <div key={opp.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{opp.name}</p>
                  <p className="truncate text-xs text-gray-400">
                    {[
                      opp.dailyVehicles ? `${opp.dailyVehicles} vehicles/day` : null,
                      opp.buyingVolume,
                      opp.mandi,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-gray-500">{opp.assignee ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 — supply and quality, side by side */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Data runway
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {runway.days !== null
              ? `${runway.days} ${runway.days === 1 ? "day" : "days"}`
              : "—"}
          </p>
          <p className="text-xs text-gray-500">
            {runway.freshRemaining} fresh leads ÷ ~{runway.dailyCapacity}/day —
            import more before it hits zero
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Data quality
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {totalLeads > 0 ? Math.round((verified / totalLeads) * 100) : 0}%
            <span className="text-sm font-normal text-gray-400"> verified</span>
          </p>
          <p className="text-xs text-gray-500">
            {wrongNumbers} wrong numbers ·{" "}
            {quality.sources
              .map(
                (s) =>
                  `${s.source.toLowerCase().replace(/_/g, " ")}: ${s.warm}/${s.leads} warm`,
              )
              .join(" · ")}
          </p>
        </div>
      </div>

      {/* 7 — campaign centre */}
      <div className="rounded-2xl border border-gray-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Campaign centre
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Audience ready", value: campaign.audienceReady },
            { label: "Intro sent", value: campaign.sent },
            { label: "Hot audience", value: campaign.hotAudience },
          ].map((cell) => (
            <div key={cell.label}>
              <p className="text-xl font-semibold tabular-nums">{cell.value}</p>
              <p className="text-[11px] text-gray-400">{cell.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
