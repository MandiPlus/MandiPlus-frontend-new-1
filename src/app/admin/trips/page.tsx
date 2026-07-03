'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { GoogleMap, MarkerF, useLoadScript } from '@react-google-maps/api';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminTripRow,
  TruckTrackingResponse,
  closeTrip,
  editTrip,
  getTruckTracking,
  listTrips,
  sendCurrentPositionAlertsForActiveTrips,
  sendManualTripAlert,
} from '@/features/admin/api/tracking.api';

type Coord = { lat: number; lng: number };

type TrackModalState = {
  trip: AdminTripRow;
  tracking: TruckTrackingResponse;
  sourceName: string;
  destinationName: string;
};

function joinAddressParts(value?: string[] | string | null): string {
  return Array.isArray(value)
    ? value.map((part) => String(part || '').trim()).filter(Boolean).join(', ')
    : String(value || '').trim();
}

function getInvoiceSourceAddress(trip: AdminTripRow): string {
  const invoice = trip.invoice;
  if (!invoice) return '';
  return joinAddressParts(invoice.supplierAddress);
}

function getInvoiceDestinationAddress(trip: AdminTripRow): string {
  const invoice = trip.invoice;
  if (!invoice) return '';
  const shipTo = joinAddressParts(invoice.shipToAddress);
  const billTo = joinAddressParts(invoice.billToAddress);
  return shipTo || billTo;
}

