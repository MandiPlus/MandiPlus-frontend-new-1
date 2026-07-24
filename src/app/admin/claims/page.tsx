'use client';

import {
  ClaimActivity,
  ClaimPaymentStatus,
  ClaimRequest,
  ClaimsSummary,
  ClaimStatus,
  EligibleClaimInvoice,
  UpdateClaimDto,
  adminApi,
} from '@/features/admin/api/admin.api';
import InvoicePicker from '@/features/admin/claims/InvoicePicker';
import {
  EvidenceBadge,
  LocationLink,
  StatusBadge,
  formatAddress,
  formatCurrency,
  formatDate,
  getInsuredParty,
  getOtherParty,
  getVehicleNumber,
} from '@/features/admin/claims/claimUi';
import { adminButtonClasses } from '@/features/admin/utils/adminUi';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Image as ImageIcon,
  Link2,
  ListFilter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

const claimStatusOptions = Object.values(ClaimStatus);
const paymentStatusOptions = Object.values(ClaimPaymentStatus);
const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/10';

type DrawerTab = 'overview' | 'documents' | 'evidence' | 'activity';

function documentEntries(claim: ClaimRequest) {
  return [
    ['FIR', claim.fir],
    ['Accident picture', claim.accidentPic],
    ['Inspection report', claim.inspectionReport],
    ['Lorry receipt', claim.lorryReceipt],
    ['Insurance policy', claim.insurancePolicy],
    ['Damage certificate', claim.claimFormUrl || claim.damageFormUrl],
    ['Invoice', claim.invoice?.pdfUrl || claim.invoice?.invoicePdfUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof ShieldCheck;
  tone: 'violet' | 'amber' | 'emerald' | 'blue';
}) {
  const tones = {
    violet: 'border-violet-100 bg-violet-50/70 text-violet-700',
    amber: 'border-amber-100 bg-amber-50/70 text-amber-700',
    emerald: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
    blue: 'border-sky-100 bg-sky-50/70 text-sky-700',
  };
  return (
    <div className={`rounded-xl border p-3.5 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold opacity-75">{label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <span className="rounded-lg bg-white/80 p-2 shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function NewClaimModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [invoice, setInvoice] = useState<EligibleClaimInvoice | null>(null);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [officialClaimNumber, setOfficialClaimNumber] = useState('');
  const [quotationAmount, setQuotationAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!invoice) {
      toast.error('Select the exact invoice for this claim');
      return;
    }
    setSaving(true);
    const response = await adminApi.createClaimByInvoice({
      invoiceId: invoice.id,
      officialClaimNumber: officialClaimNumber.trim() || undefined,
      description: reason.trim() || undefined,
      quotationAmount: quotationAmount
        ? Number(quotationAmount)
        : undefined,
      remarks: remarks.trim() || undefined,
    });
    setSaving(false);
    if (!response.success) {
      toast.error(response.message || 'Could not create claim');
      return;
    }
    toast.success('Claim created and linked to the invoice');
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <p className="text-lg font-bold text-slate-900">Initiate new claim</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-6">
          <InvoicePicker value={invoice} onChange={setInvoice} />
          {invoice && (
            <div className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Vehicle
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {invoice.vehicleNumber || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Insured party
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {invoice.insuredPersonName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Insured value
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatCurrency(invoice.amount)}
                </p>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Official insurer claim no.
              <input
                value={officialClaimNumber}
                onChange={(event) => setOfficialClaimNumber(event.target.value)}
                placeholder="Optional"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Estimation quotation (₹)
              <input
                value={quotationAmount}
                onChange={(event) => setQuotationAmount(event.target.value)}
                type="number"
                min="0"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Reason for claim
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="e.g. Engine seizure during transit"
              className={`${fieldClass} mt-1.5 resize-none`}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Initial remarks
            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={2}
              placeholder="Internal context, caps or next action"
              className={`${fieldClass} mt-1.5 resize-none`}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className={adminButtonClasses.secondary}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !invoice}
            className={adminButtonClasses.primary}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create claim
          </button>
        </div>
      </div>
    </div>
  );
}

function ClaimDrawer({
  claim,
  onClose,
  onUpdated,
}: {
  claim: ClaimRequest;
  onClose: () => void;
  onUpdated: (claim: ClaimRequest) => void;
}) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [form, setForm] = useState<UpdateClaimDto>({
    officialClaimNumber: claim.officialClaimNumber || '',
    description: claim.description || '',
    status: claim.status,
    quotationAmount: claim.quotationAmount ?? null,
    approvedPayableAmount: claim.approvedPayableAmount ?? null,
    paymentStatus:
      claim.paymentStatus || ClaimPaymentStatus.NOT_STARTED,
    paymentReference: claim.paymentReference || '',
    remarks: claim.remarks || '',
    surveyorName: claim.surveyorName || '',
    surveyorContact: claim.surveyorContact || '',
    notes: claim.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<ClaimActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const selectTab = (nextTab: DrawerTab) => {
    setTab(nextTab);
    if (nextTab !== 'activity') return;
    setActivityLoading(true);
    void adminApi.getClaimActivity(claim.id).then((response) => {
      setActivities(response.data || []);
      setActivityLoading(false);
    });
  };

  const save = async () => {
    setSaving(true);
    const response = await adminApi.updateClaim(claim.id, form);
    setSaving(false);
    if (!response.success || !response.data) {
      toast.error(response.message || 'Could not update claim');
      return;
    }
    toast.success('Claim updated');
    onUpdated(response.data);
  };

  const uploadDocument = async (
    mediaType:
      | 'fir'
      | 'accidentPic'
      | 'inspectionReport'
      | 'lorryReceipt'
      | 'insurancePolicy'
      | 'damageForm',
    file?: File,
  ) => {
    if (!file) return;
    setUploading(mediaType);
    const response = await adminApi.uploadClaimMedia(
      claim.id,
      mediaType,
      file,
    );
    setUploading(null);
    if (!response.success) {
      toast.error(response.message || 'Upload failed');
      return;
    }
    const refreshed = await adminApi.getClaimById(claim.id);
    if (refreshed.data) onUpdated(refreshed.data);
    toast.success('Document uploaded');
  };

  const documents = documentEntries(claim);
  const tabs: Array<{ key: DrawerTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: `Documents ${documents.length}` },
    { key: 'evidence', label: 'Live evidence' },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/25">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-slate-900">
                  {claim.officialClaimNumber ||
                    claim.caseNumber ||
                    'Claim number pending'}
                </p>
                <StatusBadge status={claim.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {claim.caseNumber || 'Claim number pending'} ·{' '}
                {claim.invoice?.invoiceNumber} ·{' '}
                {getVehicleNumber(claim)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => selectTab(item.key)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition ${
                  tab === item.key
                    ? 'bg-white text-[#4309ac] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'overview' && (
            <div className="space-y-6">
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Invoice snapshot
                </p>
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
                  {[
                    ['Insured party', getInsuredParty(claim)],
                    ['Other party', getOtherParty(claim)],
                    [
                      'Supplier address',
                      formatAddress(claim.invoice?.supplierAddress),
                    ],
                    [
                      'Buyer address',
                      formatAddress(claim.invoice?.billToAddress),
                    ],
                    ['Invoice / insured value', formatCurrency(claim.insuredValue ?? claim.invoice?.amount)],
                    ['Invoice date', formatDate(claim.invoice?.invoiceDate || claim.invoice?.date)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {label}
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Claim-owned fields
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Official insurer claim no.
                    <input
                      value={String(form.officialClaimNumber || '')}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          officialClaimNumber: event.target.value,
                        }))
                      }
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Current status
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as ClaimStatus,
                        }))
                      }
                      className={`${fieldClass} mt-1.5`}
                    >
                      {claimStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-700">
                  Reason for claim
                  <textarea
                    rows={3}
                    value={String(form.description || '')}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className={`${fieldClass} mt-1.5 resize-none`}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Estimation quotation (₹)
                    <input
                      type="number"
                      min="0"
                      value={form.quotationAmount ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          quotationAmount: event.target.value
                            ? Number(event.target.value)
                            : null,
                        }))
                      }
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    We have to pay (₹)
                    <input
                      type="number"
                      min="0"
                      value={form.approvedPayableAmount ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          approvedPayableAmount: event.target.value
                            ? Number(event.target.value)
                            : null,
                        }))
                      }
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Settlement payment status
                    <select
                      value={form.paymentStatus}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          paymentStatus: event.target
                            .value as ClaimPaymentStatus,
                        }))
                      }
                      className={`${fieldClass} mt-1.5`}
                    >
                      {paymentStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Payment reference
                    <input
                      value={String(form.paymentReference || '')}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          paymentReference: event.target.value,
                        }))
                      }
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-700">
                  Remarks
                  <textarea
                    rows={3}
                    value={String(form.remarks || '')}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        remarks: event.target.value,
                      }))
                    }
                    className={`${fieldClass} mt-1.5 resize-none`}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Surveyor name
                    <input
                      value={String(form.surveyorName || '')}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          surveyorName: event.target.value,
                        }))
                      }
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Surveyor contact
                    <input
                      value={String(form.surveyorContact || '')}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          surveyorContact: event.target.value,
                        }))
                      }
                      className={`${fieldClass} mt-1.5`}
                    />
                  </label>
                </div>
              </section>
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Claim documentation
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Uploads replace the current file in that document slot.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    ['FIR', 'fir'],
                    ['Accident picture', 'accidentPic'],
                    ['Inspection report', 'inspectionReport'],
                    ['Lorry receipt', 'lorryReceipt'],
                    ['Insurance policy', 'insurancePolicy'],
                    ['Damage certificate', 'damageForm'],
                  ].map(([label, mediaType]) => (
                    <label
                      key={mediaType}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-violet-200 hover:text-[#4309ac]"
                    >
                      <span className="flex items-center gap-2">
                        {uploading === mediaType ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {label}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        disabled={Boolean(uploading)}
                        onChange={(event) =>
                          uploadDocument(
                            mediaType as Parameters<
                              typeof uploadDocument
                            >[0],
                            event.target.files?.[0],
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {documents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                    <FileText className="mx-auto h-7 w-7 text-slate-300" />
                    <p className="mt-2 text-xs text-slate-500">
                      No documents uploaded yet
                    </p>
                  </div>
                ) : (
                  documents.map(([label, url]) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50/40 hover:text-[#4309ac]"
                    >
                      <span className="flex items-center gap-3">
                        <span className="rounded-lg bg-slate-100 p-2">
                          <FileCheck2 className="h-4 w-4" />
                        </span>
                        {label}
                      </span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'evidence' && (
            <div className="space-y-5">
              <EvidenceBadge claim={claim} />
              <div className="flex flex-wrap items-center gap-3">
                <LocationLink claim={claim} />
                {claim.locationAccuracyMeters && (
                  <span className="text-xs text-slate-500">
                    Accuracy ±{Math.round(Number(claim.locationAccuracyMeters))}m
                  </span>
                )}
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Photos
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(claim.evidencePhotos || []).map((photo) => (
                    <a
                      key={photo.publicId}
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={`Accident evidence ${photo.slot}`}
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/70 px-2 py-1 text-[10px] font-semibold text-white">
                        Photo {photo.slot}
                      </span>
                    </a>
                  ))}
                </div>
                {!claim.evidencePhotos?.length && (
                  <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                    <ImageIcon className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-xs text-slate-500">
                      No live photos received
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Videos
                </p>
                <div className="space-y-2">
                  {(claim.evidenceVideos || []).map((video) => (
                    <a
                      key={video.publicId}
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs font-semibold text-slate-700 hover:border-violet-200 hover:text-[#4309ac]"
                    >
                      <span className="flex items-center gap-2">
                        <Video className="h-4 w-4" /> Video {video.slot}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div>
              {activityLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-[#4309ac]" />
                </div>
              ) : activities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500">
                  No recorded activity yet
                </div>
              ) : (
                <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-200">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="relative flex gap-4 pl-0"
                    >
                      <span className="z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white bg-[#4309ac] ring-1 ring-violet-200" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {activity.summary}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {activity.actorName || 'System'} ·{' '}
                          {formatDate(activity.createdAt, true)}
                        </p>
                        {activity.changes && (
                          <p className="mt-2 text-[11px] text-slate-500">
                            {Object.keys(activity.changes)
                              .map((key) => key.replaceAll(/([A-Z])/g, ' $1'))
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {tab === 'overview' && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
            <p className="text-[11px] text-slate-400">
              Last updated {formatDate(claim.updatedAt, true)}
            </p>
            <button
              onClick={save}
              disabled={saving}
              className={adminButtonClasses.primary}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [summary, setSummary] = useState<ClaimsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [evidenceStatus, setEvidenceStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [showNewClaim, setShowNewClaim] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [claimsResponse, summaryResponse] = await Promise.all([
      adminApi.getClaimsPage({
        search: search || undefined,
        status: (status as ClaimStatus) || undefined,
        paymentStatus:
          (paymentStatus as ClaimPaymentStatus) || undefined,
        evidenceStatus:
          (evidenceStatus as
            | 'not_requested'
            | 'active'
            | 'received'
            | 'expired') || undefined,
        page,
        limit: 20,
      }),
      adminApi.getClaimsSummary(),
    ]);
    if (!claimsResponse.success) {
      toast.error(claimsResponse.message || 'Could not load claims');
    }
    setClaims(claimsResponse.data?.data || []);
    setTotal(claimsResponse.data?.total || 0);
    setTotalPages(claimsResponse.data?.totalPages || 1);
    setSummary(summaryResponse.data || null);
    if (!silent) setLoading(false);
  }, [evidenceStatus, page, paymentStatus, search, status]);

  useEffect(() => {
    // The first fetch intentionally initializes server-backed page state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      void load(true);
    }, 30_000);
    return () => window.clearInterval(refreshId);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total claims',
        value: summary?.total || 0,
        icon: ShieldCheck,
        tone: 'violet' as const,
      },
      {
        label: 'Open workload',
        value: summary?.open || 0,
        icon: ListFilter,
        tone: 'amber' as const,
      },
      {
        label: 'Evidence received',
        value: summary?.evidenceReceived || 0,
        icon: CheckCircle2,
        tone: 'emerald' as const,
      },
      {
        label: 'Outstanding payable',
        value: formatCurrency(summary?.outstandingAmount || 0),
        icon: CircleDollarSign,
        tone: 'blue' as const,
      },
    ],
    [summary],
  );

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setPaymentStatus('');
    setEvidenceStatus('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-[1800px] space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Claims
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/claims/capture-links"
              className={adminButtonClasses.outline}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Capture links
            </Link>
            <button
              onClick={() => setShowNewClaim(true)}
              className={adminButtonClasses.primary}
            >
              <Plus className="mr-2 h-4 w-4" />
              New claim
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search claim, invoice, vehicle or party"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/10"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-[#4309ac]"
                >
                  <option value="">All claim statuses</option>
                  {claimStatusOptions.map((item) => (
                    <option key={item} value={item}>
                      {item.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={paymentStatus}
                  onChange={(event) => {
                    setPaymentStatus(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-[#4309ac]"
                >
                  <option value="">All payment statuses</option>
                  {paymentStatusOptions.map((item) => (
                    <option key={item} value={item}>
                      {item.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={evidenceStatus}
                  onChange={(event) => {
                    setEvidenceStatus(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-[#4309ac]"
                >
                  <option value="">All evidence states</option>
                  <option value="received">Evidence received</option>
                  <option value="active">Link active</option>
                  <option value="expired">Link expired</option>
                  <option value="not_requested">Not requested</option>
                </select>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </button>
                <button
                  onClick={() => void load()}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                  aria-label="Refresh"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] font-medium text-slate-400">
              {total} claims
            </p>
          </div>

          <div className="max-h-[65vh] overflow-auto">
            <table className="min-w-[2650px] border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-20 bg-slate-50">
                <tr>
                  {[
                    'S.No',
                    'Claim No.',
                    'Invoice No.',
                    'Vehicle No.',
                    'Insured Party',
                    'Supplier Address',
                    'Other Party',
                    'Buyer Address',
                    'Reason for Claim',
                    'Invoice / Insured Value (₹)',
                    'Estimation Quotation Given (₹)',
                    'We Have to Pay',
                    'Documentation',
                    'Live Evidence',
                    'Current Status',
                    'Payment Status',
                    'Remarks',
                    '',
                  ].map((heading, index) => (
                    <th
                      key={`${heading}-${index}`}
                      className={`border-b border-slate-200 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 ${
                        index === 0
                          ? 'sticky left-0 z-30 w-16 bg-slate-50'
                          : index === 1
                            ? 'sticky left-16 z-30 w-44 bg-slate-50 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.3)]'
                            : ''
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, row) => (
                    <tr key={row}>
                      {Array.from({ length: 18 }).map((__, column) => (
                        <td
                          key={column}
                          className="border-b border-slate-100 px-3 py-4"
                        >
                          <div className="h-3 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : claims.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="px-6 py-20 text-center">
                      <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        No claims match these filters
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Clear filters or initiate a new claim.
                      </p>
                    </td>
                  </tr>
                ) : (
                  claims.map((claim, index) => {
                    const docs = documentEntries(claim);
                    return (
                      <tr
                        key={claim.id}
                        onClick={() => setSelectedClaim(claim)}
                        className="group cursor-pointer bg-white transition hover:bg-violet-50/35"
                      >
                        <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-3 text-xs text-slate-500 group-hover:bg-[#faf8ff]">
                          {(page - 1) * 20 + index + 1}
                        </td>
                        <td className="sticky left-16 z-10 border-b border-slate-100 bg-white px-3 py-3 shadow-[6px_0_8px_-8px_rgba(15,23,42,0.3)] group-hover:bg-[#faf8ff]">
                          <p className="text-xs font-bold text-[#4309ac]">
                            {claim.officialClaimNumber ||
                              claim.caseNumber ||
                              'Not assigned'}
                          </p>
                          {claim.officialClaimNumber && (
                            <p className="mt-1 text-[10px] text-slate-400">
                              {claim.caseNumber}
                            </p>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-xs font-semibold text-slate-700">
                          {claim.invoice?.invoiceNumber || '—'}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-xs font-semibold text-slate-800">
                          {getVehicleNumber(claim)}
                        </td>
                        <td className="max-w-44 border-b border-slate-100 px-3 py-3 text-xs font-medium text-slate-700">
                          {getInsuredParty(claim)}
                        </td>
                        <td className="max-w-56 border-b border-slate-100 px-3 py-3 text-xs leading-relaxed text-slate-500">
                          {formatAddress(claim.invoice?.supplierAddress)}
                        </td>
                        <td className="max-w-44 border-b border-slate-100 px-3 py-3 text-xs font-medium text-slate-700">
                          {getOtherParty(claim)}
                        </td>
                        <td className="max-w-56 border-b border-slate-100 px-3 py-3 text-xs leading-relaxed text-slate-500">
                          {formatAddress(claim.invoice?.billToAddress)}
                        </td>
                        <td className="max-w-56 border-b border-slate-100 px-3 py-3 text-xs leading-relaxed text-slate-600">
                          {claim.description || 'Not recorded'}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-800">
                          {formatCurrency(
                            claim.insuredValue ?? claim.invoice?.amount,
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right text-xs font-semibold tabular-nums text-slate-700">
                          {formatCurrency(claim.quotationAmount)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-900">
                          {formatCurrency(
                            claim.approvedPayableAmount ??
                              claim.claimAmount,
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          {docs.length ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-700">
                              <FileText className="h-3.5 w-3.5" />
                              {docs.length} files
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              No files
                            </span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <EvidenceBadge claim={claim} />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <StatusBadge status={claim.status} />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <StatusBadge
                            status={claim.paymentStatus}
                            kind="payment"
                          />
                        </td>
                        <td className="max-w-64 border-b border-slate-100 px-3 py-3 text-xs leading-relaxed text-slate-500">
                          {claim.remarks || claim.notes || '—'}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#4309ac]" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Showing {claims.length ? (page - 1) * 20 + 1 : 0}–
              {Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="min-w-20 text-center text-xs font-semibold text-slate-600">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNewClaim && (
        <NewClaimModal
          onClose={() => setShowNewClaim(false)}
          onCreated={() => {
            setPage(1);
            void load();
          }}
        />
      )}
      {selectedClaim && (
        <ClaimDrawer
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onUpdated={(updated) => {
            setSelectedClaim(updated);
            setClaims((current) =>
              current.map((claim) =>
                claim.id === updated.id ? updated : claim,
              ),
            );
            void adminApi.getClaimsSummary().then((response) => {
              if (response.data) setSummary(response.data);
            });
          }}
        />
      )}
    </div>
  );
}
