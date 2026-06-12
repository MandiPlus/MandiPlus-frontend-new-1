'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import {
  FileText,
  Link2,
  Pencil,
  ReceiptText,
  QrCode,
  CreditCard,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import {
  AdminLedgerUser,
  InsurancePaymentRow,
  UpdateInsurancePaymentPayload,
  adminApi,
} from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';
import SearchableSelect from '@/features/admin/components/SearchableSelect';
import AsyncSearchableSelect from '@/features/admin/components/AsyncSearchableSelect';

const PAYMENT_STATUS_OPTIONS = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
];
const PAYMENT_METHOD_OPTIONS = [
  'BULK',
  'CREDIT',
  'PER_POLICY',
  'CASH',
  'GCA',
  'WALLET',
] as const;
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
  const numericValue = Number(value || 0);
  return `Rs ${numericValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN');
}

function getActionButtonClasses(tone: 'invoice' | 'receipt' | 'reminder' | 'edit') {
  if (tone === 'invoice') {
    return 'border-sky-200 bg-sky-50 text-sky-700 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100';
  }
  if (tone === 'receipt') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100';
  }
  if (tone === 'reminder') {
    return 'border-green-200 bg-green-50 text-green-700 hover:-translate-y-0.5 hover:border-green-300 hover:bg-green-100';
  }
  return 'border-violet-200 bg-violet-50 text-violet-700 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-100';
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function wasPaymentMarkedPaidToday(row: InsurancePaymentRow, referenceDate = new Date()) {
  if (String(row.paymentStatus || '').toUpperCase() !== 'PAID') {
    return false;
  }

  const candidateDate = row.paymentCompletedAt || row.updatedAt;
  if (!candidateDate) {
    return false;
  }

  const parsed = new Date(candidateDate);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return isSameLocalDay(parsed, referenceDate);
}

function getEffectivePaidAmount(row: InsurancePaymentRow): number {
  if (row.paymentStatus !== 'PAID') return 0;
  const paymentAmount = Number(row.paymentAmount || 0);
  const premiumAmount = Number(row.premiumAmount || 0);
  return paymentAmount > 0 ? paymentAmount : premiumAmount;
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
  const [generatingAccumulatedLink, setGeneratingAccumulatedLink] = useState(false);
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [razorpayModalInvoiceId, setRazorpayModalInvoiceId] = useState<string | null>(null);
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [razorpayQrResult, setRazorpayQrResult] = useState<{ qrImageUrl: string; invoiceNumber: string } | null>(null);
  const [razorpayExistingLink, setRazorpayExistingLink] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDateInputType, setFromDateInputType] = useState<'text' | 'date'>('text');
  const [toDateInputType, setToDateInputType] = useState<'text' | 'date'>('text');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [productName, setProductName] = useState('');
  const [reportPeriod, setReportPeriod] =
    useState<(typeof REPORT_PERIOD_OPTIONS)[number]['value']>('daily');
  const [nameQuery, setNameQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('1');
  const [allUsers, setAllUsers] = useState<AdminLedgerUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserInvoiceIds, setSelectedUserInvoiceIds] = useState<Set<string> | null>(null);
  const [loadingUserLedger, setLoadingUserLedger] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(
    () => new Set(),
  );

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

  const fetchAllPages = useCallback(
    async (params: Parameters<typeof adminApi.getInsurancePayments>[0]) => {
      const collected: InsurancePaymentRow[] = [];
      let page = 1;
      let pages = 1;

      do {
        const response = await adminApi.getInsurancePayments({ ...params, page, limit: FETCH_LIMIT });
        if (!response.success) {
          throw new Error(response.message || 'Failed to load insurance payments');
        }
        const chunk = Array.isArray(response.data) ? response.data : [];
        collected.push(...chunk);
        pages = Math.max(1, Number(response.totalPages || 1));
        page += 1;
      } while (page <= pages);

      return collected;
    },
    [],
  );

  const fetchAllRowsForFilters = useCallback(
    () =>
      fetchAllPages({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        paymentStatus: paymentStatus || undefined,
        paymentMethod: paymentMethodFilter || undefined,
        productName: productName || undefined,
        searchQuery: nameQuery.trim() || undefined,
      }),
    [fetchAllPages, fromDate, toDate, paymentStatus, paymentMethodFilter, productName, nameQuery],
  );

  const fetchRowsForProductOptions = useCallback(
    () =>
      fetchAllPages({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        paymentStatus: paymentStatus || undefined,
      }),
    [fetchAllPages, fromDate, toDate, paymentStatus],
  );

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

  const userOptions = useMemo(
    () => [
      { value: '', label: 'All Users', searchText: '' },
      ...allUsers.map((u) => ({
        value: u.id,
        label: `${u.name || ''} | ${u.mobileNumber || ''}`,
        searchText: `${u.name || ''} ${u.mobileNumber || ''} ${(u.aliasNames || []).join(' ')}`,
      })),
    ],
    [allUsers],
  );

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUserInvoiceIds(null);
      return;
    }
    let cancelled = false;
    setLoadingUserLedger(true);
    adminApi.getMasterUserLedger(selectedUserId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        const ids = new Set<string>();
        for (const row of res.data.rows || []) {
          ids.add(row.invoiceId);
          for (const dupId of row.duplicateInvoiceIds || []) {
            ids.add(dupId);
          }
        }
        setSelectedUserInvoiceIds(ids);
      } else {
        setSelectedUserInvoiceIds(new Set());
      }
      setLoadingUserLedger(false);
    });
    return () => { cancelled = true; };
  }, [selectedUserId]);

  const filteredRows = useMemo(() => {
    if (!selectedUserId || !selectedUserInvoiceIds) return rows;
    return rows.filter((row) => selectedUserInvoiceIds.has(row.invoiceId));
  }, [rows, selectedUserId, selectedUserInvoiceIds]);

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

  const totalPendingPayment = useMemo(
    () =>
      filteredRows.reduce((sum, row) => {
        if (String(row.paymentStatus || '').toUpperCase() !== 'PENDING') return sum;
        const balance = Math.max(Number(row.premiumAmount || 0) - Number(row.paymentAmount || 0), 0);
        return sum + balance;
      }, 0),
    [filteredRows],
  );

  const paymentReceivedToday = useMemo(
    () =>
      filteredRows.reduce((sum, row) => {
        if (!wasPaymentMarkedPaidToday(row)) {
          return sum;
        }
        return sum + getEffectivePaidAmount(row);
      }, 0),
    [filteredRows],
  );
  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalRows);
  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedInvoiceIds.has(row.invoiceId)),
    [filteredRows, selectedInvoiceIds],
  );
  const selectedPendingRows = useMemo(
    () =>
      selectedRows.filter(
        (row) =>
          String(row.paymentStatus || '').toUpperCase() !== 'PAID' &&
          Number(row.premiumAmount || 0) > 0,
      ),
    [selectedRows],
  );
  const selectedPendingTotal = useMemo(
    () =>
      selectedPendingRows.reduce(
        (sum, row) => sum + Number(row.premiumAmount || 0),
        0,
      ),
    [selectedPendingRows],
  );
  const allPageRowsSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((row) => selectedInvoiceIds.has(row.invoiceId));

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

  useEffect(() => {
    setSelectedInvoiceIds((prev) => {
      const visibleIds = new Set(filteredRows.map((row) => row.invoiceId));
      const next = new Set(
        Array.from(prev).filter((invoiceId) => visibleIds.has(invoiceId)),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [filteredRows]);

  const toggleInvoiceSelection = (invoiceId: string, checked: boolean) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(invoiceId);
      } else {
        next.delete(invoiceId);
      }
      return next;
    });
  };

  const togglePageSelection = (checked: boolean) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      paginatedRows.forEach((row) => {
        if (checked) {
          next.add(row.invoiceId);
        } else {
          next.delete(row.invoiceId);
        }
      });
      return next;
    });
  };

  const generateAccumulatedPaymentLink = async () => {
    if (selectedPendingRows.length === 0) {
      toast.error('Select at least one unpaid invoice');
      return;
    }

    const insuredPersons = new Set(
      selectedPendingRows.map((row) => (row.insuredPerson || '').trim().toLowerCase()).filter(Boolean),
    );
    if (insuredPersons.size > 1) {
      toast.error('All selected invoices must belong to the same insured person');
      return;
    }

    setGeneratingAccumulatedLink(true);
    try {
      const response = await adminApi.generateAccumulatedPaymentLink(
        selectedPendingRows.map((row) => row.invoiceId),
      );
      if (!response.success) {
        throw new Error(response.message || 'Failed to generate payment link');
      }

      const responsePayload = response as typeof response & { paymentLink?: string };
      const paymentLink = responsePayload.paymentLink || response.data?.paymentLink;
      if (paymentLink && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(paymentLink);
        toast.success('Accumulated payment link copied');
      } else {
        toast.success('Accumulated payment link generated');
      }

      setSelectedInvoiceIds(new Set());
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to generate payment link'));
    } finally {
      setGeneratingAccumulatedLink(false);
    }
  };

  const openRazorpayModal = async (invoiceId: string) => {
    setRazorpayModalInvoiceId(invoiceId);
    setRazorpayModalOpen(true);
    setRazorpayQrResult(null);
    setRazorpayExistingLink(null);
    setRazorpayLoading(true);
    try {
      const res = await adminApi.getRazorpayPaymentStatus(invoiceId);
      const data = res.data || res;
      const invoice = (data as any).invoice;
      if (invoice?.razorpayQrImageUrl) {
        setRazorpayQrResult({ qrImageUrl: invoice.razorpayQrImageUrl, invoiceNumber: invoice.invoiceNumber || '' });
      }
      if (invoice?.paymentGateway === 'RAZORPAY' && invoice?.paymentLinkUrl) {
        setRazorpayExistingLink(invoice.paymentLinkUrl);
      }
    } catch {
      // no existing data, show create options
    } finally {
      setRazorpayLoading(false);
    }
  };

  const closeRazorpayModal = () => {
    setRazorpayModalOpen(false);
    setRazorpayModalInvoiceId(null);
    setRazorpayQrResult(null);
    setRazorpayExistingLink(null);
  };

  const handleRazorpayGenerateLink = async (invoiceId: string) => {
    setRazorpayLoading(true);
    try {
      const response = await adminApi.generateRazorpayPaymentLink(invoiceId);
      const paymentLink = (response as any).paymentLink || response.data?.paymentLink;
      if (!paymentLink) throw new Error(response.message || 'Failed to generate Razorpay link');
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(paymentLink);
        toast.success('Razorpay payment link copied to clipboard');
      }
      setRazorpayExistingLink(paymentLink);
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to generate Razorpay link'));
    } finally {
      setRazorpayLoading(false);
    }
  };

  const handleRazorpayGenerateQR = async (invoiceId: string) => {
    setRazorpayLoading(true);
    try {
      const response = await adminApi.generateRazorpayQRCode(invoiceId);
      const qrImageUrl = (response as any).qrImageUrl || response.data?.qrImageUrl;
      if (!qrImageUrl) throw new Error(response.message || 'Failed to generate QR code');
      const invoiceNumber = (response as any).invoice?.invoiceNumber || '';
      setRazorpayQrResult({ qrImageUrl, invoiceNumber });
      toast.success('QR code generated');
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to generate QR code'));
    } finally {
      setRazorpayLoading(false);
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportWithParams = (
    params: Parameters<typeof adminApi.exportInsurancePayments>[0],
    fileName: string,
  ) => {
    setExporting(true);
    adminApi
      .exportInsurancePayments(params)
      .then((blob) => downloadBlob(blob, fileName))
      .catch((err: unknown) => {
        alert(getErrorMessage(err, 'Failed to export insurance payments'));
      })
      .finally(() => setExporting(false));
  };

  const exportToExcel = () => {
    exportWithParams(
      {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        paymentStatus: paymentStatus || undefined,
        paymentMethod: paymentMethodFilter || undefined,
        productName: productName || undefined,
        searchQuery: nameQuery.trim() || undefined,
      },
      `insurance-payments-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const exportPresetReport = () => {
    const { fromDate: presetFromDate, toDate: presetToDate } =
      getReportDateRange(reportPeriod);
    exportWithParams(
      {
        fromDate: presetFromDate,
        toDate: presetToDate,
        paymentStatus: paymentStatus || undefined,
        paymentMethod: paymentMethodFilter || undefined,
        productName: productName || undefined,
        searchQuery: nameQuery.trim() || undefined,
      },
      getPresetReportFileName(reportPeriod, presetFromDate, presetToDate),
    );
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
      paymentMethod: row.paymentMethod || '',
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
        paymentMethod: form.paymentMethod || null,
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
          <div className="flex flex-wrap items-end gap-3">
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
              className="w-[140px] rounded-md border border-gray-300 px-3 py-2 text-sm"
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
              className="w-[140px] rounded-md border border-gray-300 px-3 py-2 text-sm"
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
              value={paymentMethodFilter}
              onChange={(e) => {
                setPaymentMethodFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Methods</option>
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method} value={method}>
                  {method}
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
            <AsyncSearchableSelect
              label=""
              value={selectedUserId}
              onChange={(val) => {
                setSelectedUserId(val);
                setCurrentPage(1);
              }}
              placeholder="All Users"
              searchPlaceholder="Search by name or phone..."
              className="w-[220px]"
              onSearch={async (q) => {
                const res = await adminApi.searchUsers(q, 100, { verified: true });
                if (!res.success || !Array.isArray(res.data)) return [];
                return [
                  { value: '', label: 'All Users' },
                  ...res.data
                    .map((u) => ({ value: u.id, label: `${u.name || ''} | ${u.mobileNumber || ''}` })),
                ];
              }}
            />
            <input
              type="text"
              placeholder="Search by name / invoice"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              className="w-[180px] rounded-md border border-gray-300 px-3 py-2 text-sm"
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
                setPaymentMethodFilter('');
                setProductName('');
                setNameQuery('');
                setSelectedUserId('');
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
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-600">Rows</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalRows}</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Premium Amount
            </p>
            <p className="mt-1 text-2xl font-bold text-cyan-900">
              {formatCurrency(totalPremium)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-violet-700">
              Payment Received
            </p>
            <p className="mt-1 text-2xl font-bold text-violet-900">
              {formatCurrency(totalPayment)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-amber-700">
              Pending Payment
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {formatCurrency(totalPendingPayment)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-700">
              Payment Received Today
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {formatCurrency(paymentReceivedToday)}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">{selectedPendingRows.length}</span>{' '}
              unpaid selected
              {selectedPendingRows.length > 0 ? (
                <span className="ml-2 text-gray-500">
                  {formatCurrency(selectedPendingTotal)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedInvoiceIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceIds(new Set())}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={generateAccumulatedPaymentLink}
                disabled={
                  generatingAccumulatedLink || selectedPendingRows.length === 0
                }
                className="inline-flex items-center gap-2 rounded-md bg-[#4309ac] px-3 py-2 text-sm font-semibold text-white hover:bg-[#35088a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Link2 className="h-4 w-4" strokeWidth={2.2} />
                {generatingAccumulatedLink
                  ? 'Generating...'
                  : 'Generate Accumulated Link'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={allPageRowsSelected}
                      onChange={(e) => togglePageSelection(e.target.checked)}
                      aria-label="Select all invoices on this page"
                    />
                  </th>
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
                    Payment Method
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
                      colSpan={11}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Loading insurance payments...
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.has(row.invoiceId)}
                          onChange={(e) =>
                            toggleInvoiceSelection(row.invoiceId, e.target.checked)
                          }
                          aria-label={`Select ${row.invoiceNumber}`}
                        />
                      </td>
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
                        {row.paymentMethod === 'WALLET' ? (
                          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                            WALLET
                          </span>
                        ) : (
                          row.paymentMethod || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(row.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex flex-nowrap items-center justify-end gap-2">
                          {row.pdfUrl ? (
                            <button
                              type="button"
                              onClick={() => openPdfInNewTab(row.pdfUrl)}
                              title="View Invoice PDF"
                              aria-label={`View invoice PDF for ${row.invoiceNumber}`}
                              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ${getActionButtonClasses('invoice')}`}
                            >
                              <FileText className="h-4 w-4" strokeWidth={2.2} />
                            </button>
                          ) : null}
                          {row.paymentReceiptUrl ? (
                            <button
                              type="button"
                              onClick={() => openPdfInNewTab(row.paymentReceiptUrl)}
                              title="View Payment Receipt"
                              aria-label={`View payment receipt for ${row.invoiceNumber}`}
                              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ${getActionButtonClasses('receipt')}`}
                            >
                              <ReceiptText className="h-4 w-4" strokeWidth={2.2} />
                            </button>
                          ) : null}
                          {Boolean(row.isPaymentRequired) &&
                          String(row.paymentStatus || '').toUpperCase() === 'PENDING' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openReminderModal(row)}
                                disabled={Boolean(remindingInvoiceIds[row.invoiceId])}
                                title="Send WhatsApp Reminder"
                                aria-label={`Send WhatsApp reminder for ${row.invoiceNumber}`}
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${getActionButtonClasses('reminder')}`}
                              >
                                {remindingInvoiceIds[row.invoiceId] ? (
                                  <span className="text-sm font-bold">...</span>
                                ) : (
                                  <FaWhatsapp className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => openRazorpayModal(row.invoiceId)}
                                title="Razorpay Payment"
                                aria-label={`Razorpay payment for ${row.invoiceNumber}`}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition-all duration-200 hover:bg-blue-100"
                              >
                                <CreditCard className="h-4 w-4" strokeWidth={2.2} />
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            title="Edit Payment"
                            aria-label={`Edit payment details for ${row.invoiceNumber}`}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ${getActionButtonClasses('edit')}`}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2.2} />
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
                Payment Method
                <select
                  value={typeof form.paymentMethod === 'string' ? form.paymentMethod : ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value || null,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">Select payment method</option>
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method} value={method}>
                      {method}
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

      {razorpayModalOpen && razorpayModalInvoiceId && (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeRazorpayModal}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Razorpay Payment</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {razorpayQrResult || razorpayExistingLink ? 'Payment method ready' : 'Choose payment method'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRazorpayModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <div className="px-5 py-5">
              {razorpayLoading && !razorpayQrResult && !razorpayExistingLink ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span className="ml-3 text-sm text-slate-500">Loading...</span>
                </div>
              ) : (
                <>
                  {razorpayExistingLink && (
                    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Link2 className="h-4 w-4 text-green-700" />
                        <span className="text-sm font-semibold text-green-800">Payment Link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={razorpayExistingLink}
                          className="flex-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-slate-700 select-all"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(razorpayExistingLink);
                            toast.success('Link copied');
                          }}
                          className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {razorpayQrResult && (
                    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-3 self-start">
                        <QrCode className="h-4 w-4 text-blue-700" />
                        <span className="text-sm font-semibold text-blue-800">
                          QR Code{razorpayQrResult.invoiceNumber ? ` — ${razorpayQrResult.invoiceNumber}` : ''}
                        </span>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm border border-blue-100">
                        <img
                          src={razorpayQrResult.qrImageUrl}
                          alt="Payment QR Code — right-click to copy or save"
                          className="w-56 h-56 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Right-click the QR to copy or save image</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(razorpayQrResult.qrImageUrl);
                            toast.success('QR image URL copied');
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Copy URL
                        </button>
                        <a
                          href={razorpayQrResult.qrImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                        >
                          Open Full Size
                        </a>
                      </div>
                    </div>
                  )}

                  {!razorpayQrResult && !razorpayExistingLink && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => handleRazorpayGenerateLink(razorpayModalInvoiceId)}
                        disabled={razorpayLoading}
                        className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 hover:border-blue-300 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      >
                        <Link2 className="h-5 w-5 text-blue-600 shrink-0" />
                        <div>
                          <div className="font-semibold">Generate Payment Link</div>
                          <div className="text-xs text-slate-500 mt-0.5">Shareable link via WhatsApp/SMS</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRazorpayGenerateQR(razorpayModalInvoiceId)}
                        disabled={razorpayLoading}
                        className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 hover:border-blue-300 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      >
                        <QrCode className="h-5 w-5 text-blue-600 shrink-0" />
                        <div>
                          <div className="font-semibold">Create QR Code</div>
                          <div className="text-xs text-slate-500 mt-0.5">UPI QR for scan-to-pay (single use)</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {(razorpayQrResult || razorpayExistingLink) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Generate new</p>
                      <div className="flex gap-2">
                        {!razorpayExistingLink && (
                          <button
                            type="button"
                            onClick={() => handleRazorpayGenerateLink(razorpayModalInvoiceId)}
                            disabled={razorpayLoading}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Payment Link
                          </button>
                        )}
                        {!razorpayQrResult && (
                          <button
                            type="button"
                            onClick={() => handleRazorpayGenerateQR(razorpayModalInvoiceId)}
                            disabled={razorpayLoading}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            QR Code
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
