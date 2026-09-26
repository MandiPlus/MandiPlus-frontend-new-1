"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  CheckCheck,
  Image as ImageIcon,
  Link2,
  X,
  ArrowLeft,
  RefreshCw,
  Download,
  IndianRupee,
  Phone,
  Calendar,
  Truck,
  ExternalLink,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { adminApi, InsurancePaymentRow } from "@/features/admin/api/admin.api";

type SummaryImagePreview = {
  imageUrl: string;
  invoiceCount: number;
  totalAmount: number;
  invoiceLabel: string;
};

function formatCurrency(value: number) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString("en-IN");
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-IN");
}

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function getEffectiveBalance(row: InsurancePaymentRow): number {
  const status = String(row.paymentStatus || "").toUpperCase();
  if (status === "PAID") return 0;
  const premium = Number(row.premiumAmount || 0);
  const paid = Number(row.paymentAmount || 0);
  return Math.max(premium - paid, 0);
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function CrmUserDetailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const personName = params.get("name") || "Unknown";
  const personPhone = params.get("phone") || "";
  const userId = params.get("userId") || "";
  const passedInvoiceIds = useMemo(
    () => (params.get("invoiceIds") || "").split(",").filter(Boolean),
    [params],
  );

  const [rows, setRows] = useState<InsurancePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [summaryImage, setSummaryImage] = useState<SummaryImagePreview | null>(null);
  const [linkModal, setLinkModal] = useState<{
    invoiceIds: string[];
    paymentLink: string;
    phoneNumber: string;
    invoiceLabel: string;
    invoiceCount: number;
    totalAmount: number;
  } | null>(null);
  const [sendingLink, setSendingLink] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let data: InsurancePaymentRow[] = [];
      if (userId) {
        const res = await adminApi.getInsurancePayments({ userId, limit: 1000, page: 1 });
        if (!res.success) throw new Error(res.message || "Failed to load invoices");
        data = Array.isArray(res.data) ? res.data : [];
      } else if (passedInvoiceIds.length > 0) {
        const res = await adminApi.getInsurancePayments({ limit: 1000, page: 1 });
        if (!res.success) throw new Error(res.message || "Failed to load invoices");
        const all = Array.isArray(res.data) ? res.data : [];
        data = all.filter((r) => passedInvoiceIds.includes(r.invoiceId));
      } else {
        const res = await adminApi.getInsurancePayments({
          insuredPersonQuery: personName,
          limit: 1000,
          page: 1,
        });
        if (!res.success) throw new Error(res.message || "Failed to load invoices");
        data = Array.isArray(res.data) ? res.data : [];
      }
      const pending = data.filter((r) => getEffectiveBalance(r) > 0);
      setRows(pending);
      setSelectedIds(new Set(pending.map((r) => r.invoiceId)));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load invoices"));
    } finally {
      setLoading(false);
    }
  }, [userId, passedInvoiceIds, personName]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.invoiceId)),
    [rows, selectedIds],
  );

  const selectedTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + getEffectiveBalance(r), 0),
    [selectedRows],
  );

  const totalOutstanding = useMemo(
    () => rows.reduce((s, r) => s + getEffectiveBalance(r), 0),
    [rows],
  );

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.invoiceId));

  function toggleRow(invoiceId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(invoiceId);
      else next.delete(invoiceId);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(rows.map((r) => r.invoiceId)));
    } else {
      setSelectedIds(new Set());
    }
  }

  async function generateSummaryImage() {
    if (selectedRows.length === 0) {
      toast.error("Select at least one invoice");
      return;
    }
    setGeneratingImage(true);
    try {
      const res = await adminApi.generatePaymentSummaryImage(selectedRows.map((r) => r.invoiceId));
      if (!res.success) throw new Error(res.message || "Failed to generate image");
      const data = res.data as any;
      setSummaryImage({
        imageUrl: data.imageUrl,
        invoiceCount: data.invoiceCount,
        totalAmount: data.totalAmount,
        invoiceLabel: data.invoiceLabel,
      });
      toast.success("Summary image generated");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to generate summary image"));
    } finally {
      setGeneratingImage(false);
    }
  }

  async function downloadSummaryImage() {
    if (!summaryImage) return;
    setDownloadingImage(true);
    try {
      const res = await fetch(summaryImage.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "payment-summary-" + personName + ".png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download image");
    } finally {
      setDownloadingImage(false);
    }
  }

  async function generatePaymentLink() {
    if (selectedRows.length === 0) {
      toast.error("Select at least one invoice");
      return;
    }
    setGeneratingLink(true);
    try {
      const res = await adminApi.generateAccumulatedPaymentLink(
        selectedRows.map((r) => r.invoiceId),
      );
      if (!res.success) throw new Error(res.message || "Failed to generate payment link");
      const responsePayload = res as any;
      const paymentLink = responsePayload.paymentLink || res.data?.paymentLink;
      if (!paymentLink) throw new Error("Payment link not returned");
      const first = selectedRows[0];
      setLinkModal({
        invoiceIds: selectedRows.map((r) => r.invoiceId),
        paymentLink,
        phoneNumber: normalizePhone(personPhone || first?.recipientPhone),
        invoiceLabel:
          selectedRows.length === 1
            ? first.invoiceNumber
            : first.invoiceNumber + " + " + (selectedRows.length - 1) + " more",
        invoiceCount: selectedRows.length,
        totalAmount: selectedTotal,
      });
      toast.success("Payment link generated");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to generate payment link"));
    } finally {
      setGeneratingLink(false);
    }
  }

  async function sendPaymentLink() {
    if (!linkModal) return;
    const phone = normalizePhone(linkModal.phoneNumber);
    if (!phone) {
      toast.error("Enter a mobile number");
      return;
    }
    setSendingLink(true);
    try {
      const res = await adminApi.sendAccumulatedPaymentLink(
        linkModal.invoiceIds,
        linkModal.paymentLink,
        phone,
      );
      if (!res.success) throw new Error(res.message || "Failed to send link");
      toast.success("Payment link sent on WhatsApp");
      setLinkModal(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to send payment link"));
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 pb-16">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Standalone Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  router.push("/crm");
                }
              }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              title="Back to CRM"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-gray-900">{personName}</h1>
                {personPhone && (
                  <a
                    href={"tel:" + personPhone}
                    className="text-xs font-mono font-semibold text-[#4309ac] bg-purple-50 px-2 py-0.5 rounded flex items-center gap-1 hover:underline"
                  >
                    <Phone className="w-3 h-3" /> {personPhone}
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-500">Collect payment &amp; dispatch breakdown</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRows}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={"w-3.5 h-3.5 " + (loading ? "animate-spin" : "")} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        {/* Stat Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-4 shadow-sm">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
              Total Pending Dues
            </span>
            <p className="mt-1.5 text-2xl font-black text-red-700">
              {formatCurrency(totalOutstanding)}
            </p>
            <p className="mt-0.5 text-xs text-red-600/80">{rows.length} unpaid invoices</p>
          </div>
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 shadow-sm">
            <span className="text-xs font-bold text-[#4309ac] uppercase tracking-wider">
              Selected Invoices ({selectedRows.length})
            </span>
            <p className="mt-1.5 text-2xl font-black text-[#4309ac]">
              {formatCurrency(selectedTotal)}
            </p>
            <p className="mt-0.5 text-xs text-purple-700/80">
              Amount to collect via link / summary
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Quick Actions
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={generateSummaryImage}
                disabled={generatingImage || selectedRows.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 px-3 py-2 text-xs font-bold text-[#4309ac] transition-all disabled:opacity-50"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {generatingImage ? "Generating..." : "Summary Image"}
              </button>
              <button
                type="button"
                onClick={generatePaymentLink}
                disabled={generatingLink || selectedRows.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#4309ac] hover:bg-[#4309ac]/90 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50"
              >
                <FaWhatsapp className="w-3.5 h-3.5" />
                {generatingLink ? "Generating..." : "Payment Link"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Invoice Multi-Select Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="rounded text-[#4309ac] focus:ring-[#4309ac]"
                />
                Select All ({rows.length})
              </label>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 font-medium">
                {selectedRows.length} selected ({formatCurrency(selectedTotal)})
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#4309ac]" />
              <span>Loading unpaid invoices...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              No pending dues found for this person! All invoices are fully paid.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50/80 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="rounded text-[#4309ac]"
                      />
                    </th>
                    <th className="px-4 py-3.5">Invoice #</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Vehicle</th>
                    <th className="px-4 py-3.5">Commodity</th>
                    <th className="px-4 py-3.5 text-right">Premium</th>
                    <th className="px-4 py-3.5 text-right">Paid</th>
                    <th className="px-4 py-3.5 text-right">Due Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {rows.map((row) => {
                    const isChecked = selectedIds.has(row.invoiceId);
                    const balance = getEffectiveBalance(row);
                    return (
                      <tr
                        key={row.invoiceId}
                        onClick={() => toggleRow(row.invoiceId, !isChecked)}
                        className={"cursor-pointer transition-colors " + (
                          isChecked ? "bg-purple-50/40" : "hover:bg-gray-50/60"
                        )}
                      >
                        <td
                          className="px-4 py-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleRow(row.invoiceId, e.target.checked)}
                            className="rounded text-[#4309ac] focus:ring-[#4309ac]"
                          />
                        </td>
                        <td className="px-4 py-3.5 font-bold font-mono text-gray-900">
                          {row.invoiceNumber}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">
                          {formatDate(row.invoiceDate || row.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-700">
                          {row.vehicleNumber || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 text-xs">
                          {row.productName || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-gray-700">
                          {formatCurrency(Number(row.premiumAmount || 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs text-emerald-600 font-medium">
                          {formatCurrency(Number(row.paymentAmount || 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-red-600">
                          {formatCurrency(balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Image Modal */}
        {summaryImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Payment Breakdown Image</h3>
                <button
                  type="button"
                  onClick={() => setSummaryImage(null)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 max-h-[60vh] flex items-center justify-center p-2">
                <img
                  src={summaryImage.imageUrl}
                  alt="Payment Summary"
                  className="max-h-full object-contain rounded"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {summaryImage.invoiceCount} invoices • {formatCurrency(summaryImage.totalAmount)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadSummaryImage}
                    disabled={downloadingImage}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#4309ac] hover:bg-[#4309ac]/90 text-white px-4 py-2 text-xs font-bold shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingImage ? "Downloading..." : "Download Image"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Send Payment Link Modal */}
        {linkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Send Payment Link via WhatsApp</h3>
                <button
                  type="button"
                  onClick={() => setLinkModal(null)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl bg-purple-50/60 border border-purple-200 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Insured Person:</span>
                  <span className="font-bold text-gray-900">{personName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Selected Invoices:</span>
                  <span className="font-bold text-gray-900">{linkModal.invoiceLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Amount:</span>
                  <span className="font-black text-red-600">
                    {formatCurrency(linkModal.totalAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Recipient Mobile Number (WhatsApp)
                </label>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={linkModal.phoneNumber}
                  onChange={(e) =>
                    setLinkModal((prev) => (prev ? { ...prev, phoneNumber: e.target.value } : null))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-[#4309ac]/30 focus:border-[#4309ac] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLinkModal(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendPaymentLink}
                  disabled={sendingLink || !linkModal.phoneNumber}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  <FaWhatsapp className="w-4 h-4" />
                  {sendingLink ? "Sending..." : "Send on WhatsApp"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function StandaloneCrmUserPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
          Loading...
        </div>
      }
    >
      <CrmUserDetailContent />
    </Suspense>
  );
}
