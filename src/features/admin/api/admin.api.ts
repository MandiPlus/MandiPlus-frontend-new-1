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
  id?: string;
  name?: string;
  mobileNumber: string;
  secondaryMobileNumber?: string | null;
  category?: string;
  identity?: string;
  billingType?: "BULK" | "PER_POLICY" | null;
  unionMember?: string | null;
  state?: string;
  createdAt: string;
  totalForms?: number;
  walletId?: string | null;
  walletBalance?: number;
  availableBalance?: number;
  holdBalance?: number;
  totalBalance?: number;
  canonicalUserId?: string;
  isLedgerMasterVerified?: boolean;
  duplicateCount?: number;
  aliasNames?: string[];
  aliasPhones?: string[];
  isMerged?: boolean;
  canonicalMasterName?: string | null;
  canonicalMasterMobileNumber?: string | null;
}

export interface AdminLedgerUser extends User {
  id: string;
  canonicalUserId: string;
  isLedgerMasterVerified: boolean;
  duplicateCount: number;
  aliasNames: string[];
  aliasPhones: string[];
}

export interface AdminMasterLedgerLinkedUser {
  id: string;
  name: string;
  mobileNumber: string;
  secondaryMobileNumber?: string | null;
  state?: string | null;
  isMaster: boolean;
  isMerged: boolean;
}

export interface AdminMasterLedgerSummary {
  totalInvoices: number;
  totalPremiumAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  paidCount: number;
  pendingCount: number;
}

export interface AdminMasterLedgerRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  insuredPersonName?: string | null;
  sourceUserId: string | null;
  sourceUserName: string | null;
  sourceUserMobile: string | null;
  premiumAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: string;
  paymentCompletedAt: string | null;
  walletDebitReference: string | null;
  walletTransactionId?: string | null;
  remarks: string | null;
  proofOfPaymentImage: string | null;
  duplicateCount: number;
  duplicateInvoiceIds: string[];
}

export interface AdminMasterLedgerPayload {
  masterUser: {
    id: string;
    name: string;
    mobileNumber: string;
    state?: string | null;
  };
  linkedUsers: AdminMasterLedgerLinkedUser[];
  summary: AdminMasterLedgerSummary;
  rows: AdminMasterLedgerRow[];
}

export interface PossibleDuplicateUserRow {
  id: string;
  score: number;
  reason: string;
  matchingSignals: string[];
  status: string;
  sourceUser: AdminLedgerUser;
  candidateUser: AdminLedgerUser;
}

export type UserIdentity =
  | "CUSTOMER"
  | "TRANSPORTER"
  | "INTERNAL_TEAM"
  | "BUYER"
  | "SUPPLIER"
  | "AGENT"
  | "FIELD_AGENT";

export interface AdminCreateUserPayload {
  name: string;
  mobileNumber: string;
  secondaryMobileNumber?: string;
  state: string;
  identity: UserIdentity;
  billingType?: "BULK" | "PER_POLICY";
  unionMember?: string | null;
}

export interface AdminUpdateUserPayload {
  name?: string;
  mobileNumber?: string;
  secondaryMobileNumber?: string;
  state?: string;
  identity?: UserIdentity;
  billingType?: "BULK" | "PER_POLICY" | null;
  unionMember?: string | null;
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
  token: string;
}

