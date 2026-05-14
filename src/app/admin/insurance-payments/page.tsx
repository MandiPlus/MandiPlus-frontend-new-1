'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
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
const REPORT_PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'monthly', label: 'Monthly Report' },
  { value: 'quarterly', label: 'Quarterly Report' },
  { value: 'annual', label: 'Annual Report' },
] as const;
const ITEMS_PER_PAGE = 20;
const FETCH_LIMIT = 500;

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function openPdfInNewTab(url?: string | null) {
  if (!url) return;
  if (typeof window === 'undefined') return;
  window.open(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, '_blank', 'noopener,noreferrer');
}

function normalizePhoneInput(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getOrdinalDay(day: number) {
  const remainder10 = day % 10;
  const remainder100 = day % 100;

  if (remainder10 === 1 && remainder100 !== 11) return `${day}st`;
  if (remainder10 === 2 && remainder100 !== 12) return `${day}nd`;
  if (remainder10 === 3 && remainder100 !== 13) return `${day}rd`;
  return `${day}th`;
}

function formatDateForReportFileName(
  date: Date,
  options?: { includeYear?: boolean },
) {
  const monthName = date.toLocaleString('en-IN', { month: 'long' }).toLowerCase();
  const dayLabel = getOrdinalDay(date.getDate());

  if (options?.includeYear) {
    return `${dayLabel} ${monthName} ${date.getFullYear()}`;
  }

  return `${dayLabel} ${monthName}`;
}

function getReportDateRange(period: (typeof REPORT_PERIOD_OPTIONS)[number]['value']) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (period === 'daily') {
    start.setDate(start.getDate() - 1);
    return {
      fromDate: formatDateForInput(start),
      toDate: formatDateForInput(end),
    };
  }

  if (period === 'weekly') {
    start.setDate(start.getDate() - 6);
    return {
      fromDate: formatDateForInput(start),
      toDate: formatDateForInput(end),
    };
  }

  if (period === 'monthly') {
    start.setMonth(start.getMonth() - 1);
    start.setDate(start.getDate() + 1);
    return {
      fromDate: formatDateForInput(start),
      toDate: formatDateForInput(end),
    };
  }

  if (period === 'quarterly') {
    start.setMonth(start.getMonth() - 3);
    start.setDate(start.getDate() + 1);
    return {
      fromDate: formatDateForInput(start),
      toDate: formatDateForInput(end),
    };
  }

  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() + 1);
  return {
    fromDate: formatDateForInput(start),
    toDate: formatDateForInput(end),
  };
}

function getPresetReportFileName(
  period: (typeof REPORT_PERIOD_OPTIONS)[number]['value'],
  fromDate: string,
  toDate: string,
) {
  const start = new Date(fromDate);
  const end = new Date(toDate);

  if (period === 'daily') {
    const day = String(start.getDate()).padStart(2, '0');
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const year = start.getFullYear();
    return `daily payment report-${day}-${month}-${year}.xlsx`;
  }

  const includeYear = period === 'annual';
  const startLabel = formatDateForReportFileName(start, { includeYear });
  const endLabel = formatDateForReportFileName(end, { includeYear });

  return `${period} payment report-${startLabel} to ${endLabel}.xlsx`;
}

