'use client';

import { useEffect, useMemo } from 'react';
import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';

import type { MapCoord } from './TripLeafletMap';

export type FleetMapItem = {
  id: string;
  vehicleNumber: string;
  current: MapCoord;
  isOnline?: boolean;
};

type FleetLeafletMapProps = {
  vehicles: FleetMapItem[];
  onVehicleSelect?: (vehicle: FleetMapItem) => void;
  className?: string;
};

const DEFAULT_CENTER: MapCoord = { lat: 22.9734, lng: 78.6569 };
const DEFAULT_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DEFAULT_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; OpenStreetMap contributors &copy; CARTO';

function toLatLng(coord: MapCoord): LatLngExpression {
  return [coord.lat, coord.lng];
}

function createTruckIcon(vehicle: FleetMapItem) {
  const safeLabel = vehicle.vehicleNumber.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });

  return L.divIcon({
    className: '',
    iconSize: [88, 72],
    iconAnchor: [44, 36],
    tooltipAnchor: [0, -32],
    html: `
      <div class="fleet-leaflet-truck${vehicle.isOnline ? ' is-online' : ''}">
        <div class="fleet-leaflet-truck__marker">
          <span class="tracking-truck-pulse"></span>
          <img src="/images/truck-marker.svg" alt="" />
        </div>
        <span class="fleet-leaflet-truck__label">${safeLabel}</span>
      </div>
    `,
  });
}

function FleetViewport({ vehicles }: { vehicles: FleetMapItem[] }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (!vehicles.length) {
      map.setView(toLatLng(DEFAULT_CENTER), 5);
      return;
    }
    if (vehicles.length === 1) {
      map.setView(toLatLng(vehicles[0].current), 10, { animate: true });
      return;
    }

    map.fitBounds(
      vehicles.map((vehicle) => toLatLng(vehicle.current)) as LatLngBoundsExpression,
      { padding: [64, 64], maxZoom: 8 },
    );
  }, [map, vehicles]);

  return null;
}

export default function FleetLeafletMap({
  vehicles,
  onVehicleSelect,
  className,
}: FleetLeafletMapProps) {
  const icons = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, createTruckIcon(vehicle)])),
    [vehicles],
  );

  return (
    <div className={className ? `h-full w-full overflow-hidden ${className}` : 'h-full w-full overflow-hidden'}>
      <MapContainer
        center={toLatLng(vehicles[0]?.current || DEFAULT_CENTER)}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer
          attribution={DEFAULT_ATTRIBUTION}
          maxZoom={19}
          referrerPolicy="strict-origin-when-cross-origin"
          url={DEFAULT_TILE_URL}
        />
        <FleetViewport vehicles={vehicles} />
        {vehicles.map((vehicle) => (
          <Marker
            key={vehicle.id}
            position={toLatLng(vehicle.current)}
            icon={icons.get(vehicle.id)}
            eventHandlers={{ click: () => onVehicleSelect?.(vehicle) }}
            zIndexOffset={vehicle.isOnline ? 1000 : 0}
          >
            <Tooltip direction="top" offset={[0, -31]}>
              {vehicle.vehicleNumber}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
