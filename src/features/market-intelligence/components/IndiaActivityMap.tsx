import { useMemo, useState } from 'react';
import { Clipboard, Download, MessageCircle, Phone } from 'lucide-react';
import { downloadCsv, phoneHref, whatsappHref } from '../exporters';
import { CommodityGeography, RegionActivity, RouteActivity } from '../types';
import { formatMoney, formatNumber } from '../formatters';

function projectIndia(lat: number, lng: number) {
  const minLat = 6;
  const maxLat = 36;
  const minLng = 67;
  const maxLng = 98;
  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
  return {
    x: Math.max(4, Math.min(96, x)),
    y: Math.max(4, Math.min(96, y)),
  };
}

export function IndiaActivityMap({
  regions,
  commodityGeography,
  routes,
  selectedState,
  onSelectState,
  onSelectCommodity,
}: {
  regions: RegionActivity[];
  commodityGeography: CommodityGeography[];
  routes: RouteActivity[];
  selectedState: string;
  onSelectState: (state: string) => void;
  onSelectCommodity: (commodity: string) => void;
}) {
  const [selectedRouteKey, setSelectedRouteKey] = useState('');
  const [selectedCommodityKey, setSelectedCommodityKey] = useState('');
  const [showRegions, setShowRegions] = useState(true);
  const [showCommodities, setShowCommodities] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [laneMode, setLaneMode] = useState<'hot' | 'live' | 'recent' | 'dormant' | 'all'>('hot');
  const [copiedLaneKey, setCopiedLaneKey] = useState('');
  const plotted = regions.filter((region) => region.lat !== null && region.lng !== null);
  const plottedCommodities = commodityGeography.filter(
    (item) => item.lat !== null && item.lng !== null,
  );
  const coordinateRoutes = routes.filter(
    (route) =>
      route.sourceLat !== null &&
      route.sourceLng !== null &&
      route.destinationLat !== null &&
      route.destinationLng !== null,
  );
  const plottedRoutes = useMemo(
    () =>
      coordinateRoutes
        .filter((route) => {
          if (laneMode === 'all') return true;
          if (laneMode === 'hot') return route.urgencyScore >= 60 || route.activeTrips > 0;
          return route.movementStatus === laneMode;
        })
        .sort((a, b) => b.urgencyScore - a.urgencyScore || b.activeTrips - a.activeTrips)
        .slice(0, laneMode === 'all' ? 36 : 24),
    [coordinateRoutes, laneMode],
  );
  const laneTotals = useMemo(
    () => ({
      totalGadi: plottedRoutes.reduce((sum, route) => sum + route.vehicleCount, 0),
      activeGadi: plottedRoutes.reduce((sum, route) => sum + route.activeTrips, 0),
      activeLanes: plottedRoutes.filter((route) => route.activeTrips > 0).length,
    }),
    [plottedRoutes],
  );
  const selected =
    regions.find((region) => region.state === selectedState) || regions[0] || null;
  const selectedStateCommodities = useMemo(() => {
    if (!selected) return [];
    return commodityGeography
      .filter((item) => item.state === selected.state)
      .sort((a, b) => b.opportunityScore - a.opportunityScore || b.gmv - a.gmv)
      .slice(0, 6);
  }, [commodityGeography, selected]);
  const selectedStateRoutes = useMemo(() => {
    if (!selected) return [];
    const state = selected.state.toLowerCase();
    return routes
      .filter(
        (route) =>
          route.sourceState?.toLowerCase() === state ||
          route.destinationState?.toLowerCase() === state ||
          route.source.toLowerCase().includes(state) ||
          route.destination.toLowerCase().includes(state),
      )
      .sort((a, b) => b.urgencyScore - a.urgencyScore || b.activeTrips - a.activeTrips)
      .slice(0, 5);
  }, [routes, selected]);
  const topRegions = useMemo(
    () => [...regions].sort((a, b) => b.intensity - a.intensity).slice(0, 5),
    [regions],
  );
  const selectedRoute = useMemo(() => {
    if (!plottedRoutes.length) return null;
    return (
      plottedRoutes.find((route) => routeKey(route) === selectedRouteKey) ||
      plottedRoutes[0]
    );
  }, [plottedRoutes, selectedRouteKey]);
  const selectedCommodity = useMemo(() => {
    if (!plottedCommodities.length) return null;
    return (
      plottedCommodities.find((item) => commodityKey(item) === selectedCommodityKey) ||
      plottedCommodities[0]
    );
  }, [plottedCommodities, selectedCommodityKey]);
  const selectedCommodityRoutes = useMemo(() => {
    if (!selectedCommodity) return [];
    const commodity = selectedCommodity.commodity.toLowerCase();
    return routes
      .filter((route) => (route.topCommodity || '').toLowerCase() === commodity)
      .sort((a, b) => b.activeTrips - a.activeTrips || b.urgencyScore - a.urgencyScore || b.vehicleCount - a.vehicleCount)
      .slice(0, 4);
  }, [routes, selectedCommodity]);

  return (
    <section className="grid gap-4 border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.35fr_0.65fr]">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">India Market Activity</h2>
            <p className="text-sm text-slate-500">State heat, vegetable/fruit concentration, and live gadi movement.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 text-xs font-medium text-slate-600">
            <span className="border border-slate-200 bg-slate-50 px-2 py-1">{plotted.length} states</span>
            <span className="border border-slate-200 bg-slate-50 px-2 py-1">{plottedCommodities.length} crops</span>
            <span className="border border-slate-200 bg-slate-50 px-2 py-1">{plottedRoutes.length} flows</span>
            <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
              {formatNumber(laneTotals.activeGadi)} active gadi
            </span>
            {plottedRoutes.length > 0 && (
              <button
                type="button"
                onClick={() => exportVisibleLanes(plottedRoutes)}
                className="inline-flex items-center gap-1 border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
              >
                <Download className="h-3.5 w-3.5" />
                Export lanes
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <LayerButton label="State heat" active={showRegions} onClick={() => setShowRegions((value) => !value)} />
            <LayerButton label="Crops" active={showCommodities} onClick={() => setShowCommodities((value) => !value)} />
            <LayerButton label="Gadi lanes" active={showRoutes} onClick={() => setShowRoutes((value) => !value)} />
          </div>
          <div className="flex flex-wrap gap-1 text-xs font-semibold">
            <LaneModeButton label="Hot" value="hot" active={laneMode} onClick={setLaneMode} />
            <LaneModeButton label="Live" value="live" active={laneMode} onClick={setLaneMode} />
            <LaneModeButton label="Recent" value="recent" active={laneMode} onClick={setLaneMode} />
            <LaneModeButton label="Dormant" value="dormant" active={laneMode} onClick={setLaneMode} />
            <LaneModeButton label="All" value="all" active={laneMode} onClick={setLaneMode} />
          </div>
        </div>

        <div className="relative mt-4 h-[460px] overflow-hidden border border-slate-200 bg-[#f8faf7]">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M42 5 C37 8 35 14 34 20 C31 23 29 29 31 34 C27 39 26 48 29 55 C31 60 33 66 34 73 C35 80 38 88 44 94 C50 88 54 80 57 72 C61 64 66 58 69 50 C73 39 72 29 66 21 C61 14 54 8 48 6 C46 5 44 5 42 5 Z"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="0.45"
            />
            <path
              d="M55 72 C58 76 61 81 61 88 C58 91 55 91 52 87 C53 81 54 76 55 72 Z"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="0.35"
            />
            <path
              d="M34 20 L66 21 M30 36 L72 36 M30 53 L69 53 M35 72 L57 72 M42 5 L44 94 M55 9 L39 86"
              stroke="#e2e8f0"
              strokeWidth="0.25"
              strokeDasharray="1.5 1.5"
            />
            {showRoutes && plottedRoutes.map((route) => {
              const start = projectIndia(route.sourceLat!, route.sourceLng!);
              const end = projectIndia(route.destinationLat!, route.destinationLng!);
              const active = selectedRoute && routeKey(route) === routeKey(selectedRoute);
              return (
                <g key={routeKey(route)}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={active ? '#0f172a' : '#0284c7'}
                    strokeWidth={active ? 0.9 : 0.35 + Math.min(0.75, route.vehicleCount / 24)}
                    strokeOpacity={active ? 0.86 : route.activeTrips > 0 ? 0.52 : 0.28}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx={end.x} cy={end.y} r={active ? 1.2 : 0.75} fill={active ? '#0f172a' : '#0284c7'} />
                </g>
              );
            })}
          </svg>
          {showRoutes && plottedRoutes.map((route) => {
            const end = projectIndia(route.destinationLat!, route.destinationLng!);
            const active = selectedRoute && routeKey(route) === routeKey(selectedRoute);
            return (
              <button
                key={`${routeKey(route)}-hit`}
                type="button"
                onClick={() => setSelectedRouteKey(routeKey(route))}
                className={`absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-sm transition ${
                  active ? 'border-slate-950' : 'border-sky-500 hover:border-slate-950'
                }`}
                style={{ left: `${end.x}%`, top: `${end.y}%` }}
                title={`${route.source} to ${route.destination}: ${route.vehicleCount} gadi`}
              />
            );
          })}
          {showRegions && plotted.map((region) => {
            const point = projectIndia(region.lat!, region.lng!);
            const size = 12 + Math.min(34, region.intensity / 2);
            const active = region.state === selectedState;
            return (
              <button
                key={region.state}
                type="button"
                onClick={() => onSelectState(region.state)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm transition ${
                  active
                    ? 'border-slate-950 bg-emerald-500'
                    : 'border-white bg-emerald-400 hover:bg-emerald-500'
                }`}
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  height: size,
                  width: size,
                  opacity: 0.55 + Math.min(0.4, region.intensity / 250),
                }}
                title={`${region.state}: ${region.invoiceCount} invoices`}
              >
                {active && (
                  <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 shadow-sm">
                    {region.state}
                  </span>
                )}
              </button>
            );
          })}
          {showCommodities && plottedCommodities.slice(0, 34).map((item, index) => {
            const point = projectIndia(item.lat!, item.lng!);
            const active = selectedCommodity && commodityKey(item) === commodityKey(selectedCommodity);
            const offset = commodityOffset(item.stateRank, index);
            return (
              <button
                key={commodityKey(item)}
                type="button"
                onClick={() => {
                  setSelectedCommodityKey(commodityKey(item));
                  onSelectCommodity(item.commodity);
                }}
                className={`absolute max-w-[118px] -translate-x-1/2 border px-2 py-1 text-left text-[11px] font-semibold leading-tight shadow-sm transition ${
                  active
                    ? 'border-slate-950 bg-lime-200 text-slate-950'
                    : 'border-lime-200 bg-white/95 text-slate-700 hover:border-slate-950'
                }`}
                style={{
                  left: `${Math.max(5, Math.min(95, point.x + offset.x))}%`,
                  top: `${Math.max(5, Math.min(95, point.y + offset.y))}%`,
                  opacity: 0.72 + Math.min(0.28, item.intensity / 250),
                }}
                title={`${item.commodity} in ${item.state}: ${item.invoiceCount} invoices, ${item.vehicleCount} gadi`}
              >
                {item.commodity}
              </button>
            );
          })}
          <div className="absolute left-3 top-3 w-44 border border-slate-200 bg-white/95 p-2 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Hot states
            </div>
            <div className="mt-2 space-y-1">
              {topRegions.map((region) => (
                <button
                  key={`hot-${region.state}`}
                  type="button"
                  onClick={() => onSelectState(region.state)}
                  className="grid w-full grid-cols-[1fr_44px] gap-2 text-left text-xs"
                >
                  <span className="truncate font-semibold text-slate-800">{region.state}</span>
                  <span className="text-right text-slate-500">{formatNumber(region.vehicleCount)} gadi</span>
                </button>
              ))}
            </div>
          </div>
          <div className="absolute bottom-3 left-3 grid w-52 grid-cols-3 border border-slate-200 bg-white/95 text-center text-xs shadow-sm">
            <MapMetric label="Lanes" value={formatNumber(plottedRoutes.length)} />
            <MapMetric label="Gadi" value={formatNumber(laneTotals.totalGadi)} />
            <MapMetric label="Active" value={formatNumber(laneTotals.activeGadi)} />
          </div>
        </div>
      </div>

      <div className="space-y-3 border border-slate-200 bg-slate-50 p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Selected Region</h3>
          {selected ? (
            <div className="mt-3 space-y-4">
              <div>
                <div className="text-2xl font-semibold text-slate-950">{selected.state}</div>
                <div className="text-sm text-slate-500">
                  Top commodity: {selected.topCommodity || 'Not enough data'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="Invoices" value={formatNumber(selected.invoiceCount)} />
                <Metric label="GMV" value={formatMoney(selected.gmv)} />
                <Metric label="Gadi" value={formatNumber(selected.vehicleCount)} />
                <Metric label="Commodities" value={formatNumber(selected.activeCommodities)} />
              </div>
              <div className="h-2 bg-white">
                <div
                  className="h-2 bg-emerald-500"
                  style={{ width: `${Math.max(5, selected.intensity)}%` }}
                />
              </div>
              {selectedStateCommodities.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Commodity stack
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedStateCommodities.map((item) => (
                      <button
                        key={`${selected.state}-${item.commodity}-${item.stateRank}`}
                        type="button"
                        onClick={() => {
                          setSelectedCommodityKey(commodityKey(item));
                          onSelectCommodity(item.commodity);
                        }}
                        className="grid w-full grid-cols-[1fr_52px_58px] gap-2 border border-slate-200 bg-white px-2 py-2 text-left text-xs"
                      >
                        <span className="truncate font-semibold text-slate-900">{item.commodity}</span>
                        <span className="text-right text-slate-600">{formatNumber(item.vehicleCount)} gadi</span>
                        <span className="text-right font-semibold text-slate-900">{formatNumber(item.opportunityScore)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No regional activity in this period.</p>
          )}
        </div>

        <div className="border-t border-slate-200 pt-3">
          <h3 className="text-sm font-semibold text-slate-950">Selected Commodity</h3>
          {selectedCommodity ? (
            <div className="mt-3 space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-950">
                    {selectedCommodity.commodity} in {selectedCommodity.state}
                  </div>
                  <span className={`border px-2 py-0.5 text-[11px] font-semibold uppercase ${actionClass(selectedCommodity.actionType)}`}>
                    {selectedCommodity.actionType.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Rank #{selectedCommodity.stateRank} commodity in this state for the selected period.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="Invoices" value={formatNumber(selectedCommodity.invoiceCount)} />
                <Metric label="GMV" value={formatMoney(selectedCommodity.gmv)} />
                <Metric label="Avg rate" value={formatMoney(selectedCommodity.avgRate)} />
                <Metric label="Gadi" value={formatNumber(selectedCommodity.vehicleCount)} />
              </div>
              <div className="border border-lime-200 bg-lime-50 p-3 text-xs leading-5 text-lime-950">
                {selectedCommodity.suggestedAction}
              </div>
              {selectedCommodityRoutes.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Destination demand for this crop
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedCommodityRoutes.map((route) => (
                      <button
                        key={`crop-lane-${routeKey(route)}`}
                        type="button"
                        onClick={() => setSelectedRouteKey(routeKey(route))}
                        className="grid w-full grid-cols-[1fr_54px_54px] gap-2 border border-slate-200 bg-white px-2 py-2 text-left text-xs"
                      >
                        <span className="truncate font-semibold text-slate-900">{route.destination}</span>
                        <span className="text-right text-slate-600">{formatNumber(route.vehicleCount)} gadi</span>
                        <span className="text-right font-semibold text-emerald-700">{formatNumber(route.activeTrips)} live</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No commodity geography in this period.</p>
          )}
        </div>

        <div className="border-t border-slate-200 pt-3">
          <h3 className="text-sm font-semibold text-slate-950">State Lane Stack</h3>
          {selectedStateRoutes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {selectedStateRoutes.map((route) => (
                <button
                  key={`state-lane-${routeKey(route)}`}
                  type="button"
                  onClick={() => setSelectedRouteKey(routeKey(route))}
                  className="w-full border border-slate-200 bg-white p-2 text-left"
                >
                  <div className="text-xs font-semibold text-slate-950">
                    {route.source} → {route.destination}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold text-slate-600">
                    <span>{route.topCommodity || 'Mixed'}</span>
                    <span>{formatNumber(route.vehicleCount)} gadi</span>
                    <span>{formatNumber(route.activeTrips)} active</span>
                    <span>{route.urgencyScore}/100 urgency</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No state-linked routes for the selected region.</p>
          )}
        </div>

        <div className="border-t border-slate-200 pt-3">
          <h3 className="text-sm font-semibold text-slate-950">Selected Gadi Flow</h3>
          {selectedRoute ? (
            <div className="mt-3 space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-950">
                    {selectedRoute.source} → {selectedRoute.destination}
                  </div>
                  <span className={`border px-2 py-0.5 text-[11px] font-semibold uppercase ${movementClass(selectedRoute.movementStatus)}`}>
                    {selectedRoute.movementStatus}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedRoute.topCommodity || 'Commodity unknown'} · {selectedRoute.sourceState || 'Source state unknown'} to {selectedRoute.destinationState || 'Destination state unknown'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyLaneBrief(selectedRoute, setCopiedLaneKey)}
                  className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-600 hover:text-emerald-700"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  {copiedLaneKey === routeKey(selectedRoute) ? 'Copied' : 'Copy lane brief'}
                </button>
                {selectedRoute.vehicleEvidence?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => exportLaneVehicles(selectedRoute)}
                    className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-600 hover:text-emerald-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export gadi
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Metric label="Gadi" value={formatNumber(selectedRoute.vehicleCount)} />
                <Metric label="Trips" value={formatNumber(selectedRoute.tripCount)} />
                <Metric label="Active" value={formatNumber(selectedRoute.activeTrips)} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="Urgency" value={`${selectedRoute.urgencyScore}/100`} />
                <Metric label="Active share" value={`${selectedRoute.activeVehicleShare}%`} />
              </div>
              <div className="border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Manifest
                </div>
                <div className="mt-1 text-sm text-slate-800">{selectedRoute.manifestSummary}</div>
                <div className="mt-2 border border-emerald-100 bg-emerald-50 p-2 text-xs leading-5 text-emerald-900">
                  {selectedRoute.operatorAction}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="Latest trip" value={formatRouteTime(selectedRoute.latestTripAt)} />
                <Metric label="Latest active" value={formatRouteTime(selectedRoute.latestActiveTripAt)} />
              </div>
              {selectedRoute.gmv > 0 && (
                <Metric label="Linked GMV" value={formatMoney(selectedRoute.gmv)} />
              )}
              {(selectedRoute.activeVehicles.length > 0 || selectedRoute.sampleVehicles.length > 0) && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {selectedRoute.activeVehicles.length > 0 ? 'Active gadi' : 'Sample gadi'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(selectedRoute.activeVehicles.length > 0
                      ? selectedRoute.activeVehicles
                      : selectedRoute.sampleVehicles
                    )
                      .slice(0, 8)
                      .map((vehicle) => (
                        <span
                          key={vehicle}
                          className={`border px-2 py-1 text-xs font-semibold ${
                            selectedRoute.activeVehicles.includes(vehicle)
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {vehicle}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {selectedRoute.contactEvidence?.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Call targets
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedRoute.contactEvidence.slice(0, 4).map((contact) => {
                      const message = `MandiPlus lane check: ${selectedRoute.source} to ${selectedRoute.destination}. ${contact.callObjective}`;
                      return (
                        <div key={`map-contact-${selectedRoute.source}-${contact.contactId}`} className="border border-slate-200 bg-white p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-slate-950">{contact.name}</div>
                              <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold">
                                <span className={`border px-1.5 py-0.5 uppercase ${roleClass(contact.roleCategory)}`}>
                                  {contact.roleCategory}
                                </span>
                                <span className="text-slate-500">{formatMoney(contact.gmv)}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              {phoneHref(contact.mobileNumber) && (
                                <a
                                  href={phoneHref(contact.mobileNumber)}
                                  className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 bg-white text-slate-700"
                                  title="Call"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {whatsappHref(contact.mobileNumber, message) && (
                                <a
                                  href={whatsappHref(contact.mobileNumber, message)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-7 w-7 items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-800"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 text-[11px] leading-4 text-slate-600">
                            {contact.callObjective}
                          </div>
                          {contact.qualificationQuestions.length > 0 && (
                            <div className="mt-2 border-t border-slate-100 pt-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Ask
                              </div>
                              <div className="mt-1 space-y-1 text-[11px] leading-4 text-slate-600">
                                {contact.qualificationQuestions.slice(0, 2).map((question) => (
                                  <div key={question}>- {question}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {selectedRoute.vehicleEvidence?.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Vehicle evidence
                  </div>
                  <div className="mt-2 grid gap-1">
                    {selectedRoute.vehicleEvidence.slice(0, 5).map((vehicle) => (
                      <div
                        key={`map-vehicle-${selectedRoute.source}-${vehicle.vehicleNumber}`}
                        className="grid grid-cols-[1fr_70px_58px] gap-2 border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        <span className="truncate font-semibold text-slate-900">{vehicle.vehicleNumber}</span>
                        <span className={`text-right font-semibold ${vehicle.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {vehicle.status || 'unknown'}
                        </span>
                        <span className="text-right text-slate-500">{formatMoney(vehicle.gmv)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No coordinate-backed route flow in this period.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function LayerButton({
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

function LaneModeButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: 'hot' | 'live' | 'recent' | 'dormant' | 'all';
  active: 'hot' | 'live' | 'recent' | 'dormant' | 'all';
  onClick: (value: 'hot' | 'live' | 'recent' | 'dormant' | 'all') => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`border px-2 py-1 ${
        active === value
          ? 'border-emerald-700 bg-emerald-700 text-white'
          : 'border-slate-300 bg-white text-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

function movementClass(status: RouteActivity['movementStatus']) {
  if (status === 'live') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'recent') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function actionClass(action: CommodityGeography['actionType']) {
  if (action === 'PUSH_SUPPLY') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (action === 'CAPTURE_DEMAND') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function roleClass(role: string) {
  if (role === 'buyer') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (role === 'supplier') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (role === 'transporter') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (role === 'partner') return 'border-violet-200 bg-violet-50 text-violet-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function MapMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-slate-200 px-2 py-2 last:border-r-0">
      <div className="text-[10px] font-semibold uppercase text-slate-500">{label}</div>
      <div className="font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function formatRouteTime(value: string | null) {
  if (!value) return 'None';
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

function commodityKey(item: CommodityGeography) {
  return `${item.state}__${item.commodity}__${item.stateRank}`;
}

function commodityOffset(rank: number, index: number) {
  const offsets = [
    { x: 0, y: -6 },
    { x: 7, y: 0 },
    { x: -7, y: 4 },
    { x: 3, y: 7 },
  ];
  return offsets[(rank || index) % offsets.length];
}

function exportVisibleLanes(routes: RouteActivity[]) {
  downloadCsv(
    'mandiplus-visible-gadi-lanes',
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
      'invoice_count',
      'gmv',
      'urgency_score',
      'active_vehicle_share',
      'latest_trip_at',
      'latest_active_trip_at',
      'operator_action',
      'active_vehicles',
      'sample_vehicles',
    ],
    routes.map((route) => [
      route.source,
      route.destination,
      route.sourceState || '',
      route.destinationState || '',
      route.topCommodity || '',
      route.movementStatus,
      route.vehicleCount,
      route.activeTrips,
      route.tripCount,
      route.invoiceCount,
      route.gmv,
      route.urgencyScore,
      route.activeVehicleShare,
      route.latestTripAt || '',
      route.latestActiveTripAt || '',
      route.operatorAction,
      route.activeVehicles.join(' | '),
      route.sampleVehicles.join(' | '),
    ]),
  );
}

function exportLaneVehicles(route: RouteActivity) {
  downloadCsv(
    `mandiplus-gadi-${route.source}-to-${route.destination}`,
    ['vehicle_number', 'status', 'latest_trip_at', 'trip_count', 'invoice_count', 'gmv', 'commodity'],
    route.vehicleEvidence.map((vehicle) => [
      vehicle.vehicleNumber,
      vehicle.status || '',
      vehicle.latestTripAt || '',
      vehicle.tripCount,
      vehicle.invoiceCount,
      vehicle.gmv,
      vehicle.commodity || '',
    ]),
  );
}

async function copyLaneBrief(
  route: RouteActivity,
  setCopiedLaneKey: (value: string) => void,
) {
  const activeVehicles = route.activeVehicles.length
    ? `Active gadi: ${route.activeVehicles.slice(0, 8).join(', ')}.`
    : '';
  const sampleVehicles = !route.activeVehicles.length && route.sampleVehicles.length
    ? `Sample gadi: ${route.sampleVehicles.slice(0, 8).join(', ')}.`
    : '';
  const contacts = route.contactEvidence.length
    ? `Call: ${route.contactEvidence.slice(0, 3).map((contact) => `${contact.name} ${contact.mobileNumber}`).join('; ')}.`
    : '';
  const text = [
    `MandiPlus lane brief: ${route.source} to ${route.destination}.`,
    `${route.vehicleCount} gadi, ${route.activeTrips} active, ${route.tripCount} trips, urgency ${route.urgencyScore}/100.`,
    route.topCommodity ? `Commodity: ${route.topCommodity}.` : '',
    route.manifestSummary,
    route.operatorAction,
    activeVehicles,
    sampleVehicles,
    contacts,
  ].filter(Boolean).join(' ');

  try {
    await navigator.clipboard.writeText(text);
    setCopiedLaneKey(routeKey(route));
    window.setTimeout(() => setCopiedLaneKey(''), 1500);
  } catch {
    setCopiedLaneKey('');
  }
}
