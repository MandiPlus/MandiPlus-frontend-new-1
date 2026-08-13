'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  Activity,
  BarChart3,
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  CreditCard,
  IndianRupee,
  MapPin,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import {
  adminApi,
  AdminTrackingPurchase,
  AdminTrackingPurchaseSummary,
  AdminTrackingPlanCustomer,
  AdminTrackingUsageRow,
  AdminTrackingUsageSummary,
  GrantTrackingPlanPayload,
  TrackingPaymentMethod,
  TrackingPurchaseStatus,
} from '@/features/admin/api/admin.api';

const PAGE_SIZE = 20;
const EMPTY_USAGE_SUMMARY: AdminTrackingUsageSummary = {
  interestedCustomers: 0,
  totalScreenOpens: 0,
  trackingViewsUsed: 0,
  exhaustedCustomers: 0,
  activePackCustomers: 0,
  usageDate: '',
  dailyLimit: 3,
};

const EMPTY_SUMMARY: AdminTrackingPurchaseSummary = {
  totalAttempts: 0,
  paidPurchases: 0,
  activeCustomers: 0,
  totalRevenue: 0,
  paidToday: 0,
  pendingPurchases: 0,
  failedPurchases: 0,
  expiredPurchases: 0,
  manualPurchases: 0,
};

const MANUAL_PAYMENT_METHODS: Array<{
  value: GrantTrackingPlanPayload['paymentMethod'];
  label: string;
}> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
];

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

function formatPaymentMethod(value: TrackingPaymentMethod) {
  if (value === 'PHONEPE') return 'PhonePe';
  if (value === 'BANK_TRANSFER') return 'Bank transfer';
  return value.charAt(0) + value.slice(1).toLowerCase();
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

function ReferenceLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
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
  const [grantOpen, setGrantOpen] = useState(false);
  const [usageRows, setUsageRows] = useState<AdminTrackingUsageRow[]>([]);
  const [usageSummary, setUsageSummary] = useState(EMPTY_USAGE_SUMMARY);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState('');
  const [usageSearchInput, setUsageSearchInput] = useState('');
  const [usageSearch, setUsageSearch] = useState('');
  const [usageDate, setUsageDate] = useState('');

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUsageSearch(usageSearchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [usageSearchInput]);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError('');
    const response = await adminApi.getTrackingUsage({
      ...(usageSearch ? { search: usageSearch } : {}),
      ...(usageDate ? { date: usageDate } : {}),
      page: 1,
      limit: 100,
    });
    if (!response.success) {
      setUsageRows([]);
      setUsageError(response.message || 'Tracking interest could not be loaded.');
    } else {
      setUsageRows(response.data || []);
      setUsageSummary(response.summary || EMPTY_USAGE_SUMMARY);
    }
    setUsageLoading(false);
  }, [usageDate, usageSearch]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage, refreshKey]);

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
              <h1 className="text-2xl font-semibold text-slate-950">Tracking Packs</h1>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">Paid FastTag plans and 30-day access.</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setGrantOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus size={17} />
              Grant plan
            </button>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
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
          <span>
            <strong className="font-semibold text-slate-800">{summary.paidPurchases}</strong> paid plans
          </span>
          <span>
            <strong className="font-semibold text-emerald-700">{summary.manualPurchases}</strong> granted by admin
          </span>
          <span>
            <strong className="font-semibold text-slate-700">{summary.expiredPurchases}</strong> expired
          </span>
          <span className="text-slate-400">Pending and failed checkouts are hidden.</span>
        </div>

        <TrackingInterestPanel
          rows={usageRows}
          summary={usageSummary}
          loading={usageLoading}
          error={usageError}
          search={usageSearchInput}
          date={usageDate}
          onSearch={setUsageSearchInput}
          onDate={setUsageDate}
          onRetry={() => void loadUsage()}
        />

        <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Search</span>
              <span className="relative block">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
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
                <option value="EXPIRED">Expired</option>
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
                      <th className="w-[260px] px-4 py-3">Payment</th>
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
                  <p className="mt-3 text-sm font-medium text-slate-800">No paid tracking plans found</p>
                  <p className="mt-1 text-xs text-slate-500">Confirmed payments and admin grants will appear here.</p>
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
      <GrantPlanDialog
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        onGranted={() => {
          setPage(1);
          setRefreshKey((value) => value + 1);
        }}
      />
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

