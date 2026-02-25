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
  const currentName = searchParams.get('currentName') ?? 'Not available';
  const sourceName = searchParams.get('sourceName') ?? 'Not available';
  const destinationName = searchParams.get('destinationName') ?? 'Not available';

  const current: Coord | null =
    currentLat !== null && currentLng !== null
      ? { lat: currentLat, lng: currentLng }
      : null;

  const center = useMemo(() => current ?? { lat: 22.9734, lng: 78.6569 }, [current]);

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
      scaledSize: new window.google.maps.Size(52, 52),
      anchor: new window.google.maps.Point(26, 26),
    };
  }, [isLoaded]);

  if (!apiKey) {
    return (
      <main className="min-h-screen bg-[#121317] p-4 sm:p-8">
        <section className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#171a21] p-5 shadow-2xl">
          <p className="text-sm text-red-600">
            Google Maps key is missing. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
          </p>
          <Link href="/tracking" className="mt-4 inline-block text-sm font-medium text-cyan-300">
            Back to Tracking
          </Link>
        </section>
      </main>
    );
  }

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#121317]">
        <div className="rounded-xl border border-white/10 bg-[#171a21] px-4 py-3 text-sm text-slate-200 shadow-xl">
          Loading map...
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,#252831_0%,#17191f_45%,#121317_100%)]">
      <section className="flex h-full w-full flex-col overflow-hidden border border-white/10 bg-[#171a21] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <header className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#0f3e46] to-[#1f395a] px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-400/15 ring-1 ring-cyan-300/30">
              <span className="text-xs font-bold text-cyan-300">N</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{vehicle}</p>
              <p className="text-[11px] text-cyan-100/80">Live tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Live
            </span>
            <Link
              href="/tracking"
              className="rounded-md bg-[#0f1732] px-3 py-2 text-xs font-semibold text-white hover:bg-[#172247]"
            >
              Back
            </Link>
          </div>
        </header>

        <div className="relative flex-1 p-1.5 sm:p-2">
          <GoogleMap
            zoom={11}
            center={center}
            mapContainerStyle={{
              width: '100%',
              height: '100%',
              borderRadius: '12px',
            }}
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

          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col gap-3 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-[500px]">
            <div
              className="pointer-events-auto select-text cursor-text rounded-xl border border-white/15 bg-[#121620]/88 p-3 text-white shadow-xl backdrop-blur"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <p className="mt-0.5 text-lg font-semibold">{vehicle}</p>
              <p className="mt-1 text-sm font-medium text-emerald-300">Current location active</p>
              <div className="mt-2 space-y-1 text-xs text-slate-200">
                <p>
                  <span className="font-semibold text-white">Current Location:</span>{' '}
                  {currentName}
                </p>
                <p>
                  <span className="font-semibold text-white">Source:</span>{' '}
                  {sourceName}
                </p>
                <p>
                  <span className="font-semibold text-white">Destination:</span>{' '}
                  {destinationName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
