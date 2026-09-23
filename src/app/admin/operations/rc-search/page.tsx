'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import {
  ChallanRecord,
  RcSearchResult,
  RcSourceStatus,
  RcValidityRow,
  RcVerdict,
  searchVehicleRc,
} from '@/features/admin/api/rc-search.api';

/**
 * RC search: a plate in, a compliance verdict out.
 *
 * The page leads with what is wrong rather than with what the vehicle is. An
 * operator opens this because they are about to invoice, track or settle a
 * claim on a truck, so the first thing on screen is the exception list — an
 * overdue road tax, a lapsed fitness certificate, unpaid challans — and the
 * identity and specification sit underneath as the evidence.
 */

const VERDICT_STYLE: Record<
  RcVerdict,
  { box: string; chip: string; title: string }
> = {
  CRITICAL: {
    box: 'border-red-200 bg-red-50',
    chip: 'bg-red-600 text-white',
    title: 'text-red-900',
  },
  ATTENTION: {
    box: 'border-amber-200 bg-amber-50',
    chip: 'bg-amber-500 text-white',
    title: 'text-amber-900',
  },
  CLEAR: {
    box: 'border-emerald-200 bg-emerald-50',
    chip: 'bg-emerald-600 text-white',
    title: 'text-emerald-900',
  },
};

const VALIDITY_STYLE: Record<RcValidityRow['state'], string> = {
  EXPIRED: 'bg-red-500',
  EXPIRING: 'bg-amber-500',
  VALID: 'bg-emerald-500',
  UNKNOWN: 'bg-slate-300',
};

const SOURCE_LABEL: Record<RcSourceStatus['source'], string> = {
  VAHAN: 'VAHAN',
  ECHALLAN: 'e-Challan',
  FASTAG_TAGS: 'FASTag tags',
  FASTAG_TOLLS: 'FASTag tolls',
};

const describeDaysLeft = (row: RcValidityRow): string => {
  if (row.daysLeft === null) return row.value ? 'date not recognised' : 'not on record';
  if (row.daysLeft < 0) {
    const ago = Math.abs(row.daysLeft);
    return `expired ${ago} day${ago === 1 ? '' : 's'} ago`;
  }
  if (row.daysLeft === 0) return 'expires today';
  return `${row.daysLeft} day${row.daysLeft === 1 ? '' : 's'} left`;
};

const rupees = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN')}`;

const kg = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? '—'
    : `${Number(value).toLocaleString('en-IN')} kg`;

