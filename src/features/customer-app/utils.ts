import type { ClaimRequest, InsuranceForm } from "@/features/insurance/api";

export type CustomerInvoice = InsuranceForm & {
  premium?: number | string | null;
  premiumAmount?: number | string | null;
  paymentAmount?: number | string | null;
  pendingAmount?: number | string | null;
  pendingPaymentAmount?: number | string | null;
  paymentStatus?: string | null;
  paymentCompletedAt?: string | null;
  isPaymentRequired?: boolean | null;
  isVerified?: boolean | null;
  status?: string | null;
  driverPhone?: string | null;
  insuredPartyPhone?: string | null;
  ownerName?: string | null;
};

export function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function invoicePremium(invoice: CustomerInvoice): number {
  return (
    positiveNumber(invoice.premiumAmount) ??
    positiveNumber(invoice.premium) ??
    (positiveNumber(invoice.amount)
      ? Number((asNumber(invoice.amount) * 0.002).toFixed(2))
      : null) ??
    positiveNumber(invoice.paymentAmount) ??
    0
  );
}

export function invoicePayableAmount(invoice: CustomerInvoice): number {
  const state = String(invoice.paymentStatus || "").toUpperCase();
  if (
    invoice.isRejected ||
    ["PAID", "NOT_REQUIRED", "REFUNDED"].includes(state)
  ) {
    return 0;
  }

  const explicitPending =
    positiveNumber(invoice.pendingPaymentAmount) ??
    positiveNumber(invoice.pendingAmount);
  if (explicitPending !== null) return explicitPending;

  const premium = invoicePremium(invoice);
  if (state === "PARTIAL") {
    return Number(
      Math.max(premium - Math.max(asNumber(invoice.paymentAmount), 0), 0).toFixed(
        2,
      ),
    );
  }

  // paymentAmount can legitimately be zero while a pending premium is fully
  // unpaid. It is not a safe first-choice field for the amount still due.
  return premium;
}

export function isPaidInvoice(invoice: CustomerInvoice): boolean {
  return ["PAID", "NOT_REQUIRED", "REFUNDED"].includes(
    String(invoice.paymentStatus || "").toUpperCase(),
  );
}

export function isPayableInvoice(invoice: CustomerInvoice): boolean {
  if (isPaidInvoice(invoice) || invoice.isRejected) return false;
  const state = String(invoice.paymentStatus || "").toUpperCase();
  return (
    invoicePayableAmount(invoice) > 0 &&
    (invoice.isPaymentRequired === true ||
      ["PENDING", "PARTIAL", "FAILED", ""].includes(state))
  );
}

export function isCheckoutReady(invoice: CustomerInvoice): boolean {
  return isPayableInvoice(invoice) && invoice.isVerified === true;
}

export function getInsuranceUrl(invoice: CustomerInvoice): string {
  if (typeof invoice.insurance === "string") return normalizeDocumentUrl(invoice.insurance);
  return normalizeDocumentUrl(
    invoice.insurance?.fileUrl ||
      invoice.insurance?.url ||
      invoice.insuranceFileUrl ||
      invoice.insuranceUrl,
  );
}

export function getInvoicePdfUrl(invoice: CustomerInvoice): string {
  return normalizeDocumentUrl(invoice.pdfUrl || invoice.pdfURL);
}

export function normalizeDocumentUrl(value?: string | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const backend =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
  return `${backend.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`;
}

export function invoiceProduct(invoice: CustomerInvoice): string {
  const value = invoice.productName;
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "Commodity";
  return String(value || "Commodity");
}

export function invoiceVehicle(invoice: CustomerInvoice): string {
  return String(invoice.vehicleNumber || invoice.truckNumber || "Vehicle not added");
}

export function invoiceDate(invoice: CustomerInvoice): string {
  const value = invoice.invoiceDate || invoice.createdAt;
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
  });
}

export function money(value: unknown): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

export function isClosedClaim(claim: ClaimRequest): boolean {
  return ["CLOSED", "COMPLETED", "SETTLED", "REJECTED", "CANCELLED"].includes(
    String(claim.status || "").toUpperCase(),
  );
}

export function readableError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string | string[];
      response?: { data?: { message?: string | string[] } };
    };
    const message = candidate.response?.data?.message ?? candidate.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export function initials(name?: string | null): string {
  const parts = String(name || "Mandi Plus")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
