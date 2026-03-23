import axios, { AxiosError } from "axios";
import { getStoredAuthToken } from "@/features/auth/api";

/**
 * Backend base URL
 */
const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface VehicleDetails {
    vehicleNumber: string;
    permitStatus: string;       // e.g., 'Active'
    driverLicenseStatus: string; // e.g., 'Available'
    vehicleCondition: string;    // e.g., 'OK'
    challanStatus: string;       // e.g., 'No Challan Found'
    emiStatus: string;           // e.g., 'Paid On Time'
    fitnessStatus: string;       // e.g., 'Fit'
    isVerified: boolean;         // true if "MandiPlus Verified"
    imageUrl?: string;           // Optional URL for the vehicle image
}

export interface VehicleResponse {
    success: boolean;
    data: VehicleDetails;
    message?: string;
}

export interface ApiError {
    success: boolean;
    message: string;
}

/* -------------------------------------------------------------------------- */
/* APIs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Get details for a specific vehicle number
 * @param vehicleNumber - The vehicle registration number
 */
export const getVehicleDetails = async (vehicleNumber: string): Promise<VehicleDetails> => {
    try {
        const token = getStoredAuthToken();

        // Example endpoint: POST /api/vehicle/details
        // Note: If your backend uses GET, change .post to .get and pass vehicleNumber as query param
        const response = await axios.post<VehicleResponse>(
            `${API_BASE_URL}/vehicle/details`,
            { vehicleNumber },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data.data;
    } catch (error) {
        const err = error as AxiosError<ApiError>;
        throw err.response?.data || { message: "Failed to fetch vehicle details" };
    }
};
