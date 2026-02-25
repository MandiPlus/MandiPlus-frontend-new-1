import axios, { AxiosError } from "axios";

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
  };
  origin?: LocationPoint;
  destination?: LocationPoint;
  consentStatus?: string;
  eta?: string;
  shareUrl?: string;
  shareToken?: string;
  session?: TruckSessionInfo;
  // Allow backend to send extra fields without breaking the UI
  [key: string]: any;
}

export interface TrackingResponse {
  success: boolean;
  data: TrackingData;
  message?: string;
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
  vehicleNumber: string
): Promise<TrackingResponse> => {
  try {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

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