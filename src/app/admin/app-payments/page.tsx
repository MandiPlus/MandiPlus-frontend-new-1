'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  CreditCard,
  ExternalLink,
  ReceiptText,
  RefreshCw,
  Search,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { adminApi, AppPaymentRow, AppPaymentsSummary } from '@/features/admin/api/admin.api';

const PAGE_SIZE = 20;

function formatCurrency(value?: number | null) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPaidAmount(row: AppPaymentRow) {
  return Number(row.paymentAmount || row.premiumAmount || 0);
}

function getUtr(remarks?: string | null) {
  const match = String(remarks || '').match(/(?:^|\n)\s*UTR:\s*([^\n]+)/i);
  return match?.[1]?.trim() || '';
}

function compactReference(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized) return '-';
  if (normalized.length <= 22) return normalized;
  return `${normalized.slice(0, 10)}...${normalized.slice(-8)}`;
}

function CopyReference({ value }: { value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(normalized);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy reference"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {copied ? <Check size={14} /> : <Clipboard size={14} />}
    </button>
  );
}

export default function AdminAppPaymentsPage() {
  const [rows, setRows] = useState<AppPaymentRow[]>([]);
  const [summary, setSummary] = useState<AppPaymentsSummary>({
    totalRows: 0,
    totalPaid: 0,
    paidToday: 0,
  });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(
    () => ({
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      ...(searchQuery ? { searchQuery } : {}),
    }),
    [fromDate, searchQuery, toDate],
  );

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');

    const [paymentsResponse, summaryResponse] = await Promise.all([
      adminApi.getAppPayments({
        ...filters,
        page,
        limit: PAGE_SIZE,
      }),
      adminApi.getAppPaymentsSummary(filters),
    ]);

    if (!paymentsResponse.success) {
      setRows([]);
      setError(paymentsResponse.message || 'App payments could not be loaded.');
    } else {
      setRows(paymentsResponse.data || []);
      setTotalPages(Math.max(1, Number(paymentsResponse.totalPages || 1)));
    }

    if (summaryResponse.success) {
      setSummary({
        totalRows: Number(summaryResponse.totalRows || 0),
        totalPaid: Number(summaryResponse.totalPaid || 0),
        paidToday: Number(summaryResponse.paidToday || 0),
      });
    }

    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPayments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPayments, refreshKey]);

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasFilters = Boolean(searchInput || fromDate || toDate);

  return (
    <div className="min-h-full bg-[#f7f8fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">App Payments</h1>
            <p className="mt-1 text-sm text-slate-500">Successful payments completed in the customer app.</p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Received today</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <CreditCard size={17} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{loading ? '...' : formatCurrency(summary.paidToday)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Total received</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <Smartphone size={17} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{loading ? '...' : formatCurrency(summary.totalPaid)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Invoices paid</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-50 text-violet-700">
                <ReceiptText size={17} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{loading ? '...' : summary.totalRows.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Search</span>
              <span className="relative block">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Customer, phone, invoice or reference"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">From</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </label>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-10 rounded-md px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                Clear
              </button>
            )}
          </div>

          {error ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
              <p className="text-sm font-medium text-slate-800">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                className="mt-3 text-sm font-semibold text-blue-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1050px] table-fixed">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                      <th className="w-[150px] px-4 py-3">Paid at</th>
                      <th className="w-[210px] px-4 py-3">Customer</th>
                      <th className="w-[230px] px-4 py-3">Invoice</th>
                      <th className="w-[130px] px-4 py-3 text-right">Amount</th>
                      <th className="w-[210px] px-4 py-3">PhonePe reference</th>
                      <th className="w-[190px] px-4 py-3">Order ID</th>
                      <th className="w-[72px] px-4 py-3 text-center">Bill</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading
                      ? Array.from({ length: 6 }).map((_, index) => (
                          <tr key={index}>
                            {Array.from({ length: 7 }).map((__, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-4">
                                <div className="h-4 animate-pulse rounded bg-slate-100" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : rows.map((row) => {
                          const utr = getUtr(row.remarks);
                          const phonePeReference = row.paymentGatewayPaymentId || utr || '';
                          return (
                            <tr key={row.invoiceId} className="text-sm text-slate-700 hover:bg-slate-50/70">
                              <td className="px-4 py-3.5 text-xs leading-5 text-slate-600">{formatDateTime(row.paymentCompletedAt)}</td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-start gap-2.5">
                                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                                    <UserRound size={15} />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-slate-900">
                                      {row.payerName || row.insuredPerson || 'Customer'}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">{row.payerPhone || row.recipientPhone || '-'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="truncate font-medium text-slate-900">{row.invoiceNumber || '-'}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {[row.vehicleNumber, row.productName].filter(Boolean).join(' · ') || '-'}
                                </p>
                              </td>
                              <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-950">
                                {formatCurrency(getPaidAmount(row))}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1">
                                  <span className="truncate font-mono text-xs text-slate-600" title={phonePeReference}>
                                    {compactReference(phonePeReference)}
                                  </span>
                                  <CopyReference value={phonePeReference} />
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1">
                                  <span className="truncate font-mono text-xs text-slate-600" title={row.paymentGatewayOrderId || ''}>
                                    {compactReference(row.paymentGatewayOrderId)}
                                  </span>
                                  <CopyReference value={row.paymentGatewayOrderId} />
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                {row.paymentReceiptUrl || row.pdfUrl ? (
                                  <button
                                    type="button"
                                    title="Open bill"
                                    onClick={() => window.open(row.paymentReceiptUrl || row.pdfUrl || '', '_blank', 'noopener,noreferrer')}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                                  >
                                    <ExternalLink size={15} />
                                  </button>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="space-y-3 p-4">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        <div className="h-8 animate-pulse rounded bg-slate-100" />
                      </div>
                    ))
                  : rows.map((row) => {
                      const reference = row.paymentGatewayPaymentId || getUtr(row.remarks);
                      return (
                        <div key={row.invoiceId} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-950">{row.payerName || row.insuredPerson || 'Customer'}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {row.invoiceNumber || '-'} · {formatDateTime(row.paymentCompletedAt)}
                              </p>
                            </div>
                            <p className="shrink-0 font-semibold tabular-nums text-slate-950">{formatCurrency(getPaidAmount(row))}</p>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                            <span className="truncate font-mono text-xs text-slate-600">
                              {compactReference(reference || row.paymentGatewayOrderId)}
                            </span>
                            <CopyReference value={reference || row.paymentGatewayOrderId} />
                          </div>
                        </div>
                      );
                    })}
              </div>

              {!loading && rows.length === 0 && (
                <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <CreditCard size={20} />
                  </span>
                  <p className="mt-3 text-sm font-medium text-slate-800">No app payments found</p>
                  <p className="mt-1 text-xs text-slate-500">Successful app payments will appear here.</p>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    title="Previous page"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    title="Next page"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
