import axios, { AxiosError } from "axios";
import { getStoredAuthToken } from "@/features/auth/api";

/**
 * Backend base URL
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

/* -------------------------------------------------------------------------- */
/* Types                                   */
/* -------------------------------------------------------------------------- */

export interface TruckLocation {
  lat: number;
  lng: number;
  speed?: number;
  address?: string;
  time?: string;
  distance_remained?: number;
}

export interface LocationPoint {
  lat: number;
  lng: number;
}

export interface TruckSessionInfo {
  id?: string;
  startedAt?: string;
  [key: string]: any;
}

export interface TripData {
  trip_id: string;
  trip_uid: string;
  truck_number: string;
  start_time: string;
  tel: number;
  invoice: string;
  lr_number: string;
  share_url: string;
  consent_status: string;
  origin: LocationPoint;
  destination: LocationPoint;
  last_loc: TruckLocation;
  eta: string;
  trip_status: string;
  extra_status: string;
  distance_travel: string;
  total_distance: string;
  speed: number;
  origin_in: string;
  origin_out: string;
  destination_in: string;
  destination_out: string;
  total_halt_time: string;
  halts: any[];
}

export interface TrackingData {
  vehicleNumber: string;
  truckId?: string;
  tripId?: string;
  tripStatus?: string;
  status: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
    timeRecorded?: string;
    distanceRemained?: number;
    timeRemained?: number;
    distanceTravel?: number;
    totalDistance?: number;
  };
  origin?: LocationPoint;
  destination?: LocationPoint;
  originLabel?: string;
  destinationLabel?: string;
  consentStatus?: string;
  eta?: string;
  shareUrl?: string;
  shareToken?: string;
  session?: TruckSessionInfo;
  // Allow backend to send extra fields without breaking the UI
  [key: string]: any;
}

export interface LiveTrackingTrip {
  id: string;
  tripId?: string | null;
  vehicleNumber: string;
  status: string;
  route?: string;
  sourceName?: string | null;
  destinationName?: string | null;
  product?: string | null;
  invoiceNumber?: string | null;
  eta?: string | null;
  updatedAt?: string;
  lastLocation?: {
    address?: string | null;
    timeRecorded?: string | null;
    distanceRemained?: string | number | null;
    timeRemained?: string | number | null;
    distanceTravel?: number | null;
    totalDistance?: number | null;
  } | null;
}

export interface TrackingRoute {
  provider: string;
  generatedAt?: string;
  origin?: LocationPoint | null;
  current?: LocationPoint | null;
  destination?: LocationPoint | null;
  points: LocationPoint[];
  distanceMeters?: number | null;
  durationSeconds?: number | null;
}

export interface TrackingResponse {
  success: boolean;
  data: TrackingData;
  message?: string;
}

export interface TrackingLinkContext {
  vehicleNumber: string;
  maskedPhone: string;
  expiresAt?: string;
}

export interface TrackingLinkOtpResponse {
  success: boolean;
  vehicleNumber: string;
  maskedPhone: string;
  message?: string;
}

export interface TrackingLinkVerifyResponse extends TrackingLinkOtpResponse {
  accessToken: string;
  expiresIn?: string;
}

