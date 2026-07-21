'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Headphones,
  LocateFixed,
  RefreshCw,
  Search,
  Share2,
  Truck,
} from 'lucide-react';

import ProtectedRoute from '@/features/auth/components/ProtectedRoute';
import {
  getLiveTrackingTrips,
  getTrackingRoute,
  LiveTrackingTrip,
  LocationPoint,
  trackVehicle,
  TrackingData,
  TrackingRoute,
} from '@/features/tracking/api';
import type { FleetMapItem } from '@/components/maps/FleetGoogleMap';

const FleetGoogleMap = dynamic(() => import('@/components/maps/FleetGoogleMap'), {
  ssr: false,
  loading: () => <MapLoading label="Loading vehicles…" />,
});

const TripGoogleMap = dynamic(() => import('@/components/maps/TripGoogleMap'), {
  ssr: false,
  loading: () => <MapLoading label="Loading location…" />,
});

const REFRESH_INTERVAL_MS = 60_000;
const FLEET_HYDRATION_LIMIT = 18;

type TrackingCache = Record<string, TrackingData>;

function vehicleKey(value?: string | null) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isCoord(value?: LocationPoint | null): value is LocationPoint {
  return Boolean(
    value &&
      Number.isFinite(Number(value.lat)) &&
      Number.isFinite(Number(value.lng)),
  );
}

function shortPlace(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.split(',').map((part) => part.trim()).filter(Boolean).slice(0, 2).join(', ');
}

function relativeTime(value?: string | null) {
  if (!value) return 'Waiting for GPS';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'GPS time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Updated now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

function formatEta(tracking?: TrackingData | null, trip?: LiveTrackingTrip | null) {
  const remaining = tracking?.location?.timeRemained;
  if (remaining !== undefined && remaining !== null && String(remaining).trim()) {
    const numeric = Number(remaining);
    if (Number.isFinite(numeric)) {
      if (numeric >= 60) return `${Math.floor(numeric / 60)} hr ${Math.round(numeric % 60)} min`;
      return `${Math.max(1, Math.round(numeric))} min`;
    }
    return String(remaining);
  }
  const value = tracking?.eta || trip?.eta;
  if (!value) return 'Calculating';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function tripProgress(tracking?: TrackingData | null) {
  const travelled = Number(tracking?.location?.distanceTravel ?? 0);
  const total = Number(tracking?.location?.totalDistance ?? 0);
  if (!Number.isFinite(travelled) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((travelled / total) * 100)));
}

function MapLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#eef3fa]">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#7b8176]">
        <RefreshCw className="h-4 w-4 animate-spin text-[#203044]" />
        {label}
      </div>
    </div>
  );
}

