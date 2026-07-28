import { useMemo, useState } from 'react';
import { Download, MessageCircle, Phone, RadioTower, Truck, Users } from 'lucide-react';
import { RouteActivity } from '../types';
import { downloadCsv, phoneHref, whatsappHref } from '../exporters';
import { formatMoney, formatNumber } from '../formatters';

type MovementFilter = RouteActivity['movementStatus'] | 'all';

export function GadiFlowDesk({ routes }: { routes: RouteActivity[] }) {
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('live');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState('');

  const commodities = useMemo(
    () =>
      Array.from(new Set(routes.map((route) => route.topCommodity).filter(Boolean) as string[]))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 24),
    [routes],
  );

  const filteredRoutes = useMemo(
    () =>
      routes
        .filter((route) => {
          if (movementFilter !== 'all' && route.movementStatus !== movementFilter) return false;
          if (commodityFilter && route.topCommodity !== commodityFilter) return false;
          if (searchQuery.trim() && !routeMatchesSearch(route, searchQuery)) return false;
          return true;
        })
        .sort((a, b) => b.urgencyScore - a.urgencyScore || b.activeTrips - a.activeTrips || b.vehicleCount - a.vehicleCount)
        .slice(0, 24),
    [commodityFilter, movementFilter, routes, searchQuery],
  );

  const selectedRoute = useMemo(
    () => filteredRoutes.find((route) => routeKey(route) === selectedKey) || filteredRoutes[0] || null,
    [filteredRoutes, selectedKey],
  );

  const totals = useMemo(
    () => ({
      lanes: filteredRoutes.length,
      gadi: filteredRoutes.reduce((sum, route) => sum + route.vehicleCount, 0),
      activeTrips: filteredRoutes.reduce((sum, route) => sum + route.activeTrips, 0),
      activeLanes: filteredRoutes.filter((route) => route.activeTrips > 0).length,
    }),
    [filteredRoutes],
  );

  function resetFilters() {
    setMovementFilter('live');
    setCommodityFilter('');
    setSearchQuery('');
    setSelectedKey('');
  }

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-slate-200 p-4 xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-700" />
            <h2 className="text-base font-semibold text-slate-950">Gadi Flow Desk</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Work the lanes by mandi/source, destination, active gadi, vehicle numbers, and dispatch action.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSelectedKey('');
            }}
            placeholder="Search mandi, route, gadi, contact"
            className="min-w-[240px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
          />
          <select
            value={movementFilter}
            onChange={(event) => {
              setMovementFilter(event.target.value as MovementFilter);
              setSelectedKey('');
            }}
            className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
          >
            <option value="live">Live lanes</option>
            <option value="recent">Recent lanes</option>
            <option value="dormant">Dormant lanes</option>
            <option value="all">All lanes</option>
          </select>
          <select
            value={commodityFilter}
            onChange={(event) => {
              setCommodityFilter(event.target.value);
              setSelectedKey('');
            }}
            className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
          >
            <option value="">All commodities</option>
            {commodities.map((commodity) => (
              <option key={commodity} value={commodity}>{commodity}</option>
            ))}
          </select>
          {(movementFilter !== 'live' || commodityFilter || searchQuery.trim()) && (
            <button
              type="button"
              onClick={resetFilters}
              className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => exportGadiFlows(filteredRoutes)}
            disabled={filteredRoutes.length === 0}
            className="inline-flex items-center gap-2 bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export filtered
          </button>
        </div>
      </div>

      <div className="grid gap-px bg-slate-200 md:grid-cols-4">
        <Metric label="Lanes" value={formatNumber(totals.lanes)} />
        <Metric label="Gadi" value={formatNumber(totals.gadi)} />
        <Metric label="Active trips" value={formatNumber(totals.activeTrips)} tone="emerald" />
        <Metric label="Active lanes" value={formatNumber(totals.activeLanes)} />
      </div>

      <div className="grid gap-0 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="max-h-[560px] overflow-auto border-b border-slate-200 xl:border-b-0 xl:border-r">
          {filteredRoutes.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No lanes match these filters.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRoutes.map((route) => {
                const active = selectedRoute && routeKey(selectedRoute) === routeKey(route);
                return (
                  <button
                    key={routeKey(route)}
                    type="button"
                    onClick={() => setSelectedKey(routeKey(route))}
                    className={`grid w-full gap-2 p-3 text-left transition ${
                      active ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">
                          {route.source} {'->'} {route.destination}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {route.topCommodity || 'Mixed'} · {route.sourceState || 'Unknown'} to {route.destinationState || 'Unknown'}
                        </div>
                      </div>
                      <span className={`shrink-0 border px-2 py-1 text-[11px] font-semibold uppercase ${movementClass(route.movementStatus)}`}>
                        {route.movementStatus}
                      </span>
                    </div>
                    {(route.activeVehicles.length > 0 || route.sampleVehicles.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {(route.activeVehicles.length > 0 ? route.activeVehicles : route.sampleVehicles)
                          .slice(0, 5)
                          .map((vehicle) => (
                            <span
                              key={`list-${routeKey(route)}-${vehicle}`}
                              className="border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600"
                            >
                              {vehicle}
                            </span>
                          ))}
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <MiniMetric label="Gadi" value={formatNumber(route.vehicleCount)} />
                      <MiniMetric label="Active" value={formatNumber(route.activeTrips)} />
                      <MiniMetric label="Urgency" value={`${route.urgencyScore}`} />
                      <MiniMetric label="Fresh" value={formatFreshness(route.freshnessHours)} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-4">
          {selectedRoute ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <RadioTower className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-lg font-semibold text-slate-950">
                      {selectedRoute.source} {'->'} {selectedRoute.destination}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedRoute.topCommodity || 'Mixed commodity'} · latest active {formatDateTime(selectedRoute.latestActiveTripAt)}
                  </p>
                </div>
                <span className="border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                  {selectedRoute.urgencyScore}/100 urgency
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                <Metric label="Vehicle count" value={formatNumber(selectedRoute.vehicleCount)} />
                <Metric label="Trip count" value={formatNumber(selectedRoute.tripCount)} />
                <Metric label="Active share" value={`${selectedRoute.activeVehicleShare}%`} />
                <Metric label="Linked GMV" value={formatMoney(selectedRoute.gmv)} />
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_0.82fr]">
                <div className="border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Dispatch read
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selectedRoute.manifestSummary}</p>
                  <div className="mt-3 border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-950">
                    {selectedRoute.operatorAction}
                  </div>
                </div>

                <div className="border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status mix
                  </div>
                  <div className="mt-2 grid gap-2 text-xs font-semibold">
                    <StatusBar label="Active" value={selectedRoute.statusCounts.active} total={selectedRoute.tripCount} className="bg-emerald-600" />
                    <StatusBar label="In progress" value={selectedRoute.statusCounts.inProgress} total={selectedRoute.tripCount} className="bg-sky-600" />
                    <StatusBar label="Completed" value={selectedRoute.statusCounts.completed} total={selectedRoute.tripCount} className="bg-slate-500" />
                    {selectedRoute.statusCounts.cancelled > 0 && (
                      <StatusBar label="Cancelled" value={selectedRoute.statusCounts.cancelled} total={selectedRoute.tripCount} className="bg-red-600" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <VehicleBlock
                  title="Active / in-progress gadi"
                  vehicles={selectedRoute.activeVehicles}
                  emptyText="No active gadi numbers in this lane right now."
                  active
                />
                <VehicleBlock
                  title="Sample gadi"
                  vehicles={selectedRoute.sampleVehicles}
                  emptyText="No vehicle sample captured for this lane."
                />
              </div>

              <LaneContactPanel route={selectedRoute} />

              <VehicleEvidenceTable route={selectedRoute} />
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              Select a lane to inspect gadi numbers, freshness, and dispatch action.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LaneContactPanel({ route }: { route: RouteActivity }) {
  if (!route.contactEvidence?.length) {
    return (
      <div className="border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
        No lane-linked contact evidence found yet. Use field feedback or source runs to attach buyers, suppliers, and transporters to this flow.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-700" />
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Who to call
          </div>
        </div>
        <div className="text-xs font-medium text-slate-500">
          {route.contactEvidence.length} route contacts
        </div>
      </div>
      <div className="grid gap-px bg-slate-100 lg:grid-cols-2">
        {route.contactEvidence.slice(0, 6).map((contact) => {
          const message = `MandiPlus lane check: ${route.source} to ${route.destination}. ${contact.callObjective}`;
          const callLink = phoneHref(contact.mobileNumber);
          const whatsappLink = whatsappHref(contact.mobileNumber, message);

          return (
            <div key={`${routeKey(route)}-${contact.contactId}`} className="bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{contact.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    <span className={`border px-2 py-0.5 font-semibold uppercase ${roleClass(contact.roleCategory)}`}>
                      {contact.roleCategory}
                    </span>
                    <span>{contact.state || route.sourceState || 'Unknown state'}</span>
                    {contact.recentCommodity && <span>· {contact.recentCommodity}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {callLink && (
                    <a
                      href={callLink}
                      className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-slate-800 hover:border-emerald-600 hover:text-emerald-700"
                      title="Call"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-600"
                      title="WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <MiniMetric label="Invoices" value={formatNumber(contact.invoiceCount)} />
                <MiniMetric label="Trips" value={formatNumber(contact.tripCount)} />
                <MiniMetric label="GMV" value={formatMoney(contact.gmv)} />
              </div>

              <div className="mt-3 border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
                {contact.callObjective}
              </div>

              {contact.qualificationQuestions.length > 0 && (
                <div className="mt-3 space-y-1">
                  {contact.qualificationQuestions.slice(0, 3).map((question) => (
                    <div key={question} className="text-xs leading-5 text-slate-500">
                      - {question}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VehicleEvidenceTable({ route }: { route: RouteActivity }) {
  if (!route.vehicleEvidence?.length) {
    return (
      <div className="border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
        Structured vehicle evidence is not available for this lane yet.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Vehicle evidence
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Gadi</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Latest</th>
              <th className="px-3 py-2">Trips</th>
              <th className="px-3 py-2">Invoices</th>
              <th className="px-3 py-2">GMV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {route.vehicleEvidence.slice(0, 12).map((vehicle) => (
              <tr key={`${routeKey(route)}-${vehicle.vehicleNumber}`} className="align-top">
                <td className="px-3 py-2 font-semibold text-slate-950">
                  {vehicle.vehicleNumber}
                  {vehicle.commodity && (
                    <div className="text-xs font-normal text-slate-500">{vehicle.commodity}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`border px-2 py-1 text-[11px] font-semibold uppercase ${vehicleStatusClass(vehicle.status)}`}>
                    {vehicle.status || 'unknown'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">{formatDateTime(vehicle.latestTripAt)}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(vehicle.tripCount)}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(vehicle.invoiceCount)}</td>
                <td className="px-3 py-2 font-medium text-slate-950">{formatMoney(vehicle.gmv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function exportGadiFlows(routes: RouteActivity[]) {
  downloadCsv(
    'mandiplus-gadi-flow-desk',
    [
      'source',
      'destination',
      'source_state',
      'destination_state',
      'commodity',
      'movement_status',
      'vehicle_count',
      'active_trips',
      'trip_count',
      'active_vehicle_share',
      'sample_vehicles',
      'active_vehicles',
      'vehicle_evidence',
      'contact_evidence',
      'latest_trip_at',
      'latest_active_trip_at',
      'operator_action',
    ],
    routes.map((route) => [
      route.source,
      route.destination,
      route.sourceState,
      route.destinationState,
      route.topCommodity,
      route.movementStatus,
      route.vehicleCount,
      route.activeTrips,
      route.tripCount,
      route.activeVehicleShare,
      route.sampleVehicles.join(' '),
      route.activeVehicles.join(' '),
      route.vehicleEvidence
        ?.map((vehicle) => `${vehicle.vehicleNumber}:${vehicle.status || 'unknown'}:${vehicle.tripCount}`)
        .join(' | '),
      route.contactEvidence
        ?.map((contact) => `${contact.name}:${contact.mobileNumber}:${contact.roleCategory}:${contact.invoiceCount}`)
        .join(' | '),
      route.latestTripAt,
      route.latestActiveTripAt,
      route.operatorAction,
    ]),
  );
}

function routeMatchesSearch(route: RouteActivity, query: string) {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const haystack = [
    route.source,
    route.destination,
    route.sourceState,
    route.destinationState,
    route.topCommodity,
    route.movementStatus,
    ...route.sampleVehicles,
    ...route.activeVehicles,
    ...route.vehicleEvidence.flatMap((vehicle) => [
      vehicle.vehicleNumber,
      vehicle.status,
      vehicle.commodity,
    ]),
    ...route.contactEvidence.flatMap((contact) => [
      contact.name,
      contact.mobileNumber,
      contact.roleCategory,
      contact.identity,
      contact.state,
      contact.recentCommodity,
    ]),
  ]
    .filter(Boolean)
    .map((value) => normalizeSearch(String(value)))
    .join(' ');

  return haystack.includes(needle);
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function VehicleBlock({
  title,
  vehicles,
  emptyText,
  active = false,
}: {
  title: string;
  vehicles: string[];
  emptyText: string;
  active?: boolean;
}) {
  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      {vehicles.length === 0 ? (
        <div className="mt-2 text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {vehicles.slice(0, 16).map((vehicle) => (
            <span
              key={`${title}-${vehicle}`}
              className={`border px-2 py-1 text-xs font-semibold ${
                active
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {vehicle}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBar({
  label,
  value,
  total,
  className,
}: {
  label: string;
  value: number;
  total: number;
  className: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-slate-600">
        <span>{label}</span>
        <span>{formatNumber(value)}</span>
      </div>
      <div className="mt-1 h-1.5 bg-slate-100">
        <div className={`h-1.5 ${className}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'emerald';
}) {
  return (
    <div className="bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === 'emerald' ? 'text-emerald-700' : 'text-slate-950'}`}>
        {value}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white px-2 py-1">
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function movementClass(status: RouteActivity['movementStatus']) {
  if (status === 'live') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'recent') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function vehicleStatusClass(status: string | null) {
  if (status === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'IN_PROGRESS') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'COMPLETED') return 'border-slate-200 bg-slate-50 text-slate-700';
  if (status === 'CANCELLED') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-slate-200 bg-white text-slate-600';
}

function roleClass(role: string) {
  if (role === 'buyer') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (role === 'supplier') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (role === 'transporter') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (role === 'partner') return 'border-violet-200 bg-violet-50 text-violet-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatFreshness(hours: number | null) {
  if (hours === null) return 'Unknown';
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'none';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function routeKey(route: RouteActivity) {
  return `${route.source}__${route.destination}`;
}
