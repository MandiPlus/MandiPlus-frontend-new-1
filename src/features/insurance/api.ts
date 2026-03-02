import axios, { AxiosError } from "axios";

// 1. BACKEND BASE URL
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export const getBackendURL = () => {
  return API_BASE_URL.replace("/api", "");
};

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface InsuranceForm {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierAddress: string[];
  placeOfSupply: string;
  billToName: string;
  billToAddress: string[];
  shipToName: string;
  shipToAddress: string[];
  productName: string[];
  hsnCode?: string;
  quantity: number;
  rate: number;
  amount: number;
  vehicleNumber?: string;
  truckNumber?: string;
  weighmentSlipNote?: string;
  weighmentSlipUrls?: string[];
  isClaim?: boolean;
  claimDetails?: string;
  pdfUrl?: string;
  pdfURL?: string;
  createdAt?: string;
  invoiceType?: "SUPPLIER_INVOICE" | "BUYER_INVOICE";
}

// ✅ NEW: Type for regenerating invoice
export interface RegenerateInvoicePayload {
  invoiceId: string;
  invoiceDate?: string;
  terms?: string;
  invoiceType?: "SUPPLIER_INVOICE" | "BUYER_INVOICE";
  supplierName?: string;
  supplierAddress?: string[];
  placeOfSupply?: string;
  billToName?: string;
  billToAddress?: string[];
  shipToName?: string;
  shipToAddress?: string[];
  productName?: string;
  hsnCode?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  truckNumber?: string;
  vehicleNumber?: string;
  weighmentSlipNote?: string;
  isClaim?: boolean;
  claimDetails?: string;
}
export interface ClaimRequest {
  id: string;
  status: string; // 'PENDING', 'SURVEYOR_ASSIGNED', 'APPROVED', 'REJECTED'
  createdAt: string;
  invoice: InsuranceForm; // Linked invoice
  surveyorName?: string;
  surveyorContact?: string;
  claimFormUrl?: string; // URL for the generated PDF
  // New individual media fields
  fir?: string | null; // FIR document URL
  accidentPic?: string | null; // Accident picture URL
  inspectionReport?: string | null; // Inspection report URL (PDF only, Admin only)
  lorryReceipt?: string | null; // Lorry receipt URL
  insurancePolicy?: string | null; // Insurance policy URL
  damageFormUrl?: string | null; // Damage form PDF URL
  // Legacy field (deprecated)
  supportedMedia?: string[];
  notes?: string;
}

// Added this DTO for the damage form
export interface CreateDamageFormDto {
  damageCertificateDate: string;
  transportReceiptMemoNo: string;
  transportReceiptDate: string;
  loadedWeightKg: number;
  productName: string;
  fromParty: string;
  forParty: string;
  accidentDate: string;
  accidentLocation: string;
  accidentDescription: string;
  agreedDamageAmountNumber: number;
  agreedDamageAmountWords: string;
  authorizedSignatoryName: string;
}

export type CreateInsuranceResponse = InsuranceForm;

