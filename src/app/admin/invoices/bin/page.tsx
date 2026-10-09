'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import {
  adminApi,
  type InvoiceBinEntry,
  type InvoiceBinFilterParams,
} from '@/features/admin/api/admin.api';
import {
  formatCurrency,
  formatDateOnly,
  formatTimeOnly,
} from '@/features/admin/utils/format';

const ITEMS_PER_PAGE = 20;

type BinFilters = {
  invoiceNumber: string;
  vehicleNumber: string;
  search: string;
  deletedFrom: string;
  deletedTo: string;
  includeRestored: boolean;
};

const emptyFilters = (): BinFilters => ({
  invoiceNumber: '',
  vehicleNumber: '',
  search: '',
  deletedFrom: '',
  deletedTo: '',
  includeRestored: false,
});

function asAddressLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

function productLabel(entry: InvoiceBinEntry): string {
  if (Array.isArray(entry.productName) && entry.productName.length) {
    return entry.productName.join(', ');
  }
  return '—';
}

function getPaymentStatusLabelAndClasses(entry: InvoiceBinEntry) {
  const raw = entry.paymentStatus || '';
  const s = raw.toUpperCase();

  if (entry.isRejected) {
    return {
      label: 'NOT_REQUIRED',
      classes: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }
  if (s === 'PAID') {
    return {
      label: 'PAID',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (s === 'PARTIAL') {
    return {
      label: 'PARTIAL',
      classes: 'border-orange-200 bg-orange-50 text-orange-700',
    };
  }
  if (s === 'FAILED') {
    return {
      label: 'FAILED',
      classes: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }
  if (s === 'REFUNDED') {
    return {
      label: 'REFUNDED',
      classes: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }
  if (s === 'PENDING') {
    return {
      label: 'PENDING',
      classes: 'border-red-200 bg-red-50 text-red-700',
    };
  }
  if (s === 'NOT_REQUIRED' || entry.isPaymentRequired === false) {
    return {
      label: 'NOT_REQUIRED',
      classes: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }
  return {
    label: raw || '—',
    classes: 'border-slate-200 bg-slate-50 text-slate-700',
  };
}

export default function InvoiceBinPage() {
  const [filters, setFilters] = useState<BinFilters>(emptyFilters);
  const [debouncedFilters, setDebouncedFilters] =
    useState<BinFilters>(emptyFilters);
  const [entries, setEntries] = useState<InvoiceBinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [restoringAuditId, setRestoringAuditId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<InvoiceBinEntry | null>(
    null,
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  const activeApiFilters = useMemo((): InvoiceBinFilterParams => {
    const params: InvoiceBinFilterParams = {
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      includeRestored: debouncedFilters.includeRestored,
    };
    if (debouncedFilters.invoiceNumber.trim()) {
      params.invoiceNumber = debouncedFilters.invoiceNumber.trim();
    }
    if (debouncedFilters.vehicleNumber.trim()) {
      params.vehicleNumber = debouncedFilters.vehicleNumber.trim();
    }
    if (debouncedFilters.search.trim()) {
      params.search = debouncedFilters.search.trim();
    }
    if (debouncedFilters.deletedFrom) {
      params.deletedFrom = debouncedFilters.deletedFrom;
    }
    if (debouncedFilters.deletedTo) {
      params.deletedTo = debouncedFilters.deletedTo;
    }
    return params;
  }, [currentPage, debouncedFilters]);

  const loadBin = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.listInvoiceBin(activeApiFilters);
      if (!result.success) {
        toast.error(result.message || 'Failed to load invoice bin');
        setEntries([]);
        setServerTotal(0);
        setTotalPages(1);
        return;
      }
      setEntries(result.data || []);
      setServerTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load invoice bin');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [activeApiFilters]);

  useEffect(() => {
    loadBin();
  }, [loadBin]);

  const updateFilter = <K extends keyof BinFilters>(
    key: K,
    value: BinFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters());
  };

  const confirmRestore = async () => {
    if (!restoreTarget || restoringAuditId) return;
    const auditId = restoreTarget.auditId;
    setRestoringAuditId(auditId);
    try {
      const result = await adminApi.restoreInvoiceFromBin(auditId);
      if (!result.success) {
        toast.error(result.message || 'Restore failed');
        return;
      }
      if (result.numberWasSuffixed) {
        toast.success(
          `Restored as ${result.invoiceNumber} (original ${result.originalInvoiceNumber} was already in use)`,
        );
      } else {
        toast.success(`Restored invoice ${result.invoiceNumber}`);
      }
      setRestoreTarget(null);
      setExpandedAuditId(null);
      await loadBin();
    } catch (error: any) {
      toast.error(error?.message || 'Restore failed');
    } finally {
      setRestoringAuditId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6">
      <div className="max-w-none px-3 sm:px-4 lg:px-6 2xl:px-10">
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TrashIcon className="h-6 w-6 text-slate-500" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Invoices — Bin
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600 max-w-3xl">
              Deleted invoices captured from the production safety net. View
              full details and restore them back into the live Invoices list.
              Restored invoices keep their original number unless it was reused
              — then a <code className="text-xs">-RESTORED</code> suffix is
              applied. Separate insurance-certificate uploads cannot be
              auto-relinked.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadBin()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        <div className="mb-4 sm:mb-6 rounded-lg bg-white p-4 shadow">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Invoice #
              </label>
              <input
                type="text"
                value={filters.invoiceNumber}
                onChange={(e) => updateFilter('invoiceNumber', e.target.value)}
                placeholder="INV-2026-..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Vehicle #
              </label>
              <input
                type="text"
                value={filters.vehicleNumber}
                onChange={(e) => updateFilter('vehicleNumber', e.target.value)}
                placeholder="RJ19..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Supplier / Buyer
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="Search name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Deleted From
              </label>
              <input
                type="date"
                value={filters.deletedFrom}
                onChange={(e) => updateFilter('deletedFrom', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Deleted To
              </label>
              <input
                type="date"
                value={filters.deletedTo}
                onChange={(e) => updateFilter('deletedTo', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.includeRestored}
                  onChange={(e) =>
                    updateFilter('includeRestored', e.target.checked)
                  }
                  className="rounded border-slate-300"
                />
                Show restored
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        <div className="hidden lg:block overflow-hidden rounded-lg bg-white shadow ring-1 ring-slate-200">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-green-500" />
            </div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No deleted invoices match these filters.
            </div>
          ) : (
            <div className="relative isolate overflow-x-auto">
              <table className="w-full min-w-[1200px] table-fixed divide-y divide-gray-200 border-separate border-spacing-0">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-10 px-2 py-3" />
                    <th className="w-36 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Invoice #
                    </th>
                    <th className="w-28 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Date
                    </th>
                    <th className="w-36 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Supplier
                    </th>
                    <th className="w-36 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Buyer
                    </th>
                    <th className="w-32 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Product
                    </th>
                    <th className="w-28 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Vehicle
                    </th>
                    <th className="w-28 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Amount
                    </th>
                    <th className="w-28 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Payment
                    </th>
                    <th className="w-36 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Deleted At
                    </th>
                    <th className="w-28 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Status
                    </th>
                    <th className="w-40 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {entries.map((entry) => {
                    const payment = getPaymentStatusLabelAndClasses(entry);
                    const isExpanded = expandedAuditId === entry.auditId;
                    return (
                      <FragmentRow
                        key={entry.auditId}
                        entry={entry}
                        payment={payment}
                        isExpanded={isExpanded}
                        restoring={restoringAuditId === entry.auditId}
                        onToggleExpand={() =>
                          setExpandedAuditId(isExpanded ? null : entry.auditId)
                        }
                        onRestore={() => setRestoreTarget(entry)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:hidden space-y-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-lg bg-white shadow">
              <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-green-500" />
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg bg-white px-4 py-10 text-center text-sm text-slate-500 shadow">
              No deleted invoices match these filters.
            </div>
          ) : (
            entries.map((entry) => {
              const payment = getPaymentStatusLabelAndClasses(entry);
              const isExpanded = expandedAuditId === entry.auditId;
              return (
                <div
                  key={entry.auditId}
                  className="rounded-lg bg-white p-4 shadow ring-1 ring-slate-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {entry.invoiceNumber || '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.invoiceDate
                          ? formatDateOnly(String(entry.invoiceDate))
                          : '—'}
                      </p>
                    </div>
                    {entry.isRestored ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Restored
                      </span>
                    ) : (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                        Deleted
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Supplier</p>
                      <p className="font-medium text-slate-800">
                        {entry.supplierName || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Buyer</p>
                      <p className="font-medium text-slate-800">
                        {entry.billToName || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Vehicle</p>
                      <p className="font-medium text-slate-800">
                        {entry.vehicleNumber || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Amount</p>
                      <p className="font-medium text-slate-800">
                        {entry.amount != null
                          ? formatCurrency(Number(entry.amount))
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${payment.classes}`}
                    >
                      {payment.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      Deleted {formatDateOnly(entry.deletedAt)}{' '}
                      {formatTimeOnly(entry.deletedAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedAuditId(isExpanded ? null : entry.auditId)
                      }
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                    </button>
                    {!entry.isRestored && (
                      <button
                        type="button"
                        onClick={() => setRestoreTarget(entry)}
                        disabled={restoringAuditId === entry.auditId}
                        className="rounded-md bg-[#4309ac] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                  {isExpanded && <DetailPanel entry={entry} />}
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page <span className="font-medium">{currentPage}</span> of{' '}
              <span className="font-medium">{totalPages}</span>
              {serverTotal > 0 && (
                <span className="ml-2 text-gray-500">({serverTotal} total)</span>
              )}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages || loading}
              className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {restoreTarget && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Restore invoice?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This will put{' '}
              <span className="font-semibold">
                {restoreTarget.invoiceNumber}
              </span>{' '}
              back into the live Invoices list. If that number was reused by
              another invoice, it will be restored as{' '}
              <code className="text-xs">
                {restoreTarget.invoiceNumber}-RESTORED
              </code>
              .
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                disabled={Boolean(restoringAuditId)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                disabled={Boolean(restoringAuditId)}
                className="rounded-md bg-[#4309ac] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {restoringAuditId ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  entry,
  payment,
  isExpanded,
  restoring,
  onToggleExpand,
  onRestore,
}: {
  entry: InvoiceBinEntry;
  payment: { label: string; classes: string };
  isExpanded: boolean;
  restoring: boolean;
  onToggleExpand: () => void;
  onRestore: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-slate-50/80">
        <td className="px-2 py-3 text-center">
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Expand details"
          >
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </td>
        <td className="px-3 py-3 text-sm font-semibold text-slate-900">
          {entry.invoiceNumber || '—'}
        </td>
        <td className="px-3 py-3 text-sm text-slate-700">
          {entry.invoiceDate
            ? formatDateOnly(String(entry.invoiceDate))
            : '—'}
        </td>
        <td className="px-3 py-3 text-sm text-slate-700 truncate">
          {entry.supplierName || '—'}
        </td>
        <td className="px-3 py-3 text-sm text-slate-700 truncate">
          {entry.billToName || '—'}
        </td>
        <td className="px-3 py-3 text-sm text-slate-700 truncate">
          {productLabel(entry)}
        </td>
        <td className="px-3 py-3 text-sm text-slate-700">
          {entry.vehicleNumber || '—'}
        </td>
        <td className="px-3 py-3 text-sm text-right font-medium text-slate-900">
          {entry.amount != null ? formatCurrency(Number(entry.amount)) : '—'}
        </td>
        <td className="px-3 py-3 text-center">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${payment.classes}`}
          >
            {payment.label}
          </span>
        </td>
        <td className="px-3 py-3 text-sm text-slate-600">
          <div>{formatDateOnly(entry.deletedAt)}</div>
          <div className="text-xs text-slate-400">
            {formatTimeOnly(entry.deletedAt)}
          </div>
        </td>
        <td className="px-3 py-3 text-center">
          {entry.isRestored ? (
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              Restored
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              Deleted
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-2">
            {entry.pdfUrl && (
              <a
                href={entry.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Open PDF"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View
            </button>
            {!entry.isRestored && (
              <button
                type="button"
                onClick={onRestore}
                disabled={restoring}
                className="rounded-md bg-[#4309ac] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Restore
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={12} className="bg-slate-50 px-4 py-4">
            <DetailPanel entry={entry} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetailPanel({ entry }: { entry: InvoiceBinEntry }) {
  const supplierAddress = asAddressLines(entry.supplierAddress);
  const billToAddress = asAddressLines(entry.billToAddress);
  const shipToAddress = asAddressLines(entry.shipToAddress);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            entry.isVerified
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {entry.isVerified ? 'Verified' : 'Unverified'}
        </span>
        {entry.pdfUrl ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            PDF Available
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            No PDF
          </span>
        )}
        {entry.isRestored && entry.restoredInvoiceNumber && (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            Restored as {entry.restoredInvoiceNumber}
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Applicant Details
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Place of supply</dt>
              <dd className="text-right font-medium text-slate-900">
                {entry.placeOfSupply || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Supplier</dt>
              <dd className="font-medium text-slate-900">
                {entry.supplierName || '—'}
              </dd>
              {supplierAddress.map((line) => (
                <p key={line} className="text-xs text-slate-500">
                  {line}
                </p>
              ))}
            </div>
            <div>
              <dt className="text-slate-500">Bill to</dt>
              <dd className="font-medium text-slate-900">
                {entry.billToName || '—'}
              </dd>
              {billToAddress.map((line) => (
                <p key={line} className="text-xs text-slate-500">
                  {line}
                </p>
              ))}
            </div>
            <div>
              <dt className="text-slate-500">Ship to</dt>
              <dd className="font-medium text-slate-900">
                {entry.shipToName || '—'}
              </dd>
              {shipToAddress.map((line) => (
                <p key={line} className="text-xs text-slate-500">
                  {line}
                </p>
              ))}
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Insured person</dt>
              <dd className="text-right font-medium text-slate-900">
                {entry.insuredPersonNameSnapshot || '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Invoice Details
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Product</dt>
              <dd className="text-right font-medium text-slate-900">
                {productLabel(entry)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">HSN</dt>
              <dd className="text-right font-medium text-slate-900">
                {entry.hsnCode || '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Quantity</dt>
              <dd className="text-right font-medium text-slate-900">
                {entry.quantity != null ? entry.quantity : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Rate</dt>
              <dd className="text-right font-medium text-slate-900">
                {entry.rate != null ? formatCurrency(Number(entry.rate)) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Amount</dt>
              <dd className="text-right font-semibold text-slate-900">
                {entry.amount != null
                  ? formatCurrency(Number(entry.amount))
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Premium</dt>
              <dd className="text-right font-medium text-slate-900">
                {entry.premiumAmount != null
                  ? formatCurrency(Number(entry.premiumAmount))
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Source</dt>
              <dd className="text-right font-medium text-slate-900">
                {entry.sourceSurface || '—'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Documents
        </h3>
        <div className="flex flex-wrap gap-2">
          {entry.pdfUrl ? (
            <a
              href={entry.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              Invoice PDF
            </a>
          ) : (
            <span className="text-xs text-slate-500">No invoice PDF</span>
          )}
          {(entry.weighmentSlipUrls || []).map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Weighment slip
            </a>
          ))}
        </div>
        {entry.weighmentSlipNote && (
          <p className="mt-2 text-xs text-slate-500">
            Note: {entry.weighmentSlipNote}
          </p>
        )}
      </section>

      <p className="text-xs text-slate-400">
        Captured by DB delete audit · deleted by{' '}
        <code>{entry.deletedByDbUser || 'unknown'}</code>
        {entry.restoredAt
          ? ` · restored ${formatDateOnly(entry.restoredAt)} ${formatTimeOnly(entry.restoredAt)}`
          : ''}
      </p>
    </div>
  );
}
