'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  FastagLookupResult,
  lookupFastagVehicle,
} from '@/features/admin/api/tracking.api';

function formatTollTime(value?: string | null) {
  if (!value) return '—';
  const parsed = Date.parse(value.replace(' ', 'T'));
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function FastagLookupPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAdmin();
  const [vehicle, setVehicle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FastagLookupResult | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const plate = vehicle.trim().toUpperCase();
    if (!plate) {
      setError('Enter a vehicle number');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const response = await lookupFastagVehicle(plate);
    if (!response.success || !response.data) {
      setError(response.message || 'No Fastag data found');
      setLoading(false);
      return;
    }

    setResult(response.data);
    setLoading(false);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#4309ac] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-1 py-2">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Fastag
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter a vehicle number to see the latest toll and past crossings.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mb-8">
        <label
          htmlFor="fastag-vehicle"
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Vehicle number
        </label>
        <input
          id="fastag-vehicle"
          value={vehicle}
          onChange={(event) => setVehicle(event.target.value.toUpperCase())}
          placeholder="e.g. RJ11GC1625"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-[#4309ac]/40 placeholder:text-slate-300 focus:ring-2"
        />
        <p className="mt-2 text-xs text-slate-400">Press Enter to look up</p>
      </form>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Fetching tolls…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Latest location · {result.vehicleNumber}
            </div>
            {result.latest ? (
              <>
                <div className="mt-2 text-lg font-medium text-slate-900">
                  {result.latest.address || 'Unknown toll'}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {formatTollTime(result.latest.timeRecorded)}
                </div>
                <div className="mt-1 font-mono text-xs text-slate-400">
                  {result.latest.lat.toFixed(5)}, {result.latest.lng.toFixed(5)}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-slate-500">
                No recent Fastag tolls for this vehicle.
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                Past tolls
              </h2>
              <span className="text-xs text-slate-400">
                {result.tolls.length} crossing
                {result.tolls.length === 1 ? '' : 's'}
              </span>
            </div>

            {result.tolls.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                No toll history
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {result.tolls.map((toll, index) => (
                  <li
                    key={`${toll.timeRecorded}-${toll.lat}-${toll.lng}-${index}`}
                    className="flex items-start justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {toll.address || 'Unknown toll'}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {toll.lat.toFixed(5)}, {toll.lng.toFixed(5)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-500">
                      {formatTollTime(toll.timeRecorded)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
