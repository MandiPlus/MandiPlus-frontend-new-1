import { useMemo, useState } from 'react';
import { RouteActivity } from '../types';
import { formatMoney, formatNumber } from '../formatters';
import { downloadCsv } from '../exporters';

function formatDateTime(value: string | null) {
  if (!value) return 'No active timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function movementClass(status: RouteActivity['movementStatus']) {
  if (status === 'live') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'recent') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatFreshness(hours: number | null) {
  if (hours === null) return 'Unknown';
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function RouteTable({ rows }: { rows: RouteActivity[] }) {
  const [movementFilter, setMovementFilter] = useState<RouteActivity['movementStatus'] | 'all'>('live');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const commodities = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.topCommodity).filter(Boolean) as string[]))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 18),
    [rows],
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (movementFilter !== 'all' && row.movementStatus !== movementFilter) return false;
        if (activeOnly && row.activeTrips <= 0) return false;
        if (commodityFilter && row.topCommodity !== commodityFilter) return false;
        return true;
      }),
    [activeOnly, commodityFilter, movementFilter, rows],
  );
  const totals = useMemo(
    () => ({
      lanes: filteredRows.length,
      gadi: filteredRows.reduce((sum, row) => sum + row.vehicleCount, 0),
      active: filteredRows.reduce((sum, row) => sum + row.activeTrips, 0),
      gmv: filteredRows.reduce((sum, row) => sum + row.gmv, 0),
    }),
    [filteredRows],
  );

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Gadi And Route Movement</h2>
            <p className="text-sm text-slate-500">Which gadi clusters are moving from which mandi/source to where.</p>
          </div>
          <button
            type="button"
            onClick={() => exportRoutes(filteredRows)}
            disabled={filteredRows.length === 0}
            className="w-fit border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            Export lanes
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Filtered lanes" value={formatNumber(totals.lanes)} />
          <Metric label="Gadi" value={formatNumber(totals.gadi)} />
          <Metric label="Active trips" value={formatNumber(totals.active)} />
          <Metric label="Linked GMV" value={formatMoney(totals.gmv)} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <FilterButton label="Live" active={movementFilter === 'live'} onClick={() => setMovementFilter('live')} />
          <FilterButton label="Recent" active={movementFilter === 'recent'} onClick={() => setMovementFilter('recent')} />
          <FilterButton label="Dormant" active={movementFilter === 'dormant'} onClick={() => setMovementFilter('dormant')} />
          <FilterButton label="All lanes" active={movementFilter === 'all'} onClick={() => setMovementFilter('all')} />
          <button
            type="button"
            onClick={() => setActiveOnly((value) => !value)}
            className={`border px-2 py-1 ${
              activeOnly
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            Active only
          </button>
          <select
            value={commodityFilter}
            onChange={(event) => setCommodityFilter(event.target.value)}
            className="border border-slate-300 bg-white px-2 py-1 text-slate-700"
          >
            <option value="">All commodities</option>
            {commodities.map((commodity) => (
              <option key={commodity} value={commodity}>
                {commodity}
              </option>
            ))}
          </select>
          {(commodityFilter || movementFilter !== 'live' || !activeOnly) && (
            <button
              type="button"
              onClick={() => {
                setMovementFilter('live');
                setCommodityFilter('');
                setActiveOnly(true);
              }}
              className="border border-slate-300 bg-white px-2 py-1 text-slate-600"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">No tracked routes found for this period.</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">No routes match the selected filters.</div>
        ) : (
          filteredRows.slice(0, 14).map((row) => (
            <div key={`${row.source}-${row.destination}`} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-950">{row.source} → {row.destination}</div>
                  <div className="text-sm text-slate-500">
                    {row.topCommodity || 'Commodity unknown'}
                    {(row.sourceState || row.destinationState) && (
                      <> · {row.sourceState || 'Unknown'} to {row.destinationState || 'Unknown'}</>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className={`border px-2 py-1 uppercase ${movementClass(row.movementStatus)}`}>
                    {row.movementStatus}
                  </span>
                  <span className="border border-slate-200 bg-slate-50 px-2 py-1">{formatNumber(row.vehicleCount)} gadi</span>
                  <span className="border border-slate-200 bg-slate-50 px-2 py-1">{formatNumber(row.tripCount)} trips</span>
                  <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">{formatNumber(row.activeTrips)} active</span>
                  {row.gmv > 0 && (
                    <span className="border border-slate-200 bg-slate-50 px-2 py-1">{formatMoney(row.gmv)}</span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <Metric label="Urgency" value={`${row.urgencyScore}/100`} />
                <Metric label="Freshness" value={formatFreshness(row.freshnessHours)} />
                <Metric label="Active Share" value={`${row.activeVehicleShare}%`} />
                <Metric label="Invoices" value={formatNumber(row.invoiceCount)} />
              </div>

              <div className="mt-3 border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Manifest read
                </div>
                <div className="mt-1 text-sm text-slate-800">{row.manifestSummary}</div>
                <div className="mt-2 border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-800">
                  {row.operatorAction}
                </div>
              </div>

              {row.sampleVehicles.length > 0 && (
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Active / in-progress gadi
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(row.activeVehicles.length > 0 ? row.activeVehicles : row.sampleVehicles)
                        .slice(0, 8)
                        .map((vehicle) => (
                          <span
                            key={vehicle}
                            className={`border px-2 py-1 text-[11px] font-semibold ${
                              row.activeVehicles.includes(vehicle)
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {vehicle}
                          </span>
                        ))}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Latest active: {formatDateTime(row.latestActiveTripAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status mix
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold">
                      <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                        Active {formatNumber(row.statusCounts.active)}
                      </span>
                      <span className="border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">
                        In progress {formatNumber(row.statusCounts.inProgress)}
                      </span>
                      <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                        Completed {formatNumber(row.statusCounts.completed)}
                      </span>
                      {row.statusCounts.cancelled > 0 && (
                        <span className="border border-red-200 bg-red-50 px-2 py-1 text-red-800">
                          Cancelled {formatNumber(row.statusCounts.cancelled)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function FilterButton({
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

function exportRoutes(rows: RouteActivity[]) {
  downloadCsv(
    'mandiplus-route-movement',
    [
      'source',
      'destination',
      'source_state',
      'destination_state',
      'commodity',
      'movement_status',
      'vehicle_count',
      'trip_count',
      'active_trips',
      'active_vehicle_share',
      'urgency_score',
      'gmv',
      'latest_trip_at',
      'latest_active_trip_at',
      'active_vehicles',
      'operator_action',
    ],
    rows.map((row) => [
      row.source,
      row.destination,
      row.sourceState,
      row.destinationState,
      row.topCommodity,
      row.movementStatus,
      row.vehicleCount,
      row.tripCount,
      row.activeTrips,
      row.activeVehicleShare,
      row.urgencyScore,
      row.gmv,
      row.latestTripAt,
      row.latestActiveTripAt,
      row.activeVehicles.join(' '),
      row.operatorAction,
    ]),
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
