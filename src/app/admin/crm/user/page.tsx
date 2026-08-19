'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import {
  CheckCheck,
  Image as ImageIcon,
  Link2,
  X,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { adminApi, InsurancePaymentRow } from '@/features/admin/api/admin.api';

type SummaryImagePreview = {
  imageUrl: string;
  invoiceCount: number;
  totalAmount: number;
  invoiceLabel: string;
};

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString('en-IN');
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-IN');
}

function normalizePhone(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function getEffectiveBalance(row: InsurancePaymentRow): number {
  const status = String(row.paymentStatus || '').toUpperCase();
  if (status === 'PAID') return 0;
  const premium = Number(row.premiumAmount || 0);
  const paid = Number(row.paymentAmount || 0);
  return Math.max(premium - paid, 0);
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function CrmUserDetailContent() {
  const params = useSearchParams();
  const personName = params.get('name') || 'Unknown';
  const personPhone = params.get('phone') || '';
  const userId = params.get('userId') || '';
  const passedInvoiceIds = useMemo(
    () => (params.get('invoiceIds') || '').split(',').filter(Boolean),
    [params],
  );
  const passedTotalPending = Number(params.get('totalPending') || 0);

  const [rows, setRows] = useState<InsurancePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    setError('');
    try {
      let data: InsurancePaymentRow[] = [];
      if (userId) {
        const res = await adminApi.getInsurancePayments({ userId, limit: 200, page: 1 });
        if (!res.success) throw new Error(res.message || 'Failed to load');
        data = Array.isArray(res.data) ? res.data : [];
      } else if (passedInvoiceIds.length > 0) {
        const res = await adminApi.getInsurancePayments({ limit: 200, page: 1 });
        if (!res.success) throw new Error(res.message || 'Failed to load');
        const all = Array.isArray(res.data) ? res.data : [];
        data = all.filter(r => passedInvoiceIds.includes(r.invoiceId));
      }
      const pending = data.filter(r => getEffectiveBalance(r) > 0);
      setRows(pending);
      setSelectedIds(new Set(pending.map(r => r.invoiceId)));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load invoices'));
    } finally {
      setLoading(false);
    }
  }, [userId, passedInvoiceIds]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const selectedRows = useMemo(
    () => rows.filter(r => selectedIds.has(r.invoiceId)),
    [rows, selectedIds],
  );

  const selectedTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + getEffectiveBalance(r), 0),
    [selectedRows],
  );

  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.invoiceId));

  function toggleRow(invoiceId: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(invoiceId); else next.delete(invoiceId);
      return next;
    });
  }

  async function generateSummaryImage() {
    if (selectedRows.length === 0) { toast.error('Select at least one invoice'); return; }
    setGeneratingImage(true);
    try {
      const res = await adminApi.generatePaymentSummaryImage(selectedRows.map(r => r.invoiceId));
      if (!res.success) throw new Error(res.message || 'Failed to generate image');
      const data = res.data as any;
      setSummaryImage({
        imageUrl: data.imageUrl,
        invoiceCount: data.invoiceCount,
        totalAmount: data.totalAmount,
        invoiceLabel: data.invoiceLabel,
      });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to generate summary image'));
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
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-summary-${personName}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download image');
    } finally {
      setDownloadingImage(false);
    }
  }

  async function generatePaymentLink() {
    if (selectedRows.length === 0) { toast.error('Select at least one invoice'); return; }
    setGeneratingLink(true);
    try {
      const res = await adminApi.generateAccumulatedPaymentLink(selectedRows.map(r => r.invoiceId));
      if (!res.success) throw new Error(res.message || 'Failed to generate payment link');
      const responsePayload = res as any;
      const paymentLink = responsePayload.paymentLink || res.data?.paymentLink;
      if (!paymentLink) throw new Error('Payment link not returned');
      const first = selectedRows[0];
      setLinkModal({
        invoiceIds: selectedRows.map(r => r.invoiceId),
        paymentLink,
        phoneNumber: normalizePhone(personPhone || first?.recipientPhone),
        invoiceLabel: selectedRows.length === 1
          ? first.invoiceNumber
          : `${first.invoiceNumber} + ${selectedRows.length - 1} more`,
        invoiceCount: selectedRows.length,
        totalAmount: selectedTotal,
      });
      toast.success('Payment link generated');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to generate payment link'));
    } finally {
      setGeneratingLink(false);
    }
  }

  async function sendPaymentLink() {
    if (!linkModal) return;
    const phone = normalizePhone(linkModal.phoneNumber);
    if (!phone) { toast.error('Enter a mobile number'); return; }
    setSendingLink(true);
    try {
      const res = await adminApi.sendAccumulatedPaymentLink(
        linkModal.invoiceIds,
        linkModal.paymentLink,
        phone,
      );
      if (!res.success) throw new Error(res.message || 'Failed to send link');
      toast.success('Payment link sent on WhatsApp');
      setLinkModal(null);
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to send payment link'));
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{personName}</h1>
              {personPhone && (
                <a href={`tel:${personPhone}`} className="mt-1 text-sm text-[#4309ac] hover:underline font-mono">{personPhone}</a>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Pending</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(passedTotalPending || selectedTotal)}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading invoices...</div>
        )}

        {!loading && (
          <>
            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedRows.length} selected &middot; {formatCurrency(selectedTotal)}
              </span>
              <button type="button" onClick={generateSummaryImage} disabled={generatingImage || selectedRows.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                <ImageIcon className="h-4 w-4" />
                {generatingImage ? 'Generating...' : 'Summary Image'}
              </button>
              <button type="button" onClick={generatePaymentLink} disabled={generatingLink || selectedRows.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50">
                <Link2 className="h-4 w-4" />
                {generatingLink ? 'Generating...' : 'Payment Link'}
              </button>
            </div>

            {/* Summary image preview */}
            {summaryImage && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-violet-800">{summaryImage.invoiceLabel}</p>
                    <p className="text-xs text-violet-600">{summaryImage.invoiceCount} invoice(s) &middot; {formatCurrency(summaryImage.totalAmount)}</p>
                  </div>
                  <button type="button" onClick={() => setSummaryImage(null)} className="text-violet-400 hover:text-violet-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <img src={summaryImage.imageUrl} alt="Payment summary" className="w-full rounded-lg border border-violet-200" />
                <button type="button" onClick={downloadSummaryImage} disabled={downloadingImage}
                  className="rounded-md border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50">
                  {downloadingImage ? 'Downloading...' : 'Download Image'}
                </button>
              </div>
            )}

            {/* Invoice table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">{rows.length} pending invoices</span>
              </div>
              {rows.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">No pending invoices found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 w-10">
                          <input type="checkbox" checked={allSelected}
                            onChange={e => setSelectedIds(e.target.checked ? new Set(rows.map(r => r.invoiceId)) : new Set())} />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Commodity</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Premium</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map(row => {
                        const balance = getEffectiveBalance(row);
                        const checked = selectedIds.has(row.invoiceId);
                        return (
                          <tr key={row.invoiceId} className={`transition-colors ${checked ? 'bg-sky-50/40' : 'hover:bg-gray-50/60'}`}
                            onClick={() => toggleRow(row.invoiceId, !checked)}>
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={checked} onChange={e => toggleRow(row.invoiceId, e.target.checked)}
                                onClick={e => e.stopPropagation()} />
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.invoiceNumber}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{formatDate(row.invoiceDate)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{row.productName || '—'}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(Number(row.premiumAmount || 0))}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{formatCurrency(balance)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-600">
                          {selectedRows.length} selected
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                          {formatCurrency(selectedRows.reduce((s, r) => s + Number(r.premiumAmount || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-700">
                          {formatCurrency(selectedTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Payment Link Modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Send Payment Link</h2>
                <p className="mt-0.5 text-sm text-gray-500">{linkModal.invoiceLabel} &middot; {formatCurrency(linkModal.totalAmount)}</p>
              </div>
              <button type="button" onClick={() => setLinkModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">Payment Link</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-700 font-mono truncate flex-1">{linkModal.paymentLink}</p>
                <button type="button" onClick={() => { navigator.clipboard.writeText(linkModal.paymentLink); toast.success('Copied!'); }}
                  className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <input type="tel"
                value={linkModal.phoneNumber}
                onChange={e => setLinkModal(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)}
                placeholder="10-digit mobile number"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <button type="button" onClick={sendPaymentLink} disabled={sendingLink}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              <FaWhatsapp className="h-4 w-4" />
              {sendingLink ? 'Sending...' : 'Send on WhatsApp'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CrmUserDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-sm text-gray-400">Loading...</div>}>
      <CrmUserDetailContent />
    </Suspense>
  );
}