function TrackingInterestPanel({
  rows,
  summary,
  loading,
  error,
  search,
  date,
  onSearch,
  onDate,
  onRetry,
}: {
  rows: AdminTrackingUsageRow[];
  summary: AdminTrackingUsageSummary;
  loading: boolean;
  error: string;
  search: string;
  date: string;
  onSearch: (value: string) => void;
  onDate: (value: string) => void;
  onRetry: () => void;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-sky-100 bg-white shadow-[0_14px_40px_-30px_rgba(2,132,199,0.55)]">
      <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 via-white to-emerald-50/60 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white">
                <MousePointerClick size={17} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-950">Tracking interest & daily limit</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Customer visits to Vehicle Tracking—not payment attempts.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(230px,1fr)_160px]">
            <label className="relative block">
              <span className="sr-only">Search tracking customers</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Name, mobile or vehicle"
                className="h-10 w-full rounded-md border border-sky-100 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label>
              <span className="sr-only">Usage date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => onDate(event.target.value)}
                className="h-10 w-full rounded-md border border-sky-100 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <UsageMetric label="Customers" value={summary.interestedCustomers} />
          <UsageMetric label="Visits" value={summary.totalScreenOpens} />
          <UsageMetric label="Free views used" value={summary.trackingViewsUsed} />
          <UsageMetric label="Out of 3" value={summary.exhaustedCustomers} tone="danger" />
          <UsageMetric label="Pack active" value={summary.activePackCustomers} tone="success" />
        </div>
      </div>

      {error ? (
        <div className="flex min-h-36 flex-col items-center justify-center p-5 text-center">
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <button type="button" onClick={onRetry} className="mt-2 text-sm font-semibold text-sky-700">
            Try again
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Interest</th>
                <th className="px-4 py-3">Daily free limit</th>
                <th className="px-4 py-3">Last tracked</th>
                <th className="px-4 py-3">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 5 }).map((__, cell) => (
                        <td key={cell} className="px-4 py-4">
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((row) => (
                    <TrackingUsageRow key={row.userId} row={row} dailyLimit={summary.dailyLimit || 3} />
                  ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center px-4 text-center">
              <BarChart3 size={21} className="text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">No tracking visits for this date</p>
              <p className="mt-1 text-xs text-slate-500">New visits will appear here automatically.</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function UsageMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'danger' | 'success';
}) {
  const toneClass = tone === 'danger' ? 'text-rose-700' : tone === 'success' ? 'text-emerald-700' : 'text-slate-950';
  return (
    <div className="rounded-lg border border-white/80 bg-white/85 px-3 py-2.5 shadow-sm">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${toneClass}`}>{loadingNumber(value)}</p>
    </div>
  );
}

function loadingNumber(value: number) {
  return Number(value || 0).toLocaleString('en-IN');
}

function TrackingUsageRow({ row, dailyLimit }: { row: AdminTrackingUsageRow; dailyLimit: number }) {
  const exhausted = !row.packActive && row.viewsRemaining <= 0;
  const used = Math.min(dailyLimit, Math.max(0, row.viewsUsed));
  return (
    <tr className="text-sm text-slate-700 hover:bg-sky-50/30">
      <td className="px-4 py-3.5">
        <p className="font-semibold text-slate-950">{row.customerName}</p>
        <p className="mt-0.5 text-xs text-slate-500">{row.mobileNumber || 'No mobile'}</p>
      </td>
      <td className="px-4 py-3.5">
        <p className="font-medium text-slate-800">
          {row.visitCount} {row.visitCount === 1 ? 'visit' : 'visits'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">Last {formatDateTime(row.lastVisitedAt)}</p>
      </td>
      <td className="px-4 py-3.5">
        {row.packActive ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Unlimited with pack
          </span>
        ) : (
          <div className="min-w-[180px]">
            <div className="flex items-center justify-between text-xs">
              <span className={exhausted ? 'font-semibold text-rose-700' : 'font-medium text-slate-700'}>
                {row.viewsRemaining} of {dailyLimit} left
              </span>
              <span className="text-slate-400">{used} used</span>
            </div>
            <div className="mt-2 flex gap-1.5" aria-label={`${row.viewsRemaining} of ${dailyLimit} free views left`}>
              {Array.from({ length: dailyLimit }).map((_, index) => (
                <span
                  key={index}
                  className={`h-2 flex-1 rounded-full ${index < used ? (exhausted ? 'bg-rose-500' : 'bg-sky-500') : 'bg-slate-200'}`}
                />
              ))}
            </div>
          </div>
        )}
      </td>
      <td className="px-4 py-3.5">
        <p className="font-mono text-xs text-slate-700">{row.lastVehicleNumber || '—'}</p>
        <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(row.lastTrackedAt)}</p>
      </td>
      <td className="px-4 py-3.5">
        {row.packActive ? (
          <div>
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Pack active
            </span>
            <p className="mt-1 text-[11px] text-slate-400">Until {formatDateTime(row.packExpiresAt)}</p>
          </div>
        ) : exhausted ? (
          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
            Needs plan
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            Free access
          </span>
        )}
      </td>
    </tr>
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
            <p className="truncate font-medium text-slate-950" title={row.customerName}>
              {row.customerName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{row.mobileNumber || 'No mobile'}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {[row.secondaryMobileNumber, row.identity, row.state].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <p className="truncate font-medium text-slate-900" title={row.packLabel}>
          {row.packLabel}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{row.packCode}</p>
        <p className="mt-1 text-xs text-slate-500">
          {row.status === 'ACTIVE'
            ? `${row.daysRemaining} days remaining`
            : row.status === 'EXPIRED'
              ? 'Access ended'
              : 'Access not active'}
        </p>
      </td>
      <td className="px-4 py-3.5">
        <StatusPill status={row.status} />
      </td>
      <td className="px-4 py-3.5 text-right">
        <p className="font-semibold tabular-nums text-slate-950">{formatCurrency(row.amountPaid)}</p>
        {row.listPriceAmount > row.amountPaid && (
          <p className="mt-0.5 text-xs tabular-nums text-slate-400 line-through">
            {formatCurrency(row.listPriceAmount)}
          </p>
        )}
      </td>
      <td className="px-4 py-3.5 text-xs leading-5">
        <p>
          <span className="text-slate-400">Paid</span>{' '}
          <span className="text-slate-700">{formatDateTime(row.paidAt)}</span>
        </p>
        <p>
          <span className="text-slate-400">Expires</span>{' '}
          <span className="text-slate-700">{formatDateTime(row.expiresAt)}</span>
        </p>
        <p>
          <span className="text-slate-400">Started</span>{' '}
          <span className="text-slate-700">{formatDateTime(row.createdAt)}</span>
        </p>
      </td>
      <td className="space-y-1 px-4 py-3">
        <p className="mb-1 text-xs font-semibold text-slate-800">{formatPaymentMethod(row.paymentMethod)}</p>
        <ReferenceLine label="Ref" value={row.paymentReference} />
        {row.phonepeOrderId ? <ReferenceLine label="Order" value={row.phonepeOrderId} /> : null}
        {row.purchaseSource === 'ADMIN' ? (
          <p className="pl-[60px] text-[10px] text-slate-400">Granted by {row.activatedBy || 'Admin'}</p>
        ) : null}
      </td>
      <td className="space-y-1 px-4 py-3">
        <ReferenceLine label="Merchant" value={row.merchantOrderId} />
        <ReferenceLine label="Record" value={row.id} />
        {row.adminNote ? (
          <p className="pl-[60px] text-[10px] text-slate-500" title={row.adminNote}>
            {row.adminNote}
          </p>
        ) : null}
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
          <p className="mt-1 text-xs text-slate-500">
            {row.mobileNumber || 'No mobile'} · {row.packLabel}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums text-slate-950">{formatCurrency(row.amountPaid)}</p>
          <div className="mt-1">
            <StatusPill status={row.status} />
          </div>
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
        <p className="text-xs font-semibold text-slate-800">Paid via {formatPaymentMethod(row.paymentMethod)}</p>
        <ReferenceLine label="Ref" value={row.paymentReference} />
        {row.phonepeOrderId ? <ReferenceLine label="PhonePe" value={row.phonepeOrderId} /> : null}
        <ReferenceLine label="Merchant" value={row.merchantOrderId} />
        <ReferenceLine label="Record" value={row.id} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span>{row.packCode}</span>
        <span>{row.daysRemaining > 0 ? `${row.daysRemaining} days left` : 'No active days'}</span>
        <span>Started {formatDateTime(row.createdAt)}</span>
        <span>Updated {formatDateTime(row.updatedAt)}</span>
        {row.purchaseSource === 'ADMIN' ? <span>Granted by {row.activatedBy || 'Admin'}</span> : null}
      </div>
      {row.adminNote ? <p className="mt-2 text-xs text-slate-500">Note: {row.adminNote}</p> : null}
    </article>
  );
}

function GrantPlanDialog({ open, onClose, onGranted }: { open: boolean; onClose: () => void; onGranted: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminTrackingPlanCustomer[]>([]);
  const [selected, setSelected] = useState<AdminTrackingPlanCustomer | null>(null);
  const [searching, setSearching] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<GrantTrackingPlanPayload['paymentMethod']>('CASH');
  const [amountPaid, setAmountPaid] = useState('99');
  const [paymentReference, setPaymentReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => globalThis.crypto.randomUUID());

  useEffect(() => {
    if (!open || selected || query.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const response = await adminApi.searchTrackingPlanCustomers(query.trim(), 10);
      if (cancelled) return;
      setResults(response.success ? response.data || [] : []);
      setError(response.success ? '' : response.message || 'Customer search failed.');
      setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, selected]);

  const resetAndClose = () => {
    setQuery('');
    setResults([]);
    setSelected(null);
    setPaymentMethod('CASH');
    setAmountPaid('99');
    setPaymentReference('');
    setNote('');
    setError('');
    setIdempotencyKey(globalThis.crypto.randomUUID());
    onClose();
  };

  const submit = async () => {
    if (!selected) {
      setError('Select a customer first.');
      return;
    }
    const amount = Number(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount received.');
      return;
    }
    setSubmitting(true);
    setError('');
    const response = await adminApi.grantTrackingPlan({
      userId: selected.id,
      idempotencyKey,
      paymentMethod,
      amountPaid: amount,
      ...(paymentReference.trim() ? { paymentReference: paymentReference.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setSubmitting(false);
    if (!response.success || !response.data) {
      setError(response.message || 'Plan could not be activated.');
      return;
    }
    toast.success(`Tracking plan activated for ${selected.name}`);
    onGranted();
    resetAndClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grant-tracking-plan-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ShieldCheck size={18} />
              </span>
              <div>
                <h2 id="grant-tracking-plan-title" className="text-lg font-semibold text-slate-950">
                  Grant tracking plan
                </h2>
                <p className="text-xs text-slate-500">Record an offline payment and activate 30 days.</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {!selected ? (
            <div>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Find customer</span>
                <span className="relative block">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setError('');
                    }}
                    placeholder="Search by customer name or mobile number"
                    className="h-11 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </span>
              </label>

              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                {query.trim().length < 2 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">Type at least 2 characters.</div>
                ) : searching ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">Searching customers…</div>
                ) : results.length ? (
                  <div className="divide-y divide-slate-100">
                    {results.map((customer) => (
                      <button
                        type="button"
                        key={customer.id}
                        onClick={() => {
                          setSelected(customer);
                          setError('');
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <UserRound size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-950">{customer.name}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {customer.mobileNumber} ·{' '}
                            {[customer.identity, customer.state].filter(Boolean).join(' · ') || 'Customer'}
                          </span>
                        </span>
                        {customer.active ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            Active until {formatDateTime(customer.expiresAt)}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-medium text-slate-400">Select</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">No matching customers found.</div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                  <UserRound size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{selected.name}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {selected.mobileNumber} · {[selected.identity, selected.state].filter(Boolean).join(' · ')}
                  </p>
                  {selected.active ? (
                    <p className="mt-1.5 text-xs font-medium text-emerald-700">
                      Already active until {formatDateTime(selected.expiresAt)}. This grant adds 30 days after that
                      date.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs font-medium text-emerald-700">
                      Access starts immediately for 30 days.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setResults([]);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Change
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Payment method</span>
                  <select
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(event.target.value as GrantTrackingPlanPayload['paymentMethod'])
                    }
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {MANUAL_PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Amount received</span>
                  <span className="relative block">
                    <IndianRupee
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      step="0.01"
                      value={amountPaid}
                      onChange={(event) => setAmountPaid(event.target.value)}
                      className="h-11 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm tabular-nums text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </span>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Payment reference <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder={
                    paymentMethod === 'CASH' ? 'Receipt number or collector name' : 'Transaction or bank reference'
                  }
                  maxLength={128}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Admin note <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Anything the team should know about this payment"
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <div className="mt-5 flex items-start gap-3 rounded-lg bg-slate-50 p-3.5">
                <Banknote size={18} className="mt-0.5 shrink-0 text-slate-500" />
                <p className="text-xs leading-5 text-slate-600">
                  This creates a paid audit record and unlocks FastTag tracking immediately. Pending PhonePe checkouts
                  remain hidden and unchanged.
                </p>
              </div>
            </div>
          )}

          {error ? (
            <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={submitting}
            className="h-10 rounded-md px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!selected || submitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ShieldCheck size={16} />
            {submitting ? 'Activating…' : 'Activate 30 days'}
          </button>
        </div>
      </div>
    </div>
  );
}
