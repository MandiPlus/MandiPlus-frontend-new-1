'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  CreditCard,
  IndianRupee,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  adminApi,
  AdminTrackingPurchase,
  AdminTrackingPurchaseSummary,
  TrackingPurchaseStatus,
} from '@/features/admin/api/admin.api';

const PAGE_SIZE = 20;

const EMPTY_SUMMARY: AdminTrackingPurchaseSummary = {
  totalAttempts: 0,
  paidPurchases: 0,
  activeCustomers: 0,
  totalRevenue: 0,
  paidToday: 0,
  pendingPurchases: 0,
  failedPurchases: 0,
  expiredPurchases: 0,
};

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function compactReference(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized) return '—';
  if (normalized.length <= 25) return normalized;
  return `${normalized.slice(0, 11)}…${normalized.slice(-9)}`;
}

function CopyReference({ value, label }: { value?: string | null; label: string }) {
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
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {copied ? <Check size={14} /> : <Clipboard size={14} />}
    </button>
  );
}

const STATUS_STYLES: Record<TrackingPurchaseStatus, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  EXPIRED: 'border-slate-200 bg-slate-100 text-slate-600',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
};

function StatusPill({ status }: { status: TrackingPurchaseStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function ReferenceLine({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="min-w-0 truncate font-mono text-xs text-slate-600" title={value || ''}>
        {compactReference(value)}
      </span>
      <CopyReference value={value} label={label} />
    </div>
  );
}

export default function TrackingPurchasesPage() {
  const [rows, setRows] = useState<AdminTrackingPurchase[]>([]);
  const [summary, setSummary] = useState<AdminTrackingPurchaseSummary>(EMPTY_SUMMARY);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TrackingPurchaseStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    }),
    [fromDate, search, status, toDate],
  );

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setError('');
    const [purchasesResponse, summaryResponse] = await Promise.all([
      adminApi.getTrackingPurchases({ ...filters, page, limit: PAGE_SIZE }),
      adminApi.getTrackingPurchasesSummary(filters),
    ]);

    if (!purchasesResponse.success) {
      setRows([]);
      setTotal(0);
      setError(purchasesResponse.message || 'Tracking purchases could not be loaded.');
    } else {
      setRows(purchasesResponse.data || []);
      setTotal(Number(purchasesResponse.total || 0));
      setTotalPages(Math.max(1, Number(purchasesResponse.totalPages || 1)));
    }

    if (summaryResponse.success && summaryResponse.data) {
      setSummary(summaryResponse.data);
    }
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPurchases();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPurchases, refreshKey]);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasFilters = Boolean(searchInput || status || fromDate || toDate);

  return (
    <div className="min-h-full bg-[#f7f8fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1560px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <MapPin size={16} />
              </span>
              <h1 className="text-2xl font-semibold text-slate-950">Tracking Purchases</h1>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">FastTag pack payments and 30-day access.</p>
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

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total collected"
            value={formatCurrency(summary.totalRevenue)}
            loading={loading}
            icon={<IndianRupee size={17} />}
            iconClass="bg-emerald-50 text-emerald-700"
          />
          <SummaryCard
            label="Active customers"
            value={summary.activeCustomers.toLocaleString('en-IN')}
            loading={loading}
            icon={<ShieldCheck size={17} />}
            iconClass="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            label="Received today"
            value={formatCurrency(summary.paidToday)}
            loading={loading}
            icon={<CreditCard size={17} />}
            iconClass="bg-violet-50 text-violet-700"
          />
          <SummaryCard
            label="Paid purchases"
            value={summary.paidPurchases.toLocaleString('en-IN')}
            loading={loading}
            icon={<Activity size={17} />}
            iconClass="bg-amber-50 text-amber-700"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <span><strong className="font-semibold text-slate-800">{summary.totalAttempts}</strong> total attempts</span>
          <span><strong className="font-semibold text-amber-700">{summary.pendingPurchases}</strong> pending</span>
          <span><strong className="font-semibold text-rose-700">{summary.failedPurchases}</strong> failed</span>
          <span><strong className="font-semibold text-slate-700">{summary.expiredPurchases}</strong> expired</span>
        </div>

        <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Search</span>
              <span className="relative block">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Customer, mobile, UTR or order ID"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </span>
            </label>
            <label className="xl:w-40">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as TrackingPurchaseStatus | '');
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="EXPIRED">Expired</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1420px] table-fixed">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="w-[230px] px-4 py-3">Customer</th>
                      <th className="w-[205px] px-4 py-3">Pack & access</th>
                      <th className="w-[110px] px-4 py-3">Status</th>
                      <th className="w-[125px] px-4 py-3 text-right">Amount</th>
                      <th className="w-[235px] px-4 py-3">Payment timing</th>
                      <th className="w-[260px] px-4 py-3">PhonePe</th>
                      <th className="w-[255px] px-4 py-3">Checkout</th>
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
                      : rows.map((row) => <PurchaseTableRow key={row.id} row={row} />)}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="space-y-3 p-4">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        <div className="h-20 animate-pulse rounded bg-slate-100" />
                      </div>
                    ))
                  : rows.map((row) => <PurchaseMobileCard key={row.id} row={row} />)}
              </div>

              {!loading && rows.length === 0 && (
                <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <MapPin size={20} />
                  </span>
                  <p className="mt-3 text-sm font-medium text-slate-800">No tracking purchases found</p>
                  <p className="mt-1 text-xs text-slate-500">New checkout attempts will appear here.</p>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-500">
                  {total.toLocaleString('en-IN')} records · Page {page} of {totalPages}
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

function SummaryCard({
  label,
  value,
  loading,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  loading: boolean;
  icon: ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${iconClass}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">{loading ? '…' : value}</p>
    </div>
  );
}

function PurchaseTableRow({ row }: { row: AdminTrackingPurchase }) {
  return (
    <tr className="align-top text-sm text-slate-700 hover:bg-slate-50/70">
      <td className="px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <UserRound size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-950" title={row.customerName}>{row.customerName}</p>
            <p className="mt-0.5 text-xs text-slate-500">{row.mobileNumber || 'No mobile'}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {[row.secondaryMobileNumber, row.identity, row.state].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <p className="truncate font-medium text-slate-900" title={row.packLabel}>{row.packLabel}</p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{row.packCode}</p>
        <p className="mt-1 text-xs text-slate-500">
          {row.status === 'ACTIVE' ? `${row.daysRemaining} days remaining` : row.status === 'EXPIRED' ? 'Access ended' : 'Access not active'}
        </p>
      </td>
      <td className="px-4 py-3.5"><StatusPill status={row.status} /></td>
      <td className="px-4 py-3.5 text-right">
        <p className="font-semibold tabular-nums text-slate-950">{formatCurrency(row.amountPaid)}</p>
        {row.listPriceAmount > row.amountPaid && (
          <p className="mt-0.5 text-xs tabular-nums text-slate-400 line-through">{formatCurrency(row.listPriceAmount)}</p>
        )}
      </td>
      <td className="px-4 py-3.5 text-xs leading-5">
        <p><span className="text-slate-400">Paid</span> <span className="text-slate-700">{formatDateTime(row.paidAt)}</span></p>
        <p><span className="text-slate-400">Expires</span> <span className="text-slate-700">{formatDateTime(row.expiresAt)}</span></p>
        <p><span className="text-slate-400">Started</span> <span className="text-slate-700">{formatDateTime(row.createdAt)}</span></p>
      </td>
      <td className="space-y-1 px-4 py-3">
        <ReferenceLine label="UTR" value={row.phonepeUtr} />
        <ReferenceLine label="Order" value={row.phonepeOrderId} />
      </td>
      <td className="space-y-1 px-4 py-3">
        <ReferenceLine label="Merchant" value={row.merchantOrderId} />
        <ReferenceLine label="Record" value={row.id} />
        <p className="pl-[60px] text-[10px] text-slate-400">Updated {formatDateTime(row.updatedAt)}</p>
      </td>
    </tr>
  );
}

function PurchaseMobileCard({ row }: { row: AdminTrackingPurchase }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-950">{row.customerName}</p>
          <p className="mt-1 text-xs text-slate-500">{row.mobileNumber || 'No mobile'} · {row.packLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums text-slate-950">{formatCurrency(row.amountPaid)}</p>
          <div className="mt-1"><StatusPill status={row.status} /></div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-slate-50 px-3 py-2.5 text-xs">
        <div>
          <p className="text-slate-400">Paid</p>
          <p className="mt-0.5 text-slate-700">{formatDateTime(row.paidAt)}</p>
        </div>
        <div>
          <p className="text-slate-400">Access expires</p>
          <p className="mt-0.5 text-slate-700">{formatDateTime(row.expiresAt)}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <ReferenceLine label="UTR" value={row.phonepeUtr} />
        <ReferenceLine label="PhonePe" value={row.phonepeOrderId} />
        <ReferenceLine label="Merchant" value={row.merchantOrderId} />
        <ReferenceLine label="Record" value={row.id} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span>{row.packCode}</span>
        <span>{row.daysRemaining > 0 ? `${row.daysRemaining} days left` : 'No active days'}</span>
        <span>Started {formatDateTime(row.createdAt)}</span>
        <span>Updated {formatDateTime(row.updatedAt)}</span>
      </div>
    </article>
  );
}
