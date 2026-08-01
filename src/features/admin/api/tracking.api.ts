import axios, { AxiosError } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export interface AdminTrackingApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

type GenericPayload = Record<string, unknown>;
type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
};

export interface AddDriverPayload {
  phone_number: string;
  /** Full plate or last 4 digits — required so automation can bind an invoice. */
  vehicle_number: string;
  name?: string;
  operator?: string;
}

export interface RegisterDriverForVehiclePayload {
  phone_number: string;
  vehicle_number: string;
  name?: string;
  operator?: string;
}

export type DriverConsentState = "PENDING" | "ALLOWED" | "DENIED";

export interface DriverConsentRegistrationRow {
  id: string;
  phoneNumber: string;
  vehicleNumber: string;
  driverName: string | null;
  operator: string | null;
  consentState: DriverConsentState;
  lastConsentStatusRaw: string | null;
  lastPolledAt: string | null;
  consentAllowedAt: string | null;
  autoTripCreatedAt: string | null;
  autoTripError: string | null;
  giveUpNotifiedAt: string | null;
  invoice: { id: string; invoiceNumber?: string } | null;
  autoTrip: { id: string; traqoTripId: string | null; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckConsentPayload {
  tel: string;
}

export interface CreateTripPayload {
  tel: string;
  truck_number: string;
  src?: string;
  dest?: string;
  srcname?: string;
  destname?: string;
  invoice?: string;
  eta_days?: number;
  eta_time?: number;
  eta_hrs?: number;
  internalInvoiceId?: string;
  internalTruckId?: string;
}

export interface TrackingInvoiceDraft {
  id: string;
  invoiceNumber: string;
  supplierName?: string | null;
  driverPhone: string;
  driverSecondaryPhone?: string | null;
  driverOperator?: string | null;
  driverSecondaryOperator?: string | null;
  vehicleNumber?: string | null;
  sourceName?: string | null;
  destinationName?: string | null;
  consentStatus?: string | null;
  createdAt?: string;
}

export interface TruckTrackingResponse {
  vehicleNumber: string;
  truckId: string;
  tripId: string | null;
  tripStatus: "PENDING" | "ACTIVE" | "ENDED" | null;
  status: "tracking" | "not_tracking";
  location: {
    lat: number | null;
    lng: number | null;
    address: string | null;
    timeRecorded: string | null;
    distanceRemained: string | null;
    timeRemained: string | null;
    distanceTravel?: number | null;
    totalDistance?: number | null;
  } | null;
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  consentStatus: string | null;
  eta: string | null;
  message?: string;
}

export interface AdminTripRow {
  id: string;
  traqoTripId: string | null;
  tel: string;
  src: string | null;
  dest: string | null;
  srcname?: string | null;
  destname?: string | null;
  sourceName?: string | null;
  destinationName?: string | null;
  status: "PENDING" | "ACTIVE" | "ENDED";
  createdAt: string;
  updatedAt: string;
  truck: {
    id: string;
    truckNumber: string;
  } | null;
  vehicleNumber?: string | null;
  invoice: {
    id: string;
    invoiceNumber?: string;
    driverPhone?: string | null;
    driverSecondaryPhone?: string | null;
    driverConsentStatus?: string | null;
    driverConsentOperator?: string | null;
    supplierName?: string | null;
    supplierAddress?: string[] | null;
    billToName?: string | null;
    billToAddress?: string[] | null;
    shipToName?: string | null;
    shipToAddress?: string[] | null;
  } | null;
  recipientPhone?: string | null;
  alerts?: {
    reachedSentAt?: string | null;
    delayedSentAt?: string | null;
    delayedReason?: string | null;
    lastEvaluatedAt?: string | null;
    lastEta?: string | null;
  } | null;
  lastLocation?: {
    address?: string | null;
    timeRecorded?: string | null;
    distanceRemained?: number | null;
    timeRemained?: string | null;
    distanceTravel?: number | null;
    totalDistance?: number | null;
  } | null;
}

export interface ManualTripAlertPayload {
  alertKind: "reached" | "delayed" | "current_position";
  phoneOverride?: string;
}

export interface TraqoConsentRow {
  phone_number: string;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  update_at: string | null;
  status: string | null;
  operator: string | null;
  last_24h: string | null;
  name: string | null;
  gender: string | null;
  total_distance: number | null;
  total_requests: number | null;
  avg_speed: number | null;
}

function getAuthHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as AxiosError<ApiErrorPayload>;
  const payload = err.response?.data;
  if (typeof payload?.message === "string") return payload.message;
  if (Array.isArray(payload?.message)) return payload.message.join(", ");
  if (typeof payload?.error === "string") return payload.error;
  return fallback;
}

/**
 * @deprecated Prefer registerDriverForVehicle. Kept as a compatibility wrapper
 * so any leftover callers still enroll into the consent → auto-trip pipeline.
 */
export async function addDriverNumber(
  payload: AddDriverPayload,
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  const vehicleNumber = String(payload.vehicle_number || "").trim();
  if (!vehicleNumber) {
    return {
      success: false,
      message:
        "vehicle_number is required (full plate or last 4 digits) so the trip can be auto-created after consent.",
    };
  }
  return registerDriverForVehicle({
    phone_number: payload.phone_number,
    vehicle_number: vehicleNumber,
    name: payload.name,
    operator: payload.operator,
  });
}

export async function registerDriverForVehicle(
  payload: RegisterDriverForVehiclePayload,
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/traqo/register-for-vehicle`,
      payload,
      { headers: getAuthHeaders() },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to register driver for vehicle"),
    };
  }
}

export async function lookupDriverOperator(
  phoneNumber: string,
): Promise<
  AdminTrackingApiResponse<{
    phone_number: string;
    operator: string | null;
    consentStatus: string | null;
    found: boolean;
    message?: string;
  }>
> {
  const phone = String(phoneNumber || "").replace(/\D/g, "").slice(-10);

  try {
    const res = await axios.get(`${API_BASE_URL}/traqo/lookup-operator`, {
      params: { phone_number: phone },
      headers: getAuthHeaders(),
    });
    return { success: true, data: res.data };
  } catch (primaryError) {
    // Fallback for backends that haven't deployed lookup-operator yet.
    // Traqo check_consent already returns { consent, tel, operator }.
    try {
      const res = await axios.post(
        `${API_BASE_URL}/traqo/check-consent`,
        { tel: phone },
        { headers: getAuthHeaders() },
      );
      const payload = res.data || {};
      if (payload?.error) {
        return {
          success: true,
          data: {
            phone_number: phone,
            operator: null,
            consentStatus: null,
            found: false,
            message:
              "Number is not in Traqo yet — operator will be detected after registration.",
          },
        };
      }
      const operator =
        typeof payload.operator === "string" ? payload.operator : null;
      const consentStatus =
        typeof payload.consent === "string"
          ? payload.consent
          : typeof payload.status === "string"
            ? payload.status
            : null;
      return {
        success: true,
        data: {
          phone_number: phone,
          operator,
          consentStatus,
          found: Boolean(operator || consentStatus),
          message: operator
            ? `Operator detected: ${operator}`
            : "Number is not in Traqo yet — operator will be detected after registration.",
        },
      };
    } catch (fallbackError) {
      return {
        success: false,
        message: getErrorMessage(
          primaryError,
          getErrorMessage(fallbackError, "Failed to lookup driver operator"),
        ),
      };
    }
  }
}

export async function listDriverRegistrations(): Promise<
  AdminTrackingApiResponse<DriverConsentRegistrationRow[]>
> {
  try {
    const res = await axios.get<DriverConsentRegistrationRow[]>(
      `${API_BASE_URL}/traqo/driver-registrations`,
      { headers: getAuthHeaders() },
    );
    return { success: true, data: Array.isArray(res.data) ? res.data : [] };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to fetch driver registrations"),
    };
  }
}

export async function checkDriverConsent(
  payload: CheckConsentPayload,
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/traqo/check-consent`,
      payload,
      {
        headers: getAuthHeaders(),
      },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to check consent"),
    };
  }
}

