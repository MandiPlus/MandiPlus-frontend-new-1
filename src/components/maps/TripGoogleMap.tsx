'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, MarkerF, PolylineF, useLoadScript } from '@react-google-maps/api';

export type MapCoord = { lat: number; lng: number };

type TripGoogleMapProps = {
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
  lastGpsRecordedAt?: string | null;
  isOnline?: boolean;
  routeDistanceMeters?: number | null;
  routeDurationSeconds?: number | null;
  className?: string;
};

type RouteMetrics = {
  points: MapCoord[];
  cumulative: number[];
  totalDistance: number;
};

type RouteState = {
  metrics: RouteMetrics;
  startPoint: MapCoord | null;
  startDistance: number;
  maxDistance: number;
  speedMps: number;
  initialBearing: number;
  completed: MapCoord[];
  remaining: MapCoord[];
};

type TruckOverlay = google.maps.OverlayView & {
  getPosition: () => MapCoord;
  setPosition: (position: MapCoord) => void;
  setRotation: (degrees: number) => void;
};

const FOLLOW_ZOOM = 16;
const MAX_DEAD_RECKON_SECONDS = 45 * 60;
const mapContainerStyle = { width: '100%', height: '100%' };

function isCoord(value?: MapCoord | null): value is MapCoord {
  return (
    Boolean(value) &&
    typeof value?.lat === 'number' &&
    typeof value?.lng === 'number' &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng)
  );
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