export interface AdminAccountRow {
  id: string;
  fullName: string;
  username: string;
  mobileNumber?: string | null;
  requestedRole: string;
  status: string;
  assignedSections: string[];
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminImpersonationResponse {
  token: string;
  user: {
    id: string;
    name?: string;
    mobileNumber?: string;
    identity?: string | null;
    tenantId?: string;
    impersonation?: boolean;
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
  invoiceNumber?: string;
  vehicleNumber?: string;
  startDate?: string;
  endDate?: string;
  supplierName?: string;
  buyerName?: string;
  productName?: string;
  userId?: string;
  exportType?: "all" | "payment";
  paymentStatus?: string;
  isVerified?: boolean;
  isRejected?: boolean;
  advancedFilters?: string;
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
  recipientPhone?: string;
  pdfUrl?: string | null;
  paymentReceiptUrl?: string | null;
  createdAt: string;
  productName?: string;
  buyer: string;
  insuredPerson: string;
  supplier?: string;
  premiumAmount: number;
  paymentAmount: number;
  balance: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  isPaymentRequired: boolean;
  paymentCompletedAt?: string | null;
  remarks?: string | null;
  updatedAt: string;
}

export interface ArrivalReportRow {
  id: string;
  reportDate: string;
  invoiceCount: number;
  excelUrl?: string | null;
  pdfUrl?: string | null;
  whatsappNumber?: string | null;
  whatsappSent: boolean;
  whatsappSentAt?: string | null;
  generationError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenderCoconutReportRunResult {
  reportDate: string;
  totalInvoices: number;
  averagePremium: number;
  totalPremiumAmount: number;
  dashboardPaymentReported: number;
  summaryUrl?: string | null;
  breakupUrl?: string | null;
  recipients: string[];
}

export interface AdminWalletStatementItem {
  id: string;
  type: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  balanceAfter?: number;
  referenceId?: string;
  narration?: string;
  remark?: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface AdminWalletRebuildResult {
  userId: string;
  walletId: string;
  balance: number;
  effectiveDate: string;
  removedTransactionCount: number;
  invoicesScanned: number;
  debitRowsInserted: number;
  invoiceRowsUpdated: number;
  recomputedTransactionCount: number;
  message: string;
}

export interface UpdateInsurancePaymentPayload {
  premiumAmount?: number;
  paymentAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string | null;
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
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

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
          const requestUrl = String(error?.config?.url || "");
          // Invalid admin login should stay on login page and show error,
          // not redirect to session-expired.
          const isAdminLoginRequest =
            requestUrl.includes("/auth/admin/login") ||
            requestUrl.endsWith("/admin/login");
          if (isAdminLoginRequest) {
            return Promise.reject(error);
          }
          if (typeof window !== "undefined") {
            const isImpersonatingThisTab =
              sessionStorage.getItem("impersonationActive") === "1";
            if (isImpersonatingThisTab) {
              return Promise.reject(error);
            }
            localStorage.removeItem("adminToken");
            window.location.href = "/admin-session-expired";
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
      const response = await this.client.post<{ success: boolean; data?: { token: string } }>(
        "/auth/admin/login",
        { username: email, password },
      );
      const token = response.data?.data?.token;
      if (response.data.success && token) {
        this.setAuthToken(token);
        return {
          success: true,
          data: { token },
        };
      }
      return {
        success: false,
        message: "Login failed",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
        error: error.message,
      };
    }
  };

  public signupAdminAccount = async (payload: {
    fullName: string;
    username: string;
    mobileNumber: string;
    password: string;
  }): Promise<ApiResponse<{ id: string; username: string; status: string }>> => {
    try {
      const response = await this.client.post("/auth/admin/signup", payload);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Signup failed",
        error: error.message,
      };
    }
  };

  public getAdminAccounts = async (): Promise<ApiResponse<AdminAccountRow[]>> => {
    try {
      const response = await this.client.get<ApiResponse<AdminAccountRow[]>>(
        "/auth/admin/accounts",
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch admin accounts",
        error: error.message,
      };
    }
  };

  public updateAdminAccountApproval = async (
    accountId: string,
    payload: {
      status: "APPROVED" | "REJECTED" | "SUSPENDED";
      assignedSections?: string[];
      rejectionReason?: string;
    },
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/auth/admin/accounts/${accountId}/approval`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update admin account",
        error: error.message,
      };
    }
  };

  public impersonateUser = async (
    userId: string,
  ): Promise<ApiResponse<AdminImpersonationResponse>> => {
    try {
      const response = await this.client.post<
        ApiResponse<AdminImpersonationResponse>
      >(`/auth/admin/impersonate/${userId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to impersonate user",
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

  public getAdminCustomerWallets = async (): Promise<ApiResponse<User[]>> => {
    try {
      const response = await this.client.get<User[]>("/wallet/admin/customers");
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch customer wallets",
        error: error.message,
      };
    }
  };

  public creditCustomerWallet = async (
    userId: string,
    amount: number,
    narration?: string,
    effectiveDate?: string,
    remark?: string,
    attachment?: File,
  ): Promise<ApiResponse<any>> => {
    try {
      const formData = new FormData();
      formData.append("amount", String(amount));
      if (narration) formData.append("narration", narration);
      if (effectiveDate) formData.append("effectiveDate", effectiveDate);
      if (remark) formData.append("remark", remark);
      if (attachment) formData.append("attachment", attachment);
      const response = await this.client.post<ApiResponse<any>>(
        `/wallet/admin/customers/${userId}/credit`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      const payload = response.data;
      if (payload && typeof payload === "object" && "success" in payload) {
        return payload;
      }
      return {
        success: true,
        data: payload,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to credit wallet",
        error: error.message,
      };
    }
  };

  public adjustUserWallet = async (
    userId: string,
    amount: number,
    narration?: string,
    effectiveDate?: string,
    remark?: string,
    attachment?: File,
  ): Promise<ApiResponse<any>> => {
    try {
      const formData = new FormData();
      formData.append("amount", String(amount));
      if (narration) formData.append("narration", narration);
      if (effectiveDate) formData.append("effectiveDate", effectiveDate);
      if (remark) formData.append("remark", remark);
      if (attachment) formData.append("attachment", attachment);
      const response = await this.client.post<ApiResponse<any>>(
        `/wallet/admin/users/${userId}/adjust`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      const payload = response.data;
      if (payload && typeof payload === "object" && "success" in payload) {
        return payload;
      }
      return {
        success: true,
        data: payload,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to update wallet",
        error: error.message,
      };
    }
  };

  public getAdminUserWalletStatement = async (
    userId: string,
  ): Promise<ApiResponse<AdminWalletStatementItem[]>> => {
    try {
      const response = await this.client.get<AdminWalletStatementItem[]>(
        `/wallet/admin/users/${userId}/statement`,
      );
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch wallet statement",
        error: error.message,
      };
    }
  };

  public rebuildUserWallet = async (
    userId: string,
    effectiveDate: string,
  ): Promise<ApiResponse<AdminWalletRebuildResult>> => {
    try {
      const response = await this.client.post<ApiResponse<AdminWalletRebuildResult>>(
        `/wallet/admin/users/${userId}/rebuild`,
        { effectiveDate },
      );
      const payload = response.data;
      if (payload && typeof payload === "object" && "success" in payload) {
        return payload;
      }
      return {
        success: true,
        data: payload as AdminWalletRebuildResult,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to rebuild wallet",
        error: error.message,
      };
    }
  };

  public convertUserIdentity = async (
    userId: string,
    identity: UserIdentity,
    billingType?: "BULK" | "PER_POLICY",
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch(`/users/${userId}`, {
        identity,
        ...(identity === "TRANSPORTER" ? { billingType } : {}),
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to convert user identity",
        error: error.message,
      };
    }
  };

  public updateUser = async (
    userId: string,
    payload: AdminUpdateUserPayload,
  ): Promise<ApiResponse<AdminLedgerUser>> => {
    try {
      const response = await this.client.patch(`/users/${userId}`, payload);
      const data = response.data as any;
      if (data && typeof data === "object" && "success" in data) {
        return data as ApiResponse<AdminLedgerUser>;
      }
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to update user",
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
    supplierName?: string;
    buyerName?: string;
    productName?: string;
    isVerified?: boolean;
    isRejected?: boolean;
    invoiceIds?: string[];
    exportType?: "all" | "payment";
    selectedColumns?: string[];
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

  public getAdminLedgerUsers = async (): Promise<ApiResponse<AdminLedgerUser[]>> => {
    try {
      const response = await this.client.get<AdminLedgerUser[]>('/users/admin/list');
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to fetch admin ledger users',
        error: error.message,
      };
    }
  };

  public getMasterUserLedger = async (
    userId: string,
  ): Promise<ApiResponse<AdminMasterLedgerPayload>> => {
    try {
      const response = await this.client.get<ApiResponse<AdminMasterLedgerPayload>>(
        `/users/admin/${userId}/master-ledger`,
      );
      const payload = response.data;

      if (payload && typeof payload === 'object' && 'success' in payload) {
        return payload;
      }

      return {
        success: true,
        data: payload as AdminMasterLedgerPayload,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          'Failed to fetch master user ledger',
        error: error.message,
      };
    }
  };

  public updateLedgerPaymentStatus = async (payload: {
    invoiceIds: string[];
    paymentStatus: 'PAID' | 'PENDING';
    remarks: string;
  }): Promise<ApiResponse<{ updatedCount: number }>> => {
    try {
      const response = await this.client.post<ApiResponse<{ updatedCount: number }>>(
        '/users/admin/ledger/payment-status',
        payload,
      );
      const data = response.data as any;

      if (data && typeof data === 'object' && 'success' in data) {
        return data;
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          'Failed to update ledger payment status',
        error: error.message,
      };
    }
  };

  public createUser = async (
    payload: AdminCreateUserPayload,
  ): Promise<ApiResponse<AdminLedgerUser>> => {
    try {
      const response = await this.client.post<AdminLedgerUser>('/users', payload);
      const data = response.data as any;

      if (data && typeof data === 'object' && 'success' in data) {
        return data as ApiResponse<AdminLedgerUser>;
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create user',
        error: error.message,
      };
    }
  };

  public scanPossibleDuplicates = async (): Promise<
    ApiResponse<PossibleDuplicateUserRow[]>
  > => {
    try {
      const response = await this.client.post<PossibleDuplicateUserRow[]>(
        '/users/admin/possible-duplicates/scan',
      );
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          'Failed to scan possible duplicate users',
        error: error.message,
      };
    }
  };

  public getPossibleDuplicates = async (): Promise<
    ApiResponse<PossibleDuplicateUserRow[]>
  > => {
    try {
      const response = await this.client.get<PossibleDuplicateUserRow[]>(
        '/users/admin/possible-duplicates',
      );
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          'Failed to fetch possible duplicate users',
        error: error.message,
      };
    }
  };

  public mergeUsers = async (payload: {
    sourceUserId: string;
    targetUserId: string;
    reason?: string;
    notes?: string;
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        '/users/admin/merge',
        payload,
      );
      const data = response.data;
      if (data && typeof data === 'object' && 'success' in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to merge users',
        error: error.message,
      };
    }
  };

  public verifyMasterUser = async (
    userId: string,
    reason?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/users/admin/${userId}/verify-master`,
        { reason },
      );
      const data = response.data;
      if (data && typeof data === 'object' && 'success' in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to verify master user',
        error: error.message,
      };
    }
  };

  public unverifyMasterUser = async (
    userId: string,
    reason?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/users/admin/${userId}/unverify-master`,
        { reason },
      );
      const data = response.data;
      if (data && typeof data === 'object' && 'success' in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to unverify master user',
        error: error.message,
      };
    }
  };

