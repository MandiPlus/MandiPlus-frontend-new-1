'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, MarkerF, useLoadScript } from '@react-google-maps/api';
import type { MapCoord } from './TripGoogleMap';

export type FleetMapItem = {
  id: string;
  vehicleNumber: string;
  current: MapCoord;
  isOnline?: boolean;
};

type FleetGoogleMapProps = {
  vehicles: FleetMapItem[];
  onVehicleSelect?: (vehicle: FleetMapItem) => void;
  className?: string;
};

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 22.9734, lng: 78.6569 };

export default function FleetGoogleMap({ vehicles, onVehicleSelect, className }: FleetGoogleMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const fitTimerRef = useRef<number | null>(null);
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded, loadError } = useLoadScript({
    id: 'mandiplus-google-maps',
    googleMapsApiKey: mapsApiKey,
    preventGoogleFontsLoading: true,
  });
  const center = vehicles[0]?.current ?? defaultCenter;

  const fitVehicles = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps || !vehicles.length) return;
    if (vehicles.length === 1) {
      map.setCenter(vehicles[0].current);
      map.setZoom(10);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    vehicles.forEach((vehicle) => bounds.extend(vehicle.current));
    map.fitBounds(bounds, 64);
    window.google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() || 5) > 8) map.setZoom(8);
    });
  }, [vehicles]);

  useEffect(() => {
    if (fitTimerRef.current !== null) {
      window.clearTimeout(fitTimerRef.current);
    }
    fitTimerRef.current = window.setTimeout(() => {
      fitTimerRef.current = null;
      fitVehicles();
    }, 100);
    return () => {
      if (fitTimerRef.current !== null) {
        window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
      }
    };
  }, [fitVehicles]);

  const truckIcon = useMemo(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) return undefined;
    return {
      url: '/images/truck-marker.svg',
      scaledSize: new window.google.maps.Size(48, 48),
      anchor: new window.google.maps.Point(24, 24),
    };
  }, [isLoaded]);

  if (!mapsApiKey || loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-[#eef3fa] px-6 text-center text-sm font-semibold text-[#7b8176]">
        Live map is unavailable. Your vehicle list is still up to date.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-[#eef3fa] text-sm font-semibold text-[#7b8176]">
        Preparing live map…
      </div>
    );
  }

  return (
    <div className={className ? `h-full w-full overflow-hidden ${className}` : 'h-full w-full overflow-hidden'}>
      <GoogleMap
        center={center}
        zoom={5}
        mapContainerStyle={mapContainerStyle}
        onLoad={(map) => {
          mapRef.current = map;
          window.requestAnimationFrame(fitVehicles);
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        }}
      >
        {vehicles.map((vehicle) => (
          <MarkerF
            key={vehicle.id}
            position={vehicle.current}
            title={vehicle.vehicleNumber}
            label={{
              text: vehicle.vehicleNumber,
              color: '#173f36',
              fontSize: '11px',
              fontWeight: '800',
              className: 'fleet-map-label',
            }}
            icon={truckIcon}
            onClick={() => onVehicleSelect?.(vehicle)}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
