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

type CatalogueEntry = {
  key: string;
  label: string;
  column: string;
  /** Collected by the team; the customer is never chased for it. */
  adminOnly?: boolean;
};

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
  const markedReceived = claim.documentsMarkedReceived || [];
  const paused = Boolean(claim.documentRemindersPaused);

  const uploaded = (entry: CatalogueEntry) =>
    Boolean(
      String(
        (claim as unknown as Record<string, unknown>)[entry.column] || '',
      ).trim(),
    );

  /**
   * Four states, deliberately distinct: a file exists, someone confirmed it in
   * hand, it does not apply, or it is still owed. Only the last is chased.
   */
  const stateOf = (entry: CatalogueEntry) => {
    if (uploaded(entry)) return 'uploaded' as const;
    if (markedReceived.includes(entry.key)) return 'marked' as const;
    if (notApplicable.includes(entry.key)) return 'skipped' as const;
    return 'pending' as const;
  };

  // Only customer documents are chased, so admin-only ones never count as owed.
  const outstanding = catalogue.filter(
    (entry) => !entry.adminOnly && stateOf(entry) === 'pending',
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

  const setNotNeeded = (key: string, value: boolean) =>
    void persist(
      {
        documentsNotApplicable: value
          ? [...notApplicable, key]
          : notApplicable.filter((item) => item !== key),
        // Leaving one state always clears the other, so a document can never
        // be both "not needed" and "received".
        ...(value
          ? { documentsMarkedReceived: markedReceived.filter((i) => i !== key) }
          : {}),
      },
      key,
    );

  const setReceived = (key: string, value: boolean) =>
    void persist(
      {
        documentsMarkedReceived: value
          ? [...markedReceived, key]
          : markedReceived.filter((item) => item !== key),
        ...(value
          ? { documentsNotApplicable: notApplicable.filter((i) => i !== key) }
          : {}),
      },
      key,
    );

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
          const state = stateOf(entry);
          const busy = saving === entry.key;
          const tone = {
            uploaded: 'border-emerald-200 bg-emerald-50/50',
            marked: 'border-emerald-200 bg-emerald-50/30',
            skipped: 'border-slate-200 bg-slate-50/60',
            pending: 'border-amber-200 bg-amber-50/40',
          }[state];
          const dot = {
            uploaded: 'bg-emerald-600 text-white',
            marked: 'bg-emerald-500 text-white',
            skipped: 'bg-slate-300 text-slate-600',
            pending: 'bg-amber-500 text-white',
          }[state];
          const status = {
            uploaded: 'uploaded',
            marked: 'received',
            skipped: 'not needed',
            pending: 'pending',
          }[state];

          return (
            <li
              key={entry.key}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${tone}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${dot}`}
                >
                  {state === 'pending' ? (
                    '!'
                  ) : state === 'skipped' ? (
                    '–'
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </span>
                <span
                  className={`truncate text-xs font-bold ${
                    state === 'skipped'
                      ? 'text-slate-400 line-through'
                      : 'text-slate-800'
                  }`}
                >
                  {entry.label}
                </span>
                {entry.adminOnly ? (
                  <span className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    admin only
                  </span>
                ) : null}
              </span>

              <span className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {status}
                </span>
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                ) : state === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setReceived(entry.key, true)}
                      title="We already have this document; stop asking for it"
                      className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
                    >
                      Received
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotNeeded(entry.key, true)}
                      title="This document does not apply to this claim"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Not needed
                    </button>
                  </>
                ) : state === 'marked' ? (
                  <button
                    type="button"
                    onClick={() => setReceived(entry.key, false)}
                    title="Mark as still outstanding"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Undo
                  </button>
                ) : state === 'skipped' ? (
                  <button
                    type="button"
                    onClick={() => setNotNeeded(entry.key, false)}
                    title="Ask for this document again"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Need it
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
