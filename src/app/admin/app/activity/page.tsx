'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
  PlayCircleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminAppCustomer,
  adminApi,
} from '@/features/admin/api/admin.api';
import {
  getPostHogProjectId,
  postHogSessionRecordingsUrl,
} from '@/features/admin/posthogLinks';

const ITEMS_PER_PAGE = 30;

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

function formatPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return value || '—';
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeActivity(value?: string | null) {
  if (!value) return 'No activity yet';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return formatDateTime(value);
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDateTime(value);
}

export default function AdminAppActivityPage() {
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const [customers, setCustomers] = useState<AdminAppCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const posthogConfigured = Boolean(getPostHogProjectId());

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const load = useCallback(async () => {
    if (!isAuthenticated || !canAccessSection('app-customers')) return;
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.getAdminAppCustomers({
        page,
        limit: ITEMS_PER_PAGE,
        search,
        status: 'ALL',
      });
      if (!response.success) {
        setError(response.message || 'Failed to load activity');
        setCustomers([]);
        setTotal(0);
        return;
      }
      setCustomers(response.data || []);
      setTotal(Number(response.total || 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canAccessSection, isAuthenticated, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const shownRange = useMemo(() => {
    if (!total) return '0';
    const start = (page - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(page * ITEMS_PER_PAGE, total);
    return `${start}–${end}`;
  }, [page, total]);

  if (!authLoading && (!isAuthenticated || !canAccessSection('app-customers'))) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-600">
        You do not have access to app activity.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">App activity</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Latest customers using the app. Open session recordings in PostHog (name/phone after they reopen the app with the analytics update).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!posthogConfigured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Set <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_POSTHOG_PROJECT_ID</code> in
          the frontend env so Session recordings can open PostHog.
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <label className="relative block max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name or phone"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#4309ac] focus:outline-none focus:ring-1 focus:ring-[#4309ac]"
            />
          </label>
        </div>

        {error ? (
          <div className="px-4 py-6 text-sm font-semibold text-rose-700">{error}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !customers.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    Loading activity…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No app customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const replayUrl = postHogSessionRecordingsUrl(customer.id);
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserCircleIcon className="h-8 w-8 text-[#4309ac]" />
                          <div>
                            <p className="font-black text-slate-950">
                              {customer.name || 'Unnamed customer'}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              {formatPhone(customer.mobileNumber)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-sm font-black text-slate-900">
                          {relativeActivity(customer.lastActivityAt)}
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          {formatDateTime(customer.lastActivityAt)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">
                        {formatDateTime(customer.lastLoginAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClasses[customer.status]}`}
                        >
                          {statusLabels[customer.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {replayUrl ? (
                          <a
                            href={replayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#4309ac] px-3 py-2 text-xs font-black text-white hover:bg-[#350888]"
                          >
                            <PlayCircleIcon className="h-4 w-4" />
                            Session recordings
                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 opacity-80" />
                          </a>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">
                            Configure PostHog project id
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing {shownRange} of {total.toLocaleString('en-IN')}
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
  );
}