function normalizeSearchValue(value?: string | null): string {
  return (value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function normalizeCoordValue(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',');
  return normalized || null;
}

async function reverseGeocodeWithGoogle(
  coords: string
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const normalized = normalizeCoordValue(coords);
  if (!apiKey || !normalized) return null;

  const [lat, lng] = normalized.split(',');
  if (!lat || !lng) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
      `${lat},${lng}`
    )}&key=${apiKey}`;
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      status?: string;
      results?: Array<{ formatted_address?: string }>;
    };
    if (data.status !== 'OK' || !data.results?.length) return null;

    return data.results[0]?.formatted_address || null;
  } catch {
    return null;
  }
}

export default function AdminTripsPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAdmin();
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: isMapLoaded } = useLoadScript({
    googleMapsApiKey: mapsApiKey,
  });

  const [trips, setTrips] = useState<AdminTripRow[]>([]);
  const [searchFilters, setSearchFilters] = useState({
    driverPhone: '',
    vehicleNumber: '',
  });
  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>({});
  const [routeLabels, setRouteLabels] = useState<Record<string, string>>({});
  const [trackModal, setTrackModal] = useState<TrackModalState | null>(null);
  const [detailsTrip, setDetailsTrip] = useState<AdminTripRow | null>(null);
  const [editingTrip, setEditingTrip] = useState<AdminTripRow | null>(null);
  const [editForm, setEditForm] = useState({ truck_number: '', tel: '', srcname: '', destname: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [busy, setBusy] = useState({
    fetchTrips: false,
    closeTrip: false,
    track: false,
    manualAlert: false,
    sendAllPositions: false,
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

  useEffect(() => {
    const uniqueCoords = Array.from(
      new Set(
        trips
          .flatMap((trip) => [normalizeCoordValue(trip.src), normalizeCoordValue(trip.dest)])
          .filter((value): value is string => Boolean(value))
      )
    ).filter((coords) => !routeLabels[coords]);

    if (!uniqueCoords.length) return;

    let isCancelled = false;

    const hydrateRouteLabels = async () => {
      const resolvedEntries = await Promise.all(
        uniqueCoords.map(async (coords) => {
          const label = await reverseGeocodeWithGoogle(coords);
          return [coords, label || coords] as const;
        })
      );

      if (isCancelled) return;

      setRouteLabels((prev) => {
        const next = { ...prev };
        for (const [coords, label] of resolvedEntries) {
          next[coords] = label;
        }
        return next;
      });
    };

    void hydrateRouteLabels();

    return () => {
      isCancelled = true;
    };
  }, [trips, routeLabels]);

  const getRouteLabelForCoords = useCallback(
    (coords?: string | null) => {
      const normalized = normalizeCoordValue(coords);
      return normalized ? routeLabels[normalized] || normalized : '';
    },
    [routeLabels],
  );

  const getTripSourceLabel = useCallback(
    (trip: AdminTripRow) =>
      trip.sourceName ||
      trip.srcname ||
      getRouteLabelForCoords(trip.src) ||
      getInvoiceSourceAddress(trip) ||
      trip.src ||
      '',
    [getRouteLabelForCoords],
  );

  const getTripDestinationLabel = useCallback(
    (trip: AdminTripRow) =>
      trip.destinationName ||
      trip.destname ||
      getRouteLabelForCoords(trip.dest) ||
      getInvoiceDestinationAddress(trip) ||
      trip.dest ||
      '',
    [getRouteLabelForCoords],
  );

  const handleTrack = async (trip: AdminTripRow) => {
    const truckNumber = trip.truck?.truckNumber || trip.vehicleNumber;
    if (!truckNumber) {
      toast.error('Truck number is missing for this trip.');
      return;
    }
    setBusyFlag('track', true);
    const response = await getTruckTracking(truckNumber);
    if (!response.success) {
      toast.error(response.message || 'Failed to fetch tracking data.');
    } else {
      const data = response.data;
      if (!data) {
        toast.error('Tracking data is unavailable for this trip.');
        setBusyFlag('track', false);
        return;
      }

      const sourceCoords =
        data.origin && typeof data.origin.lat === 'number' && typeof data.origin.lng === 'number'
          ? normalizeCoordValue(`${data.origin.lat},${data.origin.lng}`)
          : null;
      const destinationCoords =
        data.destination &&
        typeof data.destination.lat === 'number' &&
        typeof data.destination.lng === 'number'
          ? normalizeCoordValue(`${data.destination.lat},${data.destination.lng}`)
          : null;

      const currentName = data.location?.address || '';
      const sourceName = getTripSourceLabel(trip) || (sourceCoords ? routeLabels[sourceCoords] || sourceCoords : '');
      const destinationName = destinationCoords
        ? getTripDestinationLabel(trip) || routeLabels[destinationCoords] || destinationCoords
        : getTripDestinationLabel(trip);

      setTrackModal({
        trip,
        tracking: {
          ...data,
          location: data.location
            ? {
                ...data.location,
                address: currentName || data.location.address,
              }
            : data.location,
        },
        sourceName,
        destinationName,
      });
    }
    setBusyFlag('track', false);
  };

  const openEditModal = (trip: AdminTripRow) => {
    setEditForm({
      truck_number: trip.truck?.truckNumber || trip.vehicleNumber || '',
      tel: trip.tel || '',
      srcname: getTripSourceLabel(trip),
      destname: getTripDestinationLabel(trip),
    });
    setEditingTrip(trip);
  };

  const submitEdit = async () => {
    if (!editingTrip) return;
    const updates: Record<string, string> = {};
    if (editForm.truck_number && editForm.truck_number !== (editingTrip.truck?.truckNumber || editingTrip.vehicleNumber || '')) {
      updates.truck_number = editForm.truck_number;
    }
    if (editForm.tel && editForm.tel !== editingTrip.tel) {
      updates.tel = editForm.tel;
    }
    if (editForm.srcname) updates.srcname = editForm.srcname;
    if (editForm.destname) updates.destname = editForm.destname;

    if (Object.keys(updates).length === 0) {
      toast.error('No changes to save');
      return;
    }

    setEditSaving(true);
    const response = await editTrip(editingTrip.id, updates);
    if (!response.success) {
      toast.error(response.message || 'Failed to edit trip');
    } else {
      toast.success('Trip updated successfully');
      setEditingTrip(null);
      await fetchTrips();
    }
    setEditSaving(false);
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
    alertKind: 'reached' | 'delayed' | 'current_position'
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
      if (phoneOverride) {
        setTrips((prev) =>
          prev.map((item) =>
            item.id === trip.id ? { ...item, recipientPhone: phoneOverride } : item
          )
        );
      }
      toast.success(
        `${
          alertKind === 'reached'
            ? 'Reached'
            : alertKind === 'delayed'
            ? 'Delayed'
            : 'Current position'
        } alert sent successfully.`
      );
      await fetchTrips();
      if (phoneOverride) {
        setPhoneOverrides((prev) => ({
          ...prev,
          [trip.id]: '',
        }));
      }
    }
    setBusyFlag('manualAlert', false);
  };

  const handleSendAllCurrentPositionAlerts = async () => {
    setBusyFlag('sendAllPositions', true);
    const response = await sendCurrentPositionAlertsForActiveTrips();
    if (!response.success) {
      toast.error(
        response.message || 'Failed to send current-position alerts for active trips.'
      );
    } else {
      const processed = response.data?.processed ?? 0;
      const sent = response.data?.sent ?? 0;
      toast.success(`Current position alerts sent for ${sent} of ${processed} active trips.`);
      await fetchTrips();
    }
    setBusyFlag('sendAllPositions', false);
  };

  const totalTrips = trips.length;
  const activeTrips = trips.filter((trip) => trip.status === 'ACTIVE').length;
  const reachedAlertsSent = trips.filter(
    (trip) => Boolean(trip.alerts?.reachedSentAt)
  ).length;
  const delayedAlertsSent = trips.filter(
    (trip) => Boolean(trip.alerts?.delayedSentAt)
  ).length;
  const filteredTrips = useMemo(() => {
    const phoneQuery = normalizeSearchValue(searchFilters.driverPhone);
    const vehicleQuery = normalizeSearchValue(searchFilters.vehicleNumber);

    return trips.filter((trip) => {
      const normalizedPhone = [
        trip.tel,
        trip.invoice?.driverPhone,
        trip.invoice?.driverSecondaryPhone,
      ]
        .map((value) => normalizeSearchValue(value))
        .join(' ');
      const normalizedVehicle = normalizeSearchValue(
        trip.truck?.truckNumber || trip.vehicleNumber,
      );
      const matchesPhone = !phoneQuery || normalizedPhone.includes(phoneQuery);
      const matchesVehicle = !vehicleQuery || normalizedVehicle.includes(vehicleQuery);

      return matchesPhone && matchesVehicle;
    });
  }, [searchFilters.driverPhone, searchFilters.vehicleNumber, trips]);

  const trackCurrent = useMemo<Coord | null>(() => {
    if (
      trackModal?.tracking.location &&
      typeof trackModal.tracking.location.lat === 'number' &&
      typeof trackModal.tracking.location.lng === 'number'
    ) {
      return {
        lat: trackModal.tracking.location.lat,
        lng: trackModal.tracking.location.lng,
      };
    }
    return null;
  }, [trackModal]);

  const trackDestination = useMemo<Coord | null>(() => {
    if (
      trackModal?.tracking.destination &&
      typeof trackModal.tracking.destination.lat === 'number' &&
      typeof trackModal.tracking.destination.lng === 'number'
    ) {
      return {
        lat: trackModal.tracking.destination.lat,
        lng: trackModal.tracking.destination.lng,
      };
    }
    return null;
  }, [trackModal]);

  const trackCenter = useMemo<Coord>(
    () => trackCurrent || trackDestination || { lat: 22.9734, lng: 78.6569 },
    [trackCurrent, trackDestination]
  );

  const truckIcon = useMemo(() => {
    if (!isMapLoaded || typeof window === 'undefined' || !window.google?.maps) {
      return undefined;
    }

    return {
      url: '/images/truck-marker.svg',
      scaledSize: new window.google.maps.Size(52, 52),
      anchor: new window.google.maps.Point(26, 26),
    };
  }, [isMapLoaded]);

  const sourceFlagIcon = useMemo(() => {
    if (!isMapLoaded || typeof window === 'undefined' || !window.google?.maps) {
      return undefined;
    }

    const svg = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
        <path d="M9 4v25" stroke="#166534" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M10 5h13l-3 6 3 6H10z" fill="#22c55e" stroke="#166534" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `);

    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new window.google.maps.Size(30, 30),
      anchor: new window.google.maps.Point(10, 26),
    };
  }, [isMapLoaded]);

  const destinationFlagIcon = useMemo(() => {
    if (!isMapLoaded || typeof window === 'undefined' || !window.google?.maps) {
      return undefined;
    }

    const svg = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
        <path d="M9 4v25" stroke="#991b1b" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M10 5h13l-3 6 3 6H10z" fill="#ef4444" stroke="#991b1b" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `);

    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new window.google.maps.Size(30, 30),
      anchor: new window.google.maps.Point(10, 26),
    };
  }, [isMapLoaded]);

  if (loading || !isAuthenticated) {
    return (
      <div className="py-8">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#4309ac] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
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
        </div>
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="flex-1">
              <label
                htmlFor="trip-driver-phone-search"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Search by driver phone
              </label>
              <input
                id="trip-driver-phone-search"
                type="text"
                value={searchFilters.driverPhone}
                onChange={(e) =>
                  setSearchFilters((prev) => ({
                    ...prev,
                    driverPhone: e.target.value,
                  }))
                }
                placeholder="Enter driver phone number"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="trip-vehicle-number-search"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Search by vehicle number
              </label>
              <input
                id="trip-vehicle-number-search"
                type="text"
                value={searchFilters.vehicleNumber}
                onChange={(e) =>
                  setSearchFilters((prev) => ({
                    ...prev,
                    vehicleNumber: e.target.value,
                  }))
                }
                placeholder="Enter vehicle number"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm uppercase text-gray-800"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2 xl:flex-nowrap">
              <button
                type="button"
                onClick={() => void handleSendAllCurrentPositionAlerts()}
                disabled={busy.sendAllPositions}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy.sendAllPositions ? 'Sending Positions...' : 'Send Position To All Active'}
              </button>
              <button
                type="button"
                onClick={() => void fetchTrips()}
                disabled={busy.fetchTrips}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
              >
                {busy.fetchTrips ? 'Refreshing...' : 'Refresh Trips'}
              </button>
            </div>
          </div>
        </div>
        <div className="mb-3 text-xs text-slate-500">
          Showing {filteredTrips.length} of {trips.length} trips
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Truck</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Driver</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Completion</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">WhatsApp</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Alerts</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Route</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Created</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-gray-500">
                    {trips.length === 0 ? 'No trips found.' : 'No trips match the current search.'}
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => (
                  <tr key={trip.id}>
                    <td className="px-3 py-3 align-top font-medium text-gray-900">
                      <div className="flex flex-col gap-1">
                        <span>{trip.truck?.truckNumber || trip.vehicleNumber || '-'}</span>
                        {trip.invoice?.invoiceNumber ? (
                          <span className="text-[11px] text-gray-500">
                            Invoice: {trip.invoice.invoiceNumber}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-gray-700">
                      <div className="min-w-[150px] space-y-1 text-xs">
                        <div className="font-medium text-slate-900">
                          {trip.tel || trip.invoice?.driverPhone || '-'}
                        </div>
                        {trip.invoice?.driverSecondaryPhone ? (
                          <div className="text-slate-500">
                            Alt: {trip.invoice.driverSecondaryPhone}
                          </div>
                        ) : null}
                        {trip.invoice?.driverConsentStatus ? (
                          <div className="text-[11px] text-slate-500">
                            Consent: {trip.invoice.driverConsentStatus}
                          </div>
                        ) : null}
                      </div>
                    </td>
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
                      {(() => {
                        const traveled = trip.lastLocation?.distanceTravel;
                        const total = trip.lastLocation?.totalDistance;
                        const pct =
                          typeof traveled === 'number' && typeof total === 'number' && total > 0
                            ? Math.min(Math.round((traveled / total) * 100), 100)
                            : null;

                        if (trip.status === 'ENDED') {
                          return (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-semibold text-emerald-700">100%</span>
                              <div className="h-1.5 w-16 rounded-full bg-gray-200">
                                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: '100%' }} />
                              </div>
                            </div>
                          );
                        }

                        if (pct === null) {
                          return <span className="text-xs text-slate-400">-</span>;
                        }

                        return (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-900">{pct}%</span>
                            <div className="h-1.5 w-16 rounded-full bg-gray-200">
                              <div
                                className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : 'bg-amber-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {traveled} / {total} KM
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 align-top text-gray-700">
                      <div className="flex min-w-[230px] max-w-[260px] flex-col gap-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                          <div className="font-semibold text-slate-700">Default recipient</div>
                          <div className="mt-1 break-all text-slate-900">
                            {phoneOverrides[trip.id]?.trim() ||
                              trip.recipientPhone ||
                              'No linked number'}
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
                          <span className="break-words">
                            {getTripSourceLabel(trip) || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">Dest:</span>{' '}
                          <span className="break-words">
                            {getTripDestinationLabel(trip) || '-'}
                          </span>
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
                          onClick={() => setDetailsTrip(trip)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          Details
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
                          onClick={() => void handleManualAlert(trip, 'current_position')}
                          disabled={busy.manualAlert}
                          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Send Position
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(trip)}
                          disabled={trip.status === 'ENDED'}
                          className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 disabled:opacity-50"
                        >
                          Edit
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

      {detailsTrip ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-950">
                  Driver Details
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {detailsTrip.invoice?.invoiceNumber || detailsTrip.vehicleNumber || detailsTrip.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsTrip(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-500"
              >
                ×
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Primary Mobile
                </div>
                <div className="mt-1 break-all text-sm font-semibold text-slate-950">
                  {detailsTrip.tel || detailsTrip.invoice?.driverPhone || '-'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Alternate Mobile
                </div>
                <div className="mt-1 break-all text-sm font-semibold text-slate-950">
                  {detailsTrip.invoice?.driverSecondaryPhone || '-'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Vehicle
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {detailsTrip.truck?.truckNumber || detailsTrip.vehicleNumber || '-'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Consent
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {detailsTrip.invoice?.driverConsentStatus || 'Not available'}
                </div>
                {detailsTrip.invoice?.driverConsentOperator ? (
                  <div className="mt-1 text-xs text-slate-500">
                    Operator: {detailsTrip.invoice.driverConsentOperator}
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 sm:col-span-2">
                <div className="text-[11px] font-semibold uppercase text-emerald-700">
                  Source
                </div>
                <div className="mt-1 text-sm text-slate-900">
                  {getTripSourceLabel(detailsTrip) || '-'}
                </div>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 sm:col-span-2">
                <div className="text-[11px] font-semibold uppercase text-amber-700">
                  Destination
                </div>
                <div className="mt-1 text-sm text-slate-900">
                  {getTripDestinationLabel(detailsTrip) || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {trackModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="relative flex max-h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-[#f8fafc] shadow-2xl xl:flex-row">
            <button
              type="button"
              onClick={() => setTrackModal(null)}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-slate-500 shadow-md"
            >
              ×
            </button>

            <div className="min-h-[420px] flex-1 bg-white p-4">
              <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {!mapsApiKey ? (
                  <div className="flex h-full items-center justify-center p-6 text-sm text-red-600">
                    Google Maps key is missing. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
                  </div>
                ) : !isMapLoaded ? (
                  <div className="flex h-full items-center justify-center p-6 text-sm text-slate-600">
                    Loading map...
                  </div>
                ) : (
                  <GoogleMap
                    zoom={6}
                    center={trackCenter}
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: true,
                      fullscreenControl: true,
                    }}
                  >
                    {trackCurrent ? (
                      <MarkerF position={trackCurrent} title="Current location" icon={truckIcon} />
                    ) : null}
                    {trackDestination ? (
                      <MarkerF
                        position={trackDestination}
                        title="Destination"
                        icon={destinationFlagIcon}
                      />
                    ) : null}
                    {trackModal.tracking.origin &&
                    typeof trackModal.tracking.origin.lat === 'number' &&
                    typeof trackModal.tracking.origin.lng === 'number' ? (
                      <MarkerF
                        position={trackModal.tracking.origin}
                        title="Source"
                        icon={sourceFlagIcon}
                      />
                    ) : null}
                  </GoogleMap>
                )}
              </div>
            </div>

            <div className="w-full overflow-y-auto border-t border-slate-200 bg-white p-5 xl:w-[520px] xl:border-l xl:border-t-0">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {trackModal.trip.invoice?.invoiceNumber || trackModal.tracking.vehicleNumber}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Vehicle: {trackModal.tracking.vehicleNumber}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-b border-slate-200 py-4 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created At
                  </div>
                  <div className="mt-1">{new Date(trackModal.trip.createdAt).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    ETA
                  </div>
                  <div className="mt-1">{trackModal.tracking.eta || '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </div>
                  <div className="mt-1">{trackModal.tracking.tripStatus || trackModal.trip.status}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recipient
                  </div>
                  <div className="mt-1 break-all">{trackModal.trip.recipientPhone || '-'}</div>
                </div>
              </div>

              <div className="border-b border-slate-200 py-4">
                <div className="text-sm font-semibold text-slate-900">
                  {trackModal.sourceName || '-'} To {trackModal.destinationName || '-'}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Last Location
                    </div>
                    <div className="mt-1">{trackModal.tracking.location?.address || 'Not available'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Last Location At
                    </div>
                    <div className="mt-1">{trackModal.tracking.location?.timeRecorded || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 py-4 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Status
                  </div>
                  <div className="mt-2 text-base font-semibold text-emerald-900">
                    {trackModal.tracking.status === 'tracking'
                      ? 'Enroute To Destination'
                      : 'Not Tracking'}
                  </div>
                  {(() => {
                    const traveled = trackModal.tracking.location?.distanceTravel;
                    const total = trackModal.tracking.location?.totalDistance;
                    const pct = typeof traveled === 'number' && typeof total === 'number' && total > 0
                      ? Math.min(Math.round((traveled / total) * 100), 100)
                      : null;
                    if (pct === null) return null;
                    return (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-emerald-700 mb-1">
                          <span>{pct}% complete</span>
                          <span>{traveled} / {total} KM</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-emerald-200">
                          <div
                            className="h-2 rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                    Remaining
                  </div>
                  <div className="mt-2 text-base font-semibold text-sky-900">
                    {trackModal.tracking.location?.distanceRemained || '-'}
                  </div>
                  <div className="mt-1 text-xs text-sky-700">
                    {trackModal.tracking.location?.timeRemained || 'Time not available'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => void handleManualAlert(trackModal.trip, 'reached')}
                  disabled={busy.manualAlert}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Send Reached
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualAlert(trackModal.trip, 'delayed')}
                  disabled={busy.manualAlert}
                  className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Send Delayed
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualAlert(trackModal.trip, 'current_position')}
                  disabled={busy.manualAlert}
                  className="rounded-md bg-sky-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Send Position
                </button>
                <button
                  type="button"
                  onClick={() => void handleClose(trackModal.trip)}
                  disabled={trackModal.trip.status === 'ENDED' || busy.closeTrip}
                  className="rounded-md bg-slate-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  End Trip
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingTrip ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Edit Trip
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Changes sync with Traqo. Only fill fields you want to update.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-gray-700">
                Vehicle Number
                <input
                  type="text"
                  value={editForm.truck_number}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, truck_number: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                Driver Phone
                <input
                  type="text"
                  value={editForm.tel}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tel: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                New Source (city/address)
                <input
                  type="text"
                  placeholder="Leave empty to keep current"
                  value={editForm.srcname}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, srcname: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                New Destination (city/address)
                <input
                  type="text"
                  placeholder="Leave empty to keep current"
                  value={editForm.destname}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, destname: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                disabled={editSaving}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitEdit()}
                disabled={editSaving}
                className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {editSaving ? 'Saving...' : 'Save & Sync'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