function orientRouteTowardDestination(
  points: MapCoord[],
  source?: MapCoord | null,
  destination?: MapCoord | null,
) {
  if (points.length < 2 || (!isCoord(source) && !isCoord(destination))) return points;
  const first = points[0];
  const last = points.at(-1) as MapCoord;
  const forwardScore =
    (isCoord(source) ? distanceMeters(first, source) : 0) +
    (isCoord(destination) ? distanceMeters(last, destination) : 0);
  const reverseScore =
    (isCoord(source) ? distanceMeters(last, source) : 0) +
    (isCoord(destination) ? distanceMeters(first, destination) : 0);
  return reverseScore + 5 < forwardScore ? [...points].reverse() : points;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(first: MapCoord, second: MapCoord) {
  const radius = 6_371_000;
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLng = toRadians(second.lng - first.lng);
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function bearing(first: MapCoord, second: MapCoord) {
  if (distanceMeters(first, second) < 0.5) return 0;
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const deltaLng = toRadians(second.lng - first.lng);
  const y = Math.sin(deltaLng) * Math.cos(secondLat);
  const x =
    Math.cos(firstLat) * Math.sin(secondLat) -
    Math.sin(firstLat) * Math.cos(secondLat) * Math.cos(deltaLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function normalizeBearing(value: number) {
  if (!Number.isFinite(value)) return 0;
  return ((value % 360) + 360) % 360;
}

function continuousBearing(previous: number, target: number) {
  const shortestTurn = ((normalizeBearing(target) - normalizeBearing(previous) + 540) % 360) - 180;
  return previous + shortestTurn;
}

function buildMetrics(points: MapCoord[]): RouteMetrics {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distanceMeters(points[index - 1], points[index]));
  }
  return { points, cumulative, totalDistance: cumulative.at(-1) || 0 };
}

function pointAtDistance(metrics: RouteMetrics, targetDistance: number): MapCoord {
  const { points, cumulative, totalDistance } = metrics;
  if (!points.length) return { lat: 22.9734, lng: 78.6569 };
  if (points.length === 1 || targetDistance <= 0) return points[0];
  if (targetDistance >= totalDistance) return points.at(-1) as MapCoord;

  let low = 1;
  let high = cumulative.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (cumulative[middle] < targetDistance) low = middle + 1;
    else high = middle;
  }

  const endIndex = low;
  const startIndex = endIndex - 1;
  const segmentDistance = cumulative[endIndex] - cumulative[startIndex];
  const ratio = segmentDistance
    ? (targetDistance - cumulative[startIndex]) / segmentDistance
    : 0;
  const start = points[startIndex];
  const end = points[endIndex];
  return {
    lat: start.lat + (end.lat - start.lat) * ratio,
    lng: start.lng + (end.lng - start.lng) * ratio,
  };
}

function lineUntilDistance(metrics: RouteMetrics, targetDistance: number) {
  if (!metrics.points.length) return [];
  if (targetDistance <= 0) return [metrics.points[0]];
  const next: MapCoord[] = [];
  for (let index = 0; index < metrics.points.length; index += 1) {
    if (metrics.cumulative[index] >= targetDistance) break;
    next.push(metrics.points[index]);
  }
  next.push(pointAtDistance(metrics, targetDistance));
  return normalizePoints(next);
}

function lineFromDistance(metrics: RouteMetrics, targetDistance: number) {
  if (!metrics.points.length) return [];
  if (targetDistance <= 0) return metrics.points;
  const firstRemainingIndex = metrics.cumulative.findIndex((value) => value >= targetDistance);
  if (firstRemainingIndex < 0) return [metrics.points.at(-1) as MapCoord];
  return normalizePoints([
    pointAtDistance(metrics, targetDistance),
    ...metrics.points.slice(firstRemainingIndex),
  ]);
}

function projectPointOnRoute(metrics: RouteMetrics, current: MapCoord) {
  if (metrics.points.length < 2) return 0;
  let bestDistanceToRoute = Number.POSITIVE_INFINITY;
  let bestDistanceFromStart = 0;

  for (let index = 1; index < metrics.points.length; index += 1) {
    const start = metrics.points[index - 1];
    const end = metrics.points[index];
    const latitudeScale = 111_320;
    const longitudeScale = Math.max(1, 111_320 * Math.cos(toRadians((start.lat + end.lat) / 2)));
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
    const distanceToRoute = distanceMeters(current, projected);
    if (distanceToRoute < bestDistanceToRoute) {
      bestDistanceToRoute = distanceToRoute;
      bestDistanceFromStart =
        metrics.cumulative[index - 1] +
        (metrics.cumulative[index] - metrics.cumulative[index - 1]) * ratio;
    }
  }

  return bestDistanceFromStart;
}

function inferredSpeedMps(distance?: number | null, duration?: number | null) {
  const routeSpeed = Number(distance) > 0 && Number(duration) > 0
    ? Number(distance) / Number(duration)
    : 0;
  return Math.max(3, Math.min(19, routeSpeed || 12.5));
}

function simulationMaxDistance(startDistance: number, totalDistance: number) {
  const remaining = Math.max(0, totalDistance - startDistance);
  const holdBeforeDestination = Math.min(1200, Math.max(80, remaining * 0.08));
  return Math.max(startDistance, totalDistance - holdBeforeDestination);
}

function secondsSince(value?: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(0, (Date.now() - parsed) / 1000) : 0;
}

function routeHeadingAtDistance(metrics: RouteMetrics, distance: number, speedMps: number) {
  const currentPoint = pointAtDistance(metrics, distance);
  const lookDistance = Math.max(35, speedMps * 5);
  const ahead = pointAtDistance(
    metrics,
    Math.min(metrics.totalDistance, distance + lookDistance),
  );
  if (distanceMeters(currentPoint, ahead) >= 0.5) return bearing(currentPoint, ahead);
  const behind = pointAtDistance(metrics, Math.max(0, distance - lookDistance));
  return bearing(behind, currentPoint);
}

function createRouteState(
  points: MapCoord[],
  current: MapCoord | null | undefined,
  lastGpsRecordedAt: string | null | undefined,
  routeDistanceMeters: number | null | undefined,
  routeDurationSeconds: number | null | undefined,
): RouteState {
  const metrics = buildMetrics(points);
  const speedMps = inferredSpeedMps(routeDistanceMeters || metrics.totalDistance, routeDurationSeconds);
  if (!points.length) {
    return {
      metrics,
      startPoint: current || null,
      startDistance: 0,
      maxDistance: 0,
      speedMps,
      initialBearing: 0,
      completed: [],
      remaining: [],
    };
  }

  const projectedDistance = current ? projectPointOnRoute(metrics, current) : 0;
  const deadReckonedMeters = Math.min(MAX_DEAD_RECKON_SECONDS, secondsSince(lastGpsRecordedAt)) * speedMps;
  const maxForwardFromGps = Math.min(45_000, Math.max(1_500, metrics.totalDistance * 0.28));
  const startDistance = Math.min(
    simulationMaxDistance(projectedDistance, metrics.totalDistance),
    projectedDistance + Math.min(deadReckonedMeters, maxForwardFromGps),
  );
  const maxDistance = simulationMaxDistance(startDistance, metrics.totalDistance);
  const startPoint = pointAtDistance(metrics, startDistance);

  return {
    metrics,
    startPoint,
    startDistance,
    maxDistance,
    speedMps,
    initialBearing: routeHeadingAtDistance(metrics, startDistance, speedMps),
    completed: lineUntilDistance(metrics, startDistance),
    remaining: lineFromDistance(metrics, startDistance),
  };
}

function buildFlagSvg(tone: 'source' | 'destination') {
  const palette = tone === 'source'
    ? { pole: '#166534', fill: '#22c55e', ring: '#bbf7d0' }
    : { pole: '#991b1b', fill: '#ef4444', ring: '#fecaca' };

  return encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="9" cy="29" r="3" fill="${palette.ring}" stroke="${palette.pole}" stroke-width="1.5"/>
      <path d="M9 4v25" stroke="${palette.pole}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M10 5h13l-3 6 3 6H10z" fill="${palette.fill}" stroke="${palette.pole}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
  `);
}

function createTruckOverlay(
  map: google.maps.Map,
  initialPosition: MapCoord,
  initialBearing: number,
  isOnline: boolean,
): TruckOverlay {
  class LiveTruckOverlay extends google.maps.OverlayView {
    private position = initialPosition;
    private rotation = initialBearing;
    private element: HTMLDivElement | null = null;

    onAdd() {
      const element = document.createElement('div');
      element.className = `tracking-truck-overlay${isOnline ? ' is-online' : ''}`;
      element.innerHTML =
        '<span class="tracking-truck-pulse"></span><img src="/images/truck-marker.svg" alt="" />';
      this.element = element;
      this.getPanes()?.overlayMouseTarget.appendChild(element);
      this.applyRotation();
    }

    draw() {
      if (!this.element) return;
      const pixel = this.getProjection().fromLatLngToDivPixel(this.position);
      if (!pixel) return;
      this.element.style.left = `${pixel.x}px`;
      this.element.style.top = `${pixel.y}px`;
    }

    onRemove() {
      this.element?.remove();
      this.element = null;
    }

    getPosition() {
      return this.position;
    }

    setPosition(position: MapCoord) {
      this.position = position;
      this.draw();
    }

    setRotation(degrees: number) {
      this.rotation = Number.isFinite(degrees) ? degrees : this.rotation;
      this.applyRotation();
    }

    private applyRotation() {
      if (!this.element) return;
      const heading = normalizeBearing(this.rotation);
      this.element.style.setProperty('--truck-heading', `${heading}deg`);
      this.element.dataset.heading = heading.toFixed(1);
    }
  }

  const overlay = new LiveTruckOverlay();
  overlay.setMap(map);
  return overlay;
}

export default function TripGoogleMap({
  center,
  current,
  source,
  destination,
  routePoints = [],
  sourceLabel = 'Source',
  destinationLabel = 'Destination',
  zoom = FOLLOW_ZOOM,
  followMode = true,
  lastGpsRecordedAt,
  isOnline = false,
  routeDistanceMeters,
  routeDurationSeconds,
  className,
}: TripGoogleMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const truckOverlayRef = useRef<TruckOverlay | null>(null);
  const completedLineRef = useRef<google.maps.Polyline | null>(null);
  const remainingLineRef = useRef<google.maps.Polyline | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cameraFrameRef = useRef(0);
  const routeFrameRef = useRef(0);
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded, loadError } = useLoadScript({
    id: 'mandiplus-google-maps',
    googleMapsApiKey: mapsApiKey,
    preventGoogleFontsLoading: true,
  });

  const mapCenter = useMemo(
    () => (isCoord(center) ? center : { lat: 22.9734, lng: 78.6569 }),
    [center],
  );
  const validRoutePoints = useMemo(() => {
    const route = normalizePoints(routePoints);
    const points = route.length > 1
      ? route
      : normalizePoints([source, current, destination]);
    return orientRouteTowardDestination(points, source, destination);
  }, [current, destination, routePoints, source]);
  const routeState = useMemo(
    () => createRouteState(
      validRoutePoints,
      current,
      lastGpsRecordedAt,
      routeDistanceMeters,
      routeDurationSeconds,
    ),
    [current, lastGpsRecordedAt, routeDistanceMeters, routeDurationSeconds, validRoutePoints],
  );

  const sourceFlagIcon = useMemo(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${buildFlagSvg('source')}`,
      scaledSize: new window.google.maps.Size(34, 34),
      anchor: new window.google.maps.Point(10, 29),
    };
  }, [isLoaded]);

  const destinationFlagIcon = useMemo(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${buildFlagSvg('destination')}`,
      scaledSize: new window.google.maps.Size(34, 34),
      anchor: new window.google.maps.Point(10, 29),
    };
  }, [isLoaded]);

  const recenter = useCallback(() => {
    if (!map) return;
    const target = truckOverlayRef.current?.getPosition() || routeState.startPoint || current || mapCenter;
    map.panTo(target);
    map.setZoom(FOLLOW_ZOOM);
  }, [current, map, mapCenter, routeState.startPoint]);

  useEffect(() => {
    if (!map || !routeState.startPoint || typeof window === 'undefined' || !window.google?.maps) return;

    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    truckOverlayRef.current?.setMap(null);
    const overlay = createTruckOverlay(map, routeState.startPoint, routeState.initialBearing, isOnline);
    truckOverlayRef.current = overlay;
    completedLineRef.current?.setPath(routeState.completed);
    remainingLineRef.current?.setPath(routeState.remaining);

    if (followMode) {
      map.setCenter(routeState.startPoint);
      map.setZoom(FOLLOW_ZOOM);
    }

    if (!isOnline || routeState.metrics.totalDistance < 20 || routeState.remaining.length < 2) {
      return () => {
        overlay.setMap(null);
        if (truckOverlayRef.current === overlay) truckOverlayRef.current = null;
      };
    }

    const startedAt = performance.now();
    let renderedHeading = routeState.initialBearing;
    cameraFrameRef.current = 0;
    routeFrameRef.current = 0;

    const animate = (now: number) => {
      const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
      const distance = Math.min(
        routeState.maxDistance,
        routeState.startDistance + elapsedSeconds * routeState.speedMps,
      );
      const position = pointAtDistance(routeState.metrics, distance);
      const roadHeading = routeHeadingAtDistance(routeState.metrics, distance, routeState.speedMps);
      renderedHeading = continuousBearing(renderedHeading, roadHeading);
      overlay.setPosition(position);
      overlay.setRotation(renderedHeading);

      if (now - routeFrameRef.current >= 180) {
        routeFrameRef.current = now;
        completedLineRef.current?.setPath(lineUntilDistance(routeState.metrics, distance));
        remainingLineRef.current?.setPath(lineFromDistance(routeState.metrics, distance));
      }
      if (followMode && now - cameraFrameRef.current >= 80) {
        cameraFrameRef.current = now;
        map.setCenter(position);
        if ((map.getZoom() || 0) < FOLLOW_ZOOM) map.setZoom(FOLLOW_ZOOM);
      }

      if (distance < routeState.maxDistance) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      overlay.setMap(null);
      if (truckOverlayRef.current === overlay) truckOverlayRef.current = null;
    };
  }, [followMode, isOnline, map, routeState]);

  useEffect(() => {
    if (!map || followMode || !window.google?.maps) return;
    const points = normalizePoints([source, current, destination, ...validRoutePoints]);
    if (points.length < 2) {
      map.setCenter(points[0] || mapCenter);
      map.setZoom(zoom);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 44);
    const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() || zoom) > 13) map.setZoom(13);
    });
    return () => window.google.maps.event.removeListener(listener);
  }, [current, destination, followMode, map, mapCenter, source, validRoutePoints, zoom]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    truckOverlayRef.current?.setMap(null);
  }, []);

  if (!mapsApiKey) {
    return <div className="flex h-full items-center justify-center p-6 text-sm text-red-600">Map unavailable</div>;
  }
  if (loadError) {
    return <div className="flex h-full items-center justify-center p-6 text-sm text-red-600">Map unavailable</div>;
  }
  if (!isLoaded) {
    return <div className="flex h-full items-center justify-center p-6 text-sm text-slate-600">Loading map...</div>;
  }

  return (
    <div className={className ? `relative h-full w-full overflow-hidden ${className}` : 'relative h-full w-full overflow-hidden'}>
      <GoogleMap
        zoom={followMode ? FOLLOW_ZOOM : zoom}
        center={routeState.startPoint || mapCenter}
        mapContainerStyle={mapContainerStyle}
        onLoad={setMap}
        onUnmount={() => setMap(null)}
        options={{
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          backgroundColor: '#eef3fa',
          minZoom: 4,
          maxZoom: 19,
        }}
      >
        {routeState.completed.length > 1 ? (
          <PolylineF
            path={routeState.completed}
            onLoad={(line) => { completedLineRef.current = line; }}
            onUnmount={() => { completedLineRef.current = null; }}
            options={{
              strokeColor: '#203044',
              strokeOpacity: 0.96,
              strokeWeight: 7,
              geodesic: true,
              zIndex: 2,
            }}
          />
        ) : null}
        {routeState.remaining.length > 1 ? (
          <PolylineF
            path={routeState.remaining}
            onLoad={(line) => { remainingLineRef.current = line; }}
            onUnmount={() => { remainingLineRef.current = null; }}
            options={{
              strokeColor: '#2563eb',
              strokeOpacity: 0.9,
              strokeWeight: 6,
              geodesic: true,
              zIndex: 1,
            }}
          />
        ) : null}
        {isCoord(source) ? <MarkerF position={source} title={sourceLabel} icon={sourceFlagIcon} /> : null}
        {isCoord(destination) ? (
          <MarkerF position={destination} title={destinationLabel} icon={destinationFlagIcon} />
        ) : null}
      </GoogleMap>

      <button
        type="button"
        onClick={recenter}
        aria-label="Recenter vehicle"
        className="absolute bottom-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#171914] shadow-[0_8px_18px_rgba(23,25,20,0.22)] active:scale-95"
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
