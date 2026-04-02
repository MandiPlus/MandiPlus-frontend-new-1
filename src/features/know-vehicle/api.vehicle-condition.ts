// Updated version of api.vehicle-condition.ts
import axios, { AxiosResponse } from "axios";
import { getStoredAuthToken } from "@/features/auth/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

// Request types
// In api.vehicle-condition.ts
export interface VehicleConditionPayload {
  vehicleNumber: string;
  permitStatus?: boolean;
  driverLicense?: boolean;
  vehicleCondition?: boolean;
  challanClear?: boolean;
  emiClear?: boolean;
  fitnessClear?: boolean;
}
// Response types
export interface VehicleConditionDetails {
  permit: string;
  driverLicense: string;
  vehicleCondition: string;
  challan: string;
  emi: string;
  fitness: string;
  claim: string;
}

export interface VehicleVerificationResponse {
  vehicleNumber: string;
  details: VehicleConditionDetails;
  verified: boolean;
  reason: string | null;
}

export const upsertVehicleCondition = async (
  payload: VehicleConditionPayload
): Promise<VehicleConditionPayload> => {
  const token = getStoredAuthToken();
  if (!token) {
    throw new Error("Authentication token not found");
  }

  const response: AxiosResponse<VehicleConditionPayload> = await axios.post(
    `${API_BASE_URL}/vehicle-condition`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

export const verifyVehicleCondition = async (
  vehicleNumber: string
): Promise<VehicleVerificationResponse> => {
  const token = getStoredAuthToken();
  if (!token) {
    throw new Error("Authentication token not found");
  }

  const response: AxiosResponse<VehicleVerificationResponse> = await axios.get(
    `${API_BASE_URL}/vehicle-condition/${encodeURIComponent(vehicleNumber)}/verify`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};
