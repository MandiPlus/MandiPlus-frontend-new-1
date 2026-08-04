'use client';

import type { ClaimRequest } from '@/features/admin/api/admin.api';
import { AlertCircle, CheckCircle2, Clock3, Link2, MapPin } from 'lucide-react';

export type EvidenceState = 'not_requested' | 'active' | 'received' | 'expired';
export type CaptureType = 'accident' | 'engine_seize';

const developerTestIdentityPattern = /O[m]\s+B[h]ojane(?:\s*\(Test\))?/gi;

function removeDeveloperTestIdentity(value: string) {
  return value.replace(developerTestIdentityPattern, 'MandiPlus Test Buyer');
}

export function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '—';
  return `₹${Number(value).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value?: string | null, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatAddress(value?: string[] | string | null) {
  if (!value) return '—';
  const address = Array.isArray(value)
    ? value.filter(Boolean).join(', ')
    : value;
  return removeDeveloperTestIdentity(address);
}

export function getVehicleNumber(claim: ClaimRequest) {
  return (
    claim.invoice?.vehicleNumber || claim.invoice?.truckNumber || 'Not recorded'
  );
}

type ClaimInvoice = ClaimRequest['invoice'] & {
  invoiceType?: string | null;
  insuredPersonNameSnapshot?: string | null;
  insuredPersonDisplayName?: string | null;
  otherPartyDisplayName?: string | null;
  weighmentSlipNote?: string | null;
};

function getClaimInvoice(claim: ClaimRequest): ClaimInvoice | undefined {
  return claim.invoice as ClaimInvoice | undefined;
}

export function isBuyerInsuredClaim(claim: ClaimRequest): boolean {
  const invoice = getClaimInvoice(claim);
  if (!invoice) return false;

  if (invoice.invoiceType) {
    return String(invoice.invoiceType).toUpperCase() === 'BUYER_INVOICE';
  }

  const note = (invoice.weighmentSlipNote || '').toLowerCase().trim();
  return note.includes('cash') || note.includes('nak') || note.includes('nag');
}

function getCanonicalPartyNames(claim: ClaimRequest): { insured: string; other: string } {
  const invoice = getClaimInvoice(claim);
  if (!invoice) return { insured: '—', other: '—' };

  if (invoice.insuredPersonDisplayName || invoice.otherPartyDisplayName) {
    return {
      insured: removeDeveloperTestIdentity(invoice.insuredPersonDisplayName || '—'),
      other: removeDeveloperTestIdentity(invoice.otherPartyDisplayName || '—'),
    };
  }

  const isBuyerInsured = isBuyerInsuredClaim(claim);
  const insured =
    invoice.insuredPersonNameSnapshot ||
    (isBuyerInsured
      ? invoice.billToName || invoice.buyer
      : invoice.supplierName || invoice.supplier) ||
    '—';
  const other = isBuyerInsured
    ? invoice.supplierName || invoice.supplier || '—'
    : invoice.billToName || invoice.buyer || invoice.shipToName || '—';

  return {
    insured: removeDeveloperTestIdentity(insured),
    other: removeDeveloperTestIdentity(other),
  };
}

export function getInsuredParty(claim: ClaimRequest) {
  return getCanonicalPartyNames(claim).insured;
}

export function getInsuredPersonAddress(claim: ClaimRequest) {
  const invoice = getClaimInvoice(claim);
  if (!invoice) return '—';

  const address = isBuyerInsuredClaim(claim)
    ? invoice.billToAddress || invoice.shipToAddress
    : invoice.supplierAddress;

  return formatAddress(address);
}

export function getOtherParty(claim: ClaimRequest) {
  return getCanonicalPartyNames(claim).other;
}

export function getOtherPartyAddress(claim: ClaimRequest) {
  const invoice = getClaimInvoice(claim);
  if (!invoice) return '—';

  const address = isBuyerInsuredClaim(claim)
    ? invoice.supplierAddress
    : invoice.billToAddress || invoice.shipToAddress;

  return formatAddress(address);
}

export function getEvidenceState(
  claim: ClaimRequest,
  captureType?: CaptureType,
): EvidenceState {
  const engineSeize = captureType === 'engine_seize';
  const submittedAt = engineSeize
    ? claim.engineSeizeEvidenceSubmittedAt
    : claim.evidenceSubmittedAt;
  const linkExpiresAt = engineSeize
    ? claim.engineSeizeCaptureLinkExpiresAt
    : claim.captureLinkExpiresAt;
  const linkUsedAt = engineSeize
    ? claim.engineSeizeCaptureLinkUsedAt
    : claim.captureLinkUsedAt;

  if (submittedAt || (!captureType && claim.engineSeizeEvidenceSubmittedAt)) {
    return 'received';
  }
  if (
    !linkExpiresAt &&
    (captureType || !claim.engineSeizeCaptureLinkExpiresAt)
  ) {
    return 'not_requested';
  }
  const expiresAt = Math.max(
    new Date(linkExpiresAt || 0).getTime(),
    !captureType
      ? new Date(claim.engineSeizeCaptureLinkExpiresAt || 0).getTime()
      : 0,
  );
  if (
    (!linkUsedAt || (!captureType && !claim.engineSeizeCaptureLinkUsedAt)) &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now()
  ) {
    return 'active';
  }
  return 'expired';
}

export const claimStatusLabels: Record<string, string> = {
  pending: 'PENDING',
  inprogress: 'IN PROGRESS',
  surveyor_assigned: 'SURVEYOR ASSIGNED',
  survey_report_awaited: 'SURVEY REPORT AWAITED',
  fir_awaited: 'FIR AWAITED',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  completed: 'COMPLETED',
  settled: 'SETTLED',
};

export const paymentStatusLabels: Record<string, string> = {
  not_started: 'NOT STARTED',
  awaiting_approval: 'AWAITING APPROVAL',
  approved_for_payment: 'APPROVED FOR PAYMENT',
  processing: 'PROCESSING',
  partially_paid: 'PARTIALLY PAID',
  paid: 'PAID',
  on_hold: 'ON HOLD',
  failed: 'FAILED',
  rejected: 'REJECTED',
  not_applicable: 'N/A',
};

export function StatusBadge({
  status,
  kind = 'claim',
}: {
  status?: string | null;
  kind?: 'claim' | 'payment';
}) {
  if (!status) return <span className="text-xs text-slate-400 font-medium">—</span>;
  const raw = String(status).trim();
  const normalized = raw.toLowerCase().replaceAll(' ', '_');

  const isApprovedOrPaid = ['approved', 'completed', 'settled', 'paid', 'approved_for_payment'].includes(
    normalized,
  ) || raw.toUpperCase() === 'APPROVED' || raw.toUpperCase() === 'PAID';

  const isRejected = ['rejected', 'failed'].includes(normalized) || raw.toUpperCase() === 'REJECTED';

  const isYellowOrCream = [
    'fir_awaited',
    'surveyor_assigned',
    'survey_report_awaited',
    'pending',
    'inprogress',
    'awaiting_approval',
    'on_hold',
  ].includes(normalized) || raw.toUpperCase().includes('AWAITED') || raw.toUpperCase().includes('WAITING');

  let classes = 'border-slate-200 bg-slate-100 text-slate-700 font-semibold';
  if (isApprovedOrPaid) {
    classes = 'border-emerald-300 bg-emerald-100 text-emerald-900 font-extrabold shadow-sm';
  } else if (isRejected) {
    classes = 'border-rose-300 bg-rose-100 text-rose-900 font-extrabold shadow-sm';
  } else if (isYellowOrCream) {
    classes = 'border-amber-300 bg-amber-100 text-amber-950 font-bold';
  }

  const displayLabel =
    (kind === 'payment'
      ? paymentStatusLabels[normalized]
      : claimStatusLabels[normalized]) || raw.toUpperCase();

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-wider ${classes}`}
    >
      {displayLabel}
    </span>
  );
}

