'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  PlayCircleIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminAppCustomer,
  AdminAppCustomersSummary,
  adminApi,
} from '@/features/admin/api/admin.api';
import { postHogSessionRecordingsUrl } from '@/features/admin/posthogLinks';

const ITEMS_PER_PAGE = 20;

const statusFilters = [
  { value: 'ALL', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ONBOARDING_PENDING', label: 'Onboarding pending' },
  { value: 'HAS_FORMS', label: 'Has app forms' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const statusLabels: Record<AdminAppCustomer['status'], string> = {
  new: 'New',
  active: 'Active',
  onboarding_pending: 'Onboarding pending',
  engaged: 'Engaged',
  inactive: 'Inactive',
};

const statusClasses: Record<AdminAppCustomer['status'], string> = {
  new: 'bg-blue-50 text-blue-700 ring-blue-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  onboarding_pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  engaged: 'bg-slate-100 text-slate-700 ring-slate-200',
  inactive: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const defaultStats: AdminAppCustomer['stats'] = {
  loginCount: 0,
  formsSubmitted: 0,
  appFormsSubmitted: 0,
  filesSubmitted: 0,
  claimsSubmitted: 0,
  pendingClaims: 0,
  walletTransactionCount: 0,
  walletBalance: 0,
  walletType: null,
  lastFormSubmittedAt: null,
  lastClaimSubmittedAt: null,
  lastWalletActivityAt: null,
};

const defaultOnboarding: AdminAppCustomer['onboarding'] = {
  completed: false,
  products: [],
  fleetSize: null,
  location: [],
  verifiedLedgerMaster: false,
};

const emptySummary: AdminAppCustomersSummary = {
  totalCustomers: 0,
  todayCustomers: 0,
  weekCustomers: 0,
  monthCustomers: 0,
  newCustomers: 0,
  activeCustomers: 0,
  onboardingPending: 0,
  customersWithAppForms: 0,
  inactiveCustomers: 0,
  excludedNonAppRecords: 0,
  buyerCustomers: 0,
  customerCustomers: 0,
  supplierCustomers: 0,
  transporterCustomers: 0,
  agentCustomers: 0,
  otherRoleCustomers: 0,
  releaseDate: '2026-07-08T00:00:00+05:30',
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function toCount(value?: number | null) {
  return Number(value || 0);
}

function normalizeSummary(summary?: AdminAppCustomersSummary): AdminAppCustomersSummary {
  return { ...emptySummary, ...(summary || {}) };
}

function normalizeCustomer(customer: AdminAppCustomer): AdminAppCustomer {
  return {
    ...customer,
    status: statusLabels[customer.status] ? customer.status : 'engaged',
    onboarding: {
      ...defaultOnboarding,
      ...(customer.onboarding || {}),
      products: customer.onboarding?.products || [],
      location: customer.onboarding?.location || [],
    },
    stats: {
      ...defaultStats,
      ...(customer.stats || {}),
    },
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompactDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatPhone(value?: string | null) {
  if (!value) return '-';
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return value;
}

function cleanLabel(value?: string | null) {
  return String(value || '')
    .replace(/^Vehicles:\s*/i, '')
    .replace(/^District:\s*/i, '')
    .replace(/^PIN:\s*/i, 'PIN ')
    .replace(/^Mode:\s*/i, '')
    .trim();
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'green' | 'blue' | 'amber' | 'rose' | 'slate';
}) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-white text-slate-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{toCount(value).toLocaleString('en-IN')}</p>
        </div>
        <span className={classNames('rounded-md border px-2.5 py-1 text-xs font-bold', tones[tone])}>{detail}</span>
      </div>
    </div>
  );
}

function RoleSplit({ summary }: { summary: AdminAppCustomersSummary }) {
  const items = [
    ['Customers', summary.customerCustomers],
    ['Buyers', summary.buyerCustomers],
    ['Suppliers', summary.supplierCustomers],
    ['Transporters', summary.transporterCustomers],
    ['Agents / partners', summary.agentCustomers],
    ['Other roles', summary.otherRoleCustomers],
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([label, value]) => (
        <span key={label} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
          {label}: <span className="text-slate-950">{toCount(value).toLocaleString('en-IN')}</span>
        </span>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: AdminAppCustomer['status'] }) {
  return (
    <span className={classNames('inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1', statusClasses[status])}>
      {statusLabels[status]}
    </span>
  );
}

function CustomerDrawer({
  customer,
  onClose,
}: {
  customer: AdminAppCustomer | null;
  onClose: () => void;
}) {
  if (!customer) return null;

  const location = customer.onboarding.location.map(cleanLabel).filter(Boolean);
  const replayUrl = postHogSessionRecordingsUrl(customer.id);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close customer details"
        className="absolute inset-0 bg-slate-950/30"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <UserCircleIcon className="h-6 w-6 text-[#4309ac]" />
                <h2 className="text-xl font-black text-slate-950">{customer.name || 'Unnamed customer'}</h2>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500">{formatPhone(customer.mobileNumber)}</p>
              {replayUrl ? (
                <a
                  href={replayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#4309ac] px-3 py-2 text-xs font-black text-white hover:bg-[#350888]"
                >
                  <PlayCircleIcon className="h-4 w-4" />
                  Session recordings
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 opacity-80" />
                </a>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <DetailStat label="Status" value={statusLabels[customer.status]} />
            <DetailStat label="State" value={customer.state || '-'} />
            <DetailStat label="App signup" value={formatCompactDate(customer.appSignupAt || customer.createdAt)} />
            <DetailStat label="Last login" value={formatDateTime(customer.lastLoginAt)} />
          </div>

          <section className="mt-6">
            <h3 className="text-sm font-black uppercase tracking-[0.08em] text-slate-500">Onboarding</h3>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                {customer.onboarding.completed ? (
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ClockIcon className="h-5 w-5 text-amber-600" />
                )}
                <p className="font-bold text-slate-900">
                  {customer.onboarding.completed ? 'Completed' : 'Needs more profile data'}
                </p>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <InfoRow label="Fleet" value={cleanLabel(customer.onboarding.fleetSize) || '-'} />
                <InfoRow
                  label="Commodities"
                  value={customer.onboarding.products.length ? customer.onboarding.products.join(', ') : '-'}
                />
                <InfoRow label="Location" value={location.length ? location.join(', ') : '-'} />
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-black uppercase tracking-[0.08em] text-slate-500">Activity</h3>
            <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
              <TimelineRow label="Invoices made" value={customer.stats.formsSubmitted} at={customer.stats.lastFormSubmittedAt} />
              <TimelineRow label="App forms submitted" value={customer.stats.appFormsSubmitted} at={customer.stats.lastFormSubmittedAt} />
              <TimelineRow label="Files submitted" value={customer.stats.filesSubmitted} />
              <TimelineRow label="Claims submitted" value={customer.stats.claimsSubmitted} at={customer.stats.lastClaimSubmittedAt} />
              <TimelineRow label="Wallet activity" value={customer.stats.walletTransactionCount} at={customer.stats.lastWalletActivityAt} />
            </div>
          </section>
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <Link
            href={`/admin/users?search=${encodeURIComponent(customer.mobileNumber)}`}
            className="inline-flex w-full items-center justify-center rounded-md bg-[#4309ac] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#350783]"
          >
            Open in Users
          </Link>
        </div>
      </aside>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <p className="font-bold text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TimelineRow({ label, value, at }: { label: string; value: number; at?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm font-bold text-slate-900">{label}</p>
        {at ? <p className="mt-0.5 text-xs font-medium text-slate-500">{formatDateTime(at)}</p> : null}
      </div>
      <p className="text-lg font-black text-slate-950">{toCount(value).toLocaleString('en-IN')}</p>
    </div>
  );
}

export default function AdminAppCustomersPage() {
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const [customers, setCustomers] = useState<AdminAppCustomer[]>([]);
  const [summary, setSummary] = useState<AdminAppCustomersSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [joinedStartDate, setJoinedStartDate] = useState('');
  const [joinedEndDate, setJoinedEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminAppCustomer | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    if (!isAuthenticated || !canAccessSection('app-customers')) return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError('');

    const response = await adminApi.getAdminAppCustomers({
      page,
      limit: ITEMS_PER_PAGE,
      search: debouncedSearch,
      status,
      joinedStartDate: joinedStartDate || undefined,
      joinedEndDate: joinedEndDate || undefined,
    });

    if (requestId !== requestRef.current) return;

    if (response.success) {
      setCustomers((response.data || []).map(normalizeCustomer));
      setSummary(normalizeSummary(response.summary));
      setTotal(response.total || 0);
      setTotalPages(response.totalPages || 1);
    } else {
      setError(response.message || 'Failed to load app customers');
      setCustomers([]);
    }

    setLoading(false);
  }, [
    canAccessSection,
    debouncedSearch,
    isAuthenticated,
    joinedEndDate,
    joinedStartDate,
    page,
    status,
  ]);

  useEffect(() => {
    if (!authLoading) {
      void Promise.resolve().then(() => fetchCustomers());
    }
  }, [authLoading, fetchCustomers]);

  const shownRange = useMemo(() => {
    if (!total) return '0';
    const start = (page - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(page * ITEMS_PER_PAGE, total);
    return `${start}-${end}`;
  }, [page, total]);

  if (!authLoading && (!isAuthenticated || !canAccessSection('app-customers'))) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          You do not have access to App Customers.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5">
          <RoleSplit summary={summary} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="App customers" value={summary.totalCustomers} detail="total" tone="slate" />
          <MetricCard label="Today" value={summary.todayCustomers} detail="IST" tone="green" />
          <MetricCard label="This week" value={summary.weekCustomers} detail="7 days" tone="blue" />
          <MetricCard label="This month" value={summary.monthCustomers} detail="30 days" tone="blue" />
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-md">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or phone"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none ring-[#4309ac]/20 placeholder:text-slate-400 focus:border-[#4309ac] focus:ring-4"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => {
                      setStatus(filter.value);
                      setPage(1);
                    }}
                    className={classNames(
                      status === filter.value
                        ? 'bg-[#4309ac] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      'rounded-md px-3 py-2 text-xs font-black transition-colors',
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
                Join start
                <input
                  type="date"
                  value={joinedStartDate}
                  onChange={(event) => {
                    setJoinedStartDate(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none ring-[#4309ac]/20 focus:border-[#4309ac] focus:ring-4"
                />
              </label>
              <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
                Join end
                <input
                  type="date"
                  value={joinedEndDate}
                  onChange={(event) => {
                    setJoinedEndDate(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none ring-[#4309ac]/20 focus:border-[#4309ac] focus:ring-4"
                />
              </label>
              {(joinedStartDate || joinedEndDate) ? (
                <button
                  type="button"
                  onClick={() => {
                    setJoinedStartDate('');
                    setJoinedEndDate('');
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
                >
                  Clear dates
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {error ? (
            <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              <ExclamationTriangleIcon className="h-5 w-5" />
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-100">
                <tr>
                  <TableHeader>Customer</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>App signup</TableHeader>
                  <TableHeader>Last login</TableHeader>
                  <TableHeader>Last activity</TableHeader>
                  <TableHeader>Onboarding</TableHeader>
                  <TableHeader align="right">Invoices</TableHeader>
                  <TableHeader align="right">App forms</TableHeader>
                  <TableHeader align="right">Files</TableHeader>
                  <TableHeader align="right">Claims</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={10} className="px-4 py-3">
                        <div className="h-10 animate-pulse rounded-md bg-slate-100" />
                      </td>
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-14 text-center">
                      <DocumentTextIcon className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-sm font-black text-slate-900">No app customers found</p>
                      <p className="mt-1 text-sm text-slate-500">Try changing the search, status, or join date filter.</p>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className="group text-left"
                        >
                          <p className="font-black text-slate-950 group-hover:text-[#4309ac]">
                            {customer.name || 'Unnamed customer'}
                          </p>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <PhoneIcon className="h-3.5 w-3.5" />
                            {formatPhone(customer.mobileNumber)}
                          </p>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3"><StatusPill status={customer.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">
                        {formatCompactDate(customer.appSignupAt || customer.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">
                        {formatDateTime(customer.lastLoginAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">
                        {formatDateTime(customer.lastActivityAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs">
                          <p className="text-sm font-black text-slate-900">
                            {customer.onboarding.completed ? 'Complete' : 'Pending'}
                          </p>
                          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                            {customer.onboarding.products.length
                              ? customer.onboarding.products.join(', ')
                              : 'No commodities captured'}
                          </p>
                        </div>
                      </td>
                      <TableNumber value={customer.stats.formsSubmitted} />
                      <TableNumber value={customer.stats.appFormsSubmitted} />
                      <TableNumber value={customer.stats.filesSubmitted} />
                      <TableNumber value={customer.stats.claimsSubmitted} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-600">
              Showing {shownRange} of {toCount(total).toLocaleString('en-IN')}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <CustomerDrawer customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
}

function TableHeader({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={classNames(
        'px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-slate-500',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  );
}

function TableNumber({ value }: { value: number }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black text-slate-950">
      {toCount(value).toLocaleString('en-IN')}
    </td>
  );
}
