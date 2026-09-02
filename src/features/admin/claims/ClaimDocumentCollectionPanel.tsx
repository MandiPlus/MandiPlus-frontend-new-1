'use client';

import {
  ClaimNotificationConfig,
  ClaimRequest,
  adminApi,
} from '@/features/admin/api/admin.api';
import {
  AlertCircle,
  Check,
  Loader2,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

type CatalogueEntry = { key: string; label: string; column: string };

export default function ClaimDocumentCollectionPanel({
  claim,
  onUpdated,
}: {
  claim: ClaimRequest;
  onUpdated?: () => void;
}) {
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void adminApi.getClaimNotificationConfig().then((response) => {
      if (!active) return;
      const config = response.data as ClaimNotificationConfig | undefined;
      setCatalogue(config?.documentCatalogue || []);
    });
    return () => {
      active = false;
    };
  }, []);

  const notApplicable = claim.documentsNotApplicable || [];
  const paused = Boolean(claim.documentRemindersPaused);
  const received = (entry: CatalogueEntry) =>
    Boolean(
      String(
        (claim as unknown as Record<string, unknown>)[entry.column] || '',
      ).trim(),
    );

  const outstanding = catalogue.filter(
    (entry) => !notApplicable.includes(entry.key) && !received(entry),
  );

  const persist = async (
    payload: Parameters<typeof adminApi.updateClaim>[1],
    busyKey: string,
  ) => {
    setSaving(busyKey);
    const response = await adminApi.updateClaim(claim.id, payload);
    setSaving(null);
    if (response.success) onUpdated?.();
    else toast.error(response.message || 'Could not update the claim');
  };

  const toggleApplicable = (key: string) => {
    const next = notApplicable.includes(key)
      ? notApplicable.filter((value) => value !== key)
      : [...notApplicable, key];
    void persist({ documentsNotApplicable: next }, key);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">
            Document collection
          </h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {outstanding.length > 0
              ? `${outstanding.length} still outstanding · chased daily at 10:00 AM`
              : 'Everything asked for has been received.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            void persist({ documentRemindersPaused: !paused }, '__pause')
          }
          disabled={saving === '__pause'}
          className={
            paused
              ? 'inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50'
              : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
          }
        >
          {saving === '__pause' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : paused ? (
            <PlayCircle className="h-3.5 w-3.5" />
          ) : (
            <PauseCircle className="h-3.5 w-3.5" />
          )}
          {paused ? 'Resume daily reminders' : 'Pause daily reminders'}
        </button>
      </div>

      {paused ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Daily reminders are paused for this claim. The customer will not be
          chased until you resume them.
        </p>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {catalogue.map((entry) => {
          const has = received(entry);
          const skipped = notApplicable.includes(entry.key);
          return (
            <li
              key={entry.key}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                skipped
                  ? 'border-slate-200 bg-slate-50/60'
                  : has
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-amber-200 bg-amber-50/40'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    has
                      ? 'bg-emerald-600 text-white'
                      : skipped
                        ? 'bg-slate-300 text-slate-600'
                        : 'bg-amber-500 text-white'
                  }`}
                >
                  {has ? <Check className="h-3 w-3" /> : skipped ? '–' : '!'}
                </span>
                <span
                  className={`truncate text-xs font-bold ${
                    skipped ? 'text-slate-400 line-through' : 'text-slate-800'
                  }`}
                >
                  {entry.label}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {has ? 'received' : skipped ? 'not needed' : 'pending'}
                </span>
                {/* A document that does not apply is never chased, so an FIR is
                    not requested daily on a claim with no police case. */}
                <button
                  type="button"
                  onClick={() => toggleApplicable(entry.key)}
                  disabled={saving === entry.key || has}
                  title={
                    has
                      ? 'Already received'
                      : skipped
                        ? 'Ask for this document again'
                        : 'Do not ask for this document on this claim'
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  {saving === entry.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : skipped ? (
                    'Need it'
                  ) : (
                    'Not needed'
                  )}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
