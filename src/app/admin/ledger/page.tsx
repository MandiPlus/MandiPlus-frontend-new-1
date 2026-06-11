'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import {
  AdminLedgerUser,
  AdminMasterLedgerPayload,
  AdminMasterLedgerRow,
  adminApi,
} from '@/features/admin/api/admin.api';
import SearchableSelect from '@/features/admin/components/SearchableSelect';
import AsyncSearchableSelect from '@/features/admin/components/AsyncSearchableSelect';
import { useAdmin } from '@/features/admin/context/AdminContext';

const GCA_LEDGER_OPTION = '__GCA__';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];

type GcaAggregateLedgerRow = {
  userId: string;
  name: string;
  mobileNumber: string;
  state?: string | null;
  totalInvoices: number;
  totalPremiumAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  ledger: AdminMasterLedgerPayload;
};

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN', {
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

function formatState(value?: string | null) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function getPaymentBadgeClasses(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'PENDING') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized === 'FAILED') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (normalized === 'REFUNDED') {
    return 'border-slate-200 bg-slate-100 text-slate-700';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function sanitizeFileName(value: string) {
  return String(value || 'ledger')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ledger';
}

function LedgerLoadingOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 backdrop-blur-[2px]">
      <div className="flex min-w-[280px] max-w-sm flex-col items-center rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-2xl">
        <div className="relative mb-4 h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-sky-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-sky-500 border-r-cyan-400" />
          <div className="absolute inset-[11px] rounded-full bg-gradient-to-br from-sky-50 to-cyan-100" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Loading Ledger</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{label}</p>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500" />
        </div>
      </div>
    </div>
  );
}

