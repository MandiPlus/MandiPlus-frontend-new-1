'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PipelineAuditEntry } from '@/features/admin/api/pipeline.api';
import { formatDate } from '@/features/admin/utils/format';
import { getPipelineStageName } from './pipeline.constants';

function flattenObject(prefix: string, value: any, acc: Record<string, string>) {
  if (Array.isArray(value)) {
    acc[prefix] = JSON.stringify(value);
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => {
      const nextKey = prefix ? `${prefix}.${childKey}` : childKey;
      flattenObject(nextKey, childValue, acc);
    });
    return;
  }
  acc[prefix] =
    typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value ?? '');
}

function buildDiff(entry: PipelineAuditEntry) {
  const previous: Record<string, string> = {};
  const next: Record<string, string> = {};
  flattenObject('', entry.previousData || {}, previous);
  flattenObject('', entry.updatedData || {}, next);
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]));
  return keys
    .filter((key) => previous[key] !== next[key])
    .map((key) => ({
      key,
      previous: previous[key] || '—',
      next: next[key] || '—',
    }));
}

export default function AuditTrail({ entries }: { entries: PipelineAuditEntry[] }) {
  const [open, setOpen] = useState(false);
  const diffs = useMemo(
    () => entries.map((entry) => ({ entry, changes: buildDiff(entry) })),
    [entries],
  );

  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.24)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Audit trail</h3>
          <p className="mt-1 text-sm text-slate-500">
            Review every stage change with field-level diffs
          </p>
        </div>
        <ChevronDown className={`h-5 w-5 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-200 px-5 py-5">
          {diffs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No audit entries yet.
            </div>
          ) : (
            diffs.map(({ entry, changes }) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Stage {entry.stageNumber} — {getPipelineStageName(entry.stageNumber)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.changedBy || 'Admin'} • {formatDate(entry.changedAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {changes.length ? (
                    changes.map((change) => (
                      <div
                        key={change.key}
                        className="grid gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 md:grid-cols-[180px_1fr_1fr]"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {change.key}
                        </p>
                        <p className="text-sm text-rose-700">{change.previous}</p>
                        <p className="text-sm text-emerald-700">{change.next}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No field diff available.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