export function EvidenceBadge({
  claim,
  captureType,
}: {
  claim: ClaimRequest;
  captureType?: CaptureType;
}) {
  const state = getEvidenceState(claim, captureType);
  const engineSeize = captureType === 'engine_seize';
  const photos = engineSeize
    ? claim.engineSeizeEvidencePhotos?.length || 0
    : claim.evidencePhotos?.length || 0;
  const videos = engineSeize
    ? claim.engineSeizeEvidenceVideos?.length || 0
    : claim.evidenceVideos?.length || 0;
  const expiresAt = engineSeize
    ? claim.engineSeizeCaptureLinkExpiresAt
    : claim.captureLinkExpiresAt;
  const config = {
    received: {
      label: engineSeize ? 'Engine evidence received' : 'Evidence received',
      detail: captureType
        ? `${photos} photos · ${videos} videos`
        : `${photos + (claim.engineSeizeEvidencePhotos?.length || 0)} photos · ${videos + (claim.engineSeizeEvidenceVideos?.length || 0)} videos`,
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
    },
    active: {
      label: 'Link active',
      detail: `Until ${formatDate(expiresAt)}`,
      classes: 'border-violet-200 bg-violet-50 text-violet-700',
      icon: Link2,
    },
    expired: {
      label: 'Link expired',
      detail: 'Regenerate to collect',
      classes: 'border-rose-200 bg-rose-50 text-rose-700',
      icon: AlertCircle,
    },
    not_requested: {
      label: 'Not requested',
      detail: 'No capture link',
      classes: 'border-slate-200 bg-slate-50 text-slate-600',
      icon: Clock3,
    },
  }[state];
  const Icon = config.icon;
  return (
    <div
      className={`inline-flex min-w-[150px] items-start gap-2 rounded-lg border px-2.5 py-2 ${config.classes}`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <p className="text-[11px] font-semibold leading-none">{config.label}</p>
        <p className="mt-1 text-[10px] opacity-80">{config.detail}</p>
      </div>
    </div>
  );
}

export function LocationLink({
  claim,
  captureType = 'accident',
}: {
  claim: ClaimRequest;
  captureType?: CaptureType;
}) {
  const latitude = Number(
    captureType === 'engine_seize'
      ? claim.engineSeizeLocationLatitude
      : claim.locationLatitude,
  );
  const longitude = Number(
    captureType === 'engine_seize'
      ? claim.engineSeizeLocationLongitude
      : claim.locationLongitude,
  );
  const accuracy = Number(
    captureType === 'engine_seize'
      ? claim.engineSeizeLocationAccuracyMeters
      : claim.locationAccuracyMeters,
  );
  const capturedAt =
    captureType === 'engine_seize'
      ? claim.engineSeizeLocationCapturedAt
      : claim.locationCapturedAt;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const href = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const accuracyLabel = Number.isFinite(accuracy)
    ? ` · ±${Math.round(accuracy)}m`
    : '';
  const timeLabel = capturedAt ? ` · ${formatDate(capturedAt, true)}` : '';

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-700">
        {latitude.toFixed(6)}, {longitude.toFixed(6)}
        {accuracyLabel}
        {timeLabel}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4309ac] hover:underline"
      >
        <MapPin className="h-3.5 w-3.5" />
        Open map
      </a>
    </div>
  );
}
