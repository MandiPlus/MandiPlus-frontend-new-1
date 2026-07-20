import axios, { AxiosError } from "axios";
import type { ClaimRequest, InsuranceForm } from "@/features/insurance/api";
import { getStoredAuthToken, refreshAccessToken } from "@/features/auth/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export interface WalletSummary {
  walletId?: string;
  availableBalance: number;
  usedBalance?: number;
  holdBalance: number;
  totalBalance: number;
  updatedAt?: string;
}

export interface WalletStatementItem {
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

export interface CustomerPaymentCheckoutResponse {
  success: boolean;
  invoiceCount: number;
  awaitingApprovalCount?: number;
  totalPaymentAmount: number;
  merchantTransactionId: string;
  merchantOrderId?: string;
  orderId?: string;
  redirectUrl?: string;
  expireAt?: number | string | null;
  message?: string;
  invoices?: Array<{
    id?: string;
    invoiceNumber?: string;
    paymentAmount?: number;
  }>;
}

export interface CustomerPaymentCheckoutStatus {
  success: boolean;
  merchantTransactionId: string;
  state?: string | null;
  invoiceCount: number;
  paid: boolean;
  invoices?: InsuranceForm[];
}

export interface CustomerNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface CustomerNotificationsResponse {
  unreadCount: number;
  items: CustomerNotification[];
}

export interface WebPushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
  deviceName?: string;
}

function getAuthHeader() {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(err: AxiosError) {
  if (err.response?.status === 401 && typeof window !== "undefined") {
    // Do not force logout on background 401s.
    // Keep session until user explicitly logs out.
    console.warn("401 received from customer API; preserving local auth state.");
  }
}

export async function registerCustomerWebPushSubscription(
  payload: WebPushSubscriptionPayload,
) {
  const response = await withAuthRetry(() =>
    axios.post(`${API_BASE_URL}/notifications/web-subscription`, payload, {
      headers: getAuthHeader(),
    }),
  );
  return response.data;
}

export async function removeCustomerWebPushSubscription(endpoint: string) {
  const response = await withAuthRetry(() =>
    axios.delete(`${API_BASE_URL}/notifications/web-subscription`, {
      headers: getAuthHeader(),
      data: { endpoint },
    }),
  );
  return response.data;
}

export async function getCustomerNotifications(limit = 50): Promise<CustomerNotificationsResponse> {
  const response = await withAuthRetry(() =>
    axios.get(`${API_BASE_URL}/notifications`, {
      headers: getAuthHeader(),
      params: { limit },
    }),
  );
  return response.data;
}

export async function markCustomerNotificationRead(notificationId: string) {
  const response = await withAuthRetry(() =>
    axios.patch(
      `${API_BASE_URL}/notifications/${encodeURIComponent(notificationId)}/read`,
      {},
      { headers: getAuthHeader() },
    ),
  );
  return response.data;
}

export async function markAllCustomerNotificationsRead() {
  const response = await withAuthRetry(() =>
    axios.patch(
      `${API_BASE_URL}/notifications/read-all`,
      {},
      { headers: getAuthHeader() },
    ),
  );
  return response.data;
}

async function withAuthRetry<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    const err = error as AxiosError;
    if (err.response?.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await request();
      }
    }
    throw error;
  }
}

export async function getMyWalletSummary(): Promise<WalletSummary | null> {
  try {
    const response = await withAuthRetry(() =>
      axios.get(`${API_BASE_URL}/wallet/me`, {
        headers: getAuthHeader(),
      }),
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    if (err.response?.status === 404) {
      return null;
    }
    console.error("Wallet summary fetch failed", {
      status: err.response?.status,
      url: `${API_BASE_URL}/wallet/me`,
    });
    throw error;
  }
}

export async function getMyWalletStatement(): Promise<WalletStatementItem[]> {
  try {
    const response = await withAuthRetry(() =>
      axios.get(`${API_BASE_URL}/wallet/me/statement`, {
        headers: getAuthHeader(),
      }),
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    if (err.response?.status === 404) {
      return [];
    }
    console.error("Wallet statement fetch failed", {
      status: err.response?.status,
      url: `${API_BASE_URL}/wallet/me/statement`,
    });
    throw error;
  }
}

export async function exportMyWalletStatementExcel(): Promise<Blob> {
  try {
    const response = await withAuthRetry(() =>
      axios.get(`${API_BASE_URL}/wallet/me/statement/export`, {
        headers: getAuthHeader(),
        responseType: "blob",
      }),
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    throw error;
  }
}

export async function getCustomerDashboardInvoices(): Promise<InsuranceForm[]> {
  try {
    const response = await withAuthRetry(() =>
      axios.get(`${API_BASE_URL}/invoices/customer/dashboard`, {
        headers: getAuthHeader(),
      }),
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    if (err.response?.status === 404) {
      return [];
    }
    throw error;
  }
}


export async function getTransporterDashboardInvoices(): Promise<InsuranceForm[]> {
  try {
    const response = await withAuthRetry(() =>
      axios.get(`${API_BASE_URL}/invoices/transporter/dashboard`, {
        headers: getAuthHeader(),
      }),
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    if (err.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function getMyUserInvoices(): Promise<InsuranceForm[]> {
  try {
    const userRaw = localStorage.getItem("user");
    if (!userRaw) return [];

    const user = JSON.parse(userRaw);
    if (!user?.id) return [];

    const response = await withAuthRetry(() =>
      axios.get(`${API_BASE_URL}/invoices/user/${user.id}`, {
        headers: getAuthHeader(),
      }),
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    if (err.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function createCustomerWebPaymentCheckout(
  invoiceIds: string[],
): Promise<CustomerPaymentCheckoutResponse> {
  try {
    const response = await withAuthRetry(() =>
      axios.post(
        `${API_BASE_URL}/payment/customer/web-checkout`,
        { invoiceIds },
        { headers: getAuthHeader() },
      ),
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    throw error;
  }
}

export async function getCustomerPaymentCheckoutStatus(
  merchantOrderId: string,
): Promise<CustomerPaymentCheckoutStatus> {
  try {
    const response = await withAuthRetry(() =>
      axios.get(
        `${API_BASE_URL}/payment/customer/checkout/${encodeURIComponent(merchantOrderId)}/status`,
        { headers: getAuthHeader() },
      ),
    );
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    throw error;
  }
}

export async function getCustomerDashboardClaims(): Promise<ClaimRequest[]> {
  try {
    const response = await withAuthRetry(() =>
      axios.get(`${API_BASE_URL}/claim-requests/customer/dashboard`, {
        headers: getAuthHeader(),
      }),
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    if (err.response?.status === 404) {
      return [];
    }
    throw error;
  }
}


export async function getTransporterDashboardClaims(): Promise<ClaimRequest[]> {
  try {
    const response = await withAuthRetry(() =>
      axios.get(`${API_BASE_URL}/claim-requests/transporter/dashboard`, {
        headers: getAuthHeader(),
      }),
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    if (err.response?.status === 404) {
      return [];
    }
    throw error;
  }
}
