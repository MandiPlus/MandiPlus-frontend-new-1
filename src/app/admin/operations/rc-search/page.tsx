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
 * The page leads with what is wrong rather than with what the vehicle is, and
 * carries no explanatory copy — the operator knows why they are here. A field
 * VAHAN left blank is dropped rather than rendered as a dash, so the length of
 * a card tracks how much is actually known about the vehicle.
 */

const VERDICT_STYLE: Record<RcVerdict, { box: string; chip: string }> = {
  CRITICAL: { box: 'border-red-200 bg-red-50', chip: 'bg-red-600 text-white' },
  ATTENTION: { box: 'border-amber-200 bg-amber-50', chip: 'bg-amber-500 text-white' },
  CLEAR: { box: 'border-emerald-200 bg-emerald-50', chip: 'bg-emerald-600 text-white' },
};

const VALIDITY_DOT: Record<RcValidityRow['state'], string> = {
  EXPIRED: 'bg-red-500',
  EXPIRING: 'bg-amber-500',
  VALID: 'bg-emerald-500',
  UNKNOWN: 'bg-slate-300',
};

const SOURCE_LABEL: Record<RcSourceStatus['source'], string> = {
  VAHAN: 'VAHAN',
  ECHALLAN: 'e-Challan',
  FASTAG_TAGS: 'FASTag',
  FASTAG_TOLLS: 'Tolls',
};

const describeDaysLeft = (row: RcValidityRow): string => {
  if (row.daysLeft === null) return row.value ? 'unreadable date' : 'not on record';
  if (row.daysLeft < 0) return `expired ${Math.abs(row.daysLeft)}d ago`;
  if (row.daysLeft === 0) return 'expires today';
  return `${row.daysLeft}d left`;
};

