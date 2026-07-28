'use client';

import { useEffect, useState } from 'react';
import { Clipboard, Download, MessageCircle, Phone } from 'lucide-react';
import { getMarketLiveRadar } from '../api';
import { downloadCsv, phoneHref, whatsappHref } from '../exporters';
import { formatEnumLabel, formatMoney, formatNumber, severityClass } from '../formatters';
import { MarketLiveRadar, MarketLiveRadarItem, MarketPulseQuery } from '../types';

function statusClass(status: string) {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'not_configured') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-red-200 bg-red-50 text-red-800';
}

function formatObservedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LiveSignalRadar({ query }: { query: MarketPulseQuery }) {
  const [radar, setRadar] = useState<MarketLiveRadar | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadRadar() {
      try {
        setLoading(true);
        setError('');
        const response = await getMarketLiveRadar(query);
        if (cancelled) return;
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to load live radar');
        }
        setRadar(response.data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load live radar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRadar();
    return () => {
      cancelled = true;
    };
  }, [query.period, query.commodity, query.state, query.startDate, query.endDate]);

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Live Signal Radar</h2>
          <p className="text-sm text-slate-500">
            Live web/source observations ranked against MandiPlus invoices, routes, contacts, and price gaps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {radar && radar.items.some((item) => item.callTargets.length > 0) && (
            <button
              type="button"
              onClick={() => exportRadarCalls(radar)}
              className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-600 hover:text-emerald-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export calls
            </button>
          )}
          <div className="text-xs text-slate-500">
            {loading ? 'Refreshing live feeds...' : radar ? `Updated ${formatObservedAt(radar.generatedAt)}` : 'Waiting'}
          </div>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {radar && (
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-2">
              {radar.operatorBrief.map((item) => (
                <div key={item} className="text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {radar.sourceHealth.map((source) => (
                <span
                  key={source.key}
                  title={source.message || source.name}
                  className={`border px-2 py-1 text-[11px] font-semibold uppercase ${statusClass(source.status)}`}
                >
                  {source.name}: {source.status} · {formatNumber(source.observationsFound)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!radar && !loading ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No live radar loaded yet.
        </div>
      ) : radar?.items.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No live source signal mapped to this scope. Try clearing commodity/state filters or configure missing sources.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {radar?.items.map((item) => (
            <article key={item.id} className="px-4 py-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`border px-2 py-1 text-[11px] font-semibold uppercase ${severityClass(item.priority)}`}>
                      {item.priority} · {formatNumber(item.score)}
                    </span>
                    <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase text-slate-600">
                      {formatEnumLabel(item.observationType)}
                    </span>
                    {item.commodity && <span className="text-xs font-semibold text-slate-800">{item.commodity}</span>}
                    {[item.market, item.state].filter(Boolean).length > 0 && (
                      <span className="text-xs text-slate-500">{[item.market, item.state].filter(Boolean).join(', ')}</span>
                    )}
                    <span className="text-xs text-slate-400">{formatObservedAt(item.observedAt)}</span>
                  </div>

                  <h3 className="mt-2 text-sm font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.whyItMatters}</p>
                  <div className="mt-3 border-l-2 border-emerald-500 pl-3 text-sm font-medium leading-6 text-slate-950">
                    {item.recommendedAction}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Commodity invoices" value={formatNumber(item.internalMatches.commodityInvoices)} />
                    <Metric label="Commodity GMV" value={formatMoney(item.internalMatches.commodityGmv)} />
                    <Metric label="Route matches" value={formatNumber(item.internalMatches.matchingRouteCount)} />
                    <Metric label="Call targets" value={formatNumber(item.internalMatches.matchingPeopleCount)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</div>
                    <div className="mt-2 space-y-2">
                      {item.evidence.slice(0, 4).map((evidence) => (
                        <div key={`${item.id}-${evidence.label}`} className="text-xs leading-5 text-slate-700">
                          <span className="font-semibold text-slate-950">{evidence.label}:</span> {evidence.value}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">People to call</div>
                    {item.callTargets.length === 0 ? (
                      <div className="mt-2 text-xs leading-5 text-slate-500">
                        No matched contact yet. Use field feedback to attach ground evidence.
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {item.callTargets.map((person) => {
                          const script = radarMessage(item, person);
                          const contactKey = `${item.id}-${person.mobileNumber}`;
                          return (
                          <div key={contactKey} className="border border-slate-100 bg-slate-50 p-2 text-xs leading-5 text-slate-700">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-950">{person.name}</div>
                                <div>{person.mobileNumber} · {formatEnumLabel(person.roleCategory)}</div>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => copyCallScript(contactKey, script, setCopiedKey)}
                                  className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 bg-white text-slate-800 hover:border-emerald-600 hover:text-emerald-700"
                                  title={copiedKey === contactKey ? 'Copied' : 'Copy script'}
                                >
                                  <Clipboard className="h-3.5 w-3.5" />
                                </button>
                                {phoneHref(person.mobileNumber) && (
                                  <a
                                    href={phoneHref(person.mobileNumber)}
                                    className="inline-flex h-7 w-7 items-center justify-center border border-slate-300 bg-white text-slate-800 hover:border-emerald-600 hover:text-emerald-700"
                                    title="Call"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                {whatsappHref(person.mobileNumber, script) && (
                                  <a
                                    href={whatsappHref(person.mobileNumber, script)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-7 w-7 items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-600"
                                    title="WhatsApp"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 text-slate-600">{person.reason}</div>
                            {!!person.qualificationQuestions?.length && (
                              <div className="mt-2 border-t border-slate-200 pt-2">
                                <div className="font-semibold uppercase tracking-wide text-slate-500">Ask</div>
                                <div className="mt-1 space-y-1">
                                  {person.qualificationQuestions.slice(0, 3).map((question) => (
                                    <div key={question} className="text-slate-600">- {question}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function radarMessage(
  item: MarketLiveRadarItem,
  person: MarketLiveRadarItem['callTargets'][number],
) {
  const scope = [item.commodity, item.market, item.state].filter(Boolean).join(', ');
  const questions = person.qualificationQuestions?.slice(0, 3).map((question) => `- ${question}`).join(' ');
  return [
    `MandiPlus market check${scope ? `: ${scope}` : ''}.`,
    item.recommendedAction,
    person.ask || person.reason,
    questions ? `Questions: ${questions}` : '',
  ].filter(Boolean).join(' ');
}

async function copyCallScript(
  key: string,
  text: string,
  setCopiedKey: (value: string) => void,
) {
  try {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1500);
  } catch {
    setCopiedKey('');
  }
}

function exportRadarCalls(radar: MarketLiveRadar) {
  const rows = radar.items.flatMap((item) =>
    item.callTargets.map((person) => [
      item.title,
      item.priority,
      item.score,
      item.sourceName,
      item.commodity || '',
      item.state || '',
      item.market || '',
      person.name,
      person.mobileNumber,
      person.roleCategory,
      person.reason,
      person.ask,
      person.qualificationQuestions?.join(' | ') || '',
      person.source || '',
      item.recommendedAction,
    ]),
  );

  downloadCsv(
    'mandiplus-live-radar-calls',
    [
      'signal',
      'priority',
      'score',
      'source',
      'commodity',
      'state',
      'market',
      'contact_name',
      'mobile_number',
      'role',
      'call_reason',
      'ask',
      'qualification_questions',
      'target_source',
      'recommended_action',
    ],
    rows,
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
