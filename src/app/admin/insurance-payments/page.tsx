'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  InsurancePaymentRow,
  UpdateInsurancePaymentPayload,
  adminApi,
} from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';

const PAYMENT_STATUS_OPTIONS = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
];
const ITEMS_PER_PAGE = 20;

function getPaymentStatusBadgeClasses(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'PENDING') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (normalized === 'FAILED') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (normalized === 'REFUNDED') {
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }
  if (normalized === 'NOT_REQUIRED') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-red-200 bg-red-50 text-red-700';
}

function formatCurrency(value: number) {
  return `Rs ${Math.round(value || 0).toLocaleString('en-IN')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN');
}

function getEffectivePaidAmount(row: InsurancePaymentRow): number {
  return row.paymentStatus === 'PAID' ? Number(row.paymentAmount || 0) : 0;
}

function getEffectiveBalance(row: InsurancePaymentRow): number {
  const premium = Number(row.premiumAmount || 0);
  const paid = getEffectivePaidAmount(row);
  return Math.max(premium - paid, 0);
}

function toInputDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export default function AdminInsurancePaymentsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [rows, setRows] = useState<InsurancePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDateInputType, setFromDateInputType] = useState<'text' | 'date'>('text');
  const [toDateInputType, setToDateInputType] = useState<'text' | 'date'>('text');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [jumpPageInput, setJumpPageInput] = useState('1');

  const [editing, setEditing] = useState<InsurancePaymentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [paymentCompletedInputType, setPaymentCompletedInputType] = useState<'text' | 'datetime-local'>('text');
  const [form, setForm] = useState<UpdateInsurancePaymentPayload>({});

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.getInsurancePayments({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        paymentStatus: paymentStatus || undefined,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to load insurance payments');
      }
      setRows(response.data || []);
      const resolvedTotalRows = Number(
        response.total ?? response.count ?? (response.data?.length || 0),
      );
      const resolvedLimit = Number(response.limit ?? ITEMS_PER_PAGE);
      const fallbackTotalPages =
        resolvedTotalRows === 0
          ? 1
          : Math.max(1, Math.ceil(resolvedTotalRows / Math.max(resolvedLimit, 1)));

      setTotalRows(resolvedTotalRows);
      setTotalPages(Number(response.totalPages ?? fallbackTotalPages));
      setPageSize(resolvedLimit > 0 ? resolvedLimit : ITEMS_PER_PAGE);
      if (response.page && response.page !== currentPage) {
        setCurrentPage(response.page);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load insurance payments');
      setRows([]);
      setTotalRows(0);
      setTotalPages(1);
      setPageSize(ITEMS_PER_PAGE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    fetchRows();
  }, [isAuthenticated, router, fromDate, toDate, paymentStatus, currentPage]);

  const totalPremium = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.premiumAmount || 0), 0),
    [rows],
  );

  const totalPayment = useMemo(
    () => rows.reduce((sum, row) => sum + getEffectivePaidAmount(row), 0),
    [rows],
  );
  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalRows);

  useEffect(() => {
    setJumpPageInput(String(currentPage));
  }, [currentPage]);

  const openEditModal = (row: InsurancePaymentRow) => {
    const paymentCompletedValue = toInputDateTimeLocal(row.paymentCompletedAt);
    setPaymentCompletedInputType(paymentCompletedValue ? 'datetime-local' : 'text');
    setEditing(row);
    setForm({
      premiumAmount: Number(row.premiumAmount || 0),
      paymentAmount: Number(row.paymentAmount || 0),
      paymentStatus: row.paymentStatus,
      isPaymentRequired: Boolean(row.isPaymentRequired),
      paymentCompletedAt: paymentCompletedValue,
      remarks: row.remarks || '',
    });
  };

  const closeEditModal = () => {
    setEditing(null);
    setPaymentCompletedInputType('text');
    setForm({});
  };

  const submitEdit = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      const payload: UpdateInsurancePaymentPayload = {
        premiumAmount:
          form.premiumAmount === undefined ? undefined : Number(form.premiumAmount),
        paymentAmount:
          form.paymentAmount === undefined ? undefined : Number(form.paymentAmount),
        paymentStatus: form.paymentStatus,
        isPaymentRequired: form.isPaymentRequired,
        paymentCompletedAt: form.paymentCompletedAt || null,
        remarks: form.remarks ?? null,
      };

      const response = await adminApi.updateInsurancePayment(
        editing.invoiceId,
        payload,
      );
      if (!response.success) {
        throw new Error(response.message || 'Failed to update insurance payment');
      }

      closeEditModal();
      await fetchRows();
    } catch (err: any) {
      alert(err?.message || 'Failed to update insurance payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-gray-900">
            Insurance Payments
          </h1>
          
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type={fromDateInputType}
              placeholder="DD-MM-YYYY"
              value={fromDate}
              onFocus={() => setFromDateInputType('date')}
              onBlur={() => {
                if (!fromDate) setFromDateInputType('text');
              }}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type={toDateInputType}
              placeholder="DD-MM-YYYY"
              value={toDate}
              onFocus={() => setToDateInputType('date')}
              onBlur={() => {
                if (!toDate) setToDateInputType('text');
              }}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              {PAYMENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
                setFromDateInputType('text');
                setToDateInputType('text');
                setPaymentStatus('');
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Rows</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totalRows}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Premium Amount
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatCurrency(totalPremium)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Payment Amount
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatCurrency(totalPayment)}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Invoice Number
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Buyer / Insured
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">
                    Premium
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Updated At
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Loading insurance payments...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-gray-900">{row.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.buyer || row.insuredPerson || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(Number(row.premiumAmount || 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(getEffectivePaidAmount(row))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(getEffectiveBalance(row))}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getPaymentStatusBadgeClasses(row.paymentStatus)}`}
                        >
                          {row.paymentStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(row.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && totalRows > 0 ? (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium">{pageStart}</span> to{' '}
                <span className="font-medium">{pageEnd}</span> of{' '}
                <span className="font-medium">{totalRows}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      const targetPage = Number(jumpPageInput);
                      if (!Number.isFinite(targetPage)) return;
                      const safePage = Math.min(
                        Math.max(Math.trunc(targetPage), 1),
                        totalPages,
                      );
                      if (safePage !== currentPage) {
                        setCurrentPage(safePage);
                      } else {
                        setJumpPageInput(String(safePage));
                      }
                    }}
                    className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
                    aria-label="Jump to page"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const targetPage = Number(jumpPageInput);
                      if (!Number.isFinite(targetPage)) return;
                      const safePage = Math.min(
                        Math.max(Math.trunc(targetPage), 1),
                        totalPages,
                      );
                      if (safePage !== currentPage) {
                        setCurrentPage(safePage);
                      } else {
                        setJumpPageInput(String(safePage));
                      }
                    }}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Go
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Edit Payment: {editing.invoiceNumber}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Updating here syncs both insurance_payments and invoices.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-gray-700">
                Premium Amount
                <input
                  type="number"
                  min="0"
                  value={form.premiumAmount ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      premiumAmount: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-gray-700">
                Payment Amount
                <input
                  type="number"
                  min="0"
                  value={form.paymentAmount ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentAmount: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-gray-700">
                Payment Status
                <select
                  value={form.paymentStatus || 'PENDING'}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, paymentStatus: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  {PAYMENT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-gray-700">
                Payment Completed At
                <input
                  type={paymentCompletedInputType}
                  placeholder="DD-MM-YYYY --:--"
                  value={typeof form.paymentCompletedAt === 'string' ? form.paymentCompletedAt : ''}
                  onFocus={() => setPaymentCompletedInputType('datetime-local')}
                  onBlur={() => {
                    if (!form.paymentCompletedAt) setPaymentCompletedInputType('text');
                  }}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentCompletedAt: e.target.value || null,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
            </div>

            <label className="mt-3 block text-sm text-gray-700">
              Remarks
              <textarea
                rows={3}
                value={typeof form.remarks === 'string' ? form.remarks : ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>

            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(form.isPaymentRequired)}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    isPaymentRequired: e.target.checked,
                  }))
                }
              />
              Is Payment Required
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={saving}
                className="rounded-md bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#35088a] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
