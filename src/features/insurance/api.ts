import axios, { AxiosError } from "axios";
import { getStoredAuthToken } from "@/features/auth/api";

// 1. BACKEND BASE URL
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export const getBackendURL = () => {
  return API_BASE_URL.replace("/api", "");
};

type InsuranceAdminTokenClaims = {
  exp?: number;
  role?: string;
  sections?: string[];
};

const decodeJwtClaims = (token: string): InsuranceAdminTokenClaims | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded)) as InsuranceAdminTokenClaims;
  } catch {
    return null;
  }
};

export const getStoredInsuranceAdminToken = (): string | null => {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem("impersonationActive") === "1") return null;

  const token = localStorage.getItem("adminToken");
  return getEligibleInsuranceAdminToken(token);
};

const getEligibleInsuranceAdminToken = (
  token: string | null,
): string | null => {
  if (!token) return null;

  const claims = decodeJwtClaims(token);
  if (!claims?.exp || claims.exp * 1000 <= Date.now()) return null;
  const role = String(claims.role || "").toLowerCase();
  if (role === "admin") return token;
  if (
    role === "limited_admin" &&
    Array.isArray(claims.sections) &&
    claims.sections.includes("insurance-forms")
  ) {
    return token;
  }
  return null;
};

export const hasStoredInsuranceAdminSession = (): boolean =>
  Boolean(getStoredInsuranceAdminToken());

export const getStoredInsuranceAdminActorToken = (): string | null => {
  if (typeof window === "undefined") return null;

  const isImpersonating =
    sessionStorage.getItem("impersonationActive") === "1";
  const token = isImpersonating
    ? sessionStorage.getItem("impersonationAdminToken") ||
      localStorage.getItem("adminToken")
    : localStorage.getItem("adminToken");

  return getEligibleInsuranceAdminToken(token);
};

export const hasStoredInsuranceAdminActorSession = (): boolean =>
  Boolean(getStoredInsuranceAdminActorToken());

const getInsuranceRequestToken = (): string | null => {
  return getStoredInsuranceAdminToken() || getStoredAuthToken();
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
  premiumAmount?: number;
  insurancePremiumPerLakh?: number;
  insurancePremiumRateVersion?: number;
  premiumPricedUserId?: string | null;
  vehicleNumber?: string;
  truckNumber?: string;
  weighmentSlipNote?: string;
  weighmentSlipUrls?: string[];
  isClaim?: boolean;
  claimDetails?: string;
  pdfUrl?: string;
  pdfURL?: string;
  insurance?:
    | {
        fileUrl?: string;
        url?: string;
        fileType?: string;
        uploadedAt?: string;
      }
    | string
    | null;
  insuranceFileUrl?: string;
  insuranceUrl?: string;
  createdAt?: string;
  invoiceType?: "SUPPLIER_INVOICE" | "BUYER_INVOICE";
  insuredPersonNameSnapshot?: string;
  insuredPersonUserId?: string;
  isRejected?: boolean;
  rejectionReason?: string | null;
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
  rawClaimFormUrl?: string | null;
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
  evidenceSubmissionId?: string | null;
  evidencePhotos?: ClaimEvidenceItem[];
  evidenceVideos?: ClaimEvidenceItem[];
  locationLatitude?: number | string | null;
  locationLongitude?: number | string | null;
  locationAccuracyMeters?: number | string | null;
  locationCapturedAt?: string | null;
  evidenceSubmittedAt?: string | null;
}

export interface ClaimEvidenceItem {
  url: string;
  publicId: string;
  mimeType: string;
  size: number;
  capturedAt: string;
  slot: number;
  label?: string;
}

export interface ClaimEvidenceUploadTarget {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
}

export interface ClaimEvidenceUploadProof {
  url: string;
  publicId: string;
  version: number;
  signature: string;
  size: number;
  mimeType: string;
  capturedAt: string;
  resourceType?: string;
  format?: string;
  label?: string;
}

export interface ClaimLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

export interface PublicClaimCaptureLink {
  claimId: string;
  vehicleNumber: string;
  invoiceNumber?: string;
  expiresAt: string;
  submitted: boolean;
  submittedAt?: string | null;
  captureType: "accident" | "engine_seize";
  photoCount: number;
  videoCount: number;
  coreComplete: boolean;
  canAddMore: boolean;
  photos?: Array<{
    url: string;
    label?: string | null;
    kind: "photo";
    capturedAt: string;
  }>;
  videos?: Array<{
    url: string;
    label?: string | null;
    kind: "video";
    capturedAt: string;
  }>;
}

export type PublicClaimDocumentType =
  | "lorryReceipt"
  | "damageCertificate";