export async function resendDriverConsentSms(
  phoneNumber: string,
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/traqo/resend-consent`,
      { phone_number: phoneNumber },
      { headers: getAuthHeaders() },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to resend consent SMS"),
    };
  }
}

export async function listCreatedConsents(): Promise<
  AdminTrackingApiResponse<TraqoConsentRow[]>
> {
  try {
    const res = await axios.get<TraqoConsentRow[]>(
      `${API_BASE_URL}/traqo/consents`,
      {
        headers: getAuthHeaders(),
      },
    );
    return { success: true, data: Array.isArray(res.data) ? res.data : [] };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to fetch created consents"),
    };
  }
}

export async function createTrackingTrip(
  payload: CreateTripPayload,
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(`${API_BASE_URL}/traqo/trips`, payload, {
      headers: getAuthHeaders(),
    });
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to create trip"),
    };
  }
}

export async function listInvoiceDriverDrafts(
  limit = 20,
): Promise<AdminTrackingApiResponse<TrackingInvoiceDraft[]>> {
  try {
    const res = await axios.get<TrackingInvoiceDraft[]>(
      `${API_BASE_URL}/traqo/invoice-driver-drafts`,
      {
        headers: getAuthHeaders(),
        params: { limit },
      },
    );
    return { success: true, data: Array.isArray(res.data) ? res.data : [] };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to fetch invoice driver details"),
    };
  }
}

export async function clearInvoiceDriverDraft(
  invoiceId: string,
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.delete(
      `${API_BASE_URL}/traqo/invoice-driver-drafts/${encodeURIComponent(invoiceId)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to remove invoice driver details"),
    };
  }
}

