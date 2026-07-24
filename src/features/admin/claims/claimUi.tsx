'use client';

import type { ClaimRequest } from '@/features/admin/api/admin.api';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Link2,
  MapPin,
} from 'lucide-react';

export type EvidenceState =
  | 'not_requested'
  | 'active'
  | 'received'
  | 'expired';

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
    ...(withTime
      ? { hour: '2-digit', minute: '2-digit' }
      : {}),
  });
}

export function formatAddress(value?: string[] | string | null) {
  if (!value) return '—';
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
}

export function getVehicleNumber(claim: ClaimRequest) {
  return (
    claim.invoice?.vehicleNumber ||
    claim.invoice?.truckNumber ||
    'Not recorded'
  );
}

export function getInsuredParty(claim: ClaimRequest) {
  const invoice = claim.invoice as ClaimRequest['invoice'] & {
    insuredPersonNameSnapshot?: string | null;
  };
  return (
    invoice?.insuredPersonNameSnapshot ||
    invoice?.supplierName ||
    invoice?.supplier ||
    '—'
  );
}

export function getOtherParty(claim: ClaimRequest) {
  return (
    claim.invoice?.billToName ||
    claim.invoice?.buyer ||
    claim.invoice?.shipToName ||
    '—'
  );
}

export function getEvidenceState(claim: ClaimRequest): EvidenceState {
  if (claim.evidenceSubmittedAt) return 'received';
  if (!claim.captureLinkExpiresAt) return 'not_requested';
  const expiresAt = new Date(claim.captureLinkExpiresAt).getTime();
  if (
    !claim.captureLinkUsedAt &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now()
  ) {
    return 'active';
  }
  return 'expired';
}

export const claimStatusLabels: Record<string, string> = {
  pending: 'Pending',
  inprogress: 'In progress',
  surveyor_assigned: 'Surveyor assigned',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  settled: 'Settled',
};

export const paymentStatusLabels: Record<string, string> = {
  not_started: 'Not started',
  awaiting_approval: 'Awaiting approval',
  approved_for_payment: 'Approved for payment',
  processing: 'Processing',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  on_hold: 'On hold',
  failed: 'Failed',
  not_applicable: 'Not applicable',
};

export function StatusBadge({
  status,
  kind = 'claim',
}: {
  status?: string | null;
  kind?: 'claim' | 'payment';
}) {
  const normalized = String(status || 'not_started').toLowerCase();
  const success = ['approved', 'completed', 'settled', 'paid'].includes(
    normalized,
  );
  const danger = ['rejected', 'failed'].includes(normalized);
  const warning = [
    'pending',
    'inprogress',
    'awaiting_approval',
    'processing',
    'partially_paid',
    'on_hold',
  ].includes(normalized);
  const classes = success
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : danger
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : warning
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  const label =
    kind === 'payment'
      ? paymentStatusLabels[normalized]
      : claimStatusLabels[normalized];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}
    >
      {label || normalized.replaceAll('_', ' ')}
    </span>
  );
}

export function EvidenceBadge({ claim }: { claim: ClaimRequest }) {
  const state = getEvidenceState(claim);
  const config = {
    received: {
      label: 'Evidence received',
      detail: `${claim.evidencePhotos?.length || 0} photos · ${claim.evidenceVideos?.length || 0} videos`,
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
    },
    active: {
      label: 'Link active',
      detail: `Until ${formatDate(claim.captureLinkExpiresAt)}`,
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

export function LocationLink({ claim }: { claim: ClaimRequest }) {
  if (!claim.locationLatitude || !claim.locationLongitude) return null;
  const href = `https://www.google.com/maps?q=${claim.locationLatitude},${claim.locationLongitude}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4309ac] hover:underline"
    >
      <MapPin className="h-3.5 w-3.5" />
      Open captured location
    </a>
  );
}
