import { ExternalLink, KeyRound } from 'lucide-react';
import { MarketSourcePlan } from '../types';
import { formatEnumLabel, formatNumber } from '../formatters';

export function SourceCommandPlan({
  plan,
  loading,
}: {
  plan: MarketSourcePlan | null;
  loading: boolean;
}) {
  if (loading && !plan) {
    return (
      <div className="border-b border-slate-200 p-4 text-sm text-slate-500">
        Building crawler command plan...
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="border-b border-slate-200 p-4 text-sm text-slate-500">
        Source command plan unavailable.
      </div>
    );
  }

  const sourceByKey = new Map(plan.items.map((item) => [item.key, item]));
  const highPriorityBlocked = plan.items.filter((item) =>
    ['needs_key', 'failing', 'ready_to_build', 'needs_review'].includes(item.status),
  );

  return (
    <div className="border-b border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-950">Crawler Command Plan</div>
          <div className="text-xs text-slate-500">
            Source readiness, blocked feeds, and the next highest-value ingestion work.
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Generated {new Date(plan.generatedAt).toLocaleString('en-IN')}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-6">
        <ReadinessMetric label="Ready" value={plan.readiness.ready} tone="emerald" />
        <ReadinessMetric label="Needs keys" value={plan.readiness.needsKeys} tone="amber" />
        <ReadinessMetric label="Stale" value={plan.readiness.stale} tone="sky" />
        <ReadinessMetric label="Failing" value={plan.readiness.failing} tone="red" />
        <ReadinessMetric label="Not seeded" value={plan.readiness.notSeeded} tone="slate" />
        <ReadinessMetric label="Build next" value={plan.readiness.readyToBuild} tone="violet" />
      </div>

      {plan.missingCredentials.length > 0 && (
        <div className="mt-4 border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
            <KeyRound className="h-4 w-4" />
            API keys blocking signal coverage
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {plan.missingCredentials.map((need) => (
              <div key={need.key} className="border border-amber-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-950">{need.name}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">{need.impact}</div>
                  </div>
                  {need.requiredEnv && (
                    <span className="border border-amber-200 bg-amber-100 px-2 py-1 font-mono text-[11px] font-semibold text-amber-900">
                      {need.requiredEnv}
                    </span>
                  )}
                </div>
                {need.setupNote && (
                  <div className="mt-2 text-xs leading-5 text-amber-800">{need.setupNote}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Next crawler queue
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200">
            {plan.crawlerQueue.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">
                All configured sources look ready. Keep the schedule running.
              </div>
            ) : (
              plan.crawlerQueue.map((item) => (
                <div key={`${item.rank}-${item.sourceKey}`} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-950">
                        {item.rank}. {item.sourceName}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">{item.sourceKey}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={priorityClass(item.priority)}>
                        {item.priority}
                      </span>
                      <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                        {formatEnumLabel(item.action)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-slate-600">{item.reason}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Expected signal: {item.expectedSignal}
                  </div>
                  <QueueSourceContext item={sourceByKey.get(item.sourceKey)} />
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Source value ranking
          </div>
          <div className="max-h-[420px] space-y-2 overflow-auto">
            {plan.items.slice(0, 8).map((item) => (
              <div key={item.key} className="border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.signalTypes.join(', ')} · trust T{item.trustTier}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold text-slate-950">
                      {formatNumber(item.score)}
                    </div>
                    <div className={statusClass(item.status)}>
                      {formatEnumLabel(item.status)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-slate-600">{item.operatorValue}</div>
                <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                  <div>Coverage: {item.coverage}</div>
                  <div>Cadence: {item.recommendedCadence || '-'}</div>
                  <div>Saved recently: {formatNumber(item.observationsSavedRecent)}</div>
                  <div>Freshness: {item.freshnessHours === null ? '-' : `${item.freshnessHours}h`}</div>
                </div>
                {item.requiredEnv && (
                  <div className="mt-2 font-mono text-xs font-semibold text-amber-700">
                    {item.requiredEnv}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">{item.nextAction}</div>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {highPriorityBlocked.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Connector expansion backlog
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {highPriorityBlocked.slice(0, 6).map((item) => (
              <div key={`blocked-${item.key}`} className="border border-slate-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-950">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.kind} · {item.accessModel || 'public'} · trust T{item.trustTier}
                    </div>
                  </div>
                  <span className={statusBadgeClass(item.status)}>{formatEnumLabel(item.status)}</span>
                </div>
                <div className="mt-2 text-slate-600">{item.operatorValue}</div>
                <div className="mt-2 text-xs text-slate-500">{item.nextAction}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.playbook.length > 0 && (
        <div className="mt-4 grid gap-2 border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
          {plan.playbook.map((item) => (
            <div key={item} className="text-xs leading-5 text-slate-600">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueSourceContext({
  item,
}: {
  item: MarketSourcePlan['items'][number] | undefined;
}) {
  if (!item) return null;
  return (
    <div className="mt-2 grid gap-1 border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600 sm:grid-cols-2">
      <div>Coverage: {item.coverage}</div>
      <div>Cadence: {item.recommendedCadence || '-'}</div>
      <div>Access: {item.accessModel || 'public'}</div>
      <div>Connector: {item.connectorStatus ? formatEnumLabel(item.connectorStatus) : '-'}</div>
    </div>
  );
}

function ReadinessMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'sky' | 'red' | 'slate' | 'violet';
}) {
  const classes = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
  };

  return (
    <div className={`border px-3 py-2 ${classes[tone]}`}>
      <div className="text-xs font-semibold uppercase">{label}</div>
      <div className="text-xl font-semibold">{formatNumber(value)}</div>
    </div>
  );
}

function priorityClass(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') {
    return 'border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-red-800';
  }
  if (priority === 'medium') {
    return 'border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-800';
  }
  return 'border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600';
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-xs font-semibold uppercase text-emerald-700';
  if (status === 'failing') return 'text-xs font-semibold uppercase text-red-700';
  if (status === 'needs_key') return 'text-xs font-semibold uppercase text-amber-700';
  return 'text-xs font-semibold uppercase text-slate-500';
}

function statusBadgeClass(status: string) {
  if (status === 'needs_key') {
    return 'border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-800';
  }
  if (status === 'failing') {
    return 'border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-red-800';
  }
  if (status === 'ready_to_build') {
    return 'border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-violet-800';
  }
  return 'border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600';
}
