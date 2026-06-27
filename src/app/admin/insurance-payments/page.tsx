'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import {
  CheckCheck,
  CircleCheck,
  FileText,
  Link2,
  Pencil,
  ReceiptText,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import {
  InsurancePaymentRow,
  UpdateInsurancePaymentPayload,
  adminApi,
} from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';
import AsyncSearchableSelect from '@/features/admin/components/AsyncSearchableSelect';
import { itemsData } from '@/features/insurance/productCatalog';

const PAYMENT_STATUS_OPTIONS = [
  'PENDING',
  'PAID',
  'PARTIAL',
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
  'NONE',
] as const;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BULK: 'Bulk',
  CREDIT: 'Credit',
  PER_POLICY: 'Per Policy',
  CASH: 'Cash',
  GCA: 'GCA',
  WALLET: 'Wallet',
  NONE: '- (No Method)',
};
const REPORT_PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'monthly', label: 'Monthly Report' },
  { value: 'quarterly', label: 'Quarterly Report' },
  { value: 'annual', label: 'Annual Report' },
] as const;
const EXPORT_REPORT_TYPE_OPTIONS = [
  { value: 'PAYMENT_DETAILS', label: 'Payment Details' },
  { value: 'USER_WISE_DETAILS', label: 'User-wise Details' },
] as const;
const ITEMS_PER_PAGE = 20;

type InsurancePaymentsExportParams = NonNullable<
  Parameters<typeof adminApi.exportInsurancePayments>[0]
> & {
  userId?: string;
  reportType?: (typeof EXPORT_REPORT_TYPE_OPTIONS)[number]['value'];
};

function getPaymentStatusBadgeClasses(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'PENDING') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (normalized === 'PARTIAL') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
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
  if (row.paymentStatus !== 'PAID' && row.paymentStatus !== 'PARTIAL') return 0;
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