export default function TrackingFleetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [trips, setTrips] = useState<LiveTrackingTrip[]>([]);
  const [trackingCache, setTrackingCache] = useState<TrackingCache>({});
  const [selectedTrip, setSelectedTrip] = useState<LiveTrackingTrip | null>(null);
  const [selectedTracking, setSelectedTracking] = useState<TrackingData | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<TrackingRoute | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const detailRequestRef = useRef(0);
  const preselectedVehicleRef = useRef(false);
  const hydrationRequestedRef = useRef(new Set<string>());
  const trackingCacheRef = useRef<TrackingCache>({});

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    setError(null);
    hydrationRequestedRef.current.clear();
    trackingCacheRef.current = {};
    setTrackingCache({});
    try {
      setTrips(await getLiveTrackingTrips());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load live trips');
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (!trips.length) return;
    let cancelled = false;
    const queue = trips
      .filter((trip) => !hydrationRequestedRef.current.has(vehicleKey(trip.vehicleNumber)))
      .slice(0, FLEET_HYDRATION_LIMIT);
    queue.forEach((trip) => hydrationRequestedRef.current.add(vehicleKey(trip.vehicleNumber)));

    const worker = async () => {
      while (!cancelled && queue.length) {
        const trip = queue.shift();
        if (!trip) return;
        try {
          const response = await trackVehicle(trip.vehicleNumber);
          if (cancelled) return;
          setTrackingCache((previous) => {
            const next = { ...previous, [vehicleKey(trip.vehicleNumber)]: response.data };
            trackingCacheRef.current = next;
            return next;
          });
        } catch {
          // Keep the trip visible even when its latest GPS point is unavailable.
        }
      }
    };

    void Promise.all([worker(), worker(), worker()]);
    return () => {
      cancelled = true;
    };
  }, [trips]);

  const openTrip = useCallback(async (trip: LiveTrackingTrip, silent = false) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedTrip(trip);
    setDetailError(null);
    const cached = trackingCacheRef.current[vehicleKey(trip.vehicleNumber)] ?? null;
    if (cached) setSelectedTracking(cached);
    if (!silent) setLoadingDetail(true);

    const [trackingResult, routeResult] = await Promise.allSettled([
      trackVehicle(trip.vehicleNumber),
      getTrackingRoute(trip.vehicleNumber),
    ]);
    if (requestId !== detailRequestRef.current) return;

    if (trackingResult.status === 'fulfilled') {
      setSelectedTracking(trackingResult.value.data);
      setTrackingCache((previous) => {
        const next = { ...previous, [vehicleKey(trip.vehicleNumber)]: trackingResult.value.data };
        trackingCacheRef.current = next;
        return next;
      });
    } else if (!cached) {
      setSelectedTracking(null);
      setDetailError(
        (trackingResult.reason as { message?: string })?.message || 'Live location unavailable',
      );
    }

    if (routeResult.status === 'fulfilled') setSelectedRoute(routeResult.value);
    else if (!silent) setSelectedRoute(null);
    if (!silent) setLoadingDetail(false);
  }, []);

  useEffect(() => {
    const requestedVehicle = vehicleKey(searchParams.get('vehicle') || searchParams.get('v'));
    if (!requestedVehicle || preselectedVehicleRef.current || !trips.length) return;
    const match = trips.find((trip) => vehicleKey(trip.vehicleNumber) === requestedVehicle);
    if (!match) return;
    preselectedVehicleRef.current = true;
    void openTrip(match);
  }, [openTrip, searchParams, trips]);

  useEffect(() => {
    if (!selectedTrip) return;
    const interval = window.setInterval(() => void openTrip(selectedTrip, true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [openTrip, selectedTrip]);

  const filteredTrips = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return trips;
    return trips.filter((trip) =>
      [trip.vehicleNumber, trip.route, trip.sourceName, trip.destinationName, trip.product, trip.invoiceNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [query, trips]);

  const fleetMapItems = useMemo<FleetMapItem[]>(() => {
    return trips.flatMap((trip) => {
      const tracking = trackingCache[vehicleKey(trip.vehicleNumber)];
      if (!isCoord(tracking?.location)) return [];
      return [{
        id: trip.id,
        vehicleNumber: trip.vehicleNumber,
        current: { lat: tracking.location.lat, lng: tracking.location.lng },
        isOnline: tracking.status === 'online',
      }];
    });
  }, [trackingCache, trips]);

  const mapCenter = useMemo<LocationPoint>(() => {
    if (isCoord(selectedTracking?.location)) return selectedTracking.location;
    if (isCoord(selectedTracking?.destination)) return selectedTracking.destination;
    return { lat: 22.9734, lng: 78.6569 };
  }, [selectedTracking]);

  const progress = tripProgress(selectedTracking);
  const sourceName = shortPlace(selectedTracking?.originLabel || selectedTrip?.sourceName) || 'Route start';
  const destinationName = shortPlace(selectedTracking?.destinationLabel || selectedTrip?.destinationName) || 'Route end';
  const currentName = shortPlace(selectedTracking?.location?.address) || 'Live location';

  const goBack = () => {
    if (selectedTrip) {
      detailRequestRef.current += 1;
      setSelectedTrip(null);
      setSelectedTracking(null);
      setSelectedRoute(null);
      setDetailError(null);
      return;
    }
    if (window.history.length > 1) router.back();
    else router.push('/home');
  };

  return (
    <ProtectedRoute>
      <main
        className="min-h-screen bg-[#f5f6fb] pb-8 text-[#171914]"
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        <header className="border-b border-[#e7ebf3] bg-white px-5 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e7ebf3] bg-white text-[#203044] transition active:scale-95"
                aria-label={selectedTrip ? 'Back to vehicles' : 'Go back'}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black text-[#171914]">
                  {selectedTrip ? selectedTrip.vehicleNumber : 'Track Vehicle'}
                </h1>
                <p className="mt-0.5 truncate text-xs font-semibold text-[#7b8176]">
                  {selectedTrip ? relativeTime(selectedTracking?.location?.timeRecorded) : `${trips.length} live vehicles`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => selectedTrip ? void openTrip(selectedTrip) : void loadTrips()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e7ebf3] bg-[#f8f9fd] text-[#203044] transition active:scale-95"
              aria-label="Refresh tracking"
            >
              <RefreshCw className={`h-4 w-4 ${loadingTrips || loadingDetail ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {selectedTrip ? (
          <TripDetail
            trip={selectedTrip}
            tracking={selectedTracking}
            route={selectedRoute}
            loading={loadingDetail}
            error={detailError}
            center={mapCenter}
            currentName={currentName}
            sourceName={sourceName}
            destinationName={destinationName}
            progress={progress}
          />
        ) : (
          <section className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-5">
            {error ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#f2d7d2] bg-[#fff7f5] px-4 py-3 text-sm font-semibold text-[#a63f35]">
                <span>Could not load vehicles</span>
                <button type="button" onClick={() => void loadTrips()} className="font-black">Retry</button>
              </div>
            ) : null}

            <div className="relative h-[340px] overflow-hidden rounded-[24px] border border-[#e7ebf3] bg-[#eef3fa] shadow-[0_10px_24px_rgba(32,48,68,0.06)] sm:h-[420px]">
              {fleetMapItems.length ? (
                <FleetGoogleMap
                  vehicles={fleetMapItems}
                  onVehicleSelect={(item) => {
                    const match = trips.find((trip) => trip.id === item.id);
                    if (match) void openTrip(match);
                  }}
                />
              ) : (
                <MapLoading label={loadingTrips ? 'Loading vehicles…' : 'Waiting for GPS…'} />
              )}
              <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-[#e7ebf3] bg-white/95 px-3 py-2 text-xs font-black text-[#203044] shadow-sm">
                {loadingTrips ? 'Updating…' : `${trips.length} live`}
              </div>
            </div>

            <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#e7ebf3] bg-white px-4 shadow-sm focus-within:ring-2 focus-within:ring-[#cbd5e1]">
              <Search className="h-4 w-4 shrink-0 text-[#7b8176]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search vehicle"
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#171914] outline-none placeholder:text-[#a8b0bd]"
              />
            </div>

            <div className="overflow-hidden rounded-[22px] border border-[#e7ebf3] bg-white">
              {loadingTrips ? (
                <VehicleListSkeleton />
              ) : filteredTrips.length ? (
                filteredTrips.map((trip, index) => (
                  <VehicleRow
                    key={trip.id}
                    trip={trip}
                    tracking={trackingCache[vehicleKey(trip.vehicleNumber)]}
                    onClick={() => void openTrip(trip)}
                    last={index === filteredTrips.length - 1}
                  />
                ))
              ) : (
                <div className="px-4 py-8 text-center">
                  <Truck className="mx-auto h-6 w-6 text-[#203044]" />
                  <p className="mt-3 text-sm font-black text-[#171914]">
                    {trips.length ? 'No vehicle found' : 'No live vehicles'}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}

function VehicleRow({
  trip,
  tracking,
  onClick,
  last,
}: {
  trip: LiveTrackingTrip;
  tracking?: TrackingData;
  onClick: () => void;
  last: boolean;
}) {
  const location = shortPlace(tracking?.location?.address || trip.lastLocation?.address);
  const route = trip.route || [trip.sourceName, trip.destinationName].filter(Boolean).join(' → ');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition active:bg-[#f8f9fd] ${last ? '' : 'border-b border-[#e7ebf3]'}`}
    >
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef3fa] text-[#203044]">
        <Truck className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#22a66b]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-black text-[#171914]">{trip.vehicleNumber}</p>
          <span className="rounded-full bg-[#eef3fa] px-2 py-0.5 text-[10px] font-black text-[#203044]">Live</span>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-[#7b8176]">
          {location || route || relativeTime(trip.updatedAt)}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#9aa4b2]" />
    </button>
  );
}

function VehicleListSkeleton() {
  return (
    <div className="divide-y divide-[#e7ebf3]">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex h-[72px] animate-pulse items-center gap-3 px-4">
          <div className="h-11 w-11 rounded-2xl bg-[#eef3fa]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded bg-[#e1e6ef]" />
            <div className="h-2.5 w-2/3 rounded bg-[#eef1f6]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TripDetail({
  trip,
  tracking,
  route,
  loading,
  error,
  center,
  currentName,
  sourceName,
  destinationName,
  progress,
}: {
  trip: LiveTrackingTrip;
  tracking: TrackingData | null;
  route: TrackingRoute | null;
  loading: boolean;
  error: string | null;
  center: LocationPoint;
  currentName: string;
  sourceName: string;
  destinationName: string;
  progress: number;
}) {
  const isOnline = tracking?.status === 'online';
  const headline = isOnline ? `${currentName} → ${destinationName}` : currentName;

  const shareTrip = async () => {
    const url = tracking?.shareUrl || window.location.href;
    if (navigator.share) {
      await navigator.share({ title: trip.vehicleNumber, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url);
  };

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-5">
      {error ? (
        <div className="rounded-2xl border border-[#f2d7d2] bg-[#fff7f5] px-4 py-3 text-sm font-semibold text-[#a63f35]">
          {error}
        </div>
      ) : null}

      <div className="relative h-[390px] overflow-hidden rounded-[24px] border border-[#e7ebf3] bg-[#eef3fa] shadow-[0_10px_24px_rgba(32,48,68,0.06)] sm:h-[520px]">
        {loading && !tracking ? (
          <MapLoading label="Loading location…" />
        ) : (
          <TripGoogleMap
            center={center}
            current={isCoord(tracking?.location) ? tracking.location : null}
            source={isCoord(tracking?.origin) ? tracking.origin : null}
            destination={isCoord(tracking?.destination) ? tracking.destination : null}
            routePoints={route?.points || []}
            currentLabel={currentName}
            sourceLabel={sourceName}
            destinationLabel={destinationName}
            zoom={16}
            followMode={isOnline}
            lastGpsRecordedAt={tracking?.location?.timeRecorded || null}
            isOnline={isOnline}
            routeDistanceMeters={route?.distanceMeters ?? null}
            routeDurationSeconds={route?.durationSeconds ?? null}
          />
        )}
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-[#e7ebf3] bg-white/95 px-3 py-2 text-xs font-black text-[#203044] shadow-sm">
          <span className={`h-2 w-2 rounded-full ${isOnline ? 'animate-pulse bg-[#22a66b]' : 'bg-[#c88d37]'}`} />
          {isOnline ? 'On the way' : 'Last location'}
        </div>
      </div>

      <div className="rounded-[24px] border border-[#e7ebf3] bg-white p-5 shadow-[0_10px_24px_rgba(32,48,68,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-[#171914]">{trip.vehicleNumber}</h2>
            <p className="mt-2 truncate text-sm font-semibold text-[#7b8176]">{headline}</p>
          </div>
          <p className="shrink-0 rounded-full bg-[#eef3fa] px-3 py-1.5 text-xs font-black text-[#203044]">
            {isOnline ? 'Live' : 'Paused'}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] gap-4 border-y border-[#e7ebf3] py-4">
          <RoutePoint label="From" value={sourceName} />
          <div className="w-px bg-[#e7ebf3]" />
          <RoutePoint label="To" value={destinationName} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#f8f9fd] p-3">
            <div className="flex items-center gap-2 text-[#203044]">
              <Clock3 className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.1em]">Arrival</span>
            </div>
            <p className="mt-2 truncate text-sm font-black text-[#171914]">{formatEta(tracking, trip)}</p>
          </div>
          <div className="rounded-2xl bg-[#f8f9fd] p-3">
            <div className="flex items-center gap-2 text-[#203044]">
              <LocateFixed className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.1em]">Progress</span>
            </div>
            <p className="mt-2 text-sm font-black text-[#171914]">{progress ? `${progress}%` : 'Live'}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href={`https://wa.me/919900186757?text=${encodeURIComponent(`Hi MandiPlus, I need help tracking ${trip.vehicleNumber}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d7deea] bg-white px-4 text-sm font-black text-[#203044]"
          >
            <Headphones className="h-4 w-4" />
            Help
          </a>
          <button
            type="button"
            onClick={() => void shareTrip()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#203044] px-4 text-sm font-black text-white"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>
    </section>
  );
}

function RoutePoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#7b8176]">{label}</p>
      <p className="mt-2 line-clamp-2 text-sm font-black text-[#171914]">{value}</p>
    </div>
  );
}
