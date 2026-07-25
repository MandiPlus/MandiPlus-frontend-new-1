'use client';

import {
  ClaimCaptureLinkResult,
  ClaimRequest,
  EligibleClaimInvoice,
  adminApi,
} from '@/features/admin/api/admin.api';
import InvoicePicker from '@/features/admin/claims/InvoicePicker';
import {
  CaptureType,
  EvidenceBadge,
  formatDate,
  getEvidenceState,
  getInsuredParty,
  getVehicleNumber,
} from '@/features/admin/claims/claimUi';
import { adminButtonClasses } from '@/features/admin/utils/adminUi';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

function CaptureLinkModal({
  onClose,
  onGenerated,
  captureType,
}: {
  onClose: () => void;
  onGenerated: (result: ClaimCaptureLinkResult) => void;
  captureType: CaptureType;
}) {
  const [invoice, setInvoice] = useState<EligibleClaimInvoice | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!invoice) return;
    setLoading(true);
    const response = await adminApi.createClaimCaptureLink({
      invoiceId: invoice.id,
      captureType,
    });
    setLoading(false);
    if (!response.success || !response.data) {
      toast.error(response.message || 'Could not create capture link');
      return;
    }
    onGenerated(response.data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Create{' '}
              {captureType === 'engine_seize' ? 'engine seize' : 'accident'}{' '}
              capture request
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">
          <InvoicePicker value={invoice} onChange={setInvoice} />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className={adminButtonClasses.secondary}>
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={!invoice || loading}
            className={adminButtonClasses.primary}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Generate link
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratedLinkModal({
  result,
  onClose,
}: {
  result: ClaimCaptureLinkResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window === 'undefined'
      ? `/claim/${result.token}`
      : `${window.location.origin}/claim/${result.token}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Capture link copied');
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <Check className="h-5 w-5" />
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">
          {result.captureType === 'engine_seize'
            ? 'Engine seize link ready'
            : 'Accident claim link ready'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {result.invoiceNumber} · {result.vehicleNumber} · expires{' '}
          {formatDate(result.expiresAt, true)}
        </p>
        <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
          <p className="break-all text-xs font-medium leading-relaxed text-[#4309ac]">
            {link}
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={copy}
            className={`${adminButtonClasses.primary} flex-1`}
          >
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className={adminButtonClasses.outline}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          For security, the full link is shown only now. If it is lost, generate
          a new link from this workspace.
        </p>
      </div>
    </div>
  );
}

export default function CaptureLinksPage() {
  const [captureType, setCaptureType] = useState<CaptureType>('accident');
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [generated, setGenerated] = useState<ClaimCaptureLinkResult | null>(
    null,
  );
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await adminApi.getClaimCaptureLinks({
      search: search || undefined,
      evidenceStatus:
        (state as 'not_requested' | 'active' | 'received' | 'expired') ||
        undefined,
      captureType,
      page,
      limit: 20,
    });
    setClaims(response.data?.data || []);
    setTotal(response.data?.total || 0);
    setTotalPages(response.data?.totalPages || 1);
    setLoading(false);
    if (!response.success) {
      toast.error(response.message || 'Could not load capture links');
    }
  }, [captureType, page, search, state]);

  useEffect(() => {
    // The first fetch intentionally initializes server-backed page state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const generateForClaim = async (claim: ClaimRequest) => {
    const invoiceId = claim.invoice?.id || claim.invoice?._id;
    if (!invoiceId) {
      toast.error('This claim has no linked invoice');
      return;
    }
    setGeneratingId(claim.id);
    const response = await adminApi.createClaimCaptureLink({
      invoiceId,
      captureType,
    });
    setGeneratingId(null);
    if (!response.success || !response.data) {
      toast.error(response.message || 'Could not generate link');
      return;
    }
    setGenerated(response.data);
    void load();
  };

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link
              href="/admin/claims"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#4309ac]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Claims dashboard
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              {captureType === 'engine_seize'
                ? 'Engine seize links'
                : 'Accident claim links'}
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className={adminButtonClasses.primary}
          >
            <Plus className="mr-2 h-4 w-4" />
            New capture request
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {[
            { value: 'accident' as const, label: 'Accident claim links' },
            { value: 'engine_seize' as const, label: 'Engine seize links' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setCaptureType(item.value);
                setState('');
                setPage(1);
              }}
              className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
                captureType === item.value
                  ? 'bg-[#4309ac] text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search claim, invoice, vehicle or party"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/10"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={state}
                onChange={(event) => {
                  setState(event.target.value);
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
                onClick={() => void load()}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'Claim / invoice',
                    'Vehicle',
                    'Insured party',
                    'Capture state',
                    'Received data',
                    'Location',
                    'Last activity',
                    'Action',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-slate-200 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 7 }).map((_, row) => (
                    <tr key={row}>
                      {Array.from({ length: 8 }).map((__, column) => (
                        <td
                          key={column}
                          className="border-b border-slate-100 px-4 py-5"
                        >
                          <div className="h-3 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : claims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <Link2 className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        No capture records match
                      </p>
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => {
                    const evidenceReceived = Boolean(
                      captureType === 'engine_seize'
                        ? claim.engineSeizeEvidenceSubmittedAt
                        : claim.evidenceSubmittedAt,
                    );
                    const photos =
                      captureType === 'engine_seize'
                        ? claim.engineSeizeEvidencePhotos || []
                        : claim.evidencePhotos || [];
                    const videos =
                      captureType === 'engine_seize'
                        ? claim.engineSeizeEvidenceVideos || []
                        : claim.evidenceVideos || [];
                    const latitude =
                      captureType === 'engine_seize'
                        ? claim.engineSeizeLocationLatitude
                        : claim.locationLatitude;
                    const longitude =
                      captureType === 'engine_seize'
                        ? claim.engineSeizeLocationLongitude
                        : claim.locationLongitude;
                    const submittedAt =
                      captureType === 'engine_seize'
                        ? claim.engineSeizeEvidenceSubmittedAt
                        : claim.evidenceSubmittedAt;
                    return (
                      <tr
                        key={claim.id}
                        className="transition hover:bg-violet-50/35"
                      >
                        <td className="border-b border-slate-100 px-4 py-3">
                          <p className="text-xs font-bold text-[#4309ac]">
                            {claim.officialClaimNumber ||
                              claim.caseNumber ||
                              'Not assigned'}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {claim.invoice?.invoiceNumber}
                          </p>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-800">
                          {getVehicleNumber(claim)}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-xs text-slate-700">
                          {getInsuredParty(claim)}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <EvidenceBadge
                            claim={claim}
                            captureType={captureType}
                          />
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                              <ImageIcon className="h-3 w-3" />
                              {photos.length}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                              <Video className="h-3 w-3" />
                              {videos.length}
                            </span>
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {latitude && longitude ? (
                            <a
                              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4309ac] hover:underline"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              Open map
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Awaiting GPS
                            </span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
                          {formatDate(submittedAt || claim.updatedAt, true)}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {evidenceReceived ? (
                            <Link
                              href={`/admin/claims`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4309ac] hover:underline"
                            >
                              Review claim
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <button
                              onClick={() => void generateForClaim(claim)}
                              disabled={generatingId === claim.id}
                              className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-[#4309ac] hover:bg-violet-100 disabled:opacity-50"
                            >
                              {generatingId === claim.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {getEvidenceState(claim, captureType) ===
                              'not_requested'
                                ? 'Generate link'
                                : 'Regenerate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              {total} linked claims · page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
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

      {showCreate && (
        <CaptureLinkModal
          onClose={() => setShowCreate(false)}
          onGenerated={(result) => {
            setShowCreate(false);
            setGenerated(result);
            void load();
          }}
          captureType={captureType}
        />
      )}
      {generated && (
        <GeneratedLinkModal
          result={generated}
          onClose={() => setGenerated(null)}
        />
      )}
    </div>
  );
}