function getDaysOverdue(row: InsurancePaymentRow): number | null {
  const status = String(row.paymentStatus || '').toUpperCase();
  if (status === 'PAID' || status === 'NOT_REQUIRED' || status === 'REFUNDED') return null;
  const created = new Date(row.createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getDaysOverdueClasses(days: number | null): string {
  if (days === null) return '';
  if (days >= 60) return 'text-red-700 bg-red-50 border-red-200';
  if (days >= 30) return 'text-orange-700 bg-orange-50 border-orange-200';
  if (days >= 15) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
}

function getDaysOverdueLabel(days: number | null): string {
  if (days === null) return '-';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
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

function normalizeDateForApi(value?: string | null) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return undefined;

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return rawValue;

  const dayFirstMatch = rawValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return rawValue;
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
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [generatingAccumulatedLink, setGeneratingAccumulatedLink] = useState(false);
  const [generatingSummaryImage, setGeneratingSummaryImage] = useState(false);
  const [bulkMarkingPaid, setBulkMarkingPaid] = useState(false);
  const [error, setError] = useState('');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDateInputType, setFromDateInputType] = useState<'text' | 'date'>('text');
  const [toDateInputType, setToDateInputType] = useState<'text' | 'date'>('text');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<Set<string>>(() => new Set());
  const [methodDropdownOpen, setMethodDropdownOpen] = useState(false);
  const methodDropdownRef = useRef<HTMLDivElement>(null);
  const [productName, setProductName] = useState('');
  const [reportPeriod, setReportPeriod] =
    useState<(typeof REPORT_PERIOD_OPTIONS)[number]['value']>('daily');
  const [exportReportType, setExportReportType] =
    useState<(typeof EXPORT_REPORT_TYPE_OPTIONS)[number]['value']>('PAYMENT_DETAILS');
  const [nameQuery, setNameQuery] = useState('');
  const [debouncedNameQuery, setDebouncedNameQuery] = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [debouncedSupplierQuery, setDebouncedSupplierQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('1');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedRowsById, setSelectedRowsById] = useState<
    Record<string, InsurancePaymentRow>
  >({});

  const [editing, setEditing] = useState<InsurancePaymentRow | null>(null);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkForm, setBulkForm] = useState<{
    paymentStatus?: string;
    paymentMethod?: string | null;
    paymentCompletedAt?: string | null;
    remarks?: string | null;
    isPaymentRequired?: boolean;
  }>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkPaymentCompletedInputType, setBulkPaymentCompletedInputType] = useState<'text' | 'datetime-local'>('text');
  const [reminderTarget, setReminderTarget] = useState<InsurancePaymentRow | null>(
    null,
  );
  const [reminderPhone, setReminderPhone] = useState('');
  const [accumulatedLinkModal, setAccumulatedLinkModal] = useState<{
    invoiceIds: string[];
    paymentLink: string;
    phoneNumber: string;
    invoiceLabel: string;
    invoiceCount: number;
    totalAmount: number;
  } | null>(null);
  const [sendingAccumulatedLink, setSendingAccumulatedLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remindingInvoiceIds, setRemindingInvoiceIds] = useState<
    Record<string, boolean>
  >({});
  const [paymentCompletedInputType, setPaymentCompletedInputType] = useState<'text' | 'datetime-local'>('text');
  const [form, setForm] = useState<UpdateInsurancePaymentPayload>({});

  const [overdueDaysInput, setOverdueDaysInput] = useState('');
  const [minAmountInput, setMinAmountInput] = useState('');
  const [debouncedOverdueDays, setDebouncedOverdueDays] = useState('');
  const [debouncedMinAmount, setDebouncedMinAmount] = useState('');
  const [markingPaidInlineIds, setMarkingPaidInlineIds] = useState<Record<string, boolean>>({});

  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [summaryStats, setSummaryStats] = useState({ totalPremium: 0, totalPaid: 0, totalPending: 0, paidToday: 0, paidFromWallet: 0 });

  const paymentMethodFilterKey = Array.from(paymentMethodFilter).sort().join(',');
  const paymentMethodParams = useMemo(() => {
    if (paymentMethodFilter.size === 0) return {};
    if (paymentMethodFilter.size === PAYMENT_METHOD_OPTIONS.length) return {};
    const selected = Array.from(paymentMethodFilter);
    const excluded = PAYMENT_METHOD_OPTIONS.filter((m) => !paymentMethodFilter.has(m));
    if (selected.length === 1 && selected[0] !== 'NONE') {
      return { paymentMethod: selected[0] };
    }
    if (excluded.length === 1 && excluded[0] !== 'NONE') {
      return { excludePaymentMethod: excluded[0] };
    }
    return { paymentMethods: selected.join(',') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethodFilterKey]);

  const effectivePaymentStatus = useMemo(() => {
    if (paymentStatus) return paymentStatus;
    if (Number(debouncedOverdueDays) > 0 || Number(debouncedMinAmount) > 0) return 'PENDING';
    return '';
  }, [paymentStatus, debouncedOverdueDays, debouncedMinAmount]);

  const effectiveToDate = useMemo(() => {
    if (toDate) return toDate;
    const days = Number(debouncedOverdueDays);
    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return formatDateForInput(cutoff);
    }
    return '';
  }, [toDate, debouncedOverdueDays]);

  const fetchPage = useCallback(
    async (pageNum: number) => {
      const response = await adminApi.getInsurancePayments({
        fromDate: normalizeDateForApi(fromDate),
        toDate: normalizeDateForApi(effectiveToDate),
        paymentStatus: effectivePaymentStatus || undefined,
        ...paymentMethodParams,
        productName: productName || undefined,
        searchQuery: debouncedNameQuery.trim() || undefined,
        supplierQuery: debouncedSupplierQuery.trim() || undefined,
        userId: selectedUserId || undefined,
        page: pageNum,
        limit: ITEMS_PER_PAGE,
      });
      if (!response.success) {
        throw new Error(response.message || 'Failed to load insurance payments');
      }
      return response;
    },
    [fromDate, effectiveToDate, effectivePaymentStatus, paymentMethodParams, productName, debouncedNameQuery, debouncedSupplierQuery, selectedUserId],
  );

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const baseFilters = {
        fromDate: normalizeDateForApi(fromDate),
        toDate: normalizeDateForApi(effectiveToDate),
        productName: productName || undefined,
        paymentStatus: effectivePaymentStatus || undefined,
        ...paymentMethodParams,
        searchQuery: debouncedNameQuery.trim() || undefined,
        supplierQuery: debouncedSupplierQuery.trim() || undefined,
      };
      const [pageResponse, summaryResponse] = await Promise.all([
        fetchPage(currentPage),
        adminApi.getInsurancePaymentsSummary({
          ...baseFilters,
          userId: selectedUserId || undefined,
        }),
      ]);
      setRows(Array.isArray(pageResponse.data) ? pageResponse.data : []);
      setServerTotal(Number(pageResponse.total) || 0);
      setServerTotalPages(Math.max(1, Number(pageResponse.totalPages) || 1));
      if (summaryResponse.success) {
        setSummaryStats({
          totalPremium: summaryResponse.totalPremium || 0,
          totalPaid: summaryResponse.totalPaid || 0,
          totalPending: summaryResponse.totalPending || 0,
          paidToday: summaryResponse.paidToday || 0,
          paidFromWallet: summaryResponse.paidFromWallet || 0,
        });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load insurance payments'));
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, currentPage, fromDate, toDate, productName, paymentStatus, paymentMethodFilterKey, debouncedNameQuery, debouncedSupplierQuery, selectedUserId, debouncedOverdueDays, debouncedMinAmount]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    fetchRows();
  }, [isAuthenticated, router, fetchRows]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (methodDropdownRef.current && !methodDropdownRef.current.contains(e.target as Node)) {
        setMethodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const filteredRows = useMemo(() => {
    const minAmt = Number(debouncedMinAmount) || 0;
    if (minAmt <= 0) return rows;
    return rows.filter((row) => Number(row.premiumAmount || 0) >= minAmt);
  }, [rows, debouncedMinAmount]);

  const productOptions = useMemo(() => {
    const catalogProducts = itemsData.map((item) => item.name);
    const rowProducts = rows
      .map((row) => String(row.productName || '').trim())
      .filter(Boolean);
    return [...new Set([...catalogProducts, ...rowProducts])];
  }, [rows]);

  const totalRows = serverTotal;
  const totalPages = serverTotalPages;
  const paginatedRows = filteredRows;

  const totalPremium = summaryStats.totalPremium;
  const totalPayment = summaryStats.totalPaid;
  const totalPendingPayment = summaryStats.totalPending;
  const paymentReceivedToday = summaryStats.paidToday;
  const paidFromWallet = summaryStats.paidFromWallet;
  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalRows);
  const selectedRows = useMemo(
    () =>
      Array.from(selectedInvoiceIds)
        .map((invoiceId) => selectedRowsById[invoiceId])
        .filter((row): row is InsurancePaymentRow => Boolean(row)),
    [selectedInvoiceIds, selectedRowsById],
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
  const pageSelectableRows = useMemo(
    () =>
      paginatedRows.filter(
        (row) =>
          String(row.paymentStatus || '').toUpperCase() !== 'PAID' &&
          Number(row.premiumAmount || 0) > 0,
      ),
    [paginatedRows],
  );
  const allPageRowsSelected =
    pageSelectableRows.length > 0 &&
    pageSelectableRows.every((row) => selectedInvoiceIds.has(row.invoiceId));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setJumpPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    setSelectedInvoiceIds(new Set());
    setSelectedRowsById({});
  }, [
    fromDate,
    effectiveToDate,
    effectivePaymentStatus,
    paymentMethodFilterKey,
    productName,
    debouncedNameQuery,
    debouncedSupplierQuery,
    selectedUserId,
    debouncedOverdueDays,
    debouncedMinAmount,
  ]);

  useEffect(() => {
    setCurrentPage(1);
    const timer = setTimeout(() => setDebouncedNameQuery(nameQuery), 400);
    return () => clearTimeout(timer);
  }, [nameQuery]);

  useEffect(() => {
    setCurrentPage(1);
    const timer = setTimeout(() => setDebouncedSupplierQuery(supplierQuery), 400);
    return () => clearTimeout(timer);
  }, [supplierQuery]);

  useEffect(() => {
    setCurrentPage(1);
    const timer = setTimeout(() => setDebouncedOverdueDays(overdueDaysInput), 500);
    return () => clearTimeout(timer);
  }, [overdueDaysInput]);

  useEffect(() => {
    setCurrentPage(1);
    const timer = setTimeout(() => setDebouncedMinAmount(minAmountInput), 500);
    return () => clearTimeout(timer);
  }, [minAmountInput]);

  useEffect(() => {
    setSelectedRowsById((prev) => {
      const next = { ...prev };
      for (const row of filteredRows) {
        if (selectedInvoiceIds.has(row.invoiceId)) {
          next[row.invoiceId] = row;
        }
      }
      return next;
    });
  }, [filteredRows, selectedInvoiceIds]);

  const toggleInvoiceSelection = (row: InsurancePaymentRow, checked: boolean) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(row.invoiceId);
      } else {
        next.delete(row.invoiceId);
      }
      return next;
    });
    setSelectedRowsById((prev) => {
      const next = { ...prev };
      if (checked) {
        next[row.invoiceId] = row;
      } else {
        delete next[row.invoiceId];
      }
      return next;
    });
  };

  const selectAllMatchingRows = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getInsurancePayments({
        fromDate: normalizeDateForApi(fromDate),
        toDate: normalizeDateForApi(effectiveToDate),
        paymentStatus: effectivePaymentStatus || undefined,
        ...paymentMethodParams,
        productName: productName || undefined,
        searchQuery: debouncedNameQuery.trim() || undefined,
        supplierQuery: debouncedSupplierQuery.trim() || undefined,
        userId: selectedUserId || undefined,
        page: 1,
        limit: Math.max(serverTotal || ITEMS_PER_PAGE, ITEMS_PER_PAGE),
      });
      if (!response.success) {
        throw new Error(response.message || 'Failed to select payments');
      }
      const allRows = Array.isArray(response.data) ? response.data : [];
      const minAmt = Number(debouncedMinAmount) || 0;
      const selectableRows = allRows.filter(
        (row) =>
          String(row.paymentStatus || '').toUpperCase() !== 'PAID' &&
          Number(row.premiumAmount || 0) > 0 &&
          (minAmt <= 0 || Number(row.premiumAmount || 0) >= minAmt),
      );
      setSelectedInvoiceIds(new Set(selectableRows.map((row) => row.invoiceId)));
      setSelectedRowsById(
        selectableRows.reduce<Record<string, InsurancePaymentRow>>((acc, row) => {
          acc[row.invoiceId] = row;
          return acc;
        }, {}),
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to select payments'));
    } finally {
      setLoading(false);
    }
  };

  const toggleAllSelection = (checked: boolean) => {
    if (!checked) {
      setSelectedInvoiceIds(new Set());
      setSelectedRowsById({});
      return;
    }
    void selectAllMatchingRows();
  };

  const generateAccumulatedPaymentLink = async () => {
    if (selectedPendingRows.length === 0) {
      toast.error('Select at least one unpaid invoice');
      return;
    }

    const selectedSnapshot = selectedPendingRows;
    setGeneratingAccumulatedLink(true);
    try {
      const response = await adminApi.generateAccumulatedPaymentLink(
        selectedSnapshot.map((row) => row.invoiceId),
      );
      if (!response.success) {
        throw new Error(response.message || 'Failed to generate payment link');
      }

      const responsePayload = response as typeof response & { paymentLink?: string };
      const paymentLink = responsePayload.paymentLink || response.data?.paymentLink;
      if (!paymentLink) {
        throw new Error('Payment link was not returned');
      }

      const firstRow = selectedSnapshot[0];
      setAccumulatedLinkModal({
        invoiceIds: selectedSnapshot.map((row) => row.invoiceId),
        paymentLink,
        phoneNumber: normalizePhoneInput(firstRow?.recipientPhone),
        invoiceLabel:
          selectedSnapshot.length === 1
            ? firstRow.invoiceNumber
            : `${firstRow.invoiceNumber} + ${selectedSnapshot.length - 1} more`,
        invoiceCount: selectedSnapshot.length,
        totalAmount: selectedSnapshot.reduce(
          (sum, row) => sum + Number(row.premiumAmount || 0),
          0,
        ),
      });
      toast.success('Accumulated payment link generated');
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to generate payment link'));
    } finally {
      setGeneratingAccumulatedLink(false);
    }
  };

  const closeAccumulatedLinkModal = () => {
    setAccumulatedLinkModal(null);
    setSendingAccumulatedLink(false);
  };

  const sendAccumulatedPaymentLink = async () => {
    if (!accumulatedLinkModal) return;
    const normalizedPhone = normalizePhoneInput(accumulatedLinkModal.phoneNumber);
    if (!normalizedPhone) {
      toast.error('Please enter a mobile number');
      return;
    }

    setSendingAccumulatedLink(true);
    try {
      const response = await adminApi.sendAccumulatedPaymentLink(
        accumulatedLinkModal.invoiceIds,
        accumulatedLinkModal.paymentLink,
        normalizedPhone,
      );
      if (!response.success) {
        throw new Error(response.message || 'Failed to send accumulated payment link');
      }

      toast.success('Accumulated payment link sent on WhatsApp');
      setSelectedInvoiceIds(new Set());
      setSelectedRowsById({});
      closeAccumulatedLinkModal();
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to send accumulated payment link'));
    } finally {
      setSendingAccumulatedLink(false);
    }
  };

  const generatePaymentSummaryImage = async () => {
    if (selectedPendingRows.length === 0) {
      toast.error('Select at least one unpaid invoice');
      return;
    }

    setGeneratingSummaryImage(true);
    try {
      const response = await adminApi.generatePaymentSummaryImage(
        selectedPendingRows.map((row) => row.invoiceId),
      );
      const imageUrl =
        (response as typeof response & { imageUrl?: string }).imageUrl ||
        response.data?.imageUrl;

      if (!response.success || !imageUrl) {
        throw new Error(response.message || 'Failed to generate summary image');
      }

      openPdfInNewTab(imageUrl);
      toast.success('Payment summary image generated');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to generate summary image'));
    } finally {
      setGeneratingSummaryImage(false);
    }
  };

  const bulkMarkAsPaid = async () => {
    if (selectedPendingRows.length === 0) {
      toast.error('Select at least one unpaid invoice');
      return;
    }

    const count = selectedPendingRows.length;
    const confirmed = window.confirm(
      `Mark ${count} selected payment${count > 1 ? 's' : ''} as PAID (${formatCurrency(selectedPendingTotal)})?`,
    );
    if (!confirmed) return;

    setBulkMarkingPaid(true);
    try {
      const response = await adminApi.bulkMarkInsurancePaymentsPaid(
        selectedPendingRows.map((row) => row.invoiceId),
      );
      if (!response.success) {
        throw new Error(response.message || 'Failed to mark payments as paid');
      }

      const results = response.data || [];
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount > 0) {
        toast.warn(`${successCount} marked paid, ${failCount} failed`);
      } else {
        toast.success(`${successCount} payment${successCount > 1 ? 's' : ''} marked as paid`);
      }

      setSelectedInvoiceIds(new Set());
      setSelectedRowsById({});
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to mark payments as paid'));
    } finally {
      setBulkMarkingPaid(false);
    }
  };

  const openBulkEditModal = () => {
    setBulkForm({});
    setBulkPaymentCompletedInputType('text');
    setBulkEditing(true);
  };

  const closeBulkEditModal = () => {
    setBulkEditing(false);
    setBulkForm({});
    setBulkPaymentCompletedInputType('text');
  };

  const submitBulkEdit = async () => {
    if (selectedInvoiceIds.size === 0) return;

    const payload: Parameters<typeof adminApi.bulkUpdateInsurancePayments>[0] = {
      invoiceIds: Array.from(selectedInvoiceIds),
    };
    if (bulkForm.paymentStatus) payload.paymentStatus = bulkForm.paymentStatus;
    if (bulkForm.paymentMethod !== undefined) payload.paymentMethod = bulkForm.paymentMethod || null;
    if (bulkForm.paymentCompletedAt !== undefined) payload.paymentCompletedAt = bulkForm.paymentCompletedAt || null;
    if (bulkForm.remarks !== undefined) payload.remarks = bulkForm.remarks || null;
    if (bulkForm.isPaymentRequired !== undefined) payload.isPaymentRequired = bulkForm.isPaymentRequired;

    if (Object.keys(payload).length <= 1) {
      toast.error('Select at least one field to update');
      return;
    }

    const count = selectedInvoiceIds.size;
    const confirmed = window.confirm(
      `Apply changes to ${count} payment${count > 1 ? 's' : ''}?`,
    );
    if (!confirmed) return;

    setBulkSaving(true);
    try {
      const response = await adminApi.bulkUpdateInsurancePayments(payload);
      if (!response.success) {
        throw new Error(response.message || 'Failed to bulk update payments');
      }

      const results = response.data || [];
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount > 0) {
        toast.warn(`${successCount} updated, ${failCount} failed`);
      } else {
        toast.success(`${successCount} payment${successCount > 1 ? 's' : ''} updated`);
      }

      closeBulkEditModal();
      setSelectedInvoiceIds(new Set());
      setSelectedRowsById({});
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to bulk update payments'));
    } finally {
      setBulkSaving(false);
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
    params: InsurancePaymentsExportParams,
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
    const filePrefix =
      exportReportType === 'USER_WISE_DETAILS'
        ? 'insurance-payments-user-wise-details'
        : 'insurance-payments';
    exportWithParams(
      {
        fromDate: normalizeDateForApi(fromDate),
        toDate: normalizeDateForApi(effectiveToDate),
        paymentStatus: effectivePaymentStatus || undefined,
        ...paymentMethodParams,
        productName: productName || undefined,
        searchQuery: nameQuery.trim() || undefined,
        supplierQuery: supplierQuery.trim() || undefined,
        userId: selectedUserId || undefined,
        reportType: exportReportType,
      },
      `${filePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const exportPresetReport = () => {
    const { fromDate: presetFromDate, toDate: presetToDate } =
      getReportDateRange(reportPeriod);
    const exportFromDate = normalizeDateForApi(fromDate) || presetFromDate;
    const exportToDate = normalizeDateForApi(effectiveToDate) || presetToDate;
    exportWithParams(
      {
        fromDate: exportFromDate,
        toDate: exportToDate,
        paymentStatus: paymentStatus || undefined,
        ...paymentMethodParams,
        productName: productName || undefined,
        searchQuery: nameQuery.trim() || undefined,
        supplierQuery: supplierQuery.trim() || undefined,
        userId: selectedUserId || undefined,
        reportType: exportReportType,
      },
      exportReportType === 'USER_WISE_DETAILS'
        ? `user-wise ${getPresetReportFileName(reportPeriod, exportFromDate, exportToDate)}`
        : getPresetReportFileName(reportPeriod, exportFromDate, exportToDate),
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

  const markPaidInline = async (row: InsurancePaymentRow) => {
    const confirmed = window.confirm(
      `Mark ${row.invoiceNumber} as PAID (${formatCurrency(Number(row.premiumAmount || 0))})?`,
    );
    if (!confirmed) return;

    setMarkingPaidInlineIds((prev) => ({ ...prev, [row.invoiceId]: true }));
    try {
      const response = await adminApi.updateInsurancePayment(row.invoiceId, {
        paymentStatus: 'PAID',
        paymentAmount: Number(row.premiumAmount || 0),
        paymentCompletedAt: new Date().toISOString(),
      });
      if (!response.success) {
        throw new Error(response.message || 'Failed to mark as paid');
      }
      toast.success(`${row.invoiceNumber} marked as paid`);
      await fetchRows();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to mark as paid'));
    } finally {
      setMarkingPaidInlineIds((prev) => ({ ...prev, [row.invoiceId]: false }));
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
            <div className="relative" ref={methodDropdownRef}>
              <button
                type="button"
                onClick={() => setMethodDropdownOpen((o) => !o)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm min-w-[140px] text-left flex items-center justify-between gap-1 text-gray-900"
              >
                <span className="truncate">
                  {paymentMethodFilter.size === 0 || paymentMethodFilter.size === PAYMENT_METHOD_OPTIONS.length
                    ? 'All Methods'
                    : `${paymentMethodFilter.size} selected`}
                </span>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {methodDropdownOpen && (
                <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 text-gray-900">
                  <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm font-medium border-b border-gray-100">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={paymentMethodFilter.size === 0 || paymentMethodFilter.size === PAYMENT_METHOD_OPTIONS.length}
                      onChange={() => {
                        setPaymentMethodFilter(new Set());
                        setCurrentPage(1);
                      }}
                    />
                    All Methods
                  </label>
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <label key={method} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={paymentMethodFilter.has(method)}
                        onChange={() => {
                          setPaymentMethodFilter((prev) => {
                            const next = new Set(prev);
                            if (next.has(method)) {
                              next.delete(method);
                            } else {
                              next.add(method);
                            }
                            if (next.size === PAYMENT_METHOD_OPTIONS.length) return new Set();
                            return next;
                          });
                          setCurrentPage(1);
                        }}
                      />
                      {PAYMENT_METHOD_LABELS[method] || method}
                    </label>
                  ))}
                </div>
              )}
            </div>
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
              placeholder="Insured person / invoice"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              className="w-[180px] rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Supplier name"
              value={supplierQuery}
              onChange={(e) => setSupplierQuery(e.target.value)}
              className="w-[160px] rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={exportReportType}
              onChange={(e) =>
                setExportReportType(
                  e.target.value as (typeof EXPORT_REPORT_TYPE_OPTIONS)[number]['value'],
                )
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {EXPORT_REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                setPaymentMethodFilter(new Set());
                setProductName('');
                setNameQuery('');
                setSupplierQuery('');
                setSelectedUserId('');
                setOverdueDaysInput('');
                setMinAmountInput('');
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset Filters
            </button>
            <input
              type="number"
              min="0"
              placeholder="Overdue by days"
              value={overdueDaysInput}
              onChange={(e) => setOverdueDaysInput(e.target.value)}
              className="w-[130px] rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              placeholder="Amount ≥"
              value={minAmountInput}
              onChange={(e) => setMinAmountInput(e.target.value)}
              className="w-[120px] rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
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

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-indigo-700">
              Received from Wallet
            </p>
            <p className="mt-1 text-2xl font-bold text-indigo-900">
              {formatCurrency(paidFromWallet)}
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
                  onClick={() => {
                    setSelectedInvoiceIds(new Set());
                    setSelectedRowsById({});
                  }}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={bulkMarkAsPaid}
                disabled={
                  bulkMarkingPaid || selectedPendingRows.length === 0
                }
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCheck className="h-4 w-4" strokeWidth={2.2} />
                {bulkMarkingPaid
                  ? 'Marking...'
                  : `Mark All Paid${selectedPendingRows.length > 0 ? ` (${selectedPendingRows.length})` : ''}`}
              </button>
              <button
                type="button"
                onClick={openBulkEditModal}
                disabled={selectedInvoiceIds.size === 0}
                className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
                {`Bulk Edit${selectedInvoiceIds.size > 0 ? ` (${selectedInvoiceIds.size})` : ''}`}
              </button>
              <button
                type="button"
                onClick={generatePaymentSummaryImage}
                disabled={generatingSummaryImage || selectedPendingRows.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileText className="h-4 w-4" strokeWidth={2.2} />
                {generatingSummaryImage ? 'Generating...' : 'Summary Image'}
              </button>
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
                      disabled={loading || totalRows === 0}
                      onChange={(e) => toggleAllSelection(e.target.checked)}
                      aria-label="Select all unpaid invoices matching filters"
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
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">
                    Days Overdue
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
                      colSpan={12}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Loading insurance payments...
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
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
                            toggleInvoiceSelection(row, e.target.checked)
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
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const days = getDaysOverdue(row);
                          if (days === null) return <span className="text-gray-400">-</span>;
                          return (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${getDaysOverdueClasses(days)}`}>
                              {getDaysOverdueLabel(days)}
                            </span>
                          );
                        })()}
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
                          ['PENDING', 'PARTIAL'].includes(String(row.paymentStatus || '').toUpperCase()) ? (
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
                          ) : null}
                          {['PENDING', 'PARTIAL'].includes(String(row.paymentStatus || '').toUpperCase()) ? (
                            <button
                              type="button"
                              onClick={() => markPaidInline(row)}
                              disabled={Boolean(markingPaidInlineIds[row.invoiceId])}
                              title="Mark as Paid"
                              aria-label={`Mark ${row.invoiceNumber} as paid`}
                              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {markingPaidInlineIds[row.invoiceId] ? (
                                <span className="text-sm font-bold">...</span>
                              ) : (
                                <>
                                  <CircleCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                                  Paid
                                </>
                              )}
                            </button>
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
                  {PAYMENT_METHOD_OPTIONS.filter((m) => m !== 'NONE').map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method] || method}
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

      {bulkEditing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Bulk Edit ({selectedInvoiceIds.size} payment{selectedInvoiceIds.size > 1 ? 's' : ''})
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Only fields you change will be applied. Leave fields empty to keep their current values.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-gray-700">
                Payment Status
                <select
                  value={bulkForm.paymentStatus || ''}
                  onChange={(e) =>
                    setBulkForm((prev) => ({ ...prev, paymentStatus: e.target.value || undefined }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">— No change —</option>
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
                  value={bulkForm.paymentMethod === undefined ? '__unchanged__' : (bulkForm.paymentMethod || '__clear__')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__unchanged__') {
                      setBulkForm((prev) => {
                        const next = { ...prev };
                        delete next.paymentMethod;
                        return next;
                      });
                    } else if (val === '__clear__') {
                      setBulkForm((prev) => ({ ...prev, paymentMethod: null }));
                    } else {
                      setBulkForm((prev) => ({ ...prev, paymentMethod: val }));
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="__unchanged__">— No change —</option>
                  <option value="__clear__">— Clear method —</option>
                  {PAYMENT_METHOD_OPTIONS.filter((m) => m !== 'NONE').map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method] || method}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-gray-700">
                Payment Completed At
                <input
                  type={bulkPaymentCompletedInputType}
                  placeholder="— No change —"
                  value={bulkForm.paymentCompletedAt || ''}
                  onFocus={() => setBulkPaymentCompletedInputType('datetime-local')}
                  onBlur={() => {
                    if (!bulkForm.paymentCompletedAt) setBulkPaymentCompletedInputType('text');
                  }}
                  onChange={(e) =>
                    setBulkForm((prev) => ({
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
                rows={2}
                placeholder="— No change —"
                value={bulkForm.remarks === undefined ? '' : (bulkForm.remarks || '')}
                onChange={(e) =>
                  setBulkForm((prev) => ({ ...prev, remarks: e.target.value || null }))
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBulkEditModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={bulkSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBulkEdit}
                disabled={bulkSaving}
                className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {bulkSaving ? 'Applying...' : `Apply to ${selectedInvoiceIds.size}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {accumulatedLinkModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Send Accumulated Payment Link
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              The number is prefilled from the selected insured person and can be changed before sending.
            </p>

            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <div className="flex justify-between gap-3">
                <span>Invoices</span>
                <span className="font-semibold text-gray-900">
                  {accumulatedLinkModal.invoiceLabel} ({accumulatedLinkModal.invoiceCount})
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span>Total</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(accumulatedLinkModal.totalAmount)}
                </span>
              </div>
            </div>

            <label className="mt-4 block text-sm text-gray-700">
              WhatsApp Number
              <input
                type="text"
                value={accumulatedLinkModal.phoneNumber}
                onChange={(e) =>
                  setAccumulatedLinkModal((prev) =>
                    prev ? { ...prev, phoneNumber: e.target.value } : prev,
                  )
                }
                placeholder="Enter mobile number"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAccumulatedLinkModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={sendingAccumulatedLink}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendAccumulatedPaymentLink}
                disabled={sendingAccumulatedLink}
                className="rounded-md bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white hover:bg-[#35088a] disabled:opacity-60"
              >
                {sendingAccumulatedLink ? 'Sending...' : 'Send on WhatsApp'}
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
