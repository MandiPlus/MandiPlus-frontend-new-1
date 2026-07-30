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

export async function extractCustomerInvoice(
  files: File[],
  currentProduct?: string,
) {
  const form = new FormData();
  files.forEach((file) => form.append("documents", file));
  form.append("fastMode", "true");
  if (currentProduct) form.append("currentProduct", currentProduct);
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

export type InvoiceVoiceTargetField =
  | "supplier_name"
  | "buyer_name"
  | "buyer_address"
  | "quantity"
  | "rate"
  | "total_amount"
  | "vehicle_tonnage"
  | "insured_party_phone";

export async function extractCustomerInvoiceVoice(
  audio: File,
  currentProduct?: string,
  targetField?: InvoiceVoiceTargetField,
) {
  const form = new FormData();
  form.append("audio", audio);
  if (currentProduct) form.append("currentProduct", currentProduct);
  if (targetField) form.append("targetField", targetField);
  return customerRequest<Record<string, unknown>>({
    method: "POST",
    url: "/invoices/extract-invoice-voice-fields",
    data: form,
  });
}

export async function getCustomerInvoiceProfile() {
  return customerRequest<Record<string, unknown> | null>({
    method: "GET",
    url: "/invoices/customer/profile",
  });
}

export type CustomerLiveTranscriptionToken = {
  provider: "gemini-live" | "assemblyai";
  token: string;
  websocketUrl: string;
  expiresInSeconds: number;
  maxSessionDurationSeconds: number;
  model: string;
};

export async function getCustomerLiveTranscriptionToken(
  languageCode: string,
) {
  const response = await customerRequest<{
    success: boolean;
    data: CustomerLiveTranscriptionToken;
  }>({
    method: "POST",
    url: "/invoices/customer/live-transcription-token",
    data: { languageCode },
    timeout: 3500,
  });
  return response.data;
}

export type CustomerChannelPartnerRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type CustomerChannelPartnerRequest = {
  id: string;
  userId: string;
  name: string;
  mobileNumber: string;
  state: string;
  status: CustomerChannelPartnerRequestStatus;
  reviewedAt?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerChannelPartnerRequestResponse = {
  success: boolean;
  data: CustomerChannelPartnerRequest | null;
  message?: string;
};

export async function getCustomerChannelPartnerRequest() {
  const response = await customerRequest<CustomerChannelPartnerRequestResponse>({
    method: "GET",
    url: "/channel-partners/me/request",
  });
  return response.data || null;
}

export async function createCustomerChannelPartnerRequest(payload: {
  name: string;
  state: string;
}) {
  return customerRequest<CustomerChannelPartnerRequestResponse>({
    method: "POST",
    url: "/channel-partners/me/request",
    data: payload,
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
  totalAmount: string;
  vehicleNumber: string;
  vehicleTonnage: string;
  includeLogistics: boolean;
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

export function roundCustomerInvoiceMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function matchingCustomerInvoiceRate(
  total: number,
  quantity: number,
) {
  const safeTotal = roundCustomerInvoiceMoney(total);
  if (
    !Number.isFinite(safeTotal) ||
    safeTotal <= 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return "";
  }
  const exactRate = safeTotal / quantity;
  for (let precision = 2; precision <= 12; precision += 1) {
    const candidate = Number(exactRate.toFixed(precision));
    if (roundCustomerInvoiceMoney(quantity * candidate) === safeTotal) {
      return candidate.toFixed(precision).replace(/\.?0+$/, "");
    }
  }
  return exactRate.toFixed(12).replace(/\.?0+$/, "");
}

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
  const enteredRate = Number(draft.rate || 0);
  const extractedTotal = Number(draft.totalAmount || 0);
  const goodsAmount =
    Number.isFinite(extractedTotal) && extractedTotal > 0
      ? extractedTotal
      : quantity * enteredRate;
  const isTenderCoconut = isTenderCoconutProduct(draft.product);
  const configuredLogisticsAmount = isTenderCoconut
    ? draft.vehicleTonnage === "30"
      ? Number(pricing?.amount30Ton || 0)
      : draft.vehicleTonnage === "25"
        ? Number(pricing?.amount25Ton || 0)
        : 0
    : 0;
  const logisticsAmount = draft.includeLogistics !== false
    ? configuredLogisticsAmount
    : 0;
  const amount = Number((goodsAmount + logisticsAmount).toFixed(2));
  const rate =
    Number(matchingCustomerInvoiceRate(amount, quantity)) || enteredRate;
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
  if (isTenderCoconut) {
    if (draft.vehicleTonnage === "25" || draft.vehicleTonnage === "30") {
      form.append("vehicleTonnage", draft.vehicleTonnage);
      form.append("pricingVersion", String(pricing?.pricingVersion || 1));
      form.append(
        "includeLogistics",
        String(draft.includeLogistics !== false),
      );
    }
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
