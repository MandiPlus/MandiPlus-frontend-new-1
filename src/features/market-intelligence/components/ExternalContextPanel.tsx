import { ExternalContextIntelligence } from '../types';
import { formatEnumLabel } from '../formatters';

const TYPE_LABELS: Record<string, string> = {
  weather: 'Weather',
  policy: 'Policy',
  supply_text: 'Supply',
  demand_text: 'Demand',
  competitor_text: 'Competitor',
  route: 'Route',
  field_feedback: 'Field',
};

function typeClass(type: string) {
  if (type === 'weather') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (type === 'policy') return 'border-violet-200 bg-violet-50 text-violet-800';
  if (type === 'competitor_text') return 'border-red-200 bg-red-50 text-red-800';
  if (type === 'supply_text' || type === 'demand_text') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatObservedAt(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExternalContextPanel({ rows }: { rows: ExternalContextIntelligence[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">External Context Evidence</h2>
        <p className="text-sm text-slate-500">
          Weather, policy, supply, demand, competitor, and route context that can explain market movement.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No external context observations yet. Seed and run source ingestion after migration to populate this layer.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.slice(0, 8).map((row, index) => {
            const location = [row.market, row.state].filter(Boolean).join(', ');
            const tags = row.hazardTags || [];
            return (
              <article
                key={`${row.observationType}-${row.sourceName}-${row.latestObservedAt}-${index}`}
                className="px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`border px-2 py-1 text-[11px] font-semibold uppercase ${typeClass(row.observationType)}`}>
                        {TYPE_LABELS[row.observationType] || formatEnumLabel(row.observationType)}
                      </span>
                      {row.commodity && (
                        <span className="text-xs font-medium text-slate-700">{row.commodity}</span>
                      )}
                      {location && <span className="text-xs text-slate-500">{location}</span>}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">
                      {row.title}
                    </h3>
                    <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">
                      {row.rawText || 'Context captured without a text excerpt.'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{formatObservedAt(row.latestObservedAt)}</div>
                    <div className="mt-1">{row.sourceName}</div>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