export async function getTruckTracking(
  vehicleNumber: string,
): Promise<AdminTrackingApiResponse<TruckTrackingResponse>> {
  try {
    const res = await axios.get<TruckTrackingResponse>(
      `${API_BASE_URL}/trucks/track/${encodeURIComponent(vehicleNumber)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to fetch truck tracking"),
    };
  }
}

export async function listTrips(): Promise<
  AdminTrackingApiResponse<AdminTripRow[]>
> {
  try {
    const res = await axios.get<AdminTripRow[]>(`${API_BASE_URL}/traqo/trips`, {
      headers: getAuthHeaders(),
    });
    return { success: true, data: Array.isArray(res.data) ? res.data : [] };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to fetch trips"),
    };
  }
}

export async function closeTrip(
  traqoTripId: string,
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/traqo/trips/end`,
      { id: traqoTripId },
      { headers: getAuthHeaders() },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to close trip"),
    };
  }
}

export async function editTrip(
  tripId: string,
  updates: {
    truck_number?: string;
    tel?: string;
    src?: string;
    dest?: string;
    srcname?: string;
    destname?: string;
  },
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.patch(
      `${API_BASE_URL}/traqo/trips/${tripId}`,
      updates,
      { headers: getAuthHeaders() },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to edit trip"),
    };
  }
}

export async function sendManualTripAlert(
  tripId: string,
  payload: ManualTripAlertPayload,
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/trucks/track/alerts/trip/${encodeURIComponent(tripId)}/send`,
      payload,
      { headers: getAuthHeaders() },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to send manual trip alert"),
    };
  }
}

export async function sendCurrentPositionAlertsForActiveTrips(): Promise<
  AdminTrackingApiResponse<{ processed?: number; sent?: number }>
> {
  try {
    const res = await axios.post<{ processed?: number; sent?: number }>(
      `${API_BASE_URL}/trucks/track/alerts/current-position/send-active`,
      {},
      { headers: getAuthHeaders() },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(
        error,
        "Failed to send current-position alerts for active trips",
      ),
    };
  }
}
