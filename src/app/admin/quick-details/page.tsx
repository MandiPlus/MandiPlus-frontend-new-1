'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  AdminQuickDetail,
  AdminQuickDetailMedia,
  adminApi,
} from '@/features/admin/api/admin.api';

const ITEMS_PER_PAGE = 30;

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhone(value?: string | null) {
  const cleaned = String(value || '').replace(/\D/g, '');
  if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  return value || '-';
}

function formatDuration(milliseconds?: number | null) {
  const seconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function MediaTile({ media }: { media: AdminQuickDetailMedia }) {
  if (media.kind === 'image') {
    return (
      <a href={media.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-slate-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.url} alt={media.name || 'Quick detail image'} className="h-24 w-full object-cover" />
      </a>
    );
  }

  if (media.kind === 'audio') {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-2">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-600">
          <MicrophoneIcon className="h-4 w-4" />
          Voice note
        </div>
        <audio controls src={media.url} className="w-full" />
      </div>
    );
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-20 items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
    >
      <DocumentTextIcon className="h-5 w-5 shrink-0 text-slate-500" />
      <span className="min-w-0 truncate">{media.name || (media.kind === 'pdf' ? 'PDF' : 'File')}</span>
    </a>
  );
}

function QuickDetailCard({ row }: { row: AdminQuickDetail }) {
  const hasDetails = Boolean(String(row.details || '').trim());

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-black text-slate-950">{row.user?.name || 'Unknown user'}</p>
            {row.user?.identity ? (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{row.user.identity}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">{formatPhone(row.user?.mobileNumber)}</p>
        </div>
        <p className="text-sm font-bold text-slate-500">{formatDateTime(row.createdAt)}</p>
      </div>

      {hasDetails ? (
        <p className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-800">
          {row.details}
        </p>
      ) : null}

      {row.audioDurationMillis ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          <MicrophoneIcon className="h-4 w-4" />
          {formatDuration(row.audioDurationMillis)}
        </p>
      ) : null}

      {row.media?.length ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {row.media.map((media, index) => (
            <MediaTile key={`${row.id}-${media.url}-${index}`} media={media} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function AdminQuickDetailsPage() {
  const { isAuthenticated, loading: authLoading, canAccessSection } = useAdmin();
  const [rows, setRows] = useState<AdminQuickDetail[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!isAuthenticated || !canAccessSection('app-quick-details')) return;
    setLoading(true);
    setError(null);
    const response = await adminApi.getAdminQuickDetails({
      page,
      limit: ITEMS_PER_PAGE,
      search: search.trim() || undefined,
    });
    if (response.success) {
      setRows(response.data || []);
      setTotal(response.total || 0);
      setTotalPages(response.totalPages || 1);
    } else {
      setError(response.message || 'Failed to load quick details.');
    }
    setLoading(false);
  }, [canAccessSection, isAuthenticated, page, search]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  if (!authLoading && (!isAuthenticated || !canAccessSection('app-quick-details'))) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          You do not have access to Quick Details.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">Quick Details</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{total.toLocaleString('en-IN')} submissions</p>
          </div>
          <button
            type="button"
            onClick={() => loadRows()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, phone, details"
            className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">Loading quick details</div>
      ) : rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <QuickDetailCard key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <PhotoIcon className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-bold text-slate-600">No quick details yet</p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-bold text-slate-500">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
