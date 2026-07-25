import axios, { type AxiosRequestConfig } from "axios";

import {
  getStoredAuthToken,
  refreshAccessToken,
} from "@/features/auth/api";
import type { InsuranceForm } from "@/features/insurance/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

async function customerRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const run = () =>
    axios.request<T>({
      ...config,
      url: `${API_BASE_URL}${config.url}`,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${getStoredAuthToken() || ""}`,
      },
    });

  try {
    return (await run()).data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return (await run()).data;
    }
    throw error;
  }
}

export async function updateCustomerUser(
  userId: string,
  payload: Record<string, unknown>,
) {
  const request = (data: Record<string, unknown>) =>
    customerRequest<Record<string, unknown>>({
      method: "PATCH",
      url: `/users/${encodeURIComponent(userId)}`,
      data,
    });

  try {
    return await request(payload);
  } catch (error) {
    if (
      "primaryCommodityCode" in payload &&
      isUnsupportedPropertyError(error, "primaryCommodityCode")
    ) {
      const compatiblePayload = { ...payload };
      delete compatiblePayload.primaryCommodityCode;
      return request(compatiblePayload);
    }
    throw error;
  }
}

function isUnsupportedPropertyError(error: unknown, property: string) {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) {
    return false;
  }
  const responseMessage = error.response.data?.message;
  const messages = Array.isArray(responseMessage)
    ? responseMessage
    : [responseMessage];
  return messages.some((message) =>
    String(message || "")
      .toLowerCase()
      .includes(`property ${property.toLowerCase()} should not exist`),
  );
}

export async function extractCustomerInvoice(files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append("documents", file));
  return customerRequest<Record<string, unknown>>({
    method: "POST",
    url: "/invoices/extract-invoice-fields",
    data: form,
  });
}

export async function extractCustomerInvoiceText(
  notes: string,
  currentProduct?: string,
) {
  return customerRequest<Record<string, unknown>>({
    method: "POST",
    url: "/invoices/extract-invoice-fields-text",
    data: {
      notes,
      ...(currentProduct ? { currentProduct } : {}),
    },
  });
}

export async function askCustomerAssistant(payload: {
  message: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  return customerRequest<{ answer?: string; model?: string }>({
    method: "POST",
    url: "/customer-assistant/chat",
    data: payload,
  });
}

export type CustomerInvoiceDraft = {
  invoiceDate: string;
  mode: "Cash" | "Commission";
  supplierName: string;
  supplierAddress: string;
  buyerName: string;
  buyerAddress: string;
  placeOfSupply: string;
  product: string;
  quantity: string;
  rate: string;
  vehicleNumber: string;
  vehicleTonnage: string;
  driverPhone: string;
  insuredPartyPhone: string;
  ownerName: string;
  note: string;
};

export type CustomerAppPricing = {
  tenderCoconut: {
    pricingVersion: number;
    amount25Ton: number;
    amount30Ton: number;
    updatedAt: string | null;
  };
};

export async function getCustomerAppPricing() {
  return customerRequest<CustomerAppPricing>({
    method: "GET",
    url: "/app-settings/customer/pricing",
  });
}

export async function createCustomerInvoice(
  userId: string,
  draft: CustomerInvoiceDraft,
  files: File[],
  pricing?: CustomerAppPricing["tenderCoconut"],
): Promise<InsuranceForm & { paymentStatus?: string }> {
  const form = new FormData();
  const vehicle = draft.vehicleNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const quantity = Number(draft.quantity || 0);
  const rate = Number(draft.rate || 0);
  const amount = quantity * rate;
  const cash = draft.mode === "Cash";

  form.append("userId", userId);
  form.append("customerUserId", userId);
  form.append("invoiceDate", draft.invoiceDate);
  form.append("invoiceType", cash ? "BUYER_INVOICE" : "SUPPLIER_INVOICE");
  form.append("supplierName", draft.supplierName.trim());
  form.append("supplierAddress", JSON.stringify([draft.supplierAddress.trim()]));
  form.append("placeOfSupply", draft.placeOfSupply.trim());
  form.append("billToName", draft.buyerName.trim());
  form.append("billToAddress", JSON.stringify([draft.buyerAddress.trim()]));
  form.append("shipToName", draft.buyerName.trim());
  form.append("shipToAddress", JSON.stringify([draft.buyerAddress.trim()]));
  form.append("productName", draft.product.trim());
  form.append("quantity", String(quantity));
  form.append("rate", String(rate));
  form.append("amount", String(amount));
  form.append("sourceSurface", "USER_APP_BETA");
  form.append("autoVerifyOnCreate", "true");
  form.append("vehicleNumber", vehicle);
  form.append("truckNumber", vehicle);
  if (isTenderCoconutProduct(draft.product)) {
    form.append("vehicleTonnage", draft.vehicleTonnage);
    form.append("pricingVersion", String(pricing?.pricingVersion || 1));
    form.append("invoiceAdditionsAmount", "0");
  }
  if (draft.ownerName.trim()) form.append("ownerName", draft.ownerName.trim());
  if (draft.driverPhone.trim()) form.append("driverPhone", digits(draft.driverPhone));
  if (draft.insuredPartyPhone.trim()) {
    form.append("insuredPartyPhone", digits(draft.insuredPartyPhone));
  }
  if (draft.note.trim()) form.append("weighmentSlipNote", draft.note.trim());
  files.forEach((file) => form.append("weighmentSlips", file));

  return customerRequest({
    method: "POST",
    url: "/invoices",
    data: form,
  });
}

function digits(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

export function isTenderCoconutProduct(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    normalized === "coconut" ||
    normalized === "green coconut" ||
    /tender\s+coconuts?/.test(normalized)
  );
}
