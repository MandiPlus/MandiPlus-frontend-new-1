'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminTripRow,
  TruckTrackingResponse,
  closeTrip,
  getTruckTracking,
  listTrips,
  sendManualTripAlert,
} from '@/features/admin/api/tracking.api';

export default function AdminTripsPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAdmin();

  const [trips, setTrips] = useState<AdminTripRow[]>([]);
  const [trackingData, setTrackingData] = useState<TruckTrackingResponse | null>(
    null
  );
  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState({
    fetchTrips: false,
    closeTrip: false,
    track: false,
    manualAlert: false,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [loading, isAuthenticated, router]);

  const setBusyFlag = useCallback((key: keyof typeof busy, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }, []);

  const fetchTrips = useCallback(async () => {
    setBusyFlag('fetchTrips', true);
    const response = await listTrips();
    if (response.success) {
      setTrips(response.data || []);
    } else {
      toast.error(response.message || 'Failed to fetch trips');
    }
    setBusyFlag('fetchTrips', false);
  }, [setBusyFlag]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      void fetchTrips();
    }, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated, fetchTrips]);

  const handleTrack = async (trip: AdminTripRow) => {
    const truckNumber = trip.truck?.truckNumber;
    if (!truckNumber) {
      toast.error('Truck number is missing for this trip.');
      return;
    }
    setBusyFlag('track', true);
    const response = await getTruckTracking(truckNumber);
    if (!response.success) {
      toast.error(response.message || 'Failed to fetch tracking data.');
      setTrackingData(null);
    } else {
      setTrackingData(response.data || null);
      toast.success(`Tracking loaded for ${truckNumber}`);
    }
    setBusyFlag('track', false);
  };

  const handleClose = async (trip: AdminTripRow) => {
    if (!trip.traqoTripId) {
      toast.error('Traqo trip id is missing.');
      return;
    }
    setBusyFlag('closeTrip', true);
    const response = await closeTrip(trip.traqoTripId);
    if (!response.success) {
      toast.error(response.message || 'Failed to close trip.');
    } else {
      toast.success('Trip closed successfully.');
      await fetchTrips();
    }
    setBusyFlag('closeTrip', false);
  };

  const handleManualAlert = async (
    trip: AdminTripRow,
    alertKind: 'reached' | 'delayed'
  ) => {
    const phoneOverride = phoneOverrides[trip.id]?.trim();
    setBusyFlag('manualAlert', true);
    const response = await sendManualTripAlert(trip.id, {
      alertKind,
      ...(phoneOverride ? { phoneOverride } : {}),
    });
    if (!response.success) {
      toast.error(response.message || `Failed to send ${alertKind} alert.`);
    } else {
      toast.success(
        `${alertKind === 'reached' ? 'Reached' : 'Delayed'} alert sent successfully.`
      );
      await fetchTrips();
    }
    setBusyFlag('manualAlert', false);
  };

  const totalTrips = trips.length;
  const activeTrips = trips.filter((trip) => trip.status === 'ACTIVE').length;
  const reachedAlertsSent = trips.filter(
    (trip) => Boolean(trip.alerts?.reachedSentAt)
  ).length;
  const delayedAlertsSent = trips.filter(
    (trip) => Boolean(trip.alerts?.delayedSentAt)
  ).length;

  if (loading || !isAuthenticated) {
    return (
      <div className="py-8">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#4309ac] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Created Trips</h1>
          <p className="text-sm text-gray-600">
            Track trips, review alert status, and send WhatsApp updates from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchTrips()}
          disabled={busy.fetchTrips}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
        >
          {busy.fetchTrips ? 'Refreshing...' : 'Refresh Trips'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Trips
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{totalTrips}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Active Trips
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-900">{activeTrips}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reached Alerts
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{reachedAlertsSent}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Delayed Alerts
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{delayedAlertsSent}</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-gray-900">Trips List</h2>
          <p className="text-xs text-gray-500">
            Use the override field only when you want to send a manual alert to a different
            WhatsApp number than the linked customer number.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Truck</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Driver</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">WhatsApp</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Alerts</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Route</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Created</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                    No trips found.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip.id}>
                    <td className="px-3 py-3 align-top font-medium text-gray-900">
                      <div className="flex flex-col gap-1">
                        <span>{trip.truck?.truckNumber || '-'}</span>
                        <span className="text-[11px] text-gray-500">
                          Trip: {trip.traqoTripId || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-gray-700">{trip.tel}</td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          trip.status === 'ENDED'
                            ? 'bg-gray-200 text-gray-700'
                            : trip.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {trip.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-gray-700">
                      <div className="flex min-w-[230px] max-w-[260px] flex-col gap-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                          <div className="font-semibold text-slate-700">Default recipient</div>
                          <div className="mt-1 break-all text-slate-900">
                            {trip.recipientPhone || 'No linked number'}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Override For Manual Send
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={phoneOverrides[trip.id] || ''}
                              onChange={(e) =>
                                setPhoneOverrides((prev) => ({
                                  ...prev,
                                  [trip.id]: e.target.value,
                                }))
                              }
                              placeholder="e.g. 9198XXXXXX12"
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-800"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPhoneOverrides((prev) => ({
                                  ...prev,
                                  [trip.id]: '',
                                }))
                              }
                              disabled={!phoneOverrides[trip.id]}
                              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 disabled:opacity-40"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-gray-700">
                      <div className="flex max-w-[240px] flex-col gap-2">
                        <span
                          className={`inline-flex w-fit rounded px-2 py-1 text-[11px] font-semibold ${
                            trip.alerts?.reachedSentAt
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Reached: {trip.alerts?.reachedSentAt ? 'Sent' : 'Not Sent'}
                        </span>
                        <span
                          className={`inline-flex w-fit rounded px-2 py-1 text-[11px] font-semibold ${
                            trip.alerts?.delayedSentAt
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Delayed: {trip.alerts?.delayedSentAt ? 'Sent' : 'Not Sent'}
                        </span>
                        {trip.alerts?.lastEvaluatedAt ? (
                          <div className="text-[11px] text-slate-500">
                            Last checked:{' '}
                            {new Date(trip.alerts.lastEvaluatedAt).toLocaleString('en-IN')}
                          </div>
                        ) : null}
                        {trip.alerts?.delayedReason ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                            {trip.alerts.delayedReason}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-gray-700">
                      <div className="max-w-[230px] space-y-1 text-xs">
                        <div>
                          <span className="font-semibold text-slate-700">Src:</span>{' '}
                          <span className="break-all">{trip.src || '-'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">Dest:</span>{' '}
                          <span className="break-all">{trip.dest || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-gray-700">
                      <div className="text-xs">
                        {new Date(trip.createdAt).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleTrack(trip)}
                          disabled={busy.track}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Track
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleManualAlert(trip, 'reached')}
                          disabled={busy.manualAlert}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Send Reached
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleManualAlert(trip, 'delayed')}
                          disabled={busy.manualAlert}
                          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Send Delayed
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleClose(trip)}
                          disabled={trip.status === 'ENDED' || busy.closeTrip}
                          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                        >
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {trackingData ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Live Tracking Snapshot</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">Vehicle</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.vehicleNumber}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.status}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Trip ID</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.tripId || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Trip Status</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.tripStatus || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Latitude</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.location?.lat ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Longitude</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.location?.lng ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ETA</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.eta || '-'}</div>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <div className="text-xs text-gray-500">Address</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.address || '-'}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
