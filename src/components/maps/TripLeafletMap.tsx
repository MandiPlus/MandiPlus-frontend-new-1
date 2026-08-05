'use client';

import { useEffect, useMemo } from 'react';
import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';

export type MapCoord = { lat: number; lng: number };

type TripLeafletMapProps = {
  center: MapCoord;
  current?: MapCoord | null;
  source?: MapCoord | null;
  destination?: MapCoord | null;
  currentLabel?: string;
  sourceLabel?: string;
  destinationLabel?: string;
  zoom?: number;
  className?: string;
};

// OSM's free tile CDN blocks most production referrers (returns blank tiles).
// Prefer MapTiler when keyed; otherwise CARTO Voyager (same stack as app tracking maps).
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '';
const DEFAULT_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  (MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encodeURIComponent(MAPTILER_KEY)}`
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
const DEFAULT_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  (MAPTILER_KEY
    ? '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>');

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

function createTruckIcon() {
  return L.icon({
    iconUrl: '/images/truck-marker.svg',
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    tooltipAnchor: [0, -26],
  });
}

function MapViewport({
  center,
  points,
  zoom,
}: {
  center: MapCoord;
  points: MapCoord[];
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    // Modal/flex layouts often mount Leaflet before the container has a real size.
    const invalidate = () => map.invalidateSize();
    invalidate();
    const raf = window.requestAnimationFrame(invalidate);
    const t1 = window.setTimeout(invalidate, 50);
    const t2 = window.setTimeout(invalidate, 250);
    window.addEventListener('resize', invalidate);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);

  useEffect(() => {
    map.invalidateSize();

    if (points.length > 1) {
      const bounds = points.map(toLatLng) as LatLngBoundsExpression;
      map.fitBounds(bounds, {
        padding: [44, 44],
        maxZoom: 13,
      });
      return;
    }

    map.setView(toLatLng(points[0] || center), zoom);
  }, [center, map, points, zoom]);

  return null;
}

export default function TripLeafletMap({
  center,
  current,
  source,
  destination,
  currentLabel = 'Current location',
  sourceLabel = 'Source',
  destinationLabel = 'Destination',
  zoom = 11,
  className,
}: TripLeafletMapProps) {
  const truckIcon = useMemo(() => createTruckIcon(), []);
  const sourceIcon = useMemo(() => createFlagIcon('source'), []);
  const destinationIcon = useMemo(() => createFlagIcon('destination'), []);
  const points = useMemo(
    () => [current, source, destination].filter(isCoord),
    [current, source, destination],
  );
  const mapCenter = isCoord(center) ? center : { lat: 22.9734, lng: 78.6569 };
  const usesSubdomains = DEFAULT_TILE_URL.includes('{s}');

  return (
    <MapContainer
      center={toLatLng(mapCenter)}
      zoom={zoom}
      className={className}
      style={{ height: '100%', width: '100%', minHeight: 320, background: '#eef3fa' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution={DEFAULT_ATTRIBUTION}
        maxZoom={19}
        {...(usesSubdomains ? { subdomains: 'abcd' } : {})}
        url={DEFAULT_TILE_URL}
      />
      <MapViewport center={mapCenter} points={points} zoom={zoom} />

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
        <Marker position={toLatLng(current)} icon={truckIcon}>
          <Tooltip direction="top" offset={[0, -28]}>
            {currentLabel}
          </Tooltip>
        </Marker>
      ) : null}
    </MapContainer>
  );
}
