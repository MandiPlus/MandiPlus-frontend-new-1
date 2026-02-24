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
} from '@/features/admin/api/tracking.api';

export default function AdminTripsPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAdmin();

  const [trips, setTrips] = useState<AdminTripRow[]>([]);
  const [trackingData, setTrackingData] = useState<TruckTrackingResponse | null>(
    null
  );
  const [busy, setBusy] = useState({
    fetchTrips: false,
    closeTrip: false,
    track: false,
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
            All created trips with quick actions to track and close.
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

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Truck</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Driver</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Route</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Created</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    No trips found.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip.id}>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {trip.truck?.truckNumber || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{trip.tel}</td>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 text-gray-700">
                      <div>Src: {trip.src || '-'}</div>
                      <div>Dest: {trip.dest || '-'}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {new Date(trip.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
