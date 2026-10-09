import axios, { AxiosError } from "axios";
import {
  getStoredAuthToken,
  refreshAccessToken,
} from "@/features/auth/api";
import type { ChannelPartnerDetailPayload } from "@/features/admin/api/admin.api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

function getAuthHeader() {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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

export async function getMyChannelPartnerDashboard(
  filters?: { scope?: "profile" | "all" },
): Promise<ChannelPartnerDetailPayload> {
  const response = await withAuthRetry(() =>
    axios.get(`${API_BASE_URL}/channel-partners/me/dashboard`, {
      headers: getAuthHeader(),
      params: filters,
    }),
  );
  return response.data?.data ?? response.data;
}

export async function onboardChannelPartnerCustomer(data: {
  name: string;
  mobileNumber: string;
  secondaryMobileNumber?: string;
  state: string;
  mandiName?: string;
  products: string[];
  identity?: string;
}): Promise<{
  success?: boolean;
  message?: string;
  data?: { status?: string };
}> {
  const response = await withAuthRetry(() =>
    axios.post(`${API_BASE_URL}/channel-partners/me/customers`, data, {
      headers: getAuthHeader(),
    }),
  );
  return response.data;
}
