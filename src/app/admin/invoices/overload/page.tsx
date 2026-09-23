'use client';

import { useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  CheckIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import {
  adminApi,
  type OverloadApprovalStatus,
  type OverloadInvoice,
  type OverloadInvoicesResponse,
} from '@/features/admin/api/admin.api';
import {
  formatCurrency,
  formatDateOnly,
  formatTimeOnly,
} from '@/features/admin/utils/format';

const ITEMS_PER_PAGE = 20;

const TABS: Array<{ status: OverloadApprovalStatus; label: string }> = [
  { status: 'PENDING', label: 'Waiting for approval' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Rejected' },
];

const kg = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value).toLocaleString('en-IN')} kg`;

function productLabel(invoice: OverloadInvoice) {
  if (Array.isArray(invoice.productName)) return invoice.productName.join(', ') || '—';
  return invoice.productName || '—';
}

function LoadSummary({ invoice }: { invoice: OverloadInvoice }) {
  if (invoice.loadPercent == null) {
    return <span className="text-slate-500">Load check not linked</span>;
  }
  const fromSlip = invoice.weightSource && invoice.weightSource !== 'QUANTITY_ESTIMATE';
  // The overload is how far the load is past the RC's GVW, not the load as a
  // share of it: 29,500 kg on a 28,000 kg GVW is 5.4% overweight, not 105.4%.
  const percentOverGvw = invoice.loadPercent - 100;
  const weighedKg = invoice.ladenKg ?? invoice.cargoKg;
  const kgOverGvw =
    weighedKg != null && invoice.rcGvwKg != null ? weighedKg - invoice.rcGvwKg : null;
  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-rose-700">
        {percentOverGvw > 0 ? `${percentOverGvw.toFixed(1)}% over GVW` : 'Within GVW'}
        {kgOverGvw != null && kgOverGvw > 0 ? ` · ${kg(kgOverGvw)} over` : ''}
      </p>
      <p className="text-xs text-slate-600">
        Laden {kg(weighedKg)} vs RC GVW {kg(invoice.rcGvwKg)} · allowed{' '}
        {kg(invoice.permissibleKg)} (GVW + {invoice.tolerancePercent ?? 5}% tolerance)
      </p>
      <p className="text-xs text-slate-500">
        {fromSlip
          ? `From weighment slip${invoice.slipGrossKg ? ` (gross ${kg(invoice.slipGrossKg)})` : ''}`
          : `Estimated: ${invoice.quantity ?? '—'} × ${invoice.kgPerUnit ?? '—'} kg + truck ${kg(invoice.rcUnladenKg)}`}
      </p>
    </div>
  );
}

function Decision({ invoice }: { invoice: OverloadInvoice }) {
  if (invoice.overloadApprovalStatus === 'PENDING') return null;
  const approved = invoice.overloadApprovalStatus === 'APPROVED';
  return (
    <p className="text-xs text-slate-600">
      <span className={approved ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
        {approved ? 'Approved' : 'Rejected'}
      </span>{' '}
      by {invoice.overloadDecidedBy || '—'}
      {invoice.overloadDecidedAt
        ? ` on ${formatDateOnly(invoice.overloadDecidedAt)} ${formatTimeOnly(invoice.overloadDecidedAt)}`
        : ''}
      {invoice.overloadDecisionNote ? ` — ${invoice.overloadDecisionNote}` : ''}
    </p>
  );
}

export default function OverloadInvoicesPage() {
  const [status, setStatus] = useState<OverloadApprovalStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<OverloadInvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OverloadInvoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  // Callers flip `loading` on before the status/page/reload change that
  // triggers a fetch, so the effect only sets state from the response.
  useEffect(() => {
    let active = true;
    void adminApi
      .listOverloadInvoices({ status, page, limit: ITEMS_PER_PAGE })
      .then((response) => {
        if (!active) return;
        if (response.success && response.data) {
          setResult(response.data);
        } else {
          toast.error(response.message || 'Could not load overweight invoices');
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, page, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const approve = async (invoice: OverloadInvoice) => {
    if (
      !window.confirm(
        `Approve ${invoice.invoiceNumber}? It will be verified, the customer gets the PDF on WhatsApp, and it moves into Insurance Forms.`,
      )
    ) {
      return;
    }
    setBusyId(invoice.id);
    const response = await adminApi.decideOverloadInvoice(invoice.id, 'approve');
    setBusyId(null);
    if (!response.success) {
      toast.error(response.message || 'Approval failed');
      return;
    }
    toast.success(`${invoice.invoiceNumber} approved and verified`);
    reload();
  };

  const reject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Add a reason for the rejection');
      return;
    }
    setBusyId(rejectTarget.id);
    const response = await adminApi.decideOverloadInvoice(rejectTarget.id, 'reject', reason);
    setBusyId(null);
    if (!response.success) {
      toast.error(response.message || 'Rejection failed');
      return;
    }
    toast.success(`${rejectTarget.invoiceNumber} rejected`);
    setRejectTarget(null);
    setRejectReason('');
    reload();
  };

  const invoices = result?.data || [];
  const canApprove = Boolean(result?.canApprove);
  const totalPages = Math.max(1, Math.ceil((result?.total || 0) / ITEMS_PER_PAGE));

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Overload approvals</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Invoices generated for trucks over their permitted weight (RC GVW plus tolerance). They are
            held out of Insurance Forms and cannot be verified until approved. Only admin@mandiplus.com
            can approve or reject; approving verifies the invoice and sends the customer their PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {!loading && !canApprove && status === 'PENDING' && invoices.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You can view these invoices, but only admin@mandiplus.com can approve or reject them.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => {
              if (tab.status === status) return;
              setLoading(true);
              setStatus(tab.status);
              setPage(1);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              status === tab.status
                ? 'border-[#4309ac] text-[#4309ac]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
              {result?.counts?.[tab.status] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-lg bg-white shadow">
          <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-green-500" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg bg-white px-4 py-10 text-center text-sm text-slate-500 shadow">
          {status === 'PENDING'
            ? 'No overweight invoices are waiting for approval.'
            : `No ${status.toLowerCase()} overweight invoices yet.`}
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="grid gap-4 rounded-lg bg-white p-4 shadow ring-1 ring-slate-200 lg:grid-cols-[1.1fr_1.2fr_1.4fr_auto]"
            >
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                <p className="text-xs text-slate-500">
                  Created {formatDateOnly(invoice.createdAt)} {formatTimeOnly(invoice.createdAt)}
                  {invoice.createdByName ? ` by ${invoice.createdByName}` : ''}
                </p>
                <p className="text-sm text-slate-800">
                  {invoice.vehicleNumber || '—'} · {productLabel(invoice)}
                </p>
                <p className="text-xs text-slate-600">
                  Qty {invoice.quantity ?? '—'} ·{' '}
                  {invoice.amount != null ? formatCurrency(invoice.amount) : '—'} · premium{' '}
                  {invoice.premiumAmount != null ? formatCurrency(invoice.premiumAmount) : '—'}
                </p>
              </div>
              <div className="space-y-0.5 text-sm">
                <p className="text-xs text-slate-500">Supplier</p>
                <p className="font-medium text-slate-800">{invoice.supplierName || '—'}</p>
                <p className="pt-1 text-xs text-slate-500">Buyer</p>
                <p className="font-medium text-slate-800">{invoice.billToName || '—'}</p>
              </div>
              <div className="space-y-2 text-sm">
                <LoadSummary invoice={invoice} />
                <Decision invoice={invoice} />
              </div>
              <div className="flex flex-wrap items-start gap-2 lg:flex-col lg:items-stretch">
                {invoice.pdfUrl && (
                  <a
                    href={invoice.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4" />
                    Invoice PDF
                  </a>
                )}
                {invoice.weighmentSlipUrls?.[0] && (
                  <a
                    href={invoice.weighmentSlipUrls[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Weighment slip
                  </a>
                )}
                {status === 'PENDING' && canApprove && (
                  <>
                    <button
                      type="button"
                      onClick={() => void approve(invoice)}
                      disabled={busyId === invoice.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <CheckIcon className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget(invoice);
                        setRejectReason('');
                      }}
                      disabled={busyId === invoice.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setPage((p) => Math.max(1, p - 1));
            }}
            disabled={page === 1 || loading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setPage((p) => Math.min(totalPages, p + 1));
            }}
            disabled={page === totalPages || loading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              Reject {rejectTarget.invoiceNumber}?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              The invoice is rejected and stays out of Insurance Forms. The reason is saved on the
              invoice.
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Reason, e.g. 118% of GVW — reload into two trucks"
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void reject()}
                disabled={busyId === rejectTarget.id}
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Reject invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