  public unmergeUser = async (
    userId: string,
    reason?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/users/admin/${userId}/unmerge`,
        { reason },
      );
      const data = response.data;
      if (data && typeof data === 'object' && 'success' in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to unmerge user',
        error: error.message,
      };
    }
  };

  public ignorePossibleDuplicate = async (
    id: string,
  ): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const response = await this.client.post(`/users/admin/possible-duplicates/${id}/ignore`);
      const data = response.data;
      if (data && typeof data === 'object' && 'success' in data) {
        return data;
      }
      return {
        success: true,
        data: { success: true },
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to ignore duplicate suggestion',
        error: error.message,
      };
    }
  };

  public getArrivalReports = async (): Promise<ApiResponse<ArrivalReportRow[]>> => {
    try {
      const response = await this.client.get<ArrivalReportRow[] | ApiResponse<ArrivalReportRow[]>>(
        "/invoices/admin/arrival-reports",
      );
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch arrival reports",
        error: error.message,
      };
    }
  };

  public runLatestArrivalReport = async (): Promise<ApiResponse<ArrivalReportRow | null>> => {
    try {
      const response = await this.client.post<
        ArrivalReportRow | ApiResponse<ArrivalReportRow | null>
      >("/invoices/admin/arrival-reports/run-latest");
      if (
        response.data &&
        typeof response.data === "object" &&
        "success" in response.data
      ) {
        return response.data as ApiResponse<ArrivalReportRow | null>;
      }
      return {
        success: true,
        data: (response.data as ArrivalReportRow) || null,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to run latest arrival report",
        error: error.message,
      };
    }
  };

  public runLatestTenderCoconutReport = async (): Promise<
    ApiResponse<TenderCoconutReportRunResult | null>
  > => {
    try {
      const response = await this.client.post<
        TenderCoconutReportRunResult | ApiResponse<TenderCoconutReportRunResult | null>
      >("/invoices/admin/tender-coconut-reports/run-latest");
      if (
        response.data &&
        typeof response.data === "object" &&
        "success" in response.data
      ) {
        return response.data as ApiResponse<TenderCoconutReportRunResult | null>;
      }
      return {
        success: true,
        data: (response.data as TenderCoconutReportRunResult) || null,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to run latest tender coconut report",
        error: error.message,
      };
    }
  };

  uploadWeighmentSlips = async (
    invoiceId: string,
    files: File[],
  ): Promise<any> => {
    try {
      const token = localStorage.getItem("adminToken");
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
      return this.normalizeApiResponse(
        response.data,
        "Invoice updated & PDF regenerated",
      );
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

  private normalizeClaim(claim: ClaimRequest): ClaimRequest {
    const claimFormUrl =
      claim?.claimFormUrl ||
      (claim as ClaimRequest & { damageFormUrl?: string | null })?.damageFormUrl ||
      null;

    return {
      ...claim,
      claimFormUrl: claimFormUrl ?? undefined,
      rawClaimFormUrl: claimFormUrl,
      damageFormUrl: claimFormUrl ?? undefined,
    };
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

  public sendPaymentReminderForInvoice = async (
    invoiceId: string,
    phoneNumber?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/payment/reminders/send/${invoiceId}`,
        {
          phoneNumber,
        },
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to send payment reminder",
        error: error.message,
      };
    }
  };

  public verifyAndSendPaymentForInvoice = async (
    invoiceId: string,
    payload?: { phoneNumber?: string },
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/invoices/${invoiceId}/verify-and-send-payment`,
        payload,
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

  public updateInvoicePhone = async (
    invoiceId: string,
    insuredPartyPhone: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch<ApiResponse<any>>(
        `/invoices/${invoiceId}`,
        { insuredPartyPhone },
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update invoice phone",
        error: error.message,
      };
    }
  };

  public sendInvoiceCreatedTemplate = async (
    invoiceId: string,
    payload?: { phoneNumber?: string },
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/invoices/${invoiceId}/send-created-template`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          'Failed to send invoice created message',
        error: error.message,
      };
    }
  };

  public getInsurancePayments = async (filters?: {
    fromDate?: string;
    toDate?: string;
    paymentStatus?: string;
    productName?: string;
    searchQuery?: string;
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
        const limit = Number(filters?.limit) > 0 ? Number(filters?.limit) : 20;
        const total = payload.length;
        const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
        const safePage = Math.min(Math.max(Math.trunc(page), 1), totalPages);
        const start = (safePage - 1) * limit;
        const pageRows = (payload as InsurancePaymentRow[]).slice(
          start,
          start + limit,
        );
        return {
          success: true,
          data: pageRows,
          count: pageRows.length,
          total,
          page: safePage,
          limit,
          totalPages,
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

  public exportInsurancePayments = async (filters?: {
    fromDate?: string;
    toDate?: string;
    paymentStatus?: string;
    productName?: string;
    searchQuery?: string;
  }): Promise<Blob> => {
    const response = await this.client.get('/insurance-payments/admin/export', {
      params: filters,
      responseType: 'blob',
    });

    return response.data;
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
      claims = claims.map((claim) =>
        this.normalizeClaim({
          ...claim,
          status:
            (claim.status?.toLowerCase() as ClaimStatus) || ClaimStatus.PENDING,
        }),
      );

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
      const payload = (response.data as any)?.data ?? response.data;

      return {
        success: true,
        data: payload ? this.normalizeClaim(payload as ClaimRequest) : undefined,
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
      | "insurancePolicy"
      | "damageForm",
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
        data: this.normalizeClaim(response.data),
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
      | "insurancePolicy"
      | "damageForm",
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.patch<ClaimRequest>(
        `/claim-requests/${claimId}/media/${mediaType}/remove`,
      );

      return {
        success: true,
        data: this.normalizeClaim(response.data),
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
        data: this.normalizeClaim(response.data),
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

  public sendInsurancePdfViaBot = async (
    fileUrl: string,
    phoneNumber: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const botBaseUrl =
        (typeof process !== "undefined" &&
          process.env.NEXT_PUBLIC_BOT_API_BASE_URL) ||
        "http://localhost:8000";
      const adminToken =
        this.authToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem("adminToken")
          : null);

      const formData = new FormData();
      formData.append("phone", phoneNumber);
      formData.append("file_url", fileUrl);

      const response = await axios.post(
        `${botBaseUrl}/admin/send-insurance-pdf`,
        formData,
        { headers: { "x-admin-token": adminToken || "" } },
      );
      return { success: true, data: response.data, message: "Insurance PDF sent successfully" };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          "Failed to send insurance PDF",
        error: error.message,
      };
    }
  };

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
