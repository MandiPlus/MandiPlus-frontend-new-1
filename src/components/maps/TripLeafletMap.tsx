'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';

export type MapCoord = { lat: number; lng: number };

type TripLeafletMapProps = {
  center: MapCoord;
  current?: MapCoord | null;
  source?: MapCoord | null;
  destination?: MapCoord | null;
  routePoints?: MapCoord[];
  currentLabel?: string;
  sourceLabel?: string;
  destinationLabel?: string;
  zoom?: number;
  followMode?: boolean;
  isOnline?: boolean;
  lastGpsRecordedAt?: string | null;
  routeDistanceMeters?: number | null;
  routeDurationSeconds?: number | null;
  className?: string;
};

const DEFAULT_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DEFAULT_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; OpenStreetMap contributors &copy; CARTO';

function isCoord(value?: MapCoord | null): value is MapCoord {
  return (
    Boolean(value) &&
    typeof value?.lat === 'number' &&
    typeof value?.lng === 'number' &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng)
  );
}

function toLatLng(coord: MapCoord): LatLngExpression {
  return [coord.lat, coord.lng];
}

function normalizePoints(values: Array<MapCoord | null | undefined>) {
  const points: MapCoord[] = [];
  values.forEach((value) => {
    if (!isCoord(value)) return;
    const previous = points.at(-1);
    if (
      previous &&
      Math.abs(previous.lat - value.lat) < 0.00001 &&
      Math.abs(previous.lng - value.lng) < 0.00001
    ) {
      return;
    }
    points.push({ lat: Number(value.lat), lng: Number(value.lng) });
  });
  return points;
}

function distanceSquared(first: MapCoord, second: MapCoord) {
  const latitudeScale = 111_320;
  const longitudeScale = Math.max(
    1,
    latitudeScale * Math.cos((((first.lat + second.lat) / 2) * Math.PI) / 180),
  );
  const x = (first.lng - second.lng) * longitudeScale;
  const y = (first.lat - second.lat) * latitudeScale;
  return x ** 2 + y ** 2;
}

function orientRoute(
  points: MapCoord[],
  source?: MapCoord | null,
  destination?: MapCoord | null,
) {
  if (points.length < 2 || (!isCoord(source) && !isCoord(destination))) return points;
  const first = points[0];
  const last = points.at(-1) as MapCoord;
  const forward =
    (isCoord(source) ? distanceSquared(first, source) : 0) +
    (isCoord(destination) ? distanceSquared(last, destination) : 0);
  const reverse =
    (isCoord(source) ? distanceSquared(last, source) : 0) +
    (isCoord(destination) ? distanceSquared(first, destination) : 0);
  return reverse < forward ? [...points].reverse() : points;
}

function splitRouteAtCurrent(points: MapCoord[], current?: MapCoord | null) {
  if (points.length < 2 || !isCoord(current)) {
    return { completed: [] as MapCoord[], remaining: points, heading: 0 };
  }

  let bestIndex = 1;
  let bestRatio = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const latitudeScale = 111_320;
    const longitudeScale = Math.max(
      1,
      latitudeScale * Math.cos((((start.lat + end.lat) / 2) * Math.PI) / 180),
    );
    const segmentX = (end.lng - start.lng) * longitudeScale;
    const segmentY = (end.lat - start.lat) * latitudeScale;
    const pointX = (current.lng - start.lng) * longitudeScale;
    const pointY = (current.lat - start.lat) * latitudeScale;
    const lengthSquared = segmentX ** 2 + segmentY ** 2;
    const ratio = lengthSquared
      ? Math.max(0, Math.min(1, (pointX * segmentX + pointY * segmentY) / lengthSquared))
      : 0;
    const projected = {
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio,
    };
    const candidateDistance = distanceSquared(projected, current);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestIndex = index;
      bestRatio = ratio;
    }
  }

  const start = points[bestIndex - 1];
  const end = points[bestIndex];
  const projected = {
    lat: start.lat + (end.lat - start.lat) * bestRatio,
    lng: start.lng + (end.lng - start.lng) * bestRatio,
  };
  const heading =
    ((Math.atan2(end.lng - start.lng, end.lat - start.lat) * 180) / Math.PI + 360) % 360;

  return {
    completed: normalizePoints([...points.slice(0, bestIndex), projected]),
    remaining: normalizePoints([projected, ...points.slice(bestIndex)]),
    heading,
  };
}

function createFlagIcon(tone: 'source' | 'destination') {
  const palette =
    tone === 'source'
      ? { pole: '#166534', fill: '#22c55e', ring: '#bbf7d0' }
      : { pole: '#991b1b', fill: '#ef4444', ring: '#fecaca' };

  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [10, 29],
    html: `
      <div style="width:34px;height:34px;filter:drop-shadow(0 6px 10px rgba(15,23,42,.22));">
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="9" cy="29" r="3" fill="${palette.ring}" stroke="${palette.pole}" stroke-width="1.5"/>
          <path d="M9 4v25" stroke="${palette.pole}" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M10 5h13l-3 6 3 6H10z" fill="${palette.fill}" stroke="${palette.pole}" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
    `,
  });
}

