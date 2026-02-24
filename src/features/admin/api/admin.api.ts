import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
}

interface User {
  _id: string;
  mobileNumber: string;
  category: string;
  state: string;
  createdAt: string;
  totalForms: number;
}

export interface InsuranceForm {
  _id: string;
  id?: string; // Handle both _id (mongoose) and id (typeorm) depending on backend
  user: {
    _id: string;
    mobileNumber: string;
    category?: string;
  };
  invoiceNumber: string;
  supplier: string;
  buyer: string;
  item: string;
  quantity: number;
  amount: number;
  date: string;
  invoicePdfUrl?: string;
  weightSlipPdfUrl?: string;

  // ✅ ADD THIS
  insurance?: {
    fileUrl: string;
    fileType: string;
    uploadedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  // Added fields relevant to claims
  truckNumber?: string;
  vehicleNumber?: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  admin: {
    email: string;
    role: string;
  };
}

export interface RegenerateInvoicePayload {
  invoiceId: string;
  invoiceType?: string;
  invoiceDate?: string;
  terms?: string;
  supplierName?: string;
  supplierAddress?: string | string[];
  placeOfSupply?: string;
  billToName?: string;
  billToAddress?: string | string[];
  shipToName?: string;
  shipToAddress?: string | string[];
  productName?: string;
  hsnCode?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  vehicleNumber?: string;
  truckNumber?: string;
  weighmentSlipNote?: string;
}

export interface InvoiceFilterParams {
  invoiceType?: string;
  startDate?: string;
  endDate?: string;
  supplierName?: string;
  buyerName?: string;
  userId?: string;
  exportType?: "all" | "payment";
}

export interface AdminAgentCommissionSummaryRow {
  agentId: string;
  agentName: string;
  mandiName: string;
  totalInvoices: number | string;
  totalCommissionEarned: number | string;
  totalCommissionPaid: number | string;
  pendingCommission: number | string;
  // Some backends may include an id/commissionId for actions; keep optional
  id?: string;
  commissionId?: string;
}

export interface InsurancePaymentRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  buyer: string;
  insuredPerson: string;
  supplier?: string;
  premiumAmount: number;
  paymentAmount: number;
  balance: number;
  paymentStatus: string;
  isPaymentRequired: boolean;
  paymentCompletedAt?: string | null;
  remarks?: string | null;
  updatedAt: string;
}

export interface UpdateInsurancePaymentPayload {
  premiumAmount?: number;
  paymentAmount?: number;
  paymentStatus?: string;
  isPaymentRequired?: boolean;
  paymentCompletedAt?: string | null;
  remarks?: string | null;
}

// --- ✅ NEW: Claim Request Interfaces ---

export enum ClaimStatus {
  PENDING = "pending",
  INPROGRESS = "inprogress",
  SURVEYOR_ASSIGNED = "surveyor_assigned",
  COMPLETED = "completed",
  APPROVED = "approved",
  REJECTED = "rejected",
  SETTLED = "settled",
}

export interface ClaimRequest {
  id: string;
  status: ClaimStatus;
  createdAt: string;
  invoice: InsuranceForm;
  surveyorName?: string;
  surveyorContact?: string;
  notes?: string;
  claimFormUrl?: string;
  // New individual media fields
  fir?: string | null; // FIR document URL
  accidentPic?: string | null; // Accident picture URL
  inspectionReport?: string | null; // Inspection report URL (PDF only, Admin only)
  lorryReceipt?: string | null; // Lorry receipt URL
  insurancePolicy?: string | null; // Insurance policy URL
  damageFormUrl?: string | null; // Damage form PDF URL
  // Legacy field (deprecated)
  supportedMedia?: string[];
}