export interface ApiError {
  success: boolean;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* APIs                                    */
/* -------------------------------------------------------------------------- */

/**
 * Track a vehicle by its number using the new trucks tracker API
 * Backend endpoint: GET /trucks/track/:vehicleNumber
 * @param vehicleNumber - The vehicle registration number (e.g. UP32AB1234)
 */
export const trackVehicle = async (
  vehicleNumber: string,
  options?: { accessToken?: string | null }
): Promise<TrackingResponse> => {
  try {
    const hasExplicitAccessToken =
      options && Object.prototype.hasOwnProperty.call(options, "accessToken");
    const token = hasExplicitAccessToken
      ? options.accessToken
      : typeof window !== "undefined"
        ? getStoredAuthToken()
        : null;

    const response = await axios.get<TrackingResponse>(
      `${API_BASE_URL}/trucks/track/${encodeURIComponent(vehicleNumber)}`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    // Some backends may not wrap the response in { success, data }
    if ((response.data as any)?.data && (response.data as any)?.success !== undefined) {
      return response.data;
    }

    // If backend returns raw tracking object, normalise it
    const raw = response.data as any;

    // Direct mapping for the API response structure you provided
    const normalised: TrackingResponse = {
      success: raw.success ?? true,
      data: {
        vehicleNumber: raw.vehicleNumber ?? vehicleNumber,
        truckId: raw.truckId,
        tripId: raw.tripId,
        tripStatus: raw.tripStatus,
        status: raw.status === 'tracking' ? 'online' : 'offline',
        location: raw.location,
        origin: raw.origin,
        destination: raw.destination,
        originLabel: raw.originLabel,
        destinationLabel: raw.destinationLabel,
        consentStatus: raw.consentStatus,
        eta: raw.eta,
        shareUrl: raw.shareUrl ?? raw.shareURL,
      },
      message: raw.message,
    };

    return normalised;
  } catch (error) {
    const err = error as AxiosError<ApiError | any>;
    const message =
      (err.response?.data as any)?.message ||
      (err.response?.data as any)?.error ||
      "Failed to fetch vehicle location";
    throw { message };
  }
};

export const getLiveTrackingTrips = async (): Promise<LiveTrackingTrip[]> => {
  try {
    const token = typeof window !== "undefined" ? getStoredAuthToken() : null;
    const response = await axios.get<LiveTrackingTrip[]>(
      `${API_BASE_URL}/trucks/track/live-trips`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const err = error as AxiosError<ApiError | any>;
    throw new Error(
      (err.response?.data as any)?.message ||
        (err.response?.data as any)?.error ||
        "Unable to load live trips",
    );
  }
};

export const getTrackingRoute = async (
  vehicleNumber: string,
  options?: { accessToken?: string | null },
): Promise<TrackingRoute> => {
  try {
    const hasExplicitAccessToken =
      options && Object.prototype.hasOwnProperty.call(options, "accessToken");
    const token = hasExplicitAccessToken
      ? options.accessToken
      : typeof window !== "undefined"
        ? getStoredAuthToken()
        : null;
    const response = await axios.get<TrackingRoute>(
      `${API_BASE_URL}/trucks/track/${encodeURIComponent(vehicleNumber)}/route`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    return {
      ...response.data,
      points: Array.isArray(response.data?.points) ? response.data.points : [],
    };
  } catch (error) {
    const err = error as AxiosError<ApiError | any>;
    throw new Error(
      (err.response?.data as any)?.message ||
        (err.response?.data as any)?.error ||
        "Unable to load the trip route",
    );
  }
};

export const getTrackingLinkContext = async (
  token: string
): Promise<TrackingLinkContext> => {
  try {
    const response = await axios.get<TrackingLinkContext>(
      `${API_BASE_URL}/trucks/track/link/${encodeURIComponent(token)}/context`
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError | any>;
    if (err.response?.status === 404) {
      throw new Error(
        "Tracking unlock is not available right now. Please try again in a few minutes."
      );
    }
    throw new Error(
      (err.response?.data as any)?.message ||
        (err.response?.data as any)?.error ||
        "Tracking link expired or invalid"
    );
  }
};

export const sendTrackingLinkOtp = async (
  token: string
): Promise<TrackingLinkOtpResponse> => {
  try {
    const response = await axios.post<TrackingLinkOtpResponse>(
      `${API_BASE_URL}/trucks/track/link/${encodeURIComponent(token)}/send-otp`
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError | any>;
    throw new Error(
      (err.response?.data as any)?.message ||
        (err.response?.data as any)?.error ||
        "OTP send nahi ho paya"
    );
  }
};

export const verifyTrackingLinkOtp = async (
  token: string,
  otp: string
): Promise<TrackingLinkVerifyResponse> => {
  try {
    const response = await axios.post<TrackingLinkVerifyResponse>(
      `${API_BASE_URL}/trucks/track/link/${encodeURIComponent(token)}/verify-otp`,
      { otp }
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError | any>;
    throw new Error(
      (err.response?.data as any)?.message ||
        (err.response?.data as any)?.error ||
        "Invalid OTP"
    );
  }
};