export interface InvoiceCustomerAccount {
  id: string;
  name: string;
  mobileNumber: string;
  walletId?: string;
  walletBalance?: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

/* -------------------------------------------------------------------------- */
/* APIs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Create a new Insurance Form (Invoice)
 * POST /invoices
 */
export const createInsuranceForm = async (
  formData: FormData,
): Promise<CreateInsuranceResponse> => {
  try {
    const token = localStorage.getItem("token");

    const response = await axios.post(`${API_BASE_URL}/invoices`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw err.response?.data || { message: "Failed to create invoice" };
  }
};

export const getInvoiceCustomerAccounts = async (): Promise<
  InvoiceCustomerAccount[]
> => {
  try {
    const token =
      localStorage.getItem("accessToken") || localStorage.getItem("token");

    const response = await axios.get(`${API_BASE_URL}/invoices/customer-accounts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = response.data?.data ?? response.data;
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw err.response?.data || { message: "Failed to fetch customer accounts" };
  }
};

/**
 * Get all insurance forms for the logged-in user
 * GET /invoices/user/:userId
 */
export const getMyInsuranceForms = async (): Promise<InsuranceForm[]> => {
  try {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!userData) {
      throw new Error("User not found. Please log in again.");
    }

    const user = JSON.parse(userData);
    if (!user.id) {
      throw new Error("User ID not found. Please log in again.");
    }

    const response = await axios.get(
      `${API_BASE_URL}/invoices/user/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw err.response?.data || { message: "Failed to fetch invoices" };
  }
};
/**
 * Get all claim requests for the logged-in user
 * GET /claim-requests/user/:userId
 */
export const getMyClaimsForms = async (): Promise<ClaimRequest[]> => {
  try {
    const token = localStorage.getItem("accessToken");
    const userData = localStorage.getItem("user");

    if (!userData) throw new Error("User not found");
    const user = JSON.parse(userData);

    const response = await axios.get(
      `${API_BASE_URL}/claim-requests/user/${user.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError<any>;
    throw err.response?.data || { message: "Failed to fetch claims" };
  }
};

/**
 * NEW: Create a new Claim by Truck Number
 * POST /claim-requests/by-truck
 */
export const createClaimByTruck = async (
  truckNumber: string,
): Promise<ClaimRequest> => {
  try {
    const token = localStorage.getItem("accessToken");
    const response = await axios.post(
      `${API_BASE_URL}/claim-requests/by-truck`,
      { truckNumber },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError<any>;
    throw err.response?.data || { message: "Failed to create claim" };
  }
};

/**
 * NEW: Upload Individual Media File for Claim
 * POST /claim-requests/:id/media/:mediaType
 * @param claimId - Claim request ID
 * @param mediaType - One of: 'fir', 'accidentPic', 'inspectionReport', 'lorryReceipt', 'insurancePolicy'
 * @param file - Single file to upload
 */
export const uploadClaimMedia = async (
  claimId: string,
  mediaType:
    | "fir"
    | "accidentPic"
    | "inspectionReport"
    | "lorryReceipt"
    | "insurancePolicy",
  file: File,
): Promise<ClaimRequest> => {
  try {
    const token = localStorage.getItem("accessToken");
    const formData = new FormData();
    formData.append("file", file);

    const response = await axios.post(
      `${API_BASE_URL}/claim-requests/${claimId}/media/${mediaType}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError<any>;
    throw err.response?.data || { message: "Failed to upload media" };
  }
};

/**
 * NEW: Submit Damage Certificate Form
 * POST /claim-requests/:id/damage-form
 */
export const submitDamageForm = async (
  claimId: string,
  data: CreateDamageFormDto,
): Promise<any> => {
  try {
    const token = localStorage.getItem("accessToken");
    const response = await axios.post(
      `${API_BASE_URL}/claim-requests/${claimId}/damage-form`,
      data,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError<any>;
    throw err.response?.data || { message: "Failed to submit damage form" };
  }
};
/**
 * ✅ NEW: Regenerate Invoice PDF
 * POST /invoices/regenerate
 *
 * Updates invoice data and regenerates PDF
 */
export const regenerateInvoice = async (
  payload: RegenerateInvoicePayload,
): Promise<InsuranceForm> => {
  try {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      throw new Error("Authentication required. Please log in.");
    }

    const response = await axios.post(
      `${API_BASE_URL}/invoices/regenerate`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;

    const message =
      err.response?.data?.message ||
      err.message ||
      "Failed to regenerate invoice";

    const errorMessage = Array.isArray(message) ? message.join(", ") : message;

    console.error("Regenerate invoice error:", errorMessage);

    throw new Error(errorMessage);
  }
};

/**
 * ✅ NEW: Upload Weighment Slips
 * POST /invoices/:id/weighment-slips
 */
export const uploadWeighmentSlips = async (
  invoiceId: string,
  files: File[],
): Promise<InsuranceForm> => {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      throw new Error("Authentication required");
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("weighmentSlips", file);
    });

    const response = await axios.post(
      `${API_BASE_URL}/invoices/${invoiceId}/weighment-slips`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    const message =
      err.response?.data?.message || err.message || "Failed to upload files";
    const errorMessage = Array.isArray(message) ? message.join(", ") : message;
    throw new Error(errorMessage);
  }
};

/**
 * ✅ BONUS: Get single invoice by ID
 * GET /invoices/:id
 */
export const getInvoiceById = async (
  invoiceId: string,
): Promise<InsuranceForm> => {
  try {
    const token = localStorage.getItem("token");

    const response = await axios.get(`${API_BASE_URL}/invoices/${invoiceId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw err.response?.data || { message: "Failed to fetch invoice" };
  }
};

/**
 * ✅ ATOMIC UPDATE: Updates text AND uploads file in one go
 * PATCH /invoices/:id
 */
export const updateInvoice = async (
  invoiceId: string,
  formData: FormData,
): Promise<InsuranceForm> => {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await axios.patch(
      `${API_BASE_URL}/invoices/${invoiceId}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    const message =
      err.response?.data?.message || err.message || "Failed to update invoice";
    const errorMessage = Array.isArray(message) ? message.join(", ") : message;
    throw new Error(errorMessage);
  }
};