export interface FilterClaimRequestsDto {
  status?: ClaimStatus;
  invoiceId?: string;
  truckNumber?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateClaimStatusDto {
  status: ClaimStatus;
  surveyorName?: string;
  surveyorContact?: string;
  notes?: string;
}

// ----------------------------------------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

class AdminApi {
  private client: AxiosInstance;
  private authToken: string | null = null;
  private adminUsersEndpointAvailable: boolean | null = null;
  private adminInsuranceFormsEndpointAvailable: boolean | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    // Add request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token =
          this.authToken ||
          (typeof window !== "undefined"
            ? localStorage.getItem("adminToken")
            : null);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Add response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("adminToken");
            window.location.href = "/admin/login";
          }
        }
        return Promise.reject(error);
      },
    );
  }

  public uploadInvoiceInsurance = async (invoiceId: string, file: File) => {
    const formData = new FormData();
    formData.append("insuranceFile", file);

    const response = await this.client.post(
      `/invoices/${invoiceId}/insurance`,
      formData,
      {
        headers: {
          // 👇 override & REMOVE json content-type
          "Content-Type": undefined,
        },
      },
    );

    return response.data;
  };

  public setAuthToken = (token: string | null) => {
    this.authToken = token;
    if (token && typeof window !== "undefined") {
      localStorage.setItem("adminToken", token);
    } else if (token === null && typeof window !== "undefined") {
      localStorage.removeItem("adminToken");
    }
  };

  public clearAuthToken = () => {
    this.setAuthToken(null);
  };

  public login = async (
    email: string,
    password: string,
  ): Promise<ApiResponse<LoginResponse>> => {
    try {
      const response = await this.client.post<ApiResponse<LoginResponse>>(
        "/admin/login",
        { email, password },
      );
      if (response.data.success && response.data.data?.token) {
        this.setAuthToken(response.data.data.token);
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
        error: error.message,
      };
    }
  };

  public getUsers = async (
    page: number = 1,
    limit: number = 10,
    searchTerm: string = "",
  ): Promise<ApiResponse<{ users: User[]; total: number }>> => {
    try {
      if (this.adminUsersEndpointAvailable !== false) {
        try {
          const response = await this.client.get<
            ApiResponse<{ users: User[]; total: number }>
          >("/admin/users");
          this.adminUsersEndpointAvailable = true;
          return response.data;
        } catch (error: any) {
          const status = (error as AxiosError)?.response?.status;
          if (status !== 404) throw error;
          this.adminUsersEndpointAvailable = false;
        }
      }

      const fallback = await this.client.get<any>("/users");
      if (Array.isArray(fallback.data)) {
        return {
          success: true,
          data: { users: fallback.data as User[], total: fallback.data.length },
        };
      }
      if (Array.isArray(fallback.data?.data)) {
        return {
          success: true,
          data: {
            users: fallback.data.data as User[],
            total: fallback.data.data.length,
          },
        };
      }
      return fallback.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch users",
        error: error.message,
      };
    }
  };

  public getInsuranceForms = async (
    page: number = 1,
    limit: number = 10,
    searchTerm: string = "",
  ): Promise<ApiResponse<{ forms: InsuranceForm[]; total: number }>> => {
    try {
      if (this.adminInsuranceFormsEndpointAvailable !== false) {
        try {
          const response = await this.client.get<
            ApiResponse<{ forms: InsuranceForm[]; total: number }>
          >("/admin/insurance-forms");
          this.adminInsuranceFormsEndpointAvailable = true;
          return response.data;
        } catch (error: any) {
          const status = (error as AxiosError)?.response?.status;
          if (status !== 404) throw error;
          this.adminInsuranceFormsEndpointAvailable = false;
        }
      }

      const fallback = await this.client.get<any>("/invoices");
      if (Array.isArray(fallback.data)) {
        return {
          success: true,
          data: {
            forms: fallback.data as InsuranceForm[],
            total: fallback.data.length,
          },
        };
      }
      if (Array.isArray(fallback.data?.data)) {
        return {
          success: true,
          data: {
            forms: fallback.data.data as InsuranceForm[],
            total: fallback.data.data.length,
          },
        };
      }
      return fallback.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch insurance forms",
        error: error.message,
      };
    }
  };

  public getUserInsuranceForms = async (
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ApiResponse<{ forms: InsuranceForm[]; total: number }>> => {
    try {
      const response = await this.client.get<
        ApiResponse<{ forms: InsuranceForm[]; total: number }>
      >(`/admin/user/${userId}/forms`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch user insurance forms",
        error: error.message,
      };
    }
  };

  public filterInvoices = async (
    filters: InvoiceFilterParams,
  ): Promise<ApiResponse<any[]>> => {
    try {
      const response = await this.client.get("/invoices/admin/filter", {
        params: filters,
      });
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
        };
      }
      return response.data;
    } catch (error: any) {
      console.error("Filter API Error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to filter invoices",
        error: error.message,
      };
    }
  };

  public exportInvoices = async (body: {
    invoiceType?: string;
    startDate?: string;
    endDate?: string;
    invoiceIds?: string[];
  }): Promise<Blob | null> => {
    try {
      const response = await this.client.post("/invoices/admin/export", body, {
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      console.error("Export failed", error);
      return null;
    }
  };

  uploadWeighmentSlips = async (
    invoiceId: string,
    files: File[],
  ): Promise<any> => {
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
      const err = error as AxiosError<any>;
      const message =
        err.response?.data?.message || err.message || "Failed to upload files";
      const errorMessage = Array.isArray(message)
        ? message.join(", ")
        : message;
      throw new Error(errorMessage);
    }
  };

  // Regenerate invoice with new data + optional weighment slip file
  public regenerateInvoice = async (
    payload: RegenerateInvoicePayload,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        "/invoices/regenerate",
        payload,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to regenerate invoice",
        error: error.message,
      };
    }
  };

  // Verify invoice
  public verifyInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch<ApiResponse<any>>(
        `/invoices/${invoiceId}/verify`,
      );
      const payload: any = response.data;
      if (payload && typeof payload === "object" && "success" in payload) {
        return payload as ApiResponse<any>;
      }
      return {
        success: true,
        message: "Invoice verified successfully",
        data: payload,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to verify invoice",
        error: error.message,
      };
    }
  };

  private normalizeApiResponse(payload: any, defaultMessage: string): ApiResponse<any> {
    if (payload && typeof payload === "object" && "success" in payload) {
      return payload as ApiResponse<any>;
    }
    return {
      success: true,
      message: defaultMessage,
      data: payload,
    };
  }

  private getAxiosErrorMessage(error: any, fallback: string): string {
    const responseData = error?.response?.data;
    if (typeof responseData?.message === "string" && responseData.message.trim()) {
      return responseData.message;
    }
    if (Array.isArray(responseData?.message) && responseData.message.length > 0) {
      return responseData.message.join(", ");
    }
    return fallback;
  }

  public rejectInvoice = async (
    invoiceId: string,
    rejectionReason?: string,
  ): Promise<ApiResponse<any>> => {
    const trimmedReason = rejectionReason?.trim();
    const body = {
      rejectionReason: trimmedReason,
      // Keep `reason` for backwards compatibility with older backend payloads.
      reason: trimmedReason,
    };
    const endpointCandidates = [
      `/invoices/${invoiceId}/reject`,
      `/admin/invoices/${invoiceId}/reject`,
    ];

    try {
      for (const endpoint of endpointCandidates) {
        try {
          const response = await this.client.patch<ApiResponse<any>>(endpoint, body);
          return this.normalizeApiResponse(response.data, "Invoice rejected successfully");
        } catch (innerError: any) {
          const status = innerError?.response?.status;
          // Try next endpoint on method/path mismatch.
          if (status === 404 || status === 405) {
            try {
              const fallbackResponse = await this.client.post<ApiResponse<any>>(endpoint, body);
              return this.normalizeApiResponse(
                fallbackResponse.data,
                "Invoice rejected successfully",
              );
            } catch (postError: any) {
              const postStatus = postError?.response?.status;
              if (postStatus === 404 || postStatus === 405) {
                continue;
              }
              throw postError;
            }
          }
          throw innerError;
        }
      }
      return {
        success: false,
        message: "Reject endpoint not found on server",
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, "Failed to reject invoice"),
        error: error.message,
      };
    }
  };

  // ============================================================
  // ✅ PAYMENTS (ADMIN)
  // ============================================================

  public generatePaymentLinkForInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/payment/generate-link/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to generate payment link",
        error: error.message,
      };
    }
  };

  public getPaymentStatusForInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.get<ApiResponse<any>>(
        `/payment/status/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch payment status",
        error: error.message,
      };
    }
  };

  public resendPaymentLinkForInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/payment/resend/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to resend payment link",
        error: error.message,
      };
    }
  };

  public verifyAndSendPaymentForInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/invoices/${invoiceId}/verify-and-send-payment`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to verify invoice and send payment",
        error: error.message,
      };
    }
  };

  public getInsurancePayments = async (filters?: {
    fromDate?: string;
    toDate?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<InsurancePaymentRow[]>> => {
    try {
      const response = await this.client.get("/insurance-payments/admin", {
        params: filters,
      });

      const payload = response.data;
      if (Array.isArray(payload)) {
        const page = Number(filters?.page) > 0 ? Number(filters?.page) : 1;
        const limit = Number(filters?.limit) > 0 ? Number(filters?.limit) : 10;
        const total = payload.length;
        return {
          success: true,
          data: payload as InsurancePaymentRow[],
          count: total,
          total,
          page,
          limit,
          totalPages: total === 0 ? 1 : Math.ceil(total / limit),
        };
      }
      if (Array.isArray(payload?.data)) {
        return {
          success: true,
          data: payload.data as InsurancePaymentRow[],
          count: payload.count,
          total: payload.total,
          page: payload.page,
          limit: payload.limit,
          totalPages: payload.totalPages,
        };
      }
      return payload;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch insurance payments",
        error: error.message,
      };
    }
  };

  public updateInsurancePayment = async (
    invoiceId: string,
    payload: UpdateInsurancePaymentPayload,
  ): Promise<ApiResponse<InsurancePaymentRow>> => {
    try {
      const response = await this.client.patch(
        `/insurance-payments/admin/${invoiceId}`,
        payload,
      );

      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data as ApiResponse<InsurancePaymentRow>;
      }
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update insurance payment",
        error: error.message,
      };
    }
  };

  // ============================================================
  // ✅ AGENT COMMISSIONS (ADMIN)
  // ============================================================

  public getAgentCommissionSummaries = async (): Promise<
    ApiResponse<AdminAgentCommissionSummaryRow[]>
  > => {
    try {
      const response = await this.client.get<AdminAgentCommissionSummaryRow[]>(
        "/commissions/admin/agents",
      );

      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);

      return { success: true, data: rows };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch agent commission summaries",
        error: error.message,
      };
    }
  };

  public markCommissionPaid = async (
    commissionId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch(
        `/commissions/${commissionId}/mark-paid`,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to mark commission as paid",
        error: error.message,
      };
    }
  };

  // ============================================================
  // END AGENT COMMISSIONS
  // ============================================================

  // ============================================================
  // ✅ CLAIM REQUESTS MANAGEMENT (ADMIN)
  // ============================================================

  /**
   * Get all claims with optional filters
   * Filters: status, truckNumber, invoiceId
   */
  public getClaims = async (
    filters?: FilterClaimRequestsDto,
  ): Promise<ApiResponse<ClaimRequest[]>> => {
    try {
      const response = await this.client.get<any>("/claim-requests/admin", {
        params: filters,
      });

      // Handle both wrapped response and direct array
      let claims: ClaimRequest[] = [];

      if (Array.isArray(response.data)) {
        // Direct array response
        claims = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        // Wrapped in ApiResponse object
        claims = response.data.data;
      } else if (response.data?.success && Array.isArray(response.data.data)) {
        // Another wrapped format
        claims = response.data.data;
      }

      // Normalize status field (backend uses lowercase status values)
      claims = claims.map((claim) => ({
        ...claim,
        status:
          (claim.status?.toLowerCase() as ClaimStatus) || ClaimStatus.PENDING,
      }));

      return {
        success: true,
        data: claims,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch claims",
        error: error.message,
      };
    }
  };

  /**
   * Get a single claim by ID
   */
  public getClaimById = async (
    id: string,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.get<ApiResponse<ClaimRequest>>(
        `/claim-requests/${id}`,
      );

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch claim details",
        error: error.message,
      };
    }
  };

  /**
   * Create a claim on behalf of a user using Truck Number
   * Attaches claim to user's latest invoice for that truck
   */
  public createClaimForUser = async (
    truckNumber: string,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.post<ApiResponse<ClaimRequest>>(
        "/claim-requests/by-truck",
        { truckNumber },
      );

      return {
        success: true,
        data: response.data.data,
        message: "Claim created successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to create claim",
        error: error.message,
      };
    }
  };

  /**
   * Update claim status
   * Actions: Assign Surveyor | Approve | Reject | Settle
   */
  public updateClaimStatus = async (
    id: string,
    updateData: UpdateClaimStatusDto,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.patch<ApiResponse<ClaimRequest>>(
        `/claim-requests/${id}/status`,
        updateData,
      );

      return {
        success: true,
        data: response.data.data,
        message: "Claim status updated successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update claim status",
        error: error.message,
      };
    }
  };

  /**
   * Upload media file for a claim request
   * POST /claim-requests/:id/media/:mediaType
   */
  public uploadClaimMedia = async (
    claimId: string,
    mediaType:
      | "fir"
      | "gpsPictures"
      | "accidentPic"
      | "inspectionReport"
      | "weighmentSlip"
      | "lorryReceipt"
      | "insurancePolicy",
    file: File,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await this.client.post<ClaimRequest>(
        `/claim-requests/${claimId}/media/${mediaType}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return {
        success: true,
        data: response.data,
        message: "Media uploaded successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to upload media",
        error: error.message,
      };
    }
  };

  public removeClaimMedia = async (
    claimId: string,
    mediaType:
      | "fir"
      | "gpsPictures"
      | "accidentPic"
      | "inspectionReport"
      | "weighmentSlip"
      | "lorryReceipt"
      | "insurancePolicy",
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.patch<ClaimRequest>(
        `/claim-requests/${claimId}/media/${mediaType}/remove`,
      );

      return {
        success: true,
        data: response.data,
        message: "Media removed successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to remove media",
        error: error.message,
      };
    }
  };

  /**
   * Submit damage form for a claim request
   * POST /claim-requests/:id/damage-form
   */
  public submitDamageForm = async (
    claimId: string,
    damageFormData: {
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
    },
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.post<ClaimRequest>(
        `/claim-requests/${claimId}/damage-form`,
        damageFormData,
      );
      return {
        success: true,
        data: response.data,
        message: "Damage form submitted successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to submit damage form",
        error: error.message,
      };
    }
  };

  // ============================================================
  // END CLAIM REQUESTS
  // ============================================================

  public getDashboardStats = async (): Promise<
    ApiResponse<{
      totalUsers: number;
      totalForms: number;
      totalClaims: number; // Added claims count
      recentActivity: Array<{
        id: string;
        type: string;
        description: string;
        timestamp: string;
      }>;
    }>
  > => {
    try {
      const [usersResponse, formsResponse, claimsResponse] = await Promise.all([
        this.getUsers(),
        this.getInsuranceForms(),
        this.getClaims(), // Fetch claims for stats
      ]);

      return {
        success: true,
        data: {
          totalUsers: usersResponse.success
            ? (usersResponse.data as any)?.count ||
              (usersResponse.data as any)?.users?.length ||
              0
            : 0,
          totalForms: formsResponse.success
            ? (formsResponse.data as any)?.count ||
              (formsResponse.data as any)?.forms?.length ||
              0
            : 0,
          totalClaims:
            claimsResponse.success && Array.isArray(claimsResponse.data)
              ? claimsResponse.data.length
              : 0,
          recentActivity: [],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to fetch dashboard stats",
        error: error.message,
      };
    }
  };
}

export const adminApi = new AdminApi();