export interface PublicClaimDocumentUploadLink {
  claimNumber: string;
  vehicleNumber: string;
  expiresAt: string;
  canUpload: boolean;
  documents: Record<
    PublicClaimDocumentType,
    {
      received: boolean;
    }
  >;
}

export interface ClaimEligibleVehicle {
  vehicleNumber: string;
  invoiceId: string;
  invoiceNumber: string;
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

function normalizeClaimRequest(claim: ClaimRequest): ClaimRequest {
  const claimFormUrl =
    claim?.claimFormUrl ||
    (claim as ClaimRequest & { damageFormUrl?: string | null })
      ?.damageFormUrl ||
    null;

  return {
    ...claim,
    claimFormUrl: claimFormUrl ?? undefined,
    rawClaimFormUrl: claimFormUrl,
    damageFormUrl: claimFormUrl ?? undefined,
  };
}

export interface InvoiceCustomerAccount {
  id: string;
  userId?: string;
  customerUserId?: string;
  name: string;
  mobileNumber: string;
  identity?: string;
  billingType?: "BULK" | "PER_POLICY" | null;
  walletId?: string;
  walletBalance?: number;
  requiresWalletCheck?: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface TruckFlagStatus {
  truckNumber: string;
  exists: boolean;
  isFlagged: boolean;
  flagReason: string | null;
  message: string | null;
}

export interface VehicleRecentInvoiceStatus {
  vehicleNumber: string | null;
  hasRecentInvoice: boolean;
  invoice: {
    id: string;
    invoiceNumber: string;
    createdAt: string;
  } | null;
  message: string | null;
}

export interface VerifiedSupplierOption {
  id: string;
  name: string;
  mobileNumber: string;
  identity?: string;
  address: string;
  placeOfSupply: string;
}

export interface HistoricalPartyOption {
  name: string;
  address: string;
  shipToAddress: string;
  placeOfSupply: string;
  phoneNumber?: string;
  invoiceCount: number;
  lastInvoiceDate: string | null;
}

export interface PartyAddressSuggestion {
  address: string;
  placeOfSupply: string;
  invoiceCount: number;
  lastInvoiceDate: string | null;
  source: "profile" | "history";
}

export interface SupplierPartyAssistProduct {
  name: string;
  hsnCode: string;
  count: number;
}

export interface SupplierPartyAssistVehicle {
  vehicleNumber: string;
  ownerName: string;
  count: number;
}

export interface SupplierPartyAssistTemplate {
  id: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  productName: string;
  hsnCode: string;
  quantity: number;
  rate: number;
  vehicleNumber: string;
  ownerName: string;
  notes: string;
}

export interface SupplierPartyAssistResponse {
  productSuggestions: SupplierPartyAssistProduct[];
  vehicleSuggestions: SupplierPartyAssistVehicle[];
  recentTemplates: SupplierPartyAssistTemplate[];
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
    const token = getInsuranceRequestToken();