function LedgerDetailTable({
  rows,
  selectedInvoiceIds,
  onToggleRow,
  onToggleAll,
}: {
  rows: AdminMasterLedgerRow[];
  selectedInvoiceIds?: Set<string>;
  onToggleRow?: (invoiceId: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
}) {
  const selectable = Boolean(selectedInvoiceIds && onToggleRow && onToggleAll);
  const allVisibleSelected =
    selectable &&
    rows.length > 0 &&
    rows.every((row) => selectedInvoiceIds?.has(row.invoiceId));
  const someVisibleSelected =
    selectable && rows.some((row) => selectedInvoiceIds?.has(row.invoiceId));

  return (
    <table className="min-w-[1650px] divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 z-10 bg-slate-50">
        <tr>
          {selectable ? (
            <th className="w-12 px-4 py-3 text-left font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(allVisibleSelected)}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = Boolean(
                      someVisibleSelected && !allVisibleSelected,
                    );
                  }
                }}
                onChange={(event) => onToggleAll?.(event.target.checked)}
                aria-label="Select all visible ledger rows"
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
            </th>
          ) : null}
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Invoice Number</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Invoice Date</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Insured Person</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-700">Premium Amount</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-700">Paid Amount</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-700">Pending Amount</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment Status</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment Completed</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Remarks</th>
          <th className="px-4 py-3 text-left font-semibold text-slate-700">Proof of Payment</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={selectable ? 11 : 10} className="px-4 py-8 text-center text-slate-500">
              No ledger rows found.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.invoiceId}>
              {selectable ? (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedInvoiceIds?.has(row.invoiceId))}
                    onChange={(event) =>
                      onToggleRow?.(row.invoiceId, event.target.checked)
                    }
                    aria-label={`Select ${row.invoiceNumber || row.invoiceId}`}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                  />
                </td>
              ) : null}
              <td className="px-4 py-3 font-medium text-slate-900">
                {row.invoiceNumber || '-'}
              </td>
              <td className="px-4 py-3 text-slate-700">{formatDate(row.invoiceDate)}</td>
              <td className="px-4 py-3 text-slate-700">
                {row.insuredPersonName || row.sourceUserName || '-'}
              </td>
              <td className="px-4 py-3 text-right text-slate-900">
                {formatCurrency(row.premiumAmount)}
              </td>
              <td className="px-4 py-3 text-right text-slate-900">
                {formatCurrency(row.paidAmount)}
              </td>
              <td className="px-4 py-3 text-right text-slate-900">
                {formatCurrency(row.pendingAmount)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getPaymentBadgeClasses(row.paymentStatus)}`}
                >
                  {row.paymentStatus || '-'}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {formatDate(row.paymentCompletedAt)}
              </td>
              <td className="max-w-[240px] px-4 py-3 text-slate-700">
                <div className="line-clamp-3">{row.remarks || '-'}</div>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {row.proofOfPaymentImage ? (
                  <a
                    href={row.proofOfPaymentImage}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-700 underline underline-offset-2"
                  >
                    View Proof
                  </a>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default function AdminLedgerPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdmin();
  const [masterUsers, setMasterUsers] = useState<AdminLedgerUser[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [ledger, setLedger] = useState<AdminMasterLedgerPayload | null>(null);
  const [gcaAggregateRows, setGcaAggregateRows] = useState<GcaAggregateLedgerRow[]>([]);
  const [gcaLedgerModal, setGcaLedgerModal] = useState<AdminMasterLedgerPayload | null>(null);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('1');
  const [pageSize, setPageSize] = useState(25);
  const [exportingType, setExportingType] = useState('');
  const [ledgerReloadKey, setLedgerReloadKey] = useState(0);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [bulkStatusModal, setBulkStatusModal] = useState<{
    status: 'PAID' | 'PENDING';
  } | null>(null);
  const [bulkRemark, setBulkRemark] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const isGcaSelected = selectedMasterId === GCA_LEDGER_OPTION;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }

    const loadMasterUsers = async () => {
      try {
        setLoadingMasters(true);
        setError('');
        const response = await adminApi.getAdminLedgerUsers();
        if (!response.success || !Array.isArray(response.data)) {
          throw new Error(response.message || 'Failed to load ledger users');
        }

        const verifiedMasters = response.data
          .filter(
            (user) =>
              user.isLedgerMasterVerified &&
              user.canonicalUserId === user.id &&
              !user.isMerged,
          )
          .sort((left, right) =>
            String(left.name || '').localeCompare(String(right.name || '')),
          );

        setMasterUsers(verifiedMasters);
        setSelectedMasterId((current) => current || verifiedMasters[0]?.id || '');
      } catch (loadError: any) {
        setError(loadError?.message || 'Failed to load ledger users');
        setMasterUsers([]);
        setSelectedMasterId('');
      } finally {
        setLoadingMasters(false);
      }
    };

    void loadMasterUsers();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!selectedMasterId) {
      setLedger(null);
      setGcaAggregateRows([]);
      return;
    }

    const loadLedger = async () => {
      try {
        setLoadingLedger(true);
        setError('');
        setLedger(null);
        setGcaAggregateRows([]);

        if (selectedMasterId === GCA_LEDGER_OPTION) {
          const gcaMasterUsers = masterUsers.filter(
            (user) => String(user.unionMember || '').toUpperCase() === 'GCA',
          );

          if (gcaMasterUsers.length === 0) {
            setGcaAggregateRows([]);
            return;
          }

          const results = await Promise.allSettled(
            gcaMasterUsers.map(async (user) => {
              const response = await adminApi.getMasterUserLedger(user.id);
              if (!response.success || !response.data) {
                throw new Error(
                  response.message || `Failed to load ledger for ${user.name || 'user'}`,
                );
              }

              const payload = response.data;
              return {
                userId: user.id,
                name: payload.masterUser.name || user.name || 'User',
                mobileNumber: payload.masterUser.mobileNumber || user.mobileNumber || '-',
                state: payload.masterUser.state || user.state || null,
                totalInvoices: payload.summary.totalInvoices || 0,
                totalPremiumAmount: payload.summary.totalPremiumAmount || 0,
                totalPaidAmount: payload.summary.totalPaidAmount || 0,
                totalPendingAmount: payload.summary.totalPendingAmount || 0,
                ledger: payload,
              };
            }),
          );

          const successfulRows = results
            .filter((result) => result.status === 'fulfilled')
            .map((result) => (result as PromiseFulfilledResult<GcaAggregateLedgerRow>).value)
            .sort((left, right) =>
              String(left.name || '').localeCompare(String(right.name || '')),
            );

          const failedCount = results.filter((result) => result.status === 'rejected').length;
          if (failedCount > 0) {
            setError(`Failed to load ${failedCount} GCA member ledger${failedCount > 1 ? 's' : ''}.`);
          }

          setGcaAggregateRows(successfulRows);
          return;
        }

        const response = await adminApi.getMasterUserLedger(selectedMasterId);
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to load master ledger');
        }

        setLedger(response.data);
      } catch (loadError: any) {
        setError(loadError?.message || 'Failed to load master ledger');
        setLedger(null);
        setGcaAggregateRows([]);
      } finally {
        setLoadingLedger(false);
      }
    };

    void loadLedger();
  }, [masterUsers, selectedMasterId, ledgerReloadKey]);

  const filteredRows = useMemo(() => {
    const rows = ledger?.rows || [];
    const query = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        String(row.paymentStatus || '').toUpperCase() === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        row.invoiceNumber,
        row.insuredPersonName,
        row.sourceUserName,
        row.sourceUserMobile,
        row.walletDebitReference,
        row.remarks,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [ledger, searchTerm, statusFilter]);

  const filteredGcaRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return gcaAggregateRows;
    }

    return gcaAggregateRows.filter((row) => {
      const haystack = [row.name, row.mobileNumber, row.state]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [gcaAggregateRows, searchTerm]);

  const displayedRowCount = isGcaSelected ? filteredGcaRows.length : filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(displayedRowCount / pageSize));
  const pageStart = displayedRowCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, displayedRowCount);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  const paginatedGcaRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGcaRows.slice(start, start + pageSize);
  }, [currentPage, filteredGcaRows, pageSize]);

  const selectedLedgerRows = useMemo(
    () => filteredRows.filter((row) => selectedInvoiceIds.has(row.invoiceId)),
    [filteredRows, selectedInvoiceIds],
  );

  const selectedCount = selectedInvoiceIds.size;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMasterId, searchTerm, statusFilter, pageSize]);

  useEffect(() => {
    setSelectedInvoiceIds(new Set());
  }, [selectedMasterId, searchTerm, statusFilter, pageSize, ledgerReloadKey]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setJumpPageInput(String(currentPage));
  }, [currentPage]);

  const summary = ledger?.summary;
  const selectedMaster = ledger?.masterUser;
  const gcaSummary = useMemo(
    () =>
      gcaAggregateRows.reduce(
        (accumulator, row) => ({
          totalInvoices: accumulator.totalInvoices + row.totalInvoices,
          totalPremiumAmount:
            accumulator.totalPremiumAmount + row.totalPremiumAmount,
          totalPaidAmount: accumulator.totalPaidAmount + row.totalPaidAmount,
          totalPendingAmount:
            accumulator.totalPendingAmount + row.totalPendingAmount,
          paidCount: accumulator.paidCount + row.ledger.summary.paidCount,
          pendingCount:
            accumulator.pendingCount + row.ledger.summary.pendingCount,
        }),
        {
          totalInvoices: 0,
          totalPremiumAmount: 0,
          totalPaidAmount: 0,
          totalPendingAmount: 0,
          paidCount: 0,
          pendingCount: 0,
        },
      ),
    [gcaAggregateRows],
  );
  const summaryCards = isGcaSelected ? gcaSummary : summary;
  const masterUserOptions = useMemo(
    () => [
      {
        value: GCA_LEDGER_OPTION,
        label: 'GCA | All GCA Members',
        searchText: 'GCA all gca members union',
      },
      ...masterUsers.map((user) => ({
        value: user.id,
        label: `${user.name || ''} | ${user.mobileNumber || ''}`,
        searchText: `${user.name || ''} ${user.mobileNumber || ''}`,
      })),
    ],
    [masterUsers],
  );
  const loadingOverlayLabel = useMemo(() => {
    if (loadingMasters) {
      return 'Preparing verified users and ledger controls...';
    }

    if (selectedMasterId === GCA_LEDGER_OPTION) {
      return 'Building the cumulative GCA ledger for all marked members.';
    }

    const selectedOption = masterUserOptions.find(
      (option) => option.value === selectedMasterId,
    );

    return selectedOption
      ? `Fetching the latest ledger for ${selectedOption.label}.`
      : 'Fetching the latest ledger details.';
  }, [loadingMasters, masterUserOptions, selectedMasterId]);

  const downloadExcelFile = (fileName: string, headers: string[], rows: Array<Array<string | number>>) => {
    const escapeCell = (value: string | number) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const tableHtml = `
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`,
            )
            .join('')}
        </tbody>
      </table>
    `;

    const blob = new Blob([`\ufeff${tableHtml}`], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName}.xls`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadPdfFile = (fileName: string, title: string, headers: string[], rows: Array<Array<string | number>>) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 32;
    const top = 32;
    const lineHeight = 18;
    const usableWidth = pageWidth - left * 2;
    const columnWidth = usableWidth / headers.length;
    let y = top;

    const drawHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(title, left, y);
      y += 22;
      doc.setFontSize(9);
      headers.forEach((header, index) => {
        doc.text(String(header), left + index * columnWidth, y);
      });
      y += 10;
      doc.line(left, y, pageWidth - left, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    };

    drawHeader();

    rows.forEach((row) => {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = top;
        drawHeader();
      }

      row.forEach((cell, index) => {
        const text = doc.splitTextToSize(String(cell ?? '-'), columnWidth - 8);
        doc.text(text, left + index * columnWidth, y);
      });

      y += lineHeight;
    });

    doc.save(`${fileName}.pdf`);
  };

  const exportIndividualLedger = (
    payload: AdminMasterLedgerPayload,
    rows: AdminMasterLedgerRow[],
    format: 'excel' | 'pdf',
  ) => {
    const fileBase = `${sanitizeFileName(payload.masterUser.name)}-ledger-${new Date()
      .toISOString()
      .slice(0, 10)}`;
    const headers = [
      'Invoice Number',
      'Invoice Date',
      'Insured Person',
      'Premium Amount',
      'Paid Amount',
      'Pending Amount',
      'Payment Status',
      'Payment Completed',
      'Remarks',
      'Proof of Payment',
    ];
    const exportRows = rows.map((row) => [
      row.invoiceNumber || '-',
      formatDate(row.invoiceDate),
      row.insuredPersonName || row.sourceUserName || '-',
      row.premiumAmount.toFixed(2),
      row.paidAmount.toFixed(2),
      row.pendingAmount.toFixed(2),
      row.paymentStatus || '-',
      formatDate(row.paymentCompletedAt),
      row.remarks || '-',
      row.proofOfPaymentImage || '-',
    ]);

    if (format === 'excel') {
      downloadExcelFile(fileBase, headers, exportRows);
      return;
    }

    downloadPdfFile(fileBase, `${payload.masterUser.name} Ledger`, headers, exportRows);
  };

  const exportGcaSummary = (format: 'excel' | 'pdf') => {
    const fileBase = `gca-ledger-summary-${new Date().toISOString().slice(0, 10)}`;
    const headers = [
      'User Name',
      'Mobile Number',
      'State',
      'Total Invoices',
      'Total Premium Amount',
      'Paid Amount',
      'Pending Total Amount',
    ];
    const rows = filteredGcaRows.map((row) => [
      row.name,
      row.mobileNumber,
      formatState(row.state),
      row.totalInvoices,
      row.totalPremiumAmount.toFixed(2),
      row.totalPaidAmount.toFixed(2),
      row.totalPendingAmount.toFixed(2),
    ]);

    if (format === 'excel') {
      downloadExcelFile(fileBase, headers, rows);
      return;
    }

    downloadPdfFile(fileBase, 'GCA Members Ledger Summary', headers, rows);
  };

  const handleExport = async (type: string, exporter: () => void) => {
    try {
      setExportingType(type);
      exporter();
    } finally {
      setExportingType('');
    }
  };

  const toggleLedgerRowSelection = (invoiceId: string, checked: boolean) => {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(invoiceId);
      } else {
        next.delete(invoiceId);
      }
      return next;
    });
  };

  const toggleVisibleLedgerRows = (checked: boolean) => {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
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

  const openBulkStatusModal = (status: 'PAID' | 'PENDING') => {
    if (selectedCount === 0) {
      setError('Select at least one ledger row first');
      return;
    }
    setError('');
    setBulkRemark('');
    setBulkStatusModal({ status });
  };

  const submitBulkStatusUpdate = async () => {
    if (!bulkStatusModal) return;
    const remarks = bulkRemark.trim();
    if (!remarks) {
      setError('Remark is required before updating selected rows');
      return;
    }

    try {
      setBulkUpdating(true);
      setError('');
      const response = await adminApi.updateLedgerPaymentStatus({
        invoiceIds: Array.from(selectedInvoiceIds),
        paymentStatus: bulkStatusModal.status,
        remarks,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to update selected rows');
      }

      setBulkStatusModal(null);
      setBulkRemark('');
      setSelectedInvoiceIds(new Set());
      setLedgerReloadKey((value) => value + 1);
    } catch (updateError: any) {
      setError(updateError?.message || 'Failed to update selected rows');
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <div className="py-6">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loadingMasters || loadingLedger ? (
            <LedgerLoadingOverlay label={loadingOverlayLabel} />
          ) : null}

          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Ledger</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Combined ledger for all users, including linked accounts and invoice history.
                </p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[320px_220px_220px]">
                <AsyncSearchableSelect
                  label="Select User"
                  value={selectedMasterId}
                  onChange={setSelectedMasterId}
                  disabled={loadingMasters}
                  placeholder="Select verified master user"
                  searchPlaceholder="Search verified user by name or mobile"
                  emptyMessage="No users found"
                  onSearch={async (q) => {
                    const res = await adminApi.searchUsers(q, 100, { verified: true });
                    if (!res.success || !Array.isArray(res.data)) return [];
                    const gcaOption = { value: GCA_LEDGER_OPTION, label: 'GCA | All GCA Members' };
                    const userOptions = res.data
                      .map((u) => ({ value: u.id, label: `${u.name || ''} | ${u.mobileNumber || ''}` }));
                    return [gcaOption, ...userOptions];
                  }}
                />

                <label className="text-sm text-slate-600">
                  {isGcaSelected ? 'Search GCA Members' : 'Search Ledger'}
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={
                      isGcaSelected ? 'User name or mobile number' : 'Invoice, user, reference'
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </label>

                <label className="text-sm text-slate-600">
                  Payment Status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    disabled={isGcaSelected}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="ALL">All</option>
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Pending</option>
                    <option value="FAILED">Failed</option>
                    <option value="REFUNDED">Refunded</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {isGcaSelected ? (
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">GCA Members</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Cumulative ledger view for all verified users marked as GCA members.
                  </p>
                </div>
                <p className="text-sm text-slate-500">
                  GCA members:{' '}
                  <span className="font-semibold text-slate-800">
                    {gcaAggregateRows.length}
                  </span>
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('gca-excel', () => exportGcaSummary('excel'))}
                  disabled={loadingLedger || filteredGcaRows.length === 0 || exportingType !== ''}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingType === 'gca-excel' ? 'Exporting...' : 'Export Excel'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('gca-pdf', () => exportGcaSummary('pdf'))}
                  disabled={loadingLedger || filteredGcaRows.length === 0 || exportingType !== ''}
                  className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingType === 'gca-pdf' ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          ) : selectedMaster ? (
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedMaster.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedMaster.mobileNumber} | {formatState(selectedMaster.state)}
                  </p>
                </div>
                <p className="text-sm text-slate-500">
                  Linked users: <span className="font-semibold text-slate-800">{ledger?.linkedUsers.length || 0}</span>
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    ledger &&
                    handleExport('individual-excel', () =>
                      exportIndividualLedger(ledger, filteredRows, 'excel'),
                    )
                  }
                  disabled={loadingLedger || !ledger || filteredRows.length === 0 || exportingType !== ''}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingType === 'individual-excel' ? 'Exporting...' : 'Export Excel'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    ledger &&
                    handleExport('individual-pdf', () =>
                      exportIndividualLedger(ledger, filteredRows, 'pdf'),
                    )
                  }
                  disabled={loadingLedger || !ledger || filteredRows.length === 0 || exportingType !== ''}
                  className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingType === 'individual-pdf' ? 'Generating...' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => openBulkStatusModal('PAID')}
                  disabled={loadingLedger || selectedCount === 0 || bulkUpdating}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark Paid
                </button>
                <button
                  type="button"
                  onClick={() => openBulkStatusModal('PENDING')}
                  disabled={loadingLedger || selectedCount === 0 || bulkUpdating}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark Pending
                </button>
                {selectedCount > 0 ? (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                    {selectedCount} selected
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(ledger?.linkedUsers || []).map((user) => (
                  <span
                    key={user.id}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                      user.isMaster
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {user.name} | {user.mobileNumber}
                    {user.isMaster ? ' | Master' : ' | Child'}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Invoices</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {summaryCards?.totalInvoices ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-700">Premium</p>
              <p className="mt-2 text-2xl font-semibold text-cyan-900">
                {formatCurrency(summaryCards?.totalPremiumAmount ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Paid</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">
                {formatCurrency(summaryCards?.totalPaidAmount ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-700">Pending</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">
                {formatCurrency(summaryCards?.totalPendingAmount ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs uppercase tracking-wide text-violet-700">Paid Count</p>
              <p className="mt-2 text-2xl font-semibold text-violet-900">
                {summaryCards?.paidCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs uppercase tracking-wide text-rose-700">Pending Count</p>
              <p className="mt-2 text-2xl font-semibold text-rose-900">
                {summaryCards?.pendingCount ?? 0}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200">
            <div className="max-h-[calc(100vh-24rem)] overflow-auto">
              {isGcaSelected ? (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">User Name</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Invoices</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Premium Amount</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Paid Amount</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Pending Total Amount</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loadingMasters || loadingLedger ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Loading GCA ledger...
                        </td>
                      </tr>
                    ) : paginatedGcaRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No GCA member rows found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedGcaRows.map((row) => (
                        <tr key={row.userId}>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-medium text-slate-900">{row.name}</div>
                            <div className="text-xs text-slate-400">
                              {row.mobileNumber} | {formatState(row.state)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-900">{row.totalInvoices}</td>
                          <td className="px-4 py-3 text-right text-slate-900">
                            {formatCurrency(row.totalPremiumAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-900">
                            {formatCurrency(row.totalPaidAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-900">
                            {formatCurrency(row.totalPendingAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setGcaLedgerModal(row.ledger)}
                              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <LedgerDetailTable
                  rows={paginatedRows}
                  selectedInvoiceIds={selectedInvoiceIds}
                  onToggleRow={toggleLedgerRowSelection}
                  onToggleAll={toggleVisibleLedgerRows}
                />
              )}
            </div>

            {!loadingMasters && !loadingLedger && displayedRowCount > 0 ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-medium">{pageStart}</span> to{' '}
                  <span className="font-medium">{pageEnd}</span> of{' '}
                  <span className="font-medium">{displayedRowCount}</span>{' '}
                  {isGcaSelected ? 'GCA member rows' : 'ledger rows'}
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    Per page
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage <= 1}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>

                    <span className="text-sm text-slate-700">
                      Page <span className="font-medium">{currentPage}</span> of{' '}
                      <span className="font-medium">{totalPages}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={jumpPageInput}
                        onChange={(event) => setJumpPageInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          const targetPage = Number(jumpPageInput);
                          if (!Number.isFinite(targetPage)) return;
                          const safePage = Math.min(
                            Math.max(Math.trunc(targetPage), 1),
                            totalPages,
                          );
                          setCurrentPage(safePage);
                        }}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                        aria-label="Go to ledger page"
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
                          setCurrentPage(safePage);
                        }}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Go to page
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage >= totalPages}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {bulkStatusModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Mark {selectedCount} row{selectedCount === 1 ? '' : 's'} as{' '}
                {bulkStatusModal.status}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add a remark so this manual ledger update has a clear reason.
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="max-h-32 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {selectedLedgerRows.slice(0, 8).map((row) => (
                  <div key={row.invoiceId} className="flex justify-between gap-3 py-1">
                    <span className="font-medium text-slate-800">
                      {row.invoiceNumber || row.invoiceId}
                    </span>
                    <span>{row.insuredPersonName || row.sourceUserName || '-'}</span>
                  </div>
                ))}
                {selectedLedgerRows.length > 8 ? (
                  <div className="pt-1 text-slate-500">
                    +{selectedLedgerRows.length - 8} more selected
                  </div>
                ) : null}
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Remark</span>
                <textarea
                  value={bulkRemark}
                  onChange={(event) => setBulkRemark(event.target.value)}
                  rows={4}
                  placeholder={
                    bulkStatusModal.status === 'PAID'
                      ? 'Example: Payment verified manually from bank statement'
                      : 'Example: Reverted because payment was not received'
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setBulkStatusModal(null);
                  setBulkRemark('');
                }}
                disabled={bulkUpdating}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBulkStatusUpdate}
                disabled={bulkUpdating || !bulkRemark.trim()}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  bulkStatusModal.status === 'PAID'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {bulkUpdating ? 'Updating...' : `Mark ${bulkStatusModal.status}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {gcaLedgerModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {gcaLedgerModal.masterUser.name} Ledger
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {gcaLedgerModal.masterUser.mobileNumber} |{' '}
                  {formatState(gcaLedgerModal.masterUser.state)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleExport('modal-excel', () =>
                      exportIndividualLedger(gcaLedgerModal, gcaLedgerModal.rows, 'excel'),
                    )
                  }
                  disabled={gcaLedgerModal.rows.length === 0 || exportingType !== ''}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingType === 'modal-excel' ? 'Exporting...' : 'Export Excel'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleExport('modal-pdf', () =>
                      exportIndividualLedger(gcaLedgerModal, gcaLedgerModal.rows, 'pdf'),
                    )
                  }
                  disabled={gcaLedgerModal.rows.length === 0 || exportingType !== ''}
                  className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingType === 'modal-pdf' ? 'Generating...' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setGcaLedgerModal(null)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 border-b border-slate-200 px-5 py-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Invoices</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {gcaLedgerModal.summary.totalInvoices}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-wide text-cyan-700">Premium</p>
                <p className="mt-2 text-xl font-semibold text-cyan-900">
                  {formatCurrency(gcaLedgerModal.summary.totalPremiumAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Paid</p>
                <p className="mt-2 text-xl font-semibold text-emerald-900">
                  {formatCurrency(gcaLedgerModal.summary.totalPaidAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-700">Pending</p>
                <p className="mt-2 text-xl font-semibold text-amber-900">
                  {formatCurrency(gcaLedgerModal.summary.totalPendingAmount)}
                </p>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              <LedgerDetailTable rows={gcaLedgerModal.rows} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
