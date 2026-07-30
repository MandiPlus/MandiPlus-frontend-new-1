import type {
  CustomerAppPricing,
  CustomerInvoiceDraft,
} from "./api";

const CUSTOMER_INVOICE_PAYMENT_ATTEMPT_KEY =
  "mandiplus:customer-invoice-payment-attempt:v2";
const LEGACY_CUSTOMER_INVOICE_PAYMENT_ATTEMPT_KEY =
  "mandiplus:customer-invoice-payment-attempt:v1";
const PAYMENT_ATTEMPT_TTL_MS = 6 * 60 * 60 * 1000;

export type CustomerInvoicePaymentAttempt = {
  version: 2;
  userId: string;
  invoiceId: string;
  invoiceReferences?: CustomerInvoicePaymentReference[];
  merchantOrderId: string | null;
  phase: "draft" | "redirecting" | "retry";
  fingerprint: string;
  draft: CustomerInvoiceDraft;
  drafts?: CustomerInvoiceDraft[];
  createdAt: number;
};

export type CustomerInvoicePaymentReference = {
  id: string;
  invoiceNumber?: string;
  vehicleNumber?: string;
  draftIndex?: number;
};

export function customerInvoicePaymentFingerprint(
  draft: CustomerInvoiceDraft,
  pricing?: CustomerAppPricing["tenderCoconut"] | null,
) {
  return JSON.stringify([
    draft.mode,
    draft.supplierName.trim(),
    draft.supplierAddress.trim(),
    draft.placeOfSupply.trim(),
    draft.buyerName.trim(),
    draft.buyerAddress.trim(),
    draft.product.trim(),
    draft.quantity.trim(),
    draft.rate.trim(),
    draft.totalAmount.trim(),
    compactVehicleNumber(draft.vehicleNumber),
    draft.vehicleTonnage,
    draft.ownerName.trim(),
    draft.invoiceDate,
    normalizePhone(draft.driverPhone),
    normalizePhone(draft.insuredPartyPhone),
    draft.note.trim(),
    pricing?.pricingVersion ?? null,
    pricing?.amount25Ton ?? null,
    pricing?.amount30Ton ?? null,
  ]);
}

export function readCustomerInvoicePaymentAttempt() {
  if (typeof window === "undefined") return null;

  try {
    window.sessionStorage.removeItem(
      LEGACY_CUSTOMER_INVOICE_PAYMENT_ATTEMPT_KEY,
    );
    const raw = window.sessionStorage.getItem(
      CUSTOMER_INVOICE_PAYMENT_ATTEMPT_KEY,
    );
    if (!raw) return null;

    const attempt = JSON.parse(raw) as Partial<CustomerInvoicePaymentAttempt>;
    const isExpired =
      typeof attempt.createdAt !== "number" ||
      Date.now() - attempt.createdAt > PAYMENT_ATTEMPT_TTL_MS;
    if (
      attempt.version !== 2 ||
      typeof attempt.userId !== "string" ||
      typeof attempt.invoiceId !== "string" ||
      (attempt.merchantOrderId !== null &&
        typeof attempt.merchantOrderId !== "string") ||
      typeof attempt.fingerprint !== "string" ||
      !attempt.draft ||
      typeof attempt.draft !== "object" ||
      isExpired
    ) {
      clearCustomerInvoicePaymentAttempt();
      return null;
    }

    const phase =
      attempt.phase === "draft" ||
      attempt.phase === "redirecting" ||
      attempt.phase === "retry"
        ? attempt.phase
        : attempt.merchantOrderId
          ? "redirecting"
          : "draft";

    return {
      ...(attempt as CustomerInvoicePaymentAttempt),
      phase,
      draft: {
        ...(attempt.draft as CustomerInvoiceDraft),
        includeLogistics:
          (attempt.draft as CustomerInvoiceDraft).includeLogistics !== false,
      },
      drafts: Array.isArray(attempt.drafts)
        ? attempt.drafts.map((draft) => ({
            ...(draft as CustomerInvoiceDraft),
            includeLogistics:
              (draft as CustomerInvoiceDraft).includeLogistics !== false,
          }))
        : undefined,
      invoiceReferences: Array.isArray(attempt.invoiceReferences)
        ? attempt.invoiceReferences
            .map((reference) => ({
              id: String(reference?.id || "").trim(),
              invoiceNumber: String(reference?.invoiceNumber || "").trim(),
              vehicleNumber: String(reference?.vehicleNumber || "").trim(),
              draftIndex: Number.isInteger(reference?.draftIndex)
                ? Number(reference.draftIndex)
                : undefined,
            }))
            .filter((reference) => reference.id)
        : undefined,
    };
  } catch {
    clearCustomerInvoicePaymentAttempt();
    return null;
  }
}

export function writeCustomerInvoicePaymentAttempt(
  attempt: CustomerInvoicePaymentAttempt,
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CUSTOMER_INVOICE_PAYMENT_ATTEMPT_KEY,
      JSON.stringify(attempt),
    );
  } catch {
    // In-memory state still preserves browser-back behavior when storage is
    // unavailable, such as in restricted private browsing.
  }
}

export function clearCustomerInvoicePaymentAttempt() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CUSTOMER_INVOICE_PAYMENT_ATTEMPT_KEY);
  } catch {
    // Storage may be disabled; there is nothing else to clear.
  }
}

function compactVehicleNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}
