'use client';

import { SparklesIcon } from '@heroicons/react/24/outline';
import { MarketNarrative } from '../types';

export function AiMarketBrief({
  narrative,
  loading,
  onGenerate,
}: {
  narrative: MarketNarrative | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">AI Operator Brief</h2>
          <p className="text-sm text-slate-500">
            Evidence-bound summary generated only when requested.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <SparklesIcon className="h-4 w-4" />
          {loading ? 'Generating' : 'Generate brief'}
        </button>
      </div>

      {!narrative ? (
        <div className="px-4 py-6 text-sm text-slate-500">
          Generate after reviewing the deterministic signal feed. The model receives only compact pulse evidence.
        </div>
      ) : (
        <div className="grid gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Executive Summary · {narrative.status}
            </div>
            <p className="text-sm leading-6 text-slate-800">{narrative.executiveSummary}</p>
            <div className="mt-3 text-xs text-slate-500">
              {narrative.model ? `Model: ${narrative.model}` : 'Model not configured'} ·{' '}
              {new Date(narrative.generatedAt).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="space-y-4">
            <ListBlock title="Priority Actions" items={narrative.priorityActions} />
            <ListBlock title="Risks" items={narrative.risks} />
            <ListBlock title="Evidence Notes" items={narrative.evidenceNotes} />
          </div>
        </div>
      )}
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {items.length === 0 ? (
        <div className="mt-1 text-sm text-slate-400">No items.</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
