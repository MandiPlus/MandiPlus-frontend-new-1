"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  CreditCardIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../auth/context/AuthContext";
import { InsuranceForm, getBackendURL } from "../api";
import {
  createCustomerWebPaymentCheckout,
  getCustomerDashboardInvoices,
  getMyUserInvoices,
  getTransporterDashboardInvoices,
  markCustomerNotificationRead,
} from "../../customer/api";
import ProtectedRoute from "../../auth/components/ProtectedRoute";

type PaperTab = "pending" | "policy" | "paid" | "all";
type PaperInvoice = InsuranceForm & {
  premiumAmount?: number | string | null;
  paymentAmount?: number | string | null;
  paymentStatus?: string | null;
  paymentLinkUrl?: string | null;
  paymentCompletedAt?: string | null;
  paymentReceiptUrl?: string | null;
  isPaymentRequired?: boolean | null;
  isVerified?: boolean | null;
};

const tabs: { key: PaperTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "policy", label: "Policy" },
  { key: "paid", label: "Paid" },
  { key: "all", label: "All" },
];

const MyInsuranceForms = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [forms, setForms] = useState<PaperInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const initialTab = normalizeTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<PaperTab>(initialTab);

  const fetchForms = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data =
        Boolean(user.isCustomer) || user.identity === "CUSTOMER"
          ? await getCustomerDashboardInvoices()
          : user.identity === "TRANSPORTER"
          ? await getTransporterDashboardInvoices()
          : await getMyUserInvoices();
      setForms(data as PaperInvoice[]);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load papers"));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    const notificationId = searchParams.get("notificationId");
    if (notificationId) void markCustomerNotificationRead(notificationId).catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    const invoiceId = searchParams.get("invoiceId");
    if (!invoiceId || loading) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`invoice-${invoiceId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [forms, loading, searchParams]);

  const pendingInvoices = useMemo(() => forms.filter(isPayableInvoice), [forms]);
  const checkoutInvoices = useMemo(
    () => pendingInvoices.filter((invoice) => Boolean(invoice.isVerified)),
    [pendingInvoices],
  );
  const awaitingApprovalInvoices = useMemo(
    () => pendingInvoices.filter((invoice) => !invoice.isVerified),
    [pendingInvoices],
  );
  const policyInvoices = useMemo(() => forms.filter((form) => Boolean(getInsuranceUrl(form))), [forms]);
  const paidInvoices = useMemo(() => forms.filter(isPaidInvoice), [forms]);
  const pendingTotal = checkoutInvoices.reduce((sum, form) => sum + getPayableAmount(form), 0);

  const tabRows = useMemo(() => {
    if (activeTab === "pending") return pendingInvoices;
    if (activeTab === "policy") return policyInvoices;
    if (activeTab === "paid") return paidInvoices;
    return forms;
  }, [activeTab, forms, paidInvoices, pendingInvoices, policyInvoices]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tabRows;
    return tabRows.filter((form) =>
      [
        form.invoiceNumber,
        getVehicle(form),
        getProduct(form),
        form.supplierName,
        form.billToName,
        form.shipToName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, tabRows]);

  const handleDownload = (rawUrl?: string) => {
    const url = normalizeDocumentUrl(rawUrl);
    if (!url) {
      setNotice("This document is not ready yet.");
      return;
    }
    window.open(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, "_blank", "noopener,noreferrer");
  };

  const startPendingPaymentCheckout = async (invoiceIds?: string[]) => {
    if (creatingCheckout || loading) return;
    setNotice("");
    const selectedInvoices = invoiceIds?.length
      ? checkoutInvoices.filter((invoice) => invoiceIds.includes(invoice.id))
      : checkoutInvoices;
    if (!selectedInvoices.length) {
      if (awaitingApprovalInvoices.length) {
        setNotice(
          `${awaitingApprovalInvoices.length} invoice${awaitingApprovalInvoices.length > 1 ? "s are" : " is"} awaiting approval. Payment will be available after verification.`,
        );
        return;
      }
      setActiveTab("all");
      return;
    }

    setCreatingCheckout(true);
    try {
      const checkout = await createCustomerWebPaymentCheckout(
        selectedInvoices.map((invoice) => invoice.id),
      );
      if (!checkout.redirectUrl) {
        throw new Error("PhonePe checkout did not return a payment URL.");
      }
      window.location.assign(checkout.redirectUrl);
    } catch (err: unknown) {
      setActiveTab("pending");
      setNotice(getErrorMessage(err, "Could not start PhonePe checkout. Please try again."));
    } finally {
      setCreatingCheckout(false);
    }
  };

  return (
    <ProtectedRoute allowedIdentities={["BUYER", "SUPPLIER", "CUSTOMER", "TRANSPORTER"]}>
      <div className="min-h-screen bg-[#f5f6fb] pb-24 text-[#171914]">
      <header className="border-b border-[#e7ebf3] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e7ebf3] text-[#203044]"
            aria-label="Back to home"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-xl font-black text-[#171914]">My Papers</h1>
            <p className="text-xs font-semibold text-[#7b8176]">Invoices, payments and policy PDFs</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/insurance")}
            className="min-h-11 rounded-full bg-[#203044] px-4 text-sm font-black text-white"
          >
            New
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5">
        <section className="rounded-[24px] border border-[#e7ebf3] bg-white p-5 shadow-[0_10px_24px_rgba(32,48,68,0.05)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#203044]">
                {loading
                  ? "Checking payments"
                  : error && forms.length === 0
                  ? "Payments unavailable"
                  : checkoutInvoices.length
                  ? "Payment due"
                  : awaitingApprovalInvoices.length
                  ? "Awaiting approval"
                  : "No payment due"}
              </p>
              {loading ? (
                <div className="mt-3 h-9 w-44 animate-pulse rounded-lg bg-[#e9edf4]" aria-label="Loading payment dues" />
              ) : error && forms.length === 0 ? (
                <p className="mt-2 text-4xl font-black leading-none">--</p>
              ) : (
                <p className="mt-2 text-4xl font-black leading-none">
                  {checkoutInvoices.length ? money(pendingTotal) : "No dues"}
                </p>
              )}
              <p className="mt-2 text-sm font-semibold text-[#7b8176]">
                {loading
                  ? "Loading your latest invoices..."
                  : error && forms.length === 0
                  ? "We could not load your latest dues. Please retry."
                  : checkoutInvoices.length
                  ? `${checkoutInvoices.length} invoice${checkoutInvoices.length > 1 ? "s" : ""} ready to pay`
                  : awaitingApprovalInvoices.length
                  ? `${awaitingApprovalInvoices.length} invoice${awaitingApprovalInvoices.length > 1 ? "s" : ""} awaiting approval`
                  : "Your payment list is clear right now"}
              </p>
              {!loading && checkoutInvoices.length > 0 && awaitingApprovalInvoices.length > 0 ? (
                <p className="mt-1 text-xs font-semibold text-[#95601b]">
                  {awaitingApprovalInvoices.length} more awaiting approval
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={error && forms.length === 0 ? fetchForms : () => startPendingPaymentCheckout()}
              disabled={creatingCheckout || loading}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#203044] px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCardIcon className="h-5 w-5" />
              {loading
                ? "Checking..."
                : error && forms.length === 0
                ? "Retry"
                : creatingCheckout
                ? "Opening PhonePe..."
                : checkoutInvoices.length
                ? "Pay Now"
                : "View Papers"}
            </button>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#e7ebf3] bg-white p-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const count =
                tab.key === "pending"
                  ? pendingInvoices.length
                  : tab.key === "policy"
                  ? policyInvoices.length
                  : tab.key === "paid"
                  ? paidInvoices.length
                  : forms.length;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-black ${
                    activeTab === tab.key
                      ? "bg-[#203044] text-white"
                      : "border border-[#e7ebf3] bg-[#f8f9fd] text-[#203044]"
                  }`}
                >
                  {tab.label} {count}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl border border-[#e7ebf3] bg-[#f8f9fd] px-3">
            <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-[#7b8176]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice or truck"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[#7b8176]"
            />
          </div>

          {notice ? (
            <div className="mt-3 rounded-2xl border border-[#fff1d8] bg-[#fff8eb] px-4 py-3 text-sm font-semibold text-[#95601b]">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-2xl border border-[#ffe7e0] bg-[#fff7f5] px-4 py-3 text-sm font-semibold text-[#c84f45]">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#d7deea] bg-[#f8f9fd] px-4 py-10 text-center text-sm font-semibold text-[#7b8176]">
              Loading papers...
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#d7deea] bg-[#f8f9fd] px-4 py-10 text-center text-sm font-semibold text-[#7b8176]">
              No papers found here.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {rows.map((form) => {
                const payable = isPayableInvoice(form);
                const approvedForPayment = payable && Boolean(form.isVerified);
                const invoiceUrl = getInvoiceUrl(form);
                const policyUrl = getInsuranceUrl(form);
                return (
                  <article
                    id={`invoice-${form.id}`}
                    key={form.id}
                    className={`rounded-[22px] border bg-white p-4 ${searchParams.get("invoiceId") === form.id ? "border-[#203044] ring-2 ring-[#dfe7f1]" : "border-[#e7ebf3]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f8f9fd] text-[#203044]">
                        {policyUrl ? <ShieldCheckIcon className="h-6 w-6" /> : <DocumentTextIcon className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-black text-[#171914]">{form.invoiceNumber}</h2>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${payable ? "bg-[#fff1d8] text-[#95601b]" : policyUrl ? "bg-[#eef3fa] text-[#203044]" : "bg-[#f8f9fd] text-[#7b8176]"}`}>
                            {approvedForPayment
                              ? "Due"
                              : payable
                              ? "Awaiting approval"
                              : policyUrl
                              ? "Policy ready"
                              : formatPaymentStatus(form.paymentStatus)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#7b8176]">
                          {getVehicle(form)} · {getProduct(form)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#7b8176]">
                          {form.createdAt ? new Date(form.createdAt).toLocaleDateString("en-IN") : "Date unavailable"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-black text-[#171914]">
                          {money(payable ? getPayableAmount(form) : numberValue(form.amount))}
                        </p>
                        <p className="text-xs font-semibold text-[#7b8176]">{payable ? "Payable" : "Amount"}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {approvedForPayment ? (
                        <button
                          type="button"
                          onClick={() => startPendingPaymentCheckout([form.id])}
                          disabled={creatingCheckout}
                          className="min-h-11 rounded-full bg-[#203044] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {creatingCheckout ? "Opening..." : `Pay ${money(getPayableAmount(form))}`}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDownload(invoiceUrl)}
                        className="min-h-11 rounded-full border border-[#d7deea] px-4 text-sm font-black text-[#203044]"
                      >
                        Invoice PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(policyUrl)}
                        className="min-h-11 rounded-full border border-[#d7deea] px-4 text-sm font-black text-[#203044] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!policyUrl}
                      >
                        Policy PDF
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      </div>
    </ProtectedRoute>
  );
};

function normalizeTab(value: string | null): PaperTab {
  if (value === "pending" || value === "policy" || value === "paid" || value === "all") return value;
  return "pending";
}

function numberValue(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function getPayableAmount(form: PaperInvoice) {
  const status = String(form.paymentStatus || "").toUpperCase();
  const premium = numberValue(form.premiumAmount);
  const recordedPayment = numberValue(form.paymentAmount);

  if (status === "PARTIAL" && premium > 0) {
    return Math.max(premium - recordedPayment, 0);
  }

  return premium > 0 ? premium : recordedPayment;
}

function isPayableInvoice(form: PaperInvoice) {
  const status = String(form.paymentStatus || "").toUpperCase();
  if (["PAID", "NOT_REQUIRED", "REFUNDED"].includes(status)) return false;
  const amount = getPayableAmount(form);
  return amount > 0 && (Boolean(form.isPaymentRequired) || ["PENDING", "PARTIAL", "FAILED"].includes(status));
}

function isPaidInvoice(form: PaperInvoice) {
  const status = String(form.paymentStatus || "").toUpperCase();
  return status === "PAID";
}

function getVehicle(form: PaperInvoice) {
  return String(form.vehicleNumber || form.truckNumber || "Vehicle not added");
}

function getProduct(form: PaperInvoice) {
  const product = form.productName;
  if (Array.isArray(product)) return product.filter(Boolean).join(", ") || "Product";
  return String(product || "Product");
}

function getInvoiceUrl(form: PaperInvoice) {
  return normalizeDocumentUrl(form.pdfUrl || form.pdfURL);
}

function getInsuranceUrl(form: PaperInvoice) {
  const insurance = form.insurance;
  if (typeof insurance === "string") return normalizeDocumentUrl(insurance);
  return normalizeDocumentUrl(insurance?.fileUrl || insurance?.url || form.insuranceFileUrl || form.insuranceUrl);
}

function normalizeDocumentUrl(rawUrl?: string | null) {
  const url = String(rawUrl || "").trim();
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${getBackendURL()}${url}`;
}

function formatPaymentStatus(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  if (!normalized) return "View";
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(responseMessage)) return responseMessage.map(String).join(", ");
  if (typeof responseMessage === "string" && responseMessage.trim()) return responseMessage;
  if (error instanceof Error && error.message) return error.message;
  const directMessage = (error as { message?: unknown })?.message;
  if (Array.isArray(directMessage)) return directMessage.map(String).join(", ");
  if (typeof directMessage === "string" && directMessage.trim()) return directMessage;
  return fallback;
}

export default MyInsuranceForms;
