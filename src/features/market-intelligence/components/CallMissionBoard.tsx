import { MarketCallMission } from '../types';
import { formatEnumLabel, formatNumber, severityClass } from '../formatters';
import { downloadCsv, phoneHref, whatsappHref } from '../exporters';

export function CallMissionBoard({ missions }: { missions: MarketCallMission[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Call Mission Board</h2>
          <p className="text-sm text-slate-500">
            Today-ready verification missions from ranked opportunities and call targets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportCallSheet(missions)}
            disabled={missions.length === 0}
            className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export call sheet
          </button>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {formatNumber(missions.length)} missions
          </div>
        </div>
      </div>

      {missions.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          No call missions available for this filter.
        </div>
      ) : (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {missions.slice(0, 6).map((mission) => (
            <article key={mission.id} className="border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{mission.title}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatEnumLabel(mission.missionType)}
                    {mission.commodity ? ` · ${mission.commodity}` : ''}
                    {mission.state ? ` · ${mission.state}` : ''}
                  </div>
                </div>
                <span className={`border px-2 py-1 text-xs font-semibold ${severityClass(mission.priority)}`}>
                  {mission.priority.toUpperCase()} · {mission.score}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Metric label="Owner" value={mission.ownerHint} />
                <Metric label="Timebox" value={`${mission.timeBoxMinutes}m`} />
                <Metric label="Targets" value={formatNumber(mission.callTargets.length)} />
              </div>

              <div className="mt-3 border border-emerald-100 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Expected outcome
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-800">{mission.expectedOutcome}</div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Call sequence
                  </div>
                  <div className="mt-2 divide-y divide-slate-100 border border-slate-100 bg-white">
                    {mission.callTargets.map((person) => (
                      <div key={`${mission.id}-${person.userId}`} className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-950">{person.name}</span>
                          <span className="flex flex-wrap gap-1 text-xs font-semibold">
                            <a
                              href={phoneHref(person.mobileNumber)}
                              className="border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700"
                            >
                              Call
                            </a>
                            <a
                              href={whatsappHref(
                                person.mobileNumber,
                                `${mission.title}\n\nAsk: ${person.ask}\n\nCapture: ${mission.evidenceToCapture.slice(0, 5).join(', ')}`,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800"
                            >
                              WhatsApp
                            </a>
                            <span className="border border-slate-200 bg-white px-2 py-1 text-slate-600">
                              {person.mobileNumber}
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{person.ask}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Evidence to capture
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {mission.evidenceToCapture.slice(0, 9).map((item) => (
                      <span key={`${mission.id}-${item}`} className="border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <DecisionBlock title="If confirmed" items={mission.decisionRules.confirm.slice(0, 2)} />
                <DecisionBlock title="If rejected" items={mission.decisionRules.reject.slice(0, 2)} />
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <div className="border border-emerald-100 bg-emerald-50 p-2 text-xs leading-5 text-emerald-900">
                  {mission.nextStepIfConfirmed}
                </div>
                <div className="border border-slate-200 bg-white p-2 text-xs leading-5 text-slate-600">
                  {mission.nextStepIfRejected}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function exportCallSheet(missions: MarketCallMission[]) {
  downloadCsv(
    'mandiplus-market-call-sheet',
    [
      'Mission',
      'Priority',
      'Owner',
      'Timebox Minutes',
      'Commodity',
      'State',
      'Route',
      'Contact Name',
      'Mobile',
      'Identity',
      'Ask',
      'Evidence To Capture',
      'Success If Confirmed',
      'Next Step If Confirmed',
    ],
    missions.flatMap((mission) =>
      mission.callTargets.map((person) => [
        mission.title,
        mission.priority,
        mission.ownerHint,
        mission.timeBoxMinutes,
        mission.commodity,
        mission.state,
        mission.route ? `${mission.route.source} -> ${mission.route.destination}` : '',
        person.name,
        person.mobileNumber,
        person.identity,
        person.ask,
        mission.evidenceToCapture.join('; '),
        mission.decisionRules.confirm.join('; '),
        mission.nextStepIfConfirmed,
      ]),
    ),
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function DecisionBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-slate-200 bg-white p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={`${title}-${item}`} className="text-xs leading-4 text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
