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
  name?: string;
  operator?: string;
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
  status: "PENDING" | "ACTIVE" | "ENDED";
  createdAt: string;
  updatedAt: string;
  truck: {
    id: string;
    truckNumber: string;
  } | null;
  invoice: {
    id: string;
    invoiceNumber?: string;
  } | null;
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

export async function addDriverNumber(
  payload: AddDriverPayload
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(`${API_BASE_URL}/traqo/add-number`, payload, {
      headers: getAuthHeaders(),
    });
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to register driver number"),
    };
  }
}

export async function checkDriverConsent(
  payload: CheckConsentPayload
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/traqo/check-consent`,
      payload,
      {
        headers: getAuthHeaders(),
      }
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
  phoneNumber: string
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/traqo/resend-consent`,
      { phone_number: phoneNumber },
      { headers: getAuthHeaders() }
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to resend consent SMS"),
    };
  }
}

export async function createTrackingTrip(
  payload: CreateTripPayload
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

export async function getTruckTracking(
  vehicleNumber: string
): Promise<AdminTrackingApiResponse<TruckTrackingResponse>> {
  try {
    const res = await axios.get<TruckTrackingResponse>(
      `${API_BASE_URL}/trucks/track/${encodeURIComponent(vehicleNumber)}`,
      {
        headers: getAuthHeaders(),
      }
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
  traqoTripId: string
): Promise<AdminTrackingApiResponse<GenericPayload>> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/traqo/trips/end`,
      { id: traqoTripId },
      { headers: getAuthHeaders() }
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Failed to close trip"),
    };
  }
}
