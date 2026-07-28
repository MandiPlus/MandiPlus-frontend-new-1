import { MarketLaneScorecard } from '../types';
import { formatEnumLabel, formatMoney, formatNumber, severityClass } from '../formatters';

function laneClass(type: MarketLaneScorecard['laneType']) {
  if (type === 'HOT_LANE') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (type === 'WATCH_LANE') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatFreshness(hours: number | null) {
  if (hours === null) return 'Unknown';
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function LaneCommandBoard({ lanes }: { lanes: MarketLaneScorecard[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Lane Command Board</h2>
          <p className="text-sm text-slate-500">
            Ranked gadi lanes with dispatch decisions, transporter questions, and commercial use.
          </p>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {formatNumber(lanes.length)} lanes
        </div>
      </div>

      {lanes.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No lane scorecards for this period.
        </div>
      ) : (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {lanes.slice(0, 6).map((lane) => (
            <article key={lane.id} className="border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{lane.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {lane.commodity || 'Mixed commodity'}
                    {(lane.sourceState || lane.destinationState) && (
                      <> · {lane.sourceState || 'Unknown'} to {lane.destinationState || 'Unknown'}</>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 text-xs font-semibold">
                  <span className={`border px-2 py-1 uppercase ${laneClass(lane.laneType)}`}>
                    {formatEnumLabel(lane.laneType)}
                  </span>
                  <span className={`border px-2 py-1 uppercase ${severityClass(lane.priority)}`}>
                    {lane.priority} · {lane.score}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                <Metric label="Gadi" value={formatNumber(lane.vehicleCount)} />
                <Metric label="Active" value={formatNumber(lane.activeTrips)} />
                <Metric label="Trips" value={formatNumber(lane.tripCount)} />
                <Metric label="Fresh" value={formatFreshness(lane.freshnessHours)} />
                <Metric label="GMV" value={formatMoney(lane.linkedGmv)} />
              </div>

              <div className="mt-3 border border-emerald-100 bg-white p-3 text-sm leading-6 text-slate-800">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Dispatch decision
                </div>
                <div className="mt-1">{lane.dispatchDecision}</div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Transporter script
                  </div>
                  <ol className="mt-2 space-y-2">
                    {lane.transporterScript.slice(0, 4).map((question, index) => (
                      <li key={`${lane.id}-question-${index}`} className="flex gap-2 text-sm leading-5 text-slate-700">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-slate-900 text-[11px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <span>{question}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Commercial use
                  </div>
                  <div className="mt-2 border border-slate-100 bg-white px-3 py-2 text-sm leading-5 text-slate-700">
                    {lane.commercialUse}
                  </div>
                  {lane.riskFlags.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {lane.riskFlags.slice(0, 3).map((risk) => (
                        <div key={`${lane.id}-${risk}`} className="border border-amber-100 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-900">
                          {risk}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(lane.activeVehicles.length > 0 || lane.sampleVehicles.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {(lane.activeVehicles.length > 0 ? lane.activeVehicles : lane.sampleVehicles)
                    .slice(0, 8)
                    .map((vehicle) => (
                      <span
                        key={`${lane.id}-${vehicle}`}
                        className={`border px-2 py-1 text-[11px] font-semibold ${
                          lane.activeVehicles.includes(vehicle)
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {vehicle}
                      </span>
                    ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