const formatFetchedAt = (value: string | null): string => {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        {aside ? <div className="text-xs text-slate-400">{aside}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 break-words text-sm text-slate-900">
        {value === null || value === undefined || value === '' ? (
          <span className="text-slate-300">—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function ChallanList({ rows, tone }: { rows: ChallanRecord[]; tone: 'pending' | 'disposed' }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
        {tone === 'pending' ? 'No unpaid challans' : 'No settled challans'}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <li key={`${row.challanNumber}-${index}`} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-xs text-slate-500">{row.challanNumber}</div>
              <div className="mt-1 text-sm text-slate-900">
                {row.offences.length > 0
                  ? row.offences
                      .map((offence) =>
                        offence.act ? `s.${offence.act} ${offence.name ?? ''}`.trim() : offence.name,
                      )
                      .join(' · ')
                  : row.remark || 'Offence not stated'}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {[row.dateTime, row.place].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={`text-sm font-semibold ${
                  tone === 'pending' ? 'text-red-600' : 'text-slate-500'
                }`}
              >
                {rupees(tone === 'disposed' ? (row.receivedAmount ?? row.amount) : row.amount)}
              </div>
              {row.sentToCourt ? (
                <div className="mt-0.5 text-[11px] text-amber-600">sent to court</div>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function RcSearchPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAdmin();
  const [vehicle, setVehicle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RcSearchResult | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/admin/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const runSearch = async (plate: string, refresh: boolean) => {
    if (!plate) {
      setError('Enter a vehicle number');
      return;
    }
    setLoading(true);
    setError('');
    if (refresh === false) setResult(null);

    const response = await searchVehicleRc(plate, { refresh });
    if (!response.success || !response.data) {
      setError(response.message || 'Could not look this vehicle up');
      setResult(null);
      setLoading(false);
      return;
    }
    setResult(response.data);
    setLoading(false);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(vehicle.trim().toUpperCase(), false);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#4309ac] border-t-transparent" />
      </div>
    );
  }

  const profile = result?.profile ?? null;
  const verdictStyle = result ? VERDICT_STYLE[result.verdict] : null;
  const vahanSource = result?.sources.find((source) => source.source === 'VAHAN');

  return (
    <div className="mx-auto max-w-5xl px-1 py-2">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">RC Search</h1>
        <p className="mt-1 text-sm text-slate-500">
          Look a vehicle up on VAHAN, e-Challan and FASTag, and see what stands
          against it before you invoice or track it.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mb-6">
        <label
          htmlFor="rc-vehicle"
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Vehicle number
        </label>
        <div className="flex gap-2">
          <input
            id="rc-vehicle"
            value={vehicle}
            onChange={(event) => setVehicle(event.target.value.toUpperCase())}
            placeholder="e.g. MH40CM4399"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-base tracking-wider text-slate-900 outline-none ring-[#4309ac]/40 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-300 focus:ring-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-xl bg-[#4309ac] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Looking up…' : 'Search'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          A first lookup calls VAHAN, e-Challan and FASTag and can take a few
          seconds. Later searches are served from cache.
        </p>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading && !result ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Asking VAHAN, e-Challan and FASTag…
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          {/* Identity: enough to be sure it is the right truck, and no more. */}
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-mono text-xl font-semibold tracking-wider text-slate-900">
                {result.vehicleNumber}
              </div>
              <button
                type="button"
                onClick={() => void runSearch(result.vehicleNumber, true)}
                disabled={loading}
                className="text-xs font-medium text-[#4309ac] underline-offset-2 hover:underline disabled:opacity-50"
              >
                {loading ? 'Refreshing…' : 'Refresh from source'}
              </button>
            </div>
            {profile ? (
              <>
                <div className="mt-1 text-sm text-slate-700">
                  {[profile.makerDescription, profile.makerModel].filter(Boolean).join(' ') ||
                    '—'}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {[
                    profile.vehicleClass,
                    profile.vehicleCategory,
                    profile.axleCount ? `${profile.axleCount}-axle` : null,
                    profile.fuel,
                    profile.emissionNorms,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {profile.ownerName || '—'}
                  {profile.ownerSerial ? ` · owner #${profile.ownerSerial}` : ''}
                  {profile.registeredAt ? ` · ${profile.registeredAt}` : ''}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-slate-500">
                {vahanSource?.status === 'NOT_FOUND'
                  ? 'VAHAN has no RC on record for this number.'
                  : 'VAHAN did not answer, so there is no RC to show.'}
              </div>
            )}
          </div>

          {/* The verdict, and the reasons behind it. */}
          {profile && verdictStyle ? (
            <div className={`rounded-xl border px-5 py-4 ${verdictStyle.box}`}>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${verdictStyle.chip}`}
                >
                  {result.verdict === 'CLEAR' ? 'Clear' : result.verdict}
                </span>
                <span className={`text-sm font-semibold ${verdictStyle.title}`}>
                  {result.verdict === 'CLEAR'
                    ? 'Nothing outstanding against this vehicle'
                    : `${result.issues.length} issue${result.issues.length === 1 ? '' : 's'} found`}
                </span>
              </div>
              {result.issues.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {result.issues.map((issue) => (
                    <li key={issue.code + issue.message} className="flex items-start gap-2 text-sm">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          issue.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-slate-800">{issue.message}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {/* Every document with an expiry, in one grid. */}
          {result.validity.length > 0 ? (
            <Section title="Validity">
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.validity.map((row) => (
                  <div key={row.key} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${VALIDITY_STYLE[row.state]}`}
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        {row.label}
                      </div>
                      <div className="text-sm text-slate-900">{row.value || '—'}</div>
                      <div
                        className={`text-xs ${
                          row.state === 'EXPIRED'
                            ? 'text-red-600'
                            : row.state === 'EXPIRING'
                              ? 'text-amber-600'
                              : 'text-slate-400'
                        }`}
                      >
                        {describeDaysLeft(row)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Challans. */}
          <Section
            title="Challans"
            aside={
              result.challans
                ? `${rupees(result.challans.pendingAmount)} unpaid · ${
                    result.challans.disposedCount
                  } settled`
                : 'not available'
            }
          >
            {result.challans ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-600">
                    Pending ({result.challans.pendingCount})
                  </div>
                  <ChallanList rows={result.challans.pending} tone="pending" />
                </div>
                {result.challans.disposedCount > 0 ? (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-600">
                      Settled ({result.challans.disposedCount})
                    </div>
                    <ChallanList rows={result.challans.disposed} tone="disposed" />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                e-Challan did not answer for this vehicle.
              </div>
            )}
          </Section>

          {/* FASTag register. */}
          <Section
            title="FASTag"
            aside={
              result.fastag
                ? `${result.fastag.activeCount} active of ${result.fastag.tags.length}`
                : 'not available'
            }
          >
            {result.fastag ? (
              <ul className="divide-y divide-slate-100">
                {result.fastag.tags.map((tag) => (
                  <li key={tag.tagId} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs text-slate-600">{tag.tagId}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {[
                          tag.vehicleClass,
                          tag.issueDate ? `issued ${tag.issueDate}` : null,
                          tag.bankId ? `bank ${tag.bankId}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        tag.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tag.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-400">
                No FASTag on record, or the register did not answer.
              </div>
            )}
          </Section>

          {/* Recent toll crossings — the only live feed on this page. */}
          {result.tolls && result.tolls.length > 0 ? (
            <Section title="Recent tolls" aside={`${result.tolls.length} in the last ~72h`}>
              <ul className="divide-y divide-slate-100">
                {result.tolls.slice(0, 12).map((toll, index) => (
                  <li
                    key={`${toll.timeRecorded}-${index}`}
                    className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 text-sm text-slate-800">
                      {toll.address || 'Unknown plaza'}
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">{toll.timeRecorded || '—'}</div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Everything else VAHAN knows. */}
          {profile ? (
            <Section title="Vehicle & registration">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
                <Field label="RC status" value={profile.rcStatus} />
                <Field label="Registered on" value={profile.registrationDate} />
                <Field label="Registered at" value={profile.registeredAt} />
                <Field label="Manufactured" value={profile.manufacturedOn} />
                <Field label="Gross weight" value={kg(profile.gvwKg)} />
                <Field label="Unladen weight" value={kg(profile.unladenKg)} />
                <Field label="Axles" value={profile.axleCount} />
                <Field label="Wheelbase" value={profile.wheelbaseMm ? `${profile.wheelbaseMm} mm` : null} />
                <Field label="Body type" value={profile.bodyType} />
                <Field label="Colour" value={profile.color} />
                <Field label="Engine" value={profile.cubicCapacity ? `${profile.cubicCapacity} cc` : null} />
                <Field label="Seating" value={profile.seatCapacity} />
                <Field label="Chassis no." value={<span className="font-mono text-xs">{profile.chassisNumber}</span>} />
                <Field label="Engine no." value={<span className="font-mono text-xs">{profile.engineNumber}</span>} />
                <Field label="Sale amount" value={rupees(profile.saleAmount)} />
                <Field label="Owner category" value={profile.ownerCategory} />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-slate-100 pt-5 lg:grid-cols-4">
                <Field label="Insurer" value={profile.insurer} />
                <Field label="Policy no." value={<span className="font-mono text-xs">{profile.policyNumber}</span>} />
                <Field label="Financed by" value={profile.financer} />
                <Field label="Tax mode" value={profile.taxMode} />
                <Field label="Permit no." value={profile.permitNumber} />
                <Field label="Permit type" value={profile.permitType} />
                <Field label="Permit route" value={profile.permitRouteRegion} />
                <Field label="Permit issued by" value={profile.permitIssuingAuthority} />
                <Field label="PUC no." value={profile.puccNumber} />
                <Field label="Present address" value={profile.presentAddress} />
                <Field label="Blacklist" value={profile.blacklistStatus || 'None'} />
                <Field label="NOC" value={profile.nocDetails || 'None'} />
              </div>
            </Section>
          ) : null}

          {/* Where each part of this page came from, and how fresh it is. */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Sources
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {result.sources.map((source) => (
                <div key={source.source} className="text-xs">
                  <span className="font-medium text-slate-700">
                    {SOURCE_LABEL[source.source]}
                  </span>
                  <span
                    className={
                      source.status === 'FOUND'
                        ? ' text-slate-500'
                        : source.status === 'NOT_FOUND'
                          ? ' text-slate-400'
                          : ' text-red-500'
                    }
                  >
                    {' · '}
                    {source.status === 'FOUND'
                      ? `${source.fromCache ? 'cached' : 'live'} ${formatFetchedAt(source.fetchedAt)}`
                      : source.status === 'NOT_FOUND'
                        ? 'no record'
                        : source.status === 'NOT_CONFIGURED'
                          ? 'not configured'
                          : 'unavailable'}
                  </span>
                </div>
              ))}
            </div>
            {result.sources.some((source) => source.error) ? (
              <ul className="mt-2 space-y-0.5">
                {result.sources
                  .filter((source) => source.error)
                  .map((source) => (
                    <li key={`${source.source}-error`} className="text-[11px] text-slate-400">
                      {SOURCE_LABEL[source.source]}: {source.error}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
