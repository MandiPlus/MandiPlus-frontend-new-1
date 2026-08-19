'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  Undo2,
  UserRound,
  X,
} from 'lucide-react';
import {
  adminApi,
  AdminAccountDeletionRequest,
  AdminAccountDeletionRequestFilters,
  AccountDeletionRequestStatus,
} from '@/features/admin/api/admin.api';

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<AccountDeletionRequestStatus, string> = {
  PENDING: 'border-violet-200 bg-violet-50 text-violet-700',
  SCHEDULED: 'border-blue-200 bg-blue-50 text-blue-700',
  BLOCKED: 'border-amber-200 bg-amber-50 text-amber-800',
  COMPLETED: 'border-slate-200 bg-slate-100 text-slate-600',
  RECOVERED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-slate-200 bg-slate-100 text-slate-600',
};

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

function formatStatus(status: AccountDeletionRequestStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function StatusPill({ status }: { status: AccountDeletionRequestStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${STATUS_STYLES[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {formatStatus(status)}
    </span>
  );
}

function DeadlineCell({ request }: { request: AdminAccountDeletionRequest }) {
  return (
    <div className="space-y-1 text-xs leading-5">
      <p>
        <span className="text-slate-400">Delete</span>{' '}
        <span className="text-slate-700">{formatDateTime(request.scheduledFor)}</span>
      </p>
      <p>
        <span className="text-slate-400">Recover</span>{' '}
        <span className="text-slate-700">{formatDateTime(request.recoveryDeadline)}</span>
      </p>
    </div>
  );
}

function BlockerSummary({ blockers }: { blockers?: string[] }) {
  const items = blockers || [];
  if (!items.length) {
    return <span className="text-xs text-slate-400">None recorded</span>;
  }

  return (
    <div className="max-w-56">
      <p className="line-clamp-2 text-xs leading-5 text-amber-800" title={items.join('\n')}>
        {items.join(' · ')}
      </p>
      {items.length > 1 ? (
        <p className="mt-0.5 text-[11px] font-medium text-amber-700">
          {items.length} blockers
        </p>
      ) : null}
    </div>
  );
}

export default function AccountDeletionAdminPage() {
  const [rows, setRows] = useState<AdminAccountDeletionRequest[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountDeletionRequestStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<AdminAccountDeletionRequest | null>(null);
  const [recoveryTarget, setRecoveryTarget] = useState<AdminAccountDeletionRequest | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo<AdminAccountDeletionRequestFilters>(
    () => ({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    }),
    [fromDate, search, status, toDate],
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await adminApi.getAccountDeletionRequests({
      ...filters,
      page,
      limit: PAGE_SIZE,
    });

    if (!response.success) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(response.message || 'Account deletion requests could not be loaded.');
    } else {
      setRows(response.data || []);
      setTotal(Number(response.total || 0));
      setTotalPages(Math.max(1, Number(response.totalPages || 1)));
    }

    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests, refreshKey]);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const recover = async (request: AdminAccountDeletionRequest, reason: string) => {
    const response = await adminApi.recoverAccountDeletionRequest(request.id, {
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Account recovery could not be completed.');
    }

    const recoveredRequest = response.data;
    setRows((current) =>
      current.map((row) => (row.id === recoveredRequest.id ? recoveredRequest : row)),
    );
    setSelectedRequest((current) =>
      current?.id === recoveredRequest.id ? recoveredRequest : current,
    );
    setRecoveryTarget(null);
    toast.success(`Deletion request recovered for ${request.customerName}.`);
  };

  const hasFilters = Boolean(searchInput || status || fromDate || toDate);
  const scheduledCount = rows.filter((row) => row.status === 'SCHEDULED').length;
  const blockedCount = rows.filter((row) => row.status === 'BLOCKED').length;

  return (
    <div className="min-h-full bg-[#f7f8fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1560px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm">
                <ShieldAlert size={17} />
              </span>
              <h1 className="text-2xl font-semibold text-slate-950">Deletion Requests</h1>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              OTP-verified customer requests, recovery windows, and deletion blockers.
            </p>
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
          <QueueStat label="Listed requests" value={loading ? '…' : total.toLocaleString('en-IN')} icon={<UserRound size={17} />} iconClass="bg-violet-50 text-violet-700" />
          <QueueStat label="Scheduled on this page" value={loading ? '…' : scheduledCount.toLocaleString('en-IN')} icon={<Clock3 size={17} />} iconClass="bg-blue-50 text-blue-700" />
          <QueueStat label="Blocked on this page" value={loading ? '…' : blockedCount.toLocaleString('en-IN')} icon={<AlertTriangle size={17} />} iconClass="bg-amber-50 text-amber-700" />
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
                  placeholder="Customer name, mobile number, or request ID"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </span>
            </label>
            <label className="xl:w-44">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AccountDeletionRequestStatus | '');
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="BLOCKED">Blocked</option>
                <option value="RECOVERED">Recovered</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Requested from</span>
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
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Requested to</span>
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
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="h-10 rounded-md px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                Clear
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
              <p className="text-sm font-medium text-slate-800">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                className="mt-3 text-sm font-semibold text-[#4309ac]"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1260px] table-fixed">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="w-[245px] px-4 py-3">Customer</th>
                      <th className="w-[175px] px-4 py-3">Requested</th>
                      <th className="w-[120px] px-4 py-3">Status</th>
                      <th className="w-[235px] px-4 py-3">Deadlines</th>
                      <th className="w-[220px] px-4 py-3">Blockers</th>
                      <th className="w-[120px] px-4 py-3">Events</th>
                      <th className="w-[145px] px-4 py-3 text-right">Action</th>
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
                      : rows.map((row) => (
                        <tr key={row.id} className="align-top text-sm text-slate-700 hover:bg-slate-50/70">
                          <td className="px-4 py-3.5">
                            <div className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                                <UserRound size={15} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-950" title={row.customerName}>{row.customerName}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{row.mobileNumber}</p>
                                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400" title={row.id}>{row.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs leading-5 text-slate-600">
                            <p>{formatDateTime(row.requestedAt)}</p>
                            <p className="text-slate-400">Verified {formatDateTime(row.verifiedAt)}</p>
                          </td>
                          <td className="px-4 py-3.5"><StatusPill status={row.status} /></td>
                          <td className="px-4 py-3.5"><DeadlineCell request={row} /></td>
                          <td className="px-4 py-3.5"><BlockerSummary blockers={row.blockers} /></td>
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={() => setSelectedRequest(row)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4309ac] hover:text-[#350686]"
                            >
                              <Eye size={14} />
                              {(row.events || []).length} event{(row.events || []).length === 1 ? '' : 's'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {row.canRecover ? (
                              <button
                                type="button"
                                onClick={() => setRecoveryTarget(row)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <Undo2 size={14} />
                                Recover
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-3 p-4">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                      <div className="h-24 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))
                  : rows.map((row) => (
                    <article key={row.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-950">{row.customerName}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.mobileNumber}</p>
                        </div>
                        <StatusPill status={row.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-slate-50 px-3 py-2.5 text-xs">
                        <div>
                          <p className="text-slate-400">Requested</p>
                          <p className="mt-0.5 text-slate-700">{formatDateTime(row.requestedAt)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Delete deadline</p>
                          <p className="mt-0.5 text-slate-700">{formatDateTime(row.scheduledFor)}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Blockers</p>
                        <div className="mt-1"><BlockerSummary blockers={row.blockers} /></div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(row)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4309ac]"
                        >
                          <Eye size={14} />
                          View {(row.events || []).length} events
                        </button>
                        {row.canRecover ? (
                          <button
                            type="button"
                            onClick={() => setRecoveryTarget(row)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700"
                          >
                            <Undo2 size={14} />
                            Recover
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
              </div>

              {!loading && rows.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <ShieldAlert size={20} />
                  </span>
                  <p className="mt-3 text-sm font-medium text-slate-800">No deletion requests found</p>
                  <p className="mt-1 text-xs text-slate-500">OTP-verified requests will appear here.</p>
                </div>
              ) : null}

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

      <RequestDetailDialog request={selectedRequest} onClose={() => setSelectedRequest(null)} />
      <RecoveryDialog
        request={recoveryTarget}
        onClose={() => setRecoveryTarget(null)}
        onRecover={recover}
      />
    </div>
  );
}

function QueueStat({
  label,
  value,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${iconClass}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function RequestDetailDialog({
  request,
  onClose,
}: {
  request: AdminAccountDeletionRequest | null;
  onClose: () => void;
}) {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deletion-request-detail-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Request activity</p>
            <h2 id="deletion-request-detail-title" className="mt-1 truncate text-lg font-semibold text-slate-950">
              {request.customerName}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{request.mobileNumber} · {request.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close request activity"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <StatusPill status={request.status} />
            <span className="text-xs text-slate-500">Requested {formatDateTime(request.requestedAt)}</span>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-900">Event history</h3>
            {(request.events || []).length ? (
              <ol className="mt-3 space-y-0 border-l border-slate-200 pl-4">
                {(request.events || []).map((event) => (
                  <li key={event.id} className="relative pb-5 last:pb-0">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#4309ac] shadow-sm" />
                    <p className="text-sm font-medium text-slate-800">{event.type.replace(/_/g, ' ')}</p>
                    {event.detail ? <p className="mt-0.5 text-sm leading-5 text-slate-600">{event.detail}</p> : null}
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDateTime(event.createdAt)}
                      {event.actorName ? ` · ${event.actorName}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No events have been recorded yet.</p>
            )}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Dates and blockers</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Delete deadline</dt>
                <dd className="mt-1 font-medium text-slate-700">{formatDateTime(request.scheduledFor)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Recovery deadline</dt>
                <dd className="mt-1 font-medium text-slate-700">{formatDateTime(request.recoveryDeadline)}</dd>
              </div>
            </dl>
            <div className="mt-3"><BlockerSummary blockers={request.blockers} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecoveryDialog({
  request,
  onClose,
  onRecover,
}: {
  request: AdminAccountDeletionRequest | null;
  onClose: () => void;
  onRecover: (request: AdminAccountDeletionRequest, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setReason('');
    setError('');
  }, [request]);

  if (!request) return null;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onRecover(request, reason);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Account recovery could not be completed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recover-deletion-request-title"
        className="w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="recover-deletion-request-title" className="text-lg font-semibold text-slate-950">Recover account</h2>
            <p className="mt-1 text-sm text-slate-500">Cancel the pending deletion for {request.customerName}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close recovery dialog"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-45"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
            <p className="text-sm leading-5 text-emerald-900">
              The account will remain active and an audit event will record this recovery.
            </p>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Recovery note <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Why is this deletion request being recovered?"
              className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          {error ? <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 rounded-md px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Undo2 size={16} />
            {submitting ? 'Recovering…' : 'Recover account'}
          </button>
        </div>
      </div>
    </div>
  );
}
