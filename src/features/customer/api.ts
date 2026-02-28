import axios, { AxiosError } from "axios";
import type { ClaimRequest, InsuranceForm } from "@/features/insurance/api";

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
  createdAt: string;
}

function getAuthHeader() {
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(err: AxiosError) {
  if (err.response?.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/session-expired";
  }
}

export async function getMyWalletSummary(): Promise<WalletSummary | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/wallet/me`, {
      headers: getAuthHeader(),
    });
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
    const response = await axios.get(`${API_BASE_URL}/wallet/me/statement`, {
      headers: getAuthHeader(),
    });
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
    const response = await axios.get(`${API_BASE_URL}/wallet/me/statement/export`, {
      headers: getAuthHeader(),
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    handleUnauthorized(err);
    throw error;
  }
}

export async function getCustomerDashboardInvoices(): Promise<InsuranceForm[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/invoices/customer/dashboard`, {
      headers: getAuthHeader(),
    });
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

    const response = await axios.get(`${API_BASE_URL}/invoices/user/${user.id}`, {
      headers: getAuthHeader(),
    });
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

export async function getCustomerDashboardClaims(): Promise<ClaimRequest[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/claim-requests/customer/dashboard`, {
      headers: getAuthHeader(),
    });
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
