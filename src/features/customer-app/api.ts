import axios, { type AxiosRequestConfig } from "axios";

import {
  getStoredAuthToken,
  refreshAccessToken,
} from "@/features/auth/api";
import type { InsuranceForm } from "@/features/insurance/api";
import { canonicalizeCommodityLabel } from "./commodity-normalization";

/** Canonical invoice/PDF product name. UI may show Anar; invoices store Pomegranate. */
export function invoiceProductNameForSubmit(product: string): string {
  const cleaned = String(product || "").trim();
  if (!cleaned) return cleaned;
  if (canonicalizeCommodityLabel(cleaned) === "Pomegranate (Anar)") {
    return "Pomegranate";
  }
  return cleaned;
}

/** Catalog HSN used when customer create/update omits hsnCode. */
export function invoiceHsnCodeForSubmit(product: string): string {
  const canonical = canonicalizeCommodityLabel(product);
  const byName: Record<string, string> = {
    "Pomegranate (Anar)": "08109010",
    "Tender Coconut": "08011910",
    Tomato: "07020000",
    Mango: "08045020",
    Banana: "08039010",
    Apple: "08081000",
    Pineapple: "08043000",
    Onion: "07031010",
    Potato: "07019000",
    "Mosambi (Sweet Lime)": "08059000",
  };
  return byName[canonical] || "";
}

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
  if (userId.startsWith("demo-user")) {
    const existing = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const parsed = existing ? JSON.parse(existing) : {};
    const updated = { ...parsed, ...payload, id: userId };
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(updated));
    }
    return { success: true, data: updated, ...updated };
  }

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
  signal?: AbortSignal,
) {
  const form = new FormData();
  files.forEach((file) => form.append("documents", file));
  form.append("fastMode", "true");
  if (currentProduct) form.append("currentProduct", currentProduct);
  return customerRequest<Record<string, unknown>>({
    method: "POST",
    url: "/invoices/extract-invoice-fields",
    data: form,
    signal,
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
  | "supplier_address"
  | "buyer_name"
  | "buyer_address"
  | "quantity"
  | "rate"
  | "total_amount"
  | "vehicle_number"
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

export type TenderCoconutLogisticsTier = {
  tonnage: number;
  amount: number;
};

export type CustomerAppPricing = {
  tenderCoconut: {
    pricingVersion: number;
    // Generic tier list. Truck sizes render from this, so a new tonnage added
    // on the backend needs no web deploy. Optional because an older backend
    // only sends the legacy amountNNTon fields below.
    tiers?: TenderCoconutLogisticsTier[];
    amount20Ton?: number;
    amount25Ton: number;
    amount30Ton: number;
    updatedAt: string | null;
  };
};

export const FALLBACK_TENDER_COCONUT_TONNAGES = [20, 25, 30] as const;

export function tenderCoconutTiers(
  pricing?: CustomerAppPricing["tenderCoconut"] | null,
): TenderCoconutLogisticsTier[] {
  const fromBackend = Array.isArray(pricing?.tiers)
    ? pricing.tiers
        .map((tier) => ({
          tonnage: Number(tier?.tonnage),
          amount: Number(tier?.amount),
        }))
        .filter(
          (tier) =>
            Number.isFinite(tier.tonnage) &&
            tier.tonnage > 0 &&
            Number.isFinite(tier.amount) &&
            tier.amount >= 0,
        )
    : [];
  if (fromBackend.length > 0) {
    return fromBackend.sort((left, right) => left.tonnage - right.tonnage);
  }
  // Older backend: rebuild the list from the legacy named fields.
  return [
    { tonnage: 20, amount: Number(pricing?.amount20Ton ?? 120000) },
    { tonnage: 25, amount: Number(pricing?.amount25Ton ?? 130000) },
    { tonnage: 30, amount: Number(pricing?.amount30Ton ?? 140000) },
  ].filter((tier) => Number.isFinite(tier.amount));
}

export function normalizeVehicleTonnage(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^\d{1,3}$/.test(text) ? text : "";
}

export function tenderCoconutTierAmount(
  pricing: CustomerAppPricing["tenderCoconut"] | null | undefined,
  vehicleTonnage: unknown,
): number {
  const selected = normalizeVehicleTonnage(vehicleTonnage);
  if (!selected) return 0;
  const tier = tenderCoconutTiers(pricing).find(
    (candidate) => String(candidate.tonnage) === selected,
  );
  return tier ? Number(tier.amount) || 0 : 0;
}

export function isSelectedVehicleTonnage(
  value: unknown,
  pricing?: CustomerAppPricing["tenderCoconut"] | null,
): boolean {
  const text = normalizeVehicleTonnage(value);
  if (!text) return false;
  return tenderCoconutTiers(pricing).some(
    (tier) => String(tier.tonnage) === text,
  );
}

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
    ? tenderCoconutTierAmount(pricing, draft.vehicleTonnage)
    : 0;
  const logisticsAmount = draft.includeLogistics !== false
    ? configuredLogisticsAmount
    : 0;
  const amount = Number((goodsAmount + logisticsAmount).toFixed(2));
  const rate = enteredRate > 0 ? enteredRate : Number(matchingCustomerInvoiceRate(amount, quantity)) || 0;
  const cash = draft.mode === "Cash";

  form.append("userId", userId);
  form.append("customerUserId", userId);
  form.append("invoiceDate", draft.invoiceDate);
  form.append("invoiceType", cash ? "BUYER_INVOICE" : "SUPPLIER_INVOICE");
  form.append("supplierName", draft.supplierName.trim());
  form.append("supplierAddress", JSON.stringify([draft.supplierAddress.trim()]));
  form.append(
    "placeOfSupply",
    resolvePlaceOfSupplyForSubmit(
      draft.supplierAddress,
      draft.placeOfSupply,
    ),
  );
  form.append("billToName", draft.buyerName.trim());
  form.append("billToAddress", JSON.stringify([draft.buyerAddress.trim()]));
  form.append("shipToName", draft.buyerName.trim());
  form.append("shipToAddress", JSON.stringify([draft.buyerAddress.trim()]));
  form.append(
    "productName",
    invoiceProductNameForSubmit(draft.product),
  );
  const hsnCode = invoiceHsnCodeForSubmit(draft.product);
  if (hsnCode) form.append("hsnCode", hsnCode);
  form.append("quantity", String(quantity));
  form.append("rate", String(rate));
  form.append("amount", String(amount));
  form.append("sourceSurface", "CUSTOMER_WEB");
  form.append("autoVerifyOnCreate", "true");
  form.append("vehicleNumber", vehicle);
  form.append("truckNumber", vehicle);
  if (isTenderCoconut) {
    if (isSelectedVehicleTonnage(draft.vehicleTonnage, pricing)) {
      form.append("vehicleTonnage", normalizeVehicleTonnage(draft.vehicleTonnage));
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

export async function updateCustomerInvoice(
  invoiceId: string,
  payload: {
    invoiceDate: string;
    supplierName: string;
    supplierAddress: string;
    placeOfSupply: string;
    buyerName: string;
    buyerAddress: string;
    vehicleNumber?: string;
    productName?: string;
  },
): Promise<InsuranceForm> {
  const form = new FormData();
  form.append("invoiceDate", payload.invoiceDate);
  form.append("supplierName", payload.supplierName.trim());
  form.append(
    "supplierAddress",
    JSON.stringify([payload.supplierAddress.trim()]),
  );
  form.append(
    "placeOfSupply",
    resolvePlaceOfSupplyForSubmit(
      payload.supplierAddress,
      payload.placeOfSupply,
    ),
  );
  form.append("billToName", payload.buyerName.trim());
  form.append(
    "billToAddress",
    JSON.stringify([payload.buyerAddress.trim()]),
  );
  form.append("shipToName", payload.buyerName.trim());
  form.append(
    "shipToAddress",
    JSON.stringify([payload.buyerAddress.trim()]),
  );
  if (payload.vehicleNumber?.trim()) {
    const vehicle = payload.vehicleNumber
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    form.append("vehicleNumber", vehicle);
    form.append("truckNumber", vehicle);
  }
  if (payload.productName?.trim()) {
    form.append(
      "productName",
      invoiceProductNameForSubmit(payload.productName),
    );
    const hsnCode = invoiceHsnCodeForSubmit(payload.productName);
    if (hsnCode) form.append("hsnCode", hsnCode);
  }

  return customerRequest({
    method: "PATCH",
    url: `/invoices/${encodeURIComponent(invoiceId)}`,
    data: form,
  });
}

function digits(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function resolvePlaceOfSupplyForSubmit(
  supplierAddress: string,
  currentPlaceOfSupply: string,
) {
  const address = String(supplierAddress || "").trim();
  const current = String(currentPlaceOfSupply || "").trim();
  if (!address) return current || "India";

  const haystack = address
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const districtMatch = haystack.match(
    /\b(?:dist\.?|district|zilla|zila)\s*[:=\-.]?\s*([a-z][a-z.]+(?:\s+[a-z][a-z.]+)?)/i,
  );
  if (districtMatch?.[1]) {
    return titleCasePlace(districtMatch[1].replace(/\./g, " "));
  }

  if (current) {
    const needle = current.toLowerCase().replace(/[_/]+/g, " ").trim();
    if (needle.length >= 3 && haystack.includes(needle)) {
      return titleCasePlace(current);
    }
  }

  return current || "India";
}

function titleCasePlace(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function isTenderCoconutProduct(value: string) {
  return canonicalizeCommodityLabel(value) === "Tender Coconut";
}

export function isPomegranateProduct(value: string) {
  return canonicalizeCommodityLabel(value) === "Pomegranate (Anar)";
}