function createTruckIcon(isOnline: boolean, heading: number) {
  return L.divIcon({
    className: '',
    iconSize: [78, 78],
    iconAnchor: [39, 39],
    tooltipAnchor: [0, -35],
    html: `
      <div class="tracking-leaflet-truck${isOnline ? ' is-online' : ''}">
        <span class="tracking-truck-pulse"></span>
        <img src="/images/truck-marker.svg" alt="" style="transform:translate(-50%,-50%) rotate(${heading}deg)" />
      </div>
    `,
  });
}

function MapViewport({
  center,
  points,
  zoom,
  followMode,
}: {
  center: MapCoord;
  points: MapCoord[];
  zoom: number;
  followMode: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (followMode && points.length) {
      map.setView(toLatLng(points[0]), zoom, { animate: true });
      return;
    }

    if (points.length > 1) {
      const bounds = points.map(toLatLng) as LatLngBoundsExpression;
      map.fitBounds(bounds, {
        padding: [44, 44],
        maxZoom: 13,
      });
      return;
    }

    map.setView(toLatLng(points[0] || center), zoom);
  }, [center, followMode, map, points, zoom]);

  return null;
}

export default function TripLeafletMap({
  center,
  current,
  source,
  destination,
  routePoints = [],
  currentLabel = 'Current location',
  sourceLabel = 'Source',
  destinationLabel = 'Destination',
  zoom = 11,
  followMode = false,
  isOnline = false,
  className,
}: TripLeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const sourceIcon = useMemo(() => createFlagIcon('source'), []);
  const destinationIcon = useMemo(() => createFlagIcon('destination'), []);
  const route = useMemo(
    () => orientRoute(
      normalizePoints(routePoints.length > 1 ? routePoints : [source, current, destination]),
      source,
      destination,
    ),
    [current, destination, routePoints, source],
  );
  const routeState = useMemo(() => splitRouteAtCurrent(route, current), [current, route]);
  const truckIcon = useMemo(
    () => createTruckIcon(isOnline, routeState.heading),
    [isOnline, routeState.heading],
  );
  const viewportPoints = useMemo(
    () => followMode && isCoord(current)
      ? [current]
      : normalizePoints([current, source, destination, ...route]),
    [current, destination, followMode, route, source],
  );
  const mapCenter = useMemo(
    () => isCoord(center) ? center : { lat: 22.9734, lng: 78.6569 },
    [center],
  );
  const recenter = useCallback(() => {
    const target = isCoord(current) ? current : mapCenter;
    mapRef.current?.setView(toLatLng(target), followMode ? Math.max(zoom, 16) : zoom, {
      animate: true,
    });
  }, [current, followMode, mapCenter, zoom]);

  return (
    <div className={className ? `relative h-full w-full overflow-hidden ${className}` : 'relative h-full w-full overflow-hidden'}>
      <MapContainer
        center={toLatLng(mapCenter)}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        zoomControl
        ref={mapRef}
      >
        <TileLayer
          attribution={DEFAULT_ATTRIBUTION}
          maxZoom={19}
          referrerPolicy="strict-origin-when-cross-origin"
          url={DEFAULT_TILE_URL}
        />
        <MapViewport
          center={mapCenter}
          points={viewportPoints}
          zoom={followMode ? Math.max(zoom, 16) : zoom}
          followMode={followMode}
        />

        {routeState.completed.length > 1 ? (
          <Polyline
            positions={routeState.completed.map(toLatLng)}
            pathOptions={{ color: '#203044', opacity: 0.96, weight: 7 }}
          />
        ) : null}
        {routeState.remaining.length > 1 ? (
          <Polyline
            positions={routeState.remaining.map(toLatLng)}
            pathOptions={{ color: '#2563eb', opacity: 0.9, weight: 6 }}
          />
        ) : null}

        {isCoord(source) ? (
          <Marker position={toLatLng(source)} icon={sourceIcon}>
            <Tooltip direction="top" offset={[0, -24]}>
              {sourceLabel}
            </Tooltip>
          </Marker>
        ) : null}

        {isCoord(destination) ? (
          <Marker position={toLatLng(destination)} icon={destinationIcon}>
            <Tooltip direction="top" offset={[0, -24]}>
              {destinationLabel}
            </Tooltip>
          </Marker>
        ) : null}

        {isCoord(current) ? (
          <Marker position={toLatLng(current)} icon={truckIcon} zIndexOffset={1000}>
            <Tooltip direction="top" offset={[0, -28]}>
              {currentLabel}
            </Tooltip>
          </Marker>
        ) : null}
      </MapContainer>

      <button
        type="button"
        onClick={recenter}
        aria-label="Recenter vehicle"
        className="absolute bottom-4 right-4 z-[500] flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#171914] shadow-[0_8px_18px_rgba(23,25,20,0.22)] active:scale-95"
      >
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="12" cy="12" r="1.7" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
