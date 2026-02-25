'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GoogleMap, MarkerF, useLoadScript } from '@react-google-maps/api';

type Coord = { lat: number; lng: number };

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export default function LiveMapPage() {
  const searchParams = useSearchParams();
  const currentLat = toNumber(searchParams.get('clat'));
  const currentLng = toNumber(searchParams.get('clng'));
  const vehicle = searchParams.get('vehicle') ?? 'Vehicle';

  const current: Coord | null =
    currentLat !== null && currentLng !== null
      ? { lat: currentLat, lng: currentLng }
      : null;

  const center = useMemo(() => {
    if (current) return current;
    return { lat: 22.9734, lng: 78.6569 };
  }, [current]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey || '',
  });

  const truckIcon = useMemo(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) {
      return undefined;
    }

    return {
      url: '/images/truck-marker.svg',
      scaledSize: new window.google.maps.Size(34, 34),
      anchor: new window.google.maps.Point(17, 17),
    };
  }, [isLoaded]);

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-5 shadow">
          <p className="text-sm text-red-600">
            Google Maps key is missing. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
          </p>
          <Link href="/tracking" className="mt-4 inline-block text-sm text-blue-700">
            Back to Tracking
          </Link>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-700">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{vehicle}</div>
          <div className="text-xs text-slate-500">Current location only</div>
        </div>
        <Link href="/tracking" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
          Back
        </Link>
      </div>

      <div className="flex-1 p-3">
        <GoogleMap
          zoom={10}
          center={center}
          mapContainerStyle={{ width: '100%', height: 'calc(100vh - 86px)', borderRadius: '12px' }}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {current ? (
            <MarkerF
              position={current}
              title="Current location"
              icon={truckIcon}
            />
          ) : null}
        </GoogleMap>
      </div>
    </div>
  );
}
