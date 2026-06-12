'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';

const ITEMS_PER_PAGE = 25;

type WhatsAppStatus = 'NOT_SENT' | 'SENT' | 'ALL';
type PaymentStatusFilter = 'ALL' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'NOT_REQUIRED';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function formatPhone(phone?: string | null) {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

function getPaymentBadge(status?: string | null) {
  const s = String(status || 'NOT_REQUIRED').toUpperCase();
  const map: Record<string, { label: string; classes: string }> = {
    PAID: { label: 'Paid', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    PENDING: { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    FAILED: { label: 'Failed', classes: 'bg-red-50 text-red-700 border-red-200' },
    REFUNDED: { label: 'Refunded', classes: 'bg-slate-50 text-slate-600 border-slate-200' },
    NOT_REQUIRED: { label: 'N/A', classes: 'bg-gray-50 text-gray-500 border-gray-200' },
  };
  const badge = map[s] || map['NOT_REQUIRED'];
  return badge;
}

function getWhatsAppBadge(sent: boolean) {
  if (sent) return { label: 'Sent', classes: 'bg-green-50 text-green-700 border-green-200' };
  return { label: 'Not Sent', classes: 'bg-gray-50 text-gray-500 border-gray-200' };
}

export default function InvoiceTrackingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatusFilter>('ALL');
  const [whatsappFilter, setWhatsappFilter] = useState<WhatsAppStatus>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.filterInvoices({
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        isVerified: true,
      });
      if (!response.success) {
        throw new Error(response.message || 'Failed to load invoices');
      }
      setInvoices(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, paymentFilter]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    fetchInvoices();
  }, [isAuthenticated, router, fetchInvoices]);

  // Client-side filtering for search and WhatsApp status
  const filteredInvoices = useMemo(() => {
    let result = invoices;

    if (whatsappFilter === 'SENT') {
      result = result.filter((inv) => inv.whatsappSent === true);
    } else if (whatsappFilter === 'NOT_SENT') {
      result = result.filter((inv) => !inv.whatsappSent);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (inv) =>
          (inv.invoiceNumber || '').toLowerCase().includes(q) ||
          (inv.vehicleNumber || '').toLowerCase().includes(q) ||
          (inv.insuredPartyPhone || '').includes(q) ||
          (inv.supplierName || '').toLowerCase().includes(q) ||
          (inv.billToName || '').toLowerCase().includes(q),
      );
    }

    return result;
  }, [invoices, whatsappFilter, searchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredInvoices.length;
    const sent = filteredInvoices.filter((i) => i.whatsappSent).length;
    const notSent = total - sent;
    const paid = filteredInvoices.filter((i) => i.paymentStatus === 'PAID').length;
    const pending = filteredInvoices.filter((i) => i.paymentStatus === 'PENDING').length;
    return { total, sent, notSent, paid, pending };
  }, [filteredInvoices]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE));
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <div className="py-6">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Invoice Tracking</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track WhatsApp delivery and payment status for all verified invoices
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase">Total</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-xs font-medium text-green-600 uppercase">WA Sent</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{stats.sent}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase">Not Sent</p>
            <p className="mt-1 text-2xl font-bold text-gray-700">{stats.notSent}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-medium text-emerald-600 uppercase">Paid</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.paid}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-medium text-amber-600 uppercase">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{stats.pending}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <input
                type="text"
                placeholder="Invoice #, vehicle, phone, name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
              <select
                value={whatsappFilter}
                onChange={(e) => {
                  setWhatsappFilter(e.target.value as WhatsAppStatus);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="ALL">All</option>
                <option value="SENT">Sent</option>
                <option value="NOT_SENT">Not Sent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment</label>
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value as PaymentStatusFilter);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
                <option value="NOT_REQUIRED">Not Required</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setPaymentFilter('ALL');
                setWhatsappFilter('ALL');
                setDateFrom('');
                setDateTo('');
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Invoice #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Buyer</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Sent To</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">WhatsApp</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Sent At</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Resends</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Payment</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"></div>
                        <span>Loading invoices...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                      No invoices found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((inv) => {
                    const waBadge = getWhatsAppBadge(inv.whatsappSent);
                    const payBadge = getPaymentBadge(inv.paymentStatus);
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-violet-700">
                          {inv.invoiceNumber || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatDateShort(inv.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-900 max-w-[140px] truncate">
                          {inv.supplierName || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-900 max-w-[140px] truncate">
                          {inv.billToName || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
                          {formatPhone(inv.insuredPartyPhone)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${waBadge.classes}`}
                          >
                            {waBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {formatDate(inv.whatsappSentAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {inv.paymentLinkSentCount != null && inv.paymentLinkSentCount > 0 ? (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                              {inv.paymentLinkSentCount}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${payBadge.classes}`}
                          >
                            {payBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {formatDate(inv.paymentCompletedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredInvoices.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-600">
                Showing{' '}
                <span className="font-medium">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)}
                </span>{' '}
                of <span className="font-medium">{filteredInvoices.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
