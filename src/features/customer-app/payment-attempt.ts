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
  merchantOrderId: string | null;
  phase: "draft" | "redirecting" | "retry";
  fingerprint: string;
  draft: CustomerInvoiceDraft;
  createdAt: number;
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
    // Version 1 invoices were created before the web payload included the
    // configured logistics amount. Never retry those stale attempts.
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
    // The in-memory attempt still preserves browser-back behavior when storage
    // is unavailable (for example, in a restricted private-browsing context).
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
