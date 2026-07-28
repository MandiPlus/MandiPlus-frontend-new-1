import { useMemo, useState } from 'react';
import { RouteActivity } from '../types';
import { formatMoney, formatNumber } from '../formatters';
import { downloadCsv } from '../exporters';

type OriginMode = 'all' | 'live' | 'high_gadi' | 'multi_destination' | 'high_value';

interface OriginRow {
  source: string;
  sourceState: string | null;
  destinations: string[];
  topDestination: string;
  topCommodity: string | null;
  vehicleCount: number;
  activeTrips: number;
  tripCount: number;
  gmv: number;
  invoiceCount: number;
  activeVehicles: string[];
  urgencyScore: number;
}

export function OriginCommandBoard({ routes }: { routes: RouteActivity[] }) {
  const [mode, setMode] = useState<OriginMode>('all');
  const [query, setQuery] = useState('');
  const origins = useMemo(() => buildOrigins(routes), [routes]);
  const filtered = useMemo(
    () =>
      origins
        .filter((row) => {
          const normalizedQuery = query.trim().toLowerCase();
          if (
            normalizedQuery &&
            !row.source.toLowerCase().includes(normalizedQuery) &&
            !(row.sourceState || '').toLowerCase().includes(normalizedQuery)
          ) {
            return false;
          }
          if (mode === 'live') return row.activeTrips > 0;
          if (mode === 'high_gadi') return row.vehicleCount >= 10;
          if (mode === 'multi_destination') return row.destinations.length >= 3;
          if (mode === 'high_value') return row.gmv >= 1000000;
          return true;
        })
        .sort((a, b) => originScore(b) - originScore(a)),
    [mode, origins, query],
  );
  const totals = useMemo(
    () => ({
      origins: filtered.length,
      destinations: new Set(filtered.flatMap((row) => row.destinations)).size,
      gadi: filtered.reduce((sum, row) => sum + row.vehicleCount, 0),
      active: filtered.reduce((sum, row) => sum + row.activeTrips, 0),
    }),
    [filtered],
  );

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Origin Mandi Board</h2>
            <p className="text-sm text-slate-500">
              Which mandi/source places are sending gadi, to where, and with which commodity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportOrigins(filtered)}
            disabled={filtered.length === 0}
            className="w-fit border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
          >
            Export origins
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Origins" value={formatNumber(totals.origins)} />
          <Metric label="Destinations" value={formatNumber(totals.destinations)} />
          <Metric label="Gadi" value={formatNumber(totals.gadi)} />
          <Metric label="Active" value={formatNumber(totals.active)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search source/state"
            className="min-w-[170px] border border-slate-300 px-2 py-1 text-slate-700"
          />
          <ModeButton label="All" active={mode === 'all'} onClick={() => setMode('all')} />
          <ModeButton label="Live" active={mode === 'live'} onClick={() => setMode('live')} />
          <ModeButton label="High gadi" active={mode === 'high_gadi'} onClick={() => setMode('high_gadi')} />
          <ModeButton label="Multi destination" active={mode === 'multi_destination'} onClick={() => setMode('multi_destination')} />
          <ModeButton label="High value" active={mode === 'high_value'} onClick={() => setMode('high_value')} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Origin</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Top destination</th>
              <th className="px-4 py-3">Commodity</th>
              <th className="px-4 py-3">Gadi</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">GMV</th>
              <th className="px-4 py-3">Operator move</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-slate-500">
                  No origin rows match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 18).map((row) => {
                const action = originAction(row);
                return (
                  <tr key={row.source}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950">{row.source}</div>
                      <div className="text-xs text-slate-500">
                        {row.sourceState || 'State unknown'} · {formatNumber(row.destinations.length)} destinations
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{originScore(row)}/100</td>
                    <td className="px-4 py-3 text-slate-700">{row.topDestination}</td>
                    <td className="px-4 py-3 text-slate-700">{row.topCommodity || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(row.vehicleCount)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(row.activeTrips)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMoney(row.gmv)}</td>
                    <td className="max-w-[300px] px-4 py-3">
                      <span className={action.className}>{action.label}</span>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{action.note}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildOrigins(routes: RouteActivity[]): OriginRow[] {
  const grouped = new Map<string, OriginRow>();
  for (const route of routes) {
    const current =
      grouped.get(route.source) ||
      ({
        source: route.source,
        sourceState: route.sourceState,
        destinations: [],
        topDestination: route.destination,
        topCommodity: route.topCommodity,
        vehicleCount: 0,
        activeTrips: 0,
        tripCount: 0,
        gmv: 0,
        invoiceCount: 0,
        activeVehicles: [],
        urgencyScore: 0,
      } satisfies OriginRow);

    current.destinations = Array.from(new Set([...current.destinations, route.destination]));
    if (route.vehicleCount > current.vehicleCount / Math.max(1, current.destinations.length)) {
      current.topDestination = route.destination;
      current.topCommodity = route.topCommodity || current.topCommodity;
    }
    current.vehicleCount += route.vehicleCount;
    current.activeTrips += route.activeTrips;
    current.tripCount += route.tripCount;
    current.gmv += route.gmv;
    current.invoiceCount += route.invoiceCount;
    current.activeVehicles = Array.from(new Set([...current.activeVehicles, ...route.activeVehicles])).slice(0, 12);
    current.urgencyScore = Math.max(current.urgencyScore, route.urgencyScore);
    grouped.set(route.source, current);
  }
  return [...grouped.values()];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-1 ${
        active
          ? 'border-slate-950 bg-slate-950 text-white'
          : 'border-slate-300 bg-white text-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

function originScore(row: OriginRow) {
  return Math.min(
    100,
    Math.round(
      Math.min(30, row.vehicleCount * 3) +
        Math.min(25, row.activeTrips * 5) +
        Math.min(20, row.destinations.length * 5) +
        Math.min(15, row.gmv / 500000) +
        Math.min(10, row.urgencyScore / 10),
    ),
  );
}

function originAction(row: OriginRow) {
  if (row.activeTrips >= 5) {
    return {
      label: 'Call dispatch',
      note: `High live movement. Confirm loading pressure from ${row.source} and destination-wise freight today.`,
      className: 'border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold uppercase text-emerald-800',
    };
  }
  if (row.destinations.length >= 3) {
    return {
      label: 'Split demand',
      note: 'Multiple destinations active. Match demand by destination instead of treating this as one lane.',
      className: 'border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold uppercase text-sky-800',
    };
  }
  if (row.vehicleCount >= 10) {
    return {
      label: 'Verify repeat',
      note: 'Good gadi depth. Check whether same crop and destination will repeat tomorrow.',
      className: 'border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold uppercase text-amber-800',
    };
  }
  return {
    label: 'Watch',
    note: 'Low origin depth. Keep as context unless field feedback confirms demand or supply pressure.',
    className: 'border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold uppercase text-slate-700',
  };
}

function exportOrigins(rows: OriginRow[]) {
  downloadCsv(
    'mandiplus-origin-mandi-board',
    [
      'source',
      'source_state',
      'score',
      'top_destination',
      'destinations',
      'top_commodity',
      'gadi',
      'active_trips',
      'trips',
      'gmv',
      'invoices',
      'active_vehicles',
      'action',
      'action_note',
    ],
    rows.map((row) => {
      const action = originAction(row);
      return [
        row.source,
        row.sourceState,
        originScore(row),
        row.topDestination,
        row.destinations.join(' | '),
        row.topCommodity,
        row.vehicleCount,
        row.activeTrips,
        row.tripCount,
        row.gmv,
        row.invoiceCount,
        row.activeVehicles.join(' '),
        action.label,
        action.note,
      ];
    }),
  );
}