    const response = await axios.post(`${API_BASE_URL}/invoices`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
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
    const token = getInsuranceRequestToken();

    const response = await axios.get(
      `${API_BASE_URL}/invoices/customer-accounts`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const payload = response.data?.data ?? response.data;
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw (
      err.response?.data || { message: "Failed to fetch customer accounts" }
    );
  }
};

export const getTruckFlagStatus = async (
  truckNumber: string,
): Promise<TruckFlagStatus> => {
  try {
    const token = getInsuranceRequestToken();

    const response = await axios.get(
      `${API_BASE_URL}/trucks/flag-status/${encodeURIComponent(truckNumber)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw (
      err.response?.data || { message: "Failed to check truck flag status" }
    );
  }
};

export const getVehicleRecentInvoiceStatus = async (
  vehicleNumber: string,
): Promise<VehicleRecentInvoiceStatus> => {
  try {
    const token = getInsuranceRequestToken();

    const response = await axios.get(
      `${API_BASE_URL}/invoices/vehicle/recent-status/${encodeURIComponent(vehicleNumber)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw (
      err.response?.data || {
        message: "Failed to check recent vehicle invoice status",
      }
    );
  }
};

export const getVerifiedSuppliers = async (): Promise<
  VerifiedSupplierOption[]
> => {
  try {
    const token = getInsuranceRequestToken();
    const response = await axios.get(
      `${API_BASE_URL}/invoices/verified-suppliers`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );

    const payload = response.data?.data ?? response.data;
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw (
      err.response?.data || { message: "Failed to fetch verified suppliers" }
    );
  }
};

export const getSupplierHistoricalParties = async (params: {
  supplierId?: string;
  supplierName?: string;
  search?: string;
}): Promise<HistoricalPartyOption[]> => {
  try {
    const token = getInsuranceRequestToken();
    const response = await axios.get(
      `${API_BASE_URL}/invoices/supplier-parties`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      },
    );

    const payload = response.data?.data ?? response.data;
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw err.response?.data || { message: "Failed to fetch supplier parties" };
  }
};

export const getBuyerHistoricalSuppliers = async (params: {
  buyerId?: string;
  buyerName?: string;
  search?: string;
}): Promise<HistoricalPartyOption[]> => {
  try {
    const token = getInsuranceRequestToken();
    const response = await axios.get(
      `${API_BASE_URL}/invoices/buyer-suppliers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      },
    );

    const payload = response.data?.data ?? response.data;
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw err.response?.data || { message: "Failed to fetch buyer suppliers" };
  }
};

export const getPartyAddressSuggestions = async (params: {
  partyId?: string;
  partyName?: string;
  role?: "buyer" | "supplier";
  search?: string;
}): Promise<PartyAddressSuggestion[]> => {
  try {
    const token = getInsuranceRequestToken();
    const response = await axios.get(
      `${API_BASE_URL}/invoices/party-addresses`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      },
    );
    return response.data;
  } catch (error: unknown) {
    const err = error as AxiosError<ApiError>;
    throw err.response?.data || { message: "Failed to fetch party addresses" };
  }
};

export const getSupplierPartyAssists = async (params: {
  supplierId?: string;
  supplierName?: string;
  partyName: string;
}): Promise<SupplierPartyAssistResponse> => {
  try {
    const token = getInsuranceRequestToken();
    const response = await axios.get(
      `${API_BASE_URL}/invoices/supplier-party-assists`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      },
    );

    const payload = response.data?.data ?? response.data;
    return {
      productSuggestions: Array.isArray(payload?.productSuggestions)
        ? payload.productSuggestions
        : [],
      vehicleSuggestions: Array.isArray(payload?.vehicleSuggestions)
        ? payload.vehicleSuggestions
        : [],
      recentTemplates: Array.isArray(payload?.recentTemplates)
        ? payload.recentTemplates
        : [],
    };
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    throw (
      err.response?.data || {
        message: "Failed to fetch supplier-party assists",
      }
    );
  }
};

/**
 * Get all insurance forms for the logged-in user
 * GET /invoices/user/:userId
 */
export const getMyInsuranceForms = async (): Promise<InsuranceForm[]> => {
  try {
    const token = getStoredAuthToken();
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
    const token = getStoredAuthToken();
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
 * Get all claim requests via admin endpoint
 * GET /claim-requests/admin
 */
export const getAdminClaimsForms = async (): Promise<ClaimRequest[]> => {
  try {
    const token = getStoredAuthToken();

    const response = await axios.get(`${API_BASE_URL}/claim-requests/admin`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return Array.isArray(response.data)
      ? response.data.map(normalizeClaimRequest)
      : [];
  } catch (error) {
    const err = error as AxiosError<any>;
    throw err.response?.data || { message: "Failed to fetch admin claims" };
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
    const token = getStoredAuthToken();
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

export const getClaimEvidenceUploadTarget = async (
  submissionId: string,
): Promise<ClaimEvidenceUploadTarget> => {
  try {
    const token = getStoredAuthToken();
    const response = await axios.post(
      `${API_BASE_URL}/claim-requests/evidence-upload-signature`,
      { submissionId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data?.data || response.data;
  } catch (error) {
    const err = error as AxiosError<any>;
    throw (
      err.response?.data || { message: "Failed to prepare evidence upload" }
    );
  }
};

export const getClaimEligibleVehicles = async (): Promise<
  ClaimEligibleVehicle[]
> => {
  try {
    const token = getStoredAuthToken();
    const response = await axios.get(
      `${API_BASE_URL}/claim-requests/eligible-vehicles`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const err = error as AxiosError<any>;
    throw err.response?.data || { message: "Failed to load vehicles" };
  }
};

export const uploadClaimEvidence = async (
  target: ClaimEvidenceUploadTarget,
  file: File,
  capturedAt: string,
): Promise<ClaimEvidenceUploadProof> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", target.apiKey);
  formData.append("timestamp", String(target.timestamp));
  formData.append("signature", target.signature);
  formData.append("public_id", target.publicId);

  // Use an isolated browser request here. The shared Axios instance carries the
  // app's Authorization header, which Cloudinary rejects during CORS preflight.
  const response = await fetch(target.uploadUrl, {
    method: "POST",
    body: formData,
  });
  const uploaded = (await response.json()) as {
    secure_url?: string;
    public_id?: string;
    version?: number | string;
    signature?: string;
    bytes?: number | string;
    resource_type?: string;
    format?: string;
    error?: { message?: string };
  };

  if (
    !response.ok ||
    !uploaded.secure_url ||
    !uploaded.public_id ||
    !uploaded.signature
  ) {
    throw new Error(uploaded.error?.message || "Evidence upload failed");
  }

  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    version: Number(uploaded.version),
    signature: uploaded.signature,
    size: Number(uploaded.bytes || file.size),
    mimeType: file.type,
    capturedAt,
    resourceType: uploaded.resource_type,
    format: uploaded.format,
  };
};

export const createClaimWithEvidence = async (payload: {
  truckNumber: string;
  submissionId: string;
  photos: ClaimEvidenceUploadProof[];
  videos: ClaimEvidenceUploadProof[];
  location: ClaimLocation;
}): Promise<ClaimRequest> => {
  try {
    const token = getStoredAuthToken();
    const response = await axios.post(
      `${API_BASE_URL}/claim-requests/by-truck/evidence`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return normalizeClaimRequest(response.data);
  } catch (error) {
    const err = error as AxiosError<any>;
    throw err.response?.data || { message: "Failed to send claim" };
  }
};

const readPublicClaimResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;
  if (!response.ok || !payload) {
    const message = payload?.message;
    throw new Error(
      Array.isArray(message)
        ? message[0]
        : message || "Unable to open claim link",
    );
  }
  return payload;
};

export const getPublicClaimCaptureLink = async (
  token: string,
): Promise<PublicClaimCaptureLink> => {
  const response = await fetch(
    `${API_BASE_URL}/claim-requests/public/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  return readPublicClaimResponse<PublicClaimCaptureLink>(response);
};

export const getPublicClaimDocumentUploadLink = async (
  token: string,
): Promise<PublicClaimDocumentUploadLink> => {
  const response = await fetch(
    `${API_BASE_URL}/claim-requests/public-documents/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  return readPublicClaimResponse<PublicClaimDocumentUploadLink>(response);
};

export const uploadPublicClaimDocument = async (
  token: string,
  documentType: PublicClaimDocumentType,
  file: File,
): Promise<PublicClaimDocumentUploadLink> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    `${API_BASE_URL}/claim-requests/public-documents/${encodeURIComponent(token)}/${documentType}`,
    { method: "POST", body: formData },
  );
  return readPublicClaimResponse<PublicClaimDocumentUploadLink>(response);
};

export const getPublicClaimEvidenceUploadTarget = async (
  token: string,
  submissionId: string,
): Promise<ClaimEvidenceUploadTarget> => {
  const response = await fetch(
    `${API_BASE_URL}/claim-requests/public/${encodeURIComponent(token)}/evidence-upload-signature`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    },
  );
  return readPublicClaimResponse<ClaimEvidenceUploadTarget>(response);
};

export const createPublicClaimWithEvidence = async (
  token: string,
  payload: {
    truckNumber: string;
    submissionId: string;
    photos: ClaimEvidenceUploadProof[];
    videos: ClaimEvidenceUploadProof[];
    location: ClaimLocation;
    captureType?: "accident" | "engine_seize";
    crossLoadingVehicleNumber?: string;
  },
): Promise<PublicClaimCaptureLink> => {
  const evidence = {
    submissionId: payload.submissionId,
    photos: payload.photos,
    videos: payload.videos,
    location: payload.location,
    ...(payload.crossLoadingVehicleNumber
      ? { crossLoadingVehicleNumber: payload.crossLoadingVehicleNumber }
      : {}),
  };
  const response = await fetch(
    `${API_BASE_URL}/claim-requests/public/${encodeURIComponent(token)}/evidence`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evidence),
    },
  );
  return readPublicClaimResponse<PublicClaimCaptureLink>(response);
};

export const appendPublicClaimEvidenceItem = async (
  token: string,
  payload: {
    submissionId: string;
    kind: "photo" | "video";
    item: ClaimEvidenceUploadProof;
    location: ClaimLocation;
  },
): Promise<PublicClaimCaptureLink> => {
  const response = await fetch(
    `${API_BASE_URL}/claim-requests/public/${encodeURIComponent(token)}/evidence/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readPublicClaimResponse<PublicClaimCaptureLink>(response);
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
    | "insurancePolicy"
    | "damageForm",
  file: File,
): Promise<ClaimRequest> => {
  try {
    const token = getStoredAuthToken();
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
    return normalizeClaimRequest(response.data);
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
    const token = getStoredAuthToken();
    const response = await axios.post(
      `${API_BASE_URL}/claim-requests/${claimId}/damage-form`,
      data,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return normalizeClaimRequest(response.data);
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
    const token = getStoredAuthToken();

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
    const token = getStoredAuthToken();
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
    const token = getStoredAuthToken();

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
    const token = getStoredAuthToken();
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
