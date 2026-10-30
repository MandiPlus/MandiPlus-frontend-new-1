'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  type GrowthBatch,
  type GrowthSendLogEntry,
  type GrowthSendQuote,
  type GrowthSendRequest,
  type GrowthTemplateOption,
} from '@/features/admin/api/admin.api';
import { CategoryBadge, Td, Th, dateTime, phoneNumber, rupees } from './ui';

/** The recipient's own first name, substituted per message at send time. */
const NAME_TOKEN = '@name';

function errorText(error: unknown): string {
  const response = (error as { response?: { data?: { message?: unknown } } })
    ?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return (error as Error)?.message || 'Something went wrong';
}

/**
 * What the recipient will see, drawn from the same component structure the
 * send payload is built from — so a preview that looks right cannot correspond
 * to a message Meta rejects for a parameter mismatch.
 */
function Preview({
  template,
  quote,
}: {
  template: GrowthTemplateOption | null;
  quote: GrowthSendQuote | null;
}) {
  if (!template) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        Pick a template to see what gets sent.
      </div>
    );
  }
  const body = quote?.preview.body || template.bodyText || '';
  return (
    <div className="rounded-xl bg-[#e5ddd5] p-4">
      <div className="ml-auto max-w-sm rounded-lg bg-white p-3 shadow-sm">
        {template.headerFormat && template.headerFormat !== 'TEXT' ? (
          <div className="mb-2 flex h-24 items-center justify-center rounded bg-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
            {template.headerFormat} header
          </div>
        ) : null}
        {quote?.preview.header ? (
          <p className="mb-1 text-sm font-semibold text-gray-900">
            {quote.preview.header}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap text-sm text-gray-800">{body}</p>
        {template.footerText ? (
          <p className="mt-2 text-xs text-gray-500">{template.footerText}</p>
        ) : null}
        {template.buttons.length > 0 ? (
          <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
            {template.buttons.map((button) => (
              <p
                key={button.text}
                className="text-center text-sm font-medium text-[#00a5f4]"
              >
                {button.text}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SendConsole({
  prefillPhones,
  prefillLabel,
  onSent,
}: {
  prefillPhones: string[];
  prefillLabel: string | null;
  onSent: () => void;
}) {
  const [templates, setTemplates] = useState<GrowthTemplateOption[]>([]);
  const [templateKey, setTemplateKey] = useState('');
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerMediaId, setHeaderMediaId] = useState('');
  const [headerMediaLink, setHeaderMediaLink] = useState('');
  const [buttonUrlParam, setButtonUrlParam] = useState('');
  const [phoneText, setPhoneText] = useState(prefillPhones.join('\n'));
  const [batchId, setBatchId] = useState('');
  const [batches, setBatches] = useState<GrowthBatch[]>([]);
  const [campaignName, setCampaignName] = useState(prefillLabel || '');
  const [excludeNotOnWhatsapp, setExcludeNotOnWhatsapp] = useState(true);
  const [spacingDays, setSpacingDays] = useState<number | null>(7);
  const [testPhone, setTestPhone] = useState('');
  const [quote, setQuote] = useState<GrowthSendQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultBad, setResultBad] = useState(false);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [log, setLog] = useState<GrowthSendLogEntry[]>([]);

  const template = useMemo(
    () =>
      templates.find(
        (candidate) => `${candidate.name}::${candidate.language}` === templateKey,
      ) || null,
    [templates, templateKey],
  );

  const phones = useMemo(
    () =>
      phoneText
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [phoneText],
  );

  const loadTemplates = useCallback(async () => {
    const catalog = await adminApi.getGrowthCatalog();
    setTemplates(catalog);
    setCatalogLoaded(true);
    return catalog;
  }, []);

  const loadLog = useCallback(async () => {
    setLog(await adminApi.getGrowthSendLog());
  }, []);

  useEffect(() => {
    void loadTemplates();
    void loadLog();
    void adminApi.getGrowthBatches().then(setBatches);
  }, [loadTemplates, loadLog]);

  useEffect(() => {
    setPhoneText(prefillPhones.join('\n'));
    if (prefillLabel) setCampaignName(prefillLabel);
  }, [prefillPhones, prefillLabel]);

  // A template change resets the values under it: leaving the previous
  // template's variables in place is how a message goes out addressed to the
  // wrong thing entirely.
  useEffect(() => {
    setBodyParams(
      Array.from({ length: template?.bodyVariableCount || 0 }, (_, index) =>
        index === 0 ? NAME_TOKEN : '',
      ),
    );
    setQuote(null);
  }, [template]);

  // A header template cannot be sent without its media, and nobody can be
  // expected to know a Meta media id by heart — so offer whatever this
  // template was last sent with successfully.
  useEffect(() => {
    setHeaderMediaId('');
    setHeaderMediaLink('');
    setMediaNote(null);
    const format = String(template?.headerFormat || '').toUpperCase();
    if (!template || !['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) return;

    let cancelled = false;
    void adminApi
      .getGrowthTemplateMedia(template.name, template.language)
      .then((media) => {
        if (cancelled || !media || (!media.mediaId && !media.mediaLink)) return;
        if (media.mediaLink) setHeaderMediaLink(media.mediaLink);
        else if (media.mediaId) setHeaderMediaId(media.mediaId);
        setMediaNote(
          `Reusing the ${format.toLowerCase()} last sent with this template (${dateTime(media.usedAt)}).`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [template]);

  const request = (): GrowthSendRequest => ({
    templateName: template?.name || '',
    templateLanguage: template?.language || 'hi',
    phones: phones.length > 0 ? phones : undefined,
    batchId: batchId || undefined,
    bodyParams,
    headerMediaId: headerMediaId || null,
    headerMediaLink: headerMediaLink || null,
    buttonUrlParam: buttonUrlParam || null,
    campaignName: campaignName || null,
    excludeNotOnWhatsapp,
    spacingDays,
  });

  const report = (text: string | null, bad = false) => {
    setResult(text);
    setResultBad(bad);
  };

  const runQuote = async () => {
    if (!template) return;
    setQuoting(true);
    setQuoteError(null);
    report(null);
    try {
      setQuote(await adminApi.quoteGrowthSend(request()));
    } catch (error) {
      setQuote(null);
      setQuoteError(errorText(error));
    } finally {
      setQuoting(false);
    }
  };

  const sendTest = async () => {
    if (!template || !testPhone) return;
    setSending(true);
    report(null);
    try {
      await adminApi.growthSend({ ...request(), testPhone });
      report(
        `Accepted by Meta for ${phoneNumber(testPhone)}. If it does not arrive, Meta reports why within seconds — check the number's history on the Data tab.`,
      );
      await loadLog();
    } catch (error) {
      report(`Test not sent: ${errorText(error)}`, true);
    } finally {
      setSending(false);
    }
  };

  const sendForReal = async () => {
    if (!template || !quote) return;
    const confirmed = window.confirm(
      `Send “${template.name}” to ${quote.sendable} ${
        quote.sendable === 1 ? 'person' : 'people'
      } for ${rupees(quote.cost.incGstPaise)}?`,
    );
    if (!confirmed) return;

    setSending(true);
    report(null);
    try {
      const outcome = await adminApi.growthSend({
        ...request(),
        confirmCount: quote.sendable,
      });
      report(
        outcome.background
          ? `${outcome.queued} queued as campaign ${outcome.slug} — watch it land on the Campaigns tab.`
          : outcome.failed > 0
            ? `Not delivered: Meta rejected ${outcome.failed} of ${outcome.queued}` +
              (outcome.firstError ? ` — ${outcome.firstError}` : '') +
              '.'
            : `${outcome.sent} accepted by Meta. Delivery and reads show on the Campaigns tab as receipts arrive.`,
        !outcome.background && outcome.failed > 0,
      );
      setQuote(null);
      await loadLog();
      onSent();
    } catch (error) {
      report(`Send refused: ${errorText(error)}`, true);
    } finally {
      setSending(false);
    }
  };

  const syncTemplates = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const outcome = await adminApi.syncGrowthCatalog();
      const catalog = await loadTemplates();
      if (catalog.length === 0) {
        setSyncError(
          outcome.synced === 0
            ? 'Meta returned no templates for this WhatsApp account.'
            : `Meta returned ${outcome.synced} templates but none are approved yet.`,
        );
      }
    } catch (error) {
      // Shown under the dropdown it explains, not at the bottom of the form.
      setSyncError(errorText(error));
    } finally {
      setSyncing(false);
    }
  }, [loadTemplates]);

  // An empty picker is never what anyone wants to look at: the first visit
  // fetches from Meta on its own instead of waiting to be told to.
  useEffect(() => {
    if (catalogLoaded && templates.length === 0 && !syncing && !syncError) {
      void syncTemplates();
    }
    // Runs once the first catalog read settles; a failure stops the retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogLoaded]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------- compose */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Template
              </label>
              <button
                onClick={syncTemplates}
                disabled={syncing}
                className="text-xs text-[#4309ac] hover:underline disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync from Meta'}
              </button>
            </div>
            <select
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Choose an approved template…</option>
              {templates.map((option) => (
                <option
                  key={`${option.name}::${option.language}`}
                  value={`${option.name}::${option.language}`}
                >
                  {option.name} ({option.language}) · {option.category}
                </option>
              ))}
            </select>
            {syncing && templates.length === 0 ? (
              <p className="mt-1 text-xs text-gray-500">
                Fetching templates from Meta…
              </p>
            ) : null}
            {syncError ? (
              <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                Couldn’t load templates: {syncError}
              </p>
            ) : null}
            {template ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <CategoryBadge category={template.category} />
                <span>{rupees(Math.round(template.ratePaise))} + GST each</span>
                {template.capExposed ? (
                  <span
                    className="text-amber-700"
                    title="Marketing templates are subject to Meta's per-user frequency cap (131049)"
                  >
                    subject to the per-user cap
                  </span>
                ) : (
                  <span className="text-emerald-700">exempt from the cap</span>
                )}
                {template.qualityScore ? (
                  <span>quality {template.qualityScore}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {template && template.bodyVariableCount > 0 ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Values
              </label>
              <div className="mt-1 space-y-2">
                {bodyParams.map((value, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-10 text-sm text-gray-500">
                      {`{{${index + 1}}}`}
                    </span>
                    <input
                      value={value}
                      onChange={(event) =>
                        setBodyParams((current) =>
                          current.map((existing, position) =>
                            position === index ? event.target.value : existing,
                          ),
                        )
                      }
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Value"
                    />
                    <button
                      onClick={() =>
                        setBodyParams((current) =>
                          current.map((existing, position) =>
                            position === index ? NAME_TOKEN : existing,
                          ),
                        )
                      }
                      className="whitespace-nowrap text-xs text-[#4309ac] hover:underline"
                      title="Substitute each recipient's own first name"
                    >
                      their name
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {template?.headerFormat &&
          template.headerFormat !== 'TEXT' &&
          template.headerFormat !== 'NONE' ? (
            <div className="space-y-2">
            {!headerMediaId && !headerMediaLink ? (
              <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                This template has a {template.headerFormat.toLowerCase()} header.
                Meta rejects it without one (error 132012) — add a media id or a
                public link.
              </p>
            ) : mediaNote ? (
              <p className="text-xs text-gray-500">{mediaNote}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Header media id
                </label>
                <input
                  value={headerMediaId}
                  onChange={(event) => setHeaderMediaId(event.target.value)}
                  placeholder="From /media — expires after ~30 days"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  …or a public link
                </label>
                <input
                  value={headerMediaLink}
                  onChange={(event) => setHeaderMediaLink(event.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            </div>
          ) : null}

          {template?.buttons.some((button) => button.hasUrlVariable) ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Button link suffix
              </label>
              <input
                value={buttonUrlParam}
                onChange={(event) => setButtonUrlParam(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Send to
            </label>
            <textarea
              value={phoneText}
              onChange={(event) => setPhoneText(event.target.value)}
              rows={4}
              placeholder="One number per line, or paste a block. 10 digits is fine."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">or a whole list:</span>
              <select
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">No list</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label} ({batch.leads})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Name this send
              </label>
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="Shows on the Campaigns tab"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Leave at least
              </label>
              <select
                value={spacingDays === null ? 'off' : String(spacingDays)}
                onChange={(event) =>
                  setSpacingDays(
                    event.target.value === 'off'
                      ? null
                      : Number(event.target.value),
                  )
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="7">7 days since the last message</option>
                <option value="14">14 days</option>
                <option value="3">3 days</option>
                <option value="off">No spacing rule</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={excludeNotOnWhatsapp}
              onChange={(event) => setExcludeNotOnWhatsapp(event.target.checked)}
            />
            Skip numbers already proven not to be on WhatsApp
          </label>

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <button
              onClick={runQuote}
              disabled={!template || quoting || (phones.length === 0 && !batchId)}
              className="rounded-lg bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {quoting ? 'Checking…' : 'Check before sending'}
            </button>
            <input
              value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)}
              placeholder="Test number"
              className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={sendTest}
              disabled={!template || !testPhone || sending}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              title="Sends one message to this number only. Nothing is recorded against the audience."
            >
              Send test
            </button>
          </div>

          {result ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                resultBad
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-gray-200 bg-gray-50 text-gray-800'
              }`}
            >
              {result}
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------- preview + quote */}
        <div className="space-y-4">
          <Preview template={template} quote={quote} />

          {quoteError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {quoteError}
            </div>
          ) : null}

          {quote ? (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {quote.sendable}
                  </p>
                  <p className="text-xs text-gray-500">
                    will be messaged, of {quote.deduplicated} resolved
                    {quote.requested !== quote.deduplicated
                      ? ` from ${quote.requested} given`
                      : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {rupees(quote.cost.incGstPaise)}
                  </p>
                  <p className="text-xs text-gray-500">
                    incl GST · {rupees(quote.cost.exGstPaise)} before
                  </p>
                </div>
              </div>

              {Object.keys(quote.skipped).length > 0 ? (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Not being sent to
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
                    {Object.entries(quote.skipped).map(([reason, count]) => (
                      <li key={reason}>
                        {count} — {reason.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {quote.warnings.map((warning) => (
                <p
                  key={warning}
                  className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  {warning}
                </p>
              ))}
              {quote.blockers.map((blocker) => (
                <p
                  key={blocker}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                >
                  {blocker}
                </p>
              ))}

              <button
                onClick={sendForReal}
                disabled={sending || quote.blockers.length > 0 || quote.sendable === 0}
                className="w-full rounded-lg bg-[#4309ac] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {sending
                  ? 'Sending…'
                  : `Send to ${quote.sendable} for ${rupees(quote.cost.incGstPaise)}`}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------- the shared log */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">Recent sends</p>
          <p className="text-xs text-gray-500">
            Every send, by whom, including the ones that were refused.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Template</Th>
                <Th>Mode</Th>
                <Th right>Asked</Th>
                <Th right>Sent</Th>
                <Th right>Failed</Th>
                <Th right>Cost</Th>
                <Th>Outcome</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {log.map((entry) => (
                <tr key={entry.id}>
                  <Td muted>{dateTime(entry.created_at)}</Td>
                  <Td>{entry.admin_name || '—'}</Td>
                  <Td muted>{entry.template_name || '—'}</Td>
                  <Td muted>{entry.mode}</Td>
                  <Td right muted>
                    {entry.requested_count}
                  </Td>
                  <Td right>{entry.sent_count}</Td>
                  <Td right muted>
                    {entry.failed_count}
                  </Td>
                  <Td right muted>
                    {rupees(entry.cost_paise)}
                  </Td>
                  <Td muted>{entry.note || entry.outcome}</Td>
                </tr>
              ))}
              {log.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-gray-500">
                    Nothing sent from here yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
