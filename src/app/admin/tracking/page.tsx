'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AddDriverPayload,
  CheckConsentPayload,
  CreateTripPayload,
  TruckTrackingResponse,
  addDriverNumber,
  checkDriverConsent,
  createTrackingTrip,
  getTruckTracking,
  resendDriverConsentSms,
} from '@/features/admin/api/tracking.api';

function toTenDigitPhone(input: string) {
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function consentApproved(consent: string | null) {
  if (!consent) return false;
  const value = consent.toLowerCase();
  return (
    value.includes('allow') ||
    value.includes('approve') ||
    value.includes('granted') ||
    value.includes('accepted') ||
    value === 'true' ||
    value === 'yes'
  );
}

function pickString(
  payload: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

async function geocodeWithGoogle(address: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const query = address.trim();

  if (!apiKey || !query) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      query
    )}&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };

    if (payload.status !== 'OK' || !payload.results?.length) return null;
    const location = payload.results[0]?.geometry?.location;
    if (
      typeof location?.lat !== 'number' ||
      typeof location?.lng !== 'number'
    ) {
      return null;
    }

    return `${location.lat},${location.lng}`;
  } catch {
    return null;
  }
}

export default function AdminTrackingPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAdmin();

  const [registerForm, setRegisterForm] = useState<AddDriverPayload>({
    phone_number: '',
    name: '',
    operator: '',
  });
  const [consentForm, setConsentForm] = useState<CheckConsentPayload>({ tel: '' });
  const [tripForm, setTripForm] = useState<CreateTripPayload>({
    tel: '',
    truck_number: '',
    srcname: '',
    destname: '',
    src: '',
    dest: '',
    invoice: '',
    eta_hrs: undefined,
    internalTruckId: '',
    internalInvoiceId: '',
  });
  const [trackVehicle, setTrackVehicle] = useState('');

  const [consentState, setConsentState] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<TruckTrackingResponse | null>(
    null
  );

  const [busy, setBusy] = useState({
    register: false,
    checkConsent: false,
    resendConsent: false,
    createTrip: false,
    refreshTracking: false,
    geocode: false,
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const inputClass =
    'rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-slate-300';

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [loading, isAuthenticated, router]);

  const isConsentOk = useMemo(() => consentApproved(consentState), [consentState]);

  const setBusyFlag = useCallback((key: keyof typeof busy, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }, []);

  const refreshTracking = useCallback(async () => {
    if (!trackVehicle.trim()) return;
    setBusyFlag('refreshTracking', true);

    const response = await getTruckTracking(trackVehicle.trim().toUpperCase());
    if (!response.success) {
      setTrackingData(null);
    } else {
      setTrackingData(response.data || null);
    }

    setBusyFlag('refreshTracking', false);
  }, [trackVehicle, setBusyFlag]);

  useEffect(() => {
    if (!autoRefresh || !trackVehicle.trim()) return;
    const timer = setInterval(() => {
      void refreshTracking();
    }, 20000);
    return () => clearInterval(timer);
  }, [autoRefresh, trackVehicle, refreshTracking]);

  const handleRegisterDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyFlag('register', true);

    const phone = toTenDigitPhone(registerForm.phone_number);
    if (phone.length !== 10) {
      toast.error('Driver phone number must be 10 digits.');
      setBusyFlag('register', false);
      return;
    }

    const response = await addDriverNumber({
      phone_number: phone,
      name: registerForm.name?.trim() || undefined,
      operator: registerForm.operator?.trim() || undefined,
    });
    if (!response.success) {
      toast.error(response.message || 'Failed to register driver number.');
    } else {
      toast.success('Driver number registered. Consent SMS sent by Traqo.');
      setConsentForm({ tel: phone });
      setTripForm((prev) => ({ ...prev, tel: phone }));
    }

    setBusyFlag('register', false);
  };

  const handleCheckConsent = async () => {
    setBusyFlag('checkConsent', true);

    const tel = toTenDigitPhone(consentForm.tel);
    if (tel.length !== 10) {
      toast.error('Consent check requires a valid 10-digit driver number.');
      setBusyFlag('checkConsent', false);
      return;
    }

    const response = await checkDriverConsent({ tel });
    if (!response.success) {
      toast.error(response.message || 'Failed to check consent.');
      setConsentState(null);
    } else {
      const raw = (response.data || {}) as Record<string, unknown>;
      const status = pickString(raw, [
        'consent',
        'status',
        'consentStatus',
        'consent_status',
      ]);
      setConsentState(status || '');
      toast.success(`Consent status: ${status || 'Unknown'}`);
      setTripForm((prev) => ({ ...prev, tel }));
    }

    setBusyFlag('checkConsent', false);
  };

  const handleResendConsent = async () => {
    setBusyFlag('resendConsent', true);

    const phone = toTenDigitPhone(consentForm.tel);
    if (phone.length !== 10) {
      toast.error('Resend requires a valid 10-digit driver number.');
      setBusyFlag('resendConsent', false);
      return;
    }

    const response = await resendDriverConsentSms(phone);
    if (!response.success) {
      toast.error(response.message || 'Failed to resend consent SMS.');
    } else {
      toast.success('Consent SMS resent successfully.');
    }

    setBusyFlag('resendConsent', false);
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyFlag('createTrip', true);

    const payload: CreateTripPayload = {
      ...tripForm,
      tel: toTenDigitPhone(tripForm.tel || ''),
      truck_number: tripForm.truck_number.trim().toUpperCase(),
      src: tripForm.src?.trim() || undefined,
      dest: tripForm.dest?.trim() || undefined,
      srcname: tripForm.srcname?.trim() || undefined,
      destname: tripForm.destname?.trim() || undefined,
      invoice: tripForm.invoice?.trim() || undefined,
      internalTruckId: tripForm.internalTruckId?.trim() || undefined,
      internalInvoiceId: tripForm.internalInvoiceId?.trim() || undefined,
      eta_hrs: tripForm.eta_hrs || undefined,
    };

    if (!payload.tel || payload.tel.length !== 10) {
      toast.error('Trip creation requires a valid 10-digit driver number.');
      setBusyFlag('createTrip', false);
      return;
    }
    if (!payload.truck_number) {
      toast.error('Truck number is required.');
      setBusyFlag('createTrip', false);
      return;
    }

    // Auto resolve coordinates using Google Geocoding API when names are present.
    if ((!payload.src && payload.srcname) || (!payload.dest && payload.destname)) {
      setBusyFlag('geocode', true);
      const [resolvedSrc, resolvedDest] = await Promise.all([
        !payload.src && payload.srcname
          ? geocodeWithGoogle(payload.srcname)
          : Promise.resolve(payload.src || null),
        !payload.dest && payload.destname
          ? geocodeWithGoogle(payload.destname)
          : Promise.resolve(payload.dest || null),
      ]);
      setBusyFlag('geocode', false);

      if (!payload.src && resolvedSrc) {
        payload.src = resolvedSrc;
        setTripForm((prev) => ({ ...prev, src: resolvedSrc }));
      }

      if (!payload.dest && resolvedDest) {
        payload.dest = resolvedDest;
        setTripForm((prev) => ({ ...prev, dest: resolvedDest }));
      }
    }

    if (!payload.src && !payload.srcname) {
      toast.error(
        'Source is required. Fill either Source Coordinates (src) or Source Name (srcname).'
      );
      setBusyFlag('createTrip', false);
      return;
    }
    if (!payload.dest && !payload.destname) {
      toast.error(
        'Destination is required. Fill either Destination Coordinates (dest) or Destination Name (destname).'
      );
      setBusyFlag('createTrip', false);
      return;
    }

    // Always verify latest consent during trip creation attempt.
    const consentResponse = await checkDriverConsent({ tel: payload.tel });
    if (!consentResponse.success) {
      toast.error(
        consentResponse.message ||
          'Unable to verify consent. Trip creation stopped.'
      );
      setBusyFlag('createTrip', false);
      return;
    }

    const consentRawResponse = (consentResponse.data || {}) as Record<
      string,
      unknown
    >;
    const latestConsent = pickString(consentRawResponse, [
      'consent',
      'status',
      'consentStatus',
      'consent_status',
    ]);
    setConsentState(latestConsent || '');

    if (!consentApproved(latestConsent || null)) {
      toast.error(
        `Consent is not approved for ${payload.tel}. Current status: ${
          latestConsent || 'UNKNOWN'
        }.`
      );
      setBusyFlag('createTrip', false);
      return;
    }

    const response = await createTrackingTrip(payload);
    if (!response.success) {
      toast.error(response.message || 'Failed to create trip.');
    } else {
      toast.success('Trip created successfully.');
      setTrackVehicle(payload.truck_number);
    }

    setBusyFlag('createTrip', false);
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tracking Setup</h1>
        <p className="text-sm text-gray-600">
          Admin flow: register driver number, confirm consent, then create trip for
          vehicle tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <form
          onSubmit={handleRegisterDriver}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-gray-900">1. Driver Registration</h2>
          <p className="mt-1 text-xs text-gray-500">
            Adds driver number and sends initial consent SMS.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <input
              className={inputClass}
              placeholder="Driver Phone (10 digit)"
              value={registerForm.phone_number}
              onChange={(e) =>
                setRegisterForm((prev) => ({ ...prev, phone_number: e.target.value }))
              }
            />
            <input
              className={inputClass}
              placeholder="Driver Name (optional)"
              value={registerForm.name || ''}
              onChange={(e) =>
                setRegisterForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <input
              className={inputClass}
              placeholder="Operator (airtel/jio/etc, optional)"
              value={registerForm.operator || ''}
              onChange={(e) =>
                setRegisterForm((prev) => ({ ...prev, operator: e.target.value }))
              }
            />
          </div>
          <button
            type="submit"
            disabled={busy.register}
            className="mt-4 rounded-md bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy.register ? 'Registering...' : 'Register Driver'}
          </button>
        </form>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">2. Consent Check</h2>
          <p className="mt-1 text-xs text-gray-500">
            Consent must be approved before trip creation.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <input
              className={inputClass}
              placeholder="Driver Phone (10 digit)"
              value={consentForm.tel}
              onChange={(e) => setConsentForm({ tel: e.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCheckConsent}
                disabled={busy.checkConsent}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy.checkConsent ? 'Checking...' : 'Check Consent'}
              </button>
              <button
                type="button"
                onClick={handleResendConsent}
                disabled={busy.resendConsent}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
              >
                {busy.resendConsent ? 'Resending...' : 'Resend SMS'}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Current Consent Status</div>
            <div
              className={`mt-1 inline-flex rounded px-2 py-1 text-xs font-semibold ${
                isConsentOk
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {consentState || 'Not checked'}
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreateTrip}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">3. Create Trip</h2>
            <p className="mt-1 text-xs text-gray-500">
              Admin can submit directly. Consent is validated automatically at
              create time. If coords are blank, backend resolves from source and
              destination names.
            </p>
          </div>
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${
              isConsentOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {isConsentOk ? 'Consent Approved' : 'Consent Required'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            className={inputClass}
            placeholder="Driver Phone (tel)"
            value={tripForm.tel}
            onChange={(e) => setTripForm((prev) => ({ ...prev, tel: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Truck Number (required)"
            value={tripForm.truck_number}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, truck_number: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Source Coordinates lat,lng (or use srcname)"
            value={tripForm.src || ''}
            onChange={(e) => setTripForm((prev) => ({ ...prev, src: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Destination Coordinates lat,lng (or use destname)"
            value={tripForm.dest || ''}
            onChange={(e) => setTripForm((prev) => ({ ...prev, dest: e.target.value }))}
          />
          <input
            type="number"
            className={inputClass}
            placeholder="ETA Hours (optional)"
            value={tripForm.eta_hrs ?? ''}
            onChange={(e) =>
              setTripForm((prev) => ({
                ...prev,
                eta_hrs: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
          <input
            className={inputClass}
            placeholder="Source Name (use if src coords not given)"
            value={tripForm.srcname || ''}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, srcname: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Destination Name (use if dest coords not given)"
            value={tripForm.destname || ''}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, destname: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Invoice Ref (optional)"
            value={tripForm.invoice || ''}
            onChange={(e) => setTripForm((prev) => ({ ...prev, invoice: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Internal Truck ID (optional)"
            value={tripForm.internalTruckId || ''}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, internalTruckId: e.target.value }))
            }
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy.createTrip || busy.geocode}
            className="rounded-md bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy.geocode
              ? 'Fetching Coords...'
              : busy.createTrip
              ? 'Creating Trip...'
              : 'Create Trip'}
          </button>
        </div>

      </form>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Live Tracking</h2>
            <p className="mt-1 text-xs text-gray-500">
              Fetches current tracking state for a vehicle.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto refresh (20s)
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className={`${inputClass} w-full max-w-md`}
            placeholder="Vehicle Number"
            value={trackVehicle}
            onChange={(e) => setTrackVehicle(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void refreshTracking()}
            disabled={busy.refreshTracking}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy.refreshTracking ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {trackingData ? (
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
              <div className="text-xs text-gray-500">Consent Status</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.consentStatus || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ETA</div>
              <div className="text-sm font-semibold text-gray-900">{trackingData.eta || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Latitude</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.lat ?? '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Longitude</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.lng ?? '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Last Recorded</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.timeRecorded || '-'}
              </div>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <div className="text-xs text-gray-500">Address</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.address || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Distance Remaining</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.distanceRemained || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Time Remaining</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.timeRemained || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Message</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.message || '-'}
              </div>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