export default function AdminInsurancePaymentsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [rows, setRows] = useState<InsurancePaymentRow[]>([]);
  const [productOptionRows, setProductOptionRows] = useState<InsurancePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sendingAllReminders, setSendingAllReminders] = useState(false);
  const [error, setError] = useState('');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDateInputType, setFromDateInputType] = useState<'text' | 'date'>('text');
  const [toDateInputType, setToDateInputType] = useState<'text' | 'date'>('text');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [productName, setProductName] = useState('');
  const [reportPeriod, setReportPeriod] =
    useState<(typeof REPORT_PERIOD_OPTIONS)[number]['value']>('daily');
  const [nameQuery, setNameQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('1');

  const [editing, setEditing] = useState<InsurancePaymentRow | null>(null);
  const [reminderTarget, setReminderTarget] = useState<InsurancePaymentRow | null>(
    null,
  );
  const [reminderPhone, setReminderPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [remindingInvoiceIds, setRemindingInvoiceIds] = useState<
    Record<string, boolean>
  >({});
  const [paymentCompletedInputType, setPaymentCompletedInputType] = useState<'text' | 'datetime-local'>('text');
  const [form, setForm] = useState<UpdateInsurancePaymentPayload>({});

  const fetchAllRowsForFilters = useCallback(async () => {
    const collected: InsurancePaymentRow[] = [];
    let page = 1;
    let pages = 1;

    do {
      const response = await adminApi.getInsurancePayments({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        paymentStatus: paymentStatus || undefined,
        productName: productName || undefined,
        page,
        limit: FETCH_LIMIT,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to load insurance payments');
      }

      const chunk = Array.isArray(response.data) ? response.data : [];
      collected.push(...chunk);
      pages = Math.max(1, Number(response.totalPages || 1));
      page += 1;
    } while (page <= pages);

    return collected;
  }, [fromDate, toDate, paymentStatus, productName]);

  const fetchRowsForProductOptions = useCallback(async () => {
    const collected: InsurancePaymentRow[] = [];
    let page = 1;
    let pages = 1;

    do {
      const response = await adminApi.getInsurancePayments({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        paymentStatus: paymentStatus || undefined,
        page,
        limit: FETCH_LIMIT,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to load insurance payments');
      }

      const chunk = Array.isArray(response.data) ? response.data : [];
      collected.push(...chunk);
      pages = Math.max(1, Number(response.totalPages || 1));
      page += 1;
    } while (page <= pages);

    return collected;
  }, [fromDate, toDate, paymentStatus]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [allRows, allProductRows] = await Promise.all([
        fetchAllRowsForFilters(),
        fetchRowsForProductOptions(),
      ]);
      setRows(allRows);
      setProductOptionRows(allProductRows);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load insurance payments'));
      setRows([]);
      setProductOptionRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetchAllRowsForFilters, fetchRowsForProductOptions]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    fetchRows();
  }, [isAuthenticated, router, fetchRows]);

  const filteredRows = useMemo(() => {
    const query = nameQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const haystack = `${row.buyer || ''} ${row.insuredPerson || ''} ${row.supplier || ''} ${row.invoiceNumber || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, nameQuery]);

  const productOptions = useMemo(() => {
    return [
      ...new Set(
        productOptionRows
          .map((row) => String(row.productName || '').trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [productOptionRows]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / ITEMS_PER_PAGE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const totalPremium = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.premiumAmount || 0), 0),
    [filteredRows],
  );

  const totalPayment = useMemo(
    () => filteredRows.reduce((sum, row) => sum + getEffectivePaidAmount(row), 0),
    [filteredRows],
  );
  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalRows);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setJumpPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [nameQuery]);

  const exportToExcel = () => {
    setExporting(true);

    adminApi
      .exportInsurancePayments({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        paymentStatus: paymentStatus || undefined,
        productName: productName || undefined,
        searchQuery: nameQuery.trim() || undefined,
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `insurance-payments-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err: unknown) => {
        alert(getErrorMessage(err, 'Failed to export insurance payments'));
      })
      .finally(() => {
        setExporting(false);
      });
  };

  const exportPresetReport = () => {
    const { fromDate: presetFromDate, toDate: presetToDate } =
      getReportDateRange(reportPeriod);

    setExporting(true);

    adminApi
      .exportInsurancePayments({
        fromDate: presetFromDate,
        toDate: presetToDate,
        paymentStatus: paymentStatus || undefined,
        productName: productName || undefined,
        searchQuery: nameQuery.trim() || undefined,
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = getPresetReportFileName(
          reportPeriod,
          presetFromDate,
          presetToDate,
        );
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err: unknown) => {
        alert(getErrorMessage(err, 'Failed to export insurance payments report'));
      })
      .finally(() => {
        setExporting(false);
      });
  };

  const sendReminderToAllPending = async () => {
    const pendingRows = filteredRows.filter(
      (row) =>
        Boolean(row.isPaymentRequired) &&
        String(row.paymentStatus || '').toUpperCase() === 'PENDING',
    );

    if (pendingRows.length === 0) {
      toast.info('No pending payments found for reminder');
      return;
    }

    setSendingAllReminders(true);
    let sentCount = 0;
    let failedCount = 0;

    try {
      for (const row of pendingRows) {
        setRemindingInvoiceIds((prev) => ({ ...prev, [row.invoiceId]: true }));
        try {
          const response = await adminApi.sendPaymentReminderForInvoice(
            row.invoiceId,
            row.recipientPhone,
          );
          if (!response.success) {
            throw new Error(response.message || 'Failed to send payment reminder');
          }
          sentCount += 1;
        } catch {
          failedCount += 1;
        } finally {
          setRemindingInvoiceIds((prev) => ({
            ...prev,
            [row.invoiceId]: false,
          }));
        }
      }

      if (failedCount === 0) {
        toast.success(`Payment reminders sent for ${sentCount} invoices`);
      } else if (sentCount === 0) {
        toast.error('Failed to send payment reminders');
      } else {
        toast.warn(
          `Payment reminders sent for ${sentCount} invoices, failed for ${failedCount}`,
        );
      }

      await fetchRows();
    } finally {
      setSendingAllReminders(false);
    }
  };

  const openEditModal = (row: InsurancePaymentRow) => {
    const premiumAmount = Number(row.premiumAmount || 0);
    const paymentCompletedValue = toInputDateTimeLocal(row.paymentCompletedAt);
    setPaymentCompletedInputType(paymentCompletedValue ? 'datetime-local' : 'text');
    setEditing(row);
    setForm({
      premiumAmount,
      paymentAmount: premiumAmount,
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
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to update insurance payment'));
    } finally {
      setSaving(false);
    }
  };

  const openReminderModal = (row: InsurancePaymentRow) => {
    setReminderTarget(row);
    setReminderPhone(normalizePhoneInput(row.recipientPhone));
  };

  const closeReminderModal = () => {
    setReminderTarget(null);
    setReminderPhone('');
  };

  const sendReminder = async () => {
    if (!reminderTarget) return;
    const normalizedPhone = normalizePhoneInput(reminderPhone);
    if (!normalizedPhone) {
      toast.error('Please enter a mobile number');
      return;
    }

    setRemindingInvoiceIds((prev) => ({
      ...prev,
      [reminderTarget.invoiceId]: true,
    }));
    try {
      const response = await adminApi.sendPaymentReminderForInvoice(
        reminderTarget.invoiceId,
        normalizedPhone,
      );
      if (!response.success) {
        throw new Error(response.message || 'Failed to send payment reminder');
      }

      toast.success(`Payment reminder sent for ${reminderTarget.invoiceNumber}`);
      closeReminderModal();
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to send payment reminder'));
    } finally {
      setRemindingInvoiceIds((prev) => ({
        ...prev,
        [reminderTarget.invoiceId]: false,
      }));
    }
  };

  return (
    <div className="py-6">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
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
            <select
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Products</option>
              {productOptions.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search by name / invoice"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={exportToExcel}
              disabled={exporting}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
                setFromDateInputType('text');
                setToDateInputType('text');
                setPaymentStatus('');
                setProductName('');
                setNameQuery('');
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset Filters
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
              Report Downloads
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
              <div className="md:col-span-2">
                <select
                  value={reportPeriod}
                  onChange={(e) =>
                    setReportPeriod(
                      e.target.value as (typeof REPORT_PERIOD_OPTIONS)[number]['value'],
                    )
                  }
                  className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-sky-900"
                >
                  {REPORT_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={exportPresetReport}
                  disabled={exporting}
                  className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {exporting ? 'Exporting...' : 'Download Report'}
                </button>
              </div>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={sendReminderToAllPending}
                  disabled={sendingAllReminders}
                  className="w-full rounded-md bg-[#4309ac] px-3 py-2 text-sm font-semibold text-white hover:bg-[#35088a] disabled:opacity-60"
                >
                  {sendingAllReminders
                    ? 'Sending Reminders...'
                    : 'Send Payment Reminder to All'}
                </button>
              </div>
            </div>
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
                    Invoice Date
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Insured Person
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
                      colSpan={9}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Loading insurance payments...
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-gray-900">{row.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.insuredPerson || row.buyer || '-'}
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
                        <div className="flex flex-wrap justify-end gap-2">
                          {row.pdfUrl ? (
                            <button
                              type="button"
                              onClick={() => openPdfInNewTab(row.pdfUrl)}
                              className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                            >
                              View Invoice
                            </button>
                          ) : null}
                          {row.paymentReceiptUrl ? (
                            <button
                              type="button"
                              onClick={() => openPdfInNewTab(row.paymentReceiptUrl)}
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              View Receipt
                            </button>
                          ) : null}
                          {Boolean(row.isPaymentRequired) &&
                          String(row.paymentStatus || '').toUpperCase() === 'PENDING' ? (
                            <button
                              type="button"
                              onClick={() => openReminderModal(row)}
                              disabled={Boolean(remindingInvoiceIds[row.invoiceId])}
                              className="rounded-md bg-[#4309ac] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#35088a] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {remindingInvoiceIds[row.invoiceId]
                                ? 'Sending...'
                                : 'Send Reminder'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        </div>
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
                  readOnly
                  disabled
                  className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500"
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

      {reminderTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Send Reminder: {reminderTarget.invoiceNumber}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              This number will be used for the reminder and saved as the latest
              reminder number for this invoice.
            </p>

            <label className="mt-4 block text-sm text-gray-700">
              Mobile Number
              <input
                type="text"
                value={reminderPhone}
                onChange={(e) => setReminderPhone(e.target.value)}
                placeholder="Enter mobile number"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeReminderModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={Boolean(remindingInvoiceIds[reminderTarget.invoiceId])}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendReminder}
                disabled={Boolean(remindingInvoiceIds[reminderTarget.invoiceId])}
                className="rounded-md bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#35088a] disabled:opacity-60"
              >
                {remindingInvoiceIds[reminderTarget.invoiceId]
                  ? 'Sending...'
                  : 'Send Reminder'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