const rupees = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`;

const kg = (value: number | null | undefined): string | null =>
  value === null || value === undefined ? null : `${Number(value).toLocaleString('en-IN')} kg`;

const shortTime = (value: string | null): string => {
  if (!value) return '';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toLocaleTimeString('en-IN', {
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
      <div className="flex items-baseline justify-between border-b border-slate-100 px-5 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {aside ? <div className="text-xs text-slate-400">{aside}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Renders nothing at all when VAHAN had no value for the field. */
function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 break-words text-sm text-slate-900">{value}</div>
    </div>
  );
}

function ChallanList({ rows, tone }: { rows: ChallanRecord[]; tone: 'pending' | 'disposed' }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <li key={`${row.challanNumber}-${index}`} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {/* The remark is the short human wording ("Over Height Vehicles");
                  the offence names are the fallback, and the Act sections go in
                  the meta line where they do not crowd out what happened. */}
              <div className="line-clamp-2 text-sm text-slate-900">
                {row.remark ||
                  row.offences
                    .map((offence) => offence.name)
                    .filter(Boolean)
                    .join(' · ') ||
                  'Offence not stated'}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {[
                  row.dateTime,
                  row.stateCode,
                  row.offences
                    .map((offence) => (offence.act ? `s.${offence.act}` : null))
                    .filter(Boolean)
                    .join(' '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={`text-sm font-semibold ${
                  tone === 'pending' ? 'text-red-600' : 'text-slate-400'
                }`}
              >
                {rupees(tone === 'disposed' ? (row.receivedAmount ?? row.amount) : row.amount)}
              </div>
              {row.sentToCourt ? (
                <div className="text-[11px] text-amber-600">court</div>
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
    if (!refresh) setResult(null);

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
    <div className="mx-auto max-w-4xl px-1 py-2">
      <form onSubmit={onSubmit} className="mb-5 flex gap-2">
        <input
          id="rc-vehicle"
          value={vehicle}
          onChange={(event) => setVehicle(event.target.value.toUpperCase())}
          placeholder="MH40CM4399"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-base tracking-wider text-slate-900 outline-none ring-[#4309ac]/40 placeholder:tracking-normal placeholder:text-slate-300 focus:ring-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-[#4309ac] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading && !result ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Looking up…
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          {/* Identity. */}
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-mono text-xl font-semibold tracking-wider text-slate-900">
                {result.vehicleNumber}
              </div>
              <button
                type="button"
                onClick={() => void runSearch(result.vehicleNumber, true)}
                disabled={loading}
                className="text-xs text-[#4309ac] underline-offset-2 hover:underline disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
            {profile ? (
              <>
                <div className="mt-1 text-sm text-slate-700">
                  {[profile.makerDescription, profile.makerModel].filter(Boolean).join(' ')}
                </div>
                <div className="mt-0.5 text-sm text-slate-500">
                  {[
                    profile.vehicleClass,
                    profile.vehicleCategory,
                    profile.axleCount ? `${profile.axleCount}-axle` : null,
                    profile.fuel,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="mt-1.5 text-sm text-slate-500">
                  {[profile.ownerName, profile.registeredAt].filter(Boolean).join(' · ')}
                </div>
              </>
            ) : (
              <div className="mt-1 text-sm text-slate-500">
                {vahanSource?.status === 'NOT_FOUND' ? 'No RC on VAHAN' : 'VAHAN did not answer'}
              </div>
            )}
          </div>

          {/* Verdict. */}
          {profile && verdictStyle ? (
            <div className={`rounded-xl border px-5 py-4 ${verdictStyle.box}`}>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${verdictStyle.chip}`}
              >
                {result.verdict === 'CLEAR' ? 'Clear' : result.verdict}
              </span>
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

          {/* Validity. */}
          {result.validity.length > 0 ? (
            <Section title="Validity">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                {result.validity.map((row) => (
                  <div key={row.key} className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${VALIDITY_DOT[row.state]}`}
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

          {/* Challans — only when there are any. */}
          {result.challans &&
          (result.challans.pendingCount > 0 || result.challans.disposedCount > 0) ? (
            <Section
              title="Challans"
              aside={`${rupees(result.challans.pendingAmount)} unpaid`}
            >
              <ChallanList rows={result.challans.pending} tone="pending" />
              {result.challans.disposedCount > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <ChallanList rows={result.challans.disposed} tone="disposed" />
                </div>
              ) : null}
            </Section>
          ) : null}

          {/* FASTag. */}
          {result.fastag && result.fastag.tags.length > 0 ? (
            <Section title="FASTag" aside={`${result.fastag.activeCount} of ${result.fastag.tags.length} active`}>
              <ul className="divide-y divide-slate-100">
                {result.fastag.tags.map((tag) => (
                  <li
                    key={tag.tagId}
                    className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 text-xs text-slate-500">
                      {[tag.vehicleClass, tag.issueDate].filter(Boolean).join(' · ')}
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-semibold ${
                        tag.isActive ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {tag.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Recent tolls. */}
          {result.tolls && result.tolls.length > 0 ? (
            <Section title="Recent tolls">
              <ul className="divide-y divide-slate-100">
                {result.tolls.slice(0, 8).map((toll, index) => (
                  <li
                    key={`${toll.timeRecorded}-${index}`}
                    className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 text-sm text-slate-800">{toll.address}</div>
                    <div className="shrink-0 text-xs text-slate-400">{toll.timeRecorded}</div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Everything else worth keeping from the RC. */}
          {profile ? (
            <Section title="Vehicle">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
                <Field label="RC status" value={profile.rcStatus} />
                <Field label="Registered" value={profile.registrationDate} />
                <Field label="Manufactured" value={profile.manufacturedOn} />
                <Field label="Body" value={profile.bodyType} />
                <Field label="Gross weight" value={kg(profile.gvwKg)} />
                <Field label="Unladen" value={kg(profile.unladenKg)} />
                <Field
                  label="Chassis"
                  value={
                    profile.chassisNumber ? (
                      <span className="font-mono text-xs">{profile.chassisNumber}</span>
                    ) : null
                  }
                />
                <Field
                  label="Engine"
                  value={
                    profile.engineNumber ? (
                      <span className="font-mono text-xs">{profile.engineNumber}</span>
                    ) : null
                  }
                />
                <Field label="Insurer" value={profile.insurer} />
                <Field
                  label="Policy"
                  value={
                    profile.policyNumber ? (
                      <span className="font-mono text-xs">{profile.policyNumber}</span>
                    ) : null
                  }
                />
                <Field label="Financed by" value={profile.financer} />
                <Field label="Permit" value={profile.permitType} />
              </div>
            </Section>
          ) : null}

          {/* Freshness, in one line. */}
          <div className="px-1 text-[11px] text-slate-400">
            {result.sources.map((source, index) => (
              <span key={source.source} title={source.error ?? undefined}>
                {index > 0 ? ' · ' : ''}
                {SOURCE_LABEL[source.source]}{' '}
                <span className={source.status === 'FAILED' ? 'text-red-400' : ''}>
                  {source.status === 'FOUND'
                    ? `${source.fromCache ? 'cached' : 'live'} ${shortTime(source.fetchedAt)}`
                    : source.status === 'NOT_FOUND'
                      ? 'none'
                      : 'unavailable'}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
