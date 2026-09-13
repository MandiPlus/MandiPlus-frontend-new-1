'use client';

import {
  ClaimNotificationConfig,
  ClaimNotificationLog,
  ClaimRequest,
  ClaimRequestableDocumentKey,
  ClaimStageEvent,
  ClaimStageNotificationResult,
  ClaimStagePreview,
  adminApi,
  claimStageFailureMessage,
} from '@/features/admin/api/admin.api';
import {
  AlertTriangle,
  Check,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

const DELIVERED_STATUSES = ['accepted', 'delivered', 'read'];

export const EVENT_LABELS: Record<ClaimStageEvent, string> = {
  claim_initiated: 'Claim initiated',
  surveyor_appointment: 'Surveyor appointment initiated',
  surveyor_details: 'Surveyor details (name, company, contact)',
  survey_onspot: 'Survey scheduled · on spot',
  survey_destination: 'Survey scheduled · final destination',
  survey_completed: 'Survey completed',
  document_request: 'Request documents',
  claim_settled: 'Claim settled & amount',
};

/**
 * Labels for each template parameter, in the order the backend sends them.
 * Shown inline so an admin can see the exact values before pressing Send.
 */
const EVENT_FIELD_LABELS: Record<ClaimStageEvent, string[]> = {
  claim_initiated: ['Customer', 'Vehicle'],
  surveyor_appointment: ['Customer', 'Vehicle'],
  surveyor_details: ['Customer', 'Vehicle', 'Surveyor', 'Company', 'Contact'],
  survey_onspot: ['Customer', 'Vehicle'],
  survey_destination: ['Customer', 'Vehicle'],
  survey_completed: ['Customer', 'Vehicle'],
  document_request: ['Customer', 'Vehicle', 'Documents'],
  claim_settled: ['Customer', 'Vehicle', 'Amount'],
};

function formatInr(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Levels are rendered from the server catalogue when it is available so the
 * rail cannot drift from the events the backend will actually accept.
 */
const FALLBACK_LEVELS: ClaimNotificationConfig['levels'] = [
  { level: 1, key: 'claim_initiated', label: 'Claim initiated', events: ['claim_initiated'] },
  {
    level: 2,
    key: 'surveyor_appointment',
    label: 'Surveyor appointment',
    events: ['surveyor_appointment', 'surveyor_details'],
  },
  {
    level: 3,
    key: 'survey_locations',
    label: 'On spot & final destination',
    events: ['survey_onspot', 'survey_destination'],
  },
  { level: 4, key: 'survey_completed', label: 'Surveyor complete', events: ['survey_completed'] },
  { level: 5, key: 'assessment_report', label: 'Assessment report', events: [] },
  {
    level: 6,
    key: 'additional_documents',
    label: 'Additional documents',
    events: ['document_request'],
  },
  { level: 7, key: 'completed_payment', label: 'Completed & payment', events: ['claim_settled'] },
];

const FALLBACK_DOCUMENTS: ClaimNotificationConfig['requestableDocuments'] = [
  { key: 'lorry_receipt', label: 'Lorry Receipt (LR)' },
  { key: 'damage_certificate', label: 'Damage Certificate' },
  { key: 'fir', label: 'FIR Copy' },
];

function formatTimestamp(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type PendingSend = {
  event: ClaimStageEvent;
  preview: ClaimStageNotificationResult;
  resend: boolean;
};

function ConfigBanner({ config }: { config: ClaimNotificationConfig | null }) {
  if (!config) return null;

  if (!config.enabled) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Customer messages are switched OFF. Nothing will reach the insured
          person until <code className="font-mono">CLAIM_NOTIFICATIONS_ENABLED=true</code>{' '}
          is set on the backend.
        </span>
      </div>
    );
  }

  if (!config.whatsappConfigured) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>WhatsApp credentials are missing on the backend.</span>
      </div>
    );
  }

  if (config.testMode) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-xs font-semibold text-sky-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Canary mode — only{' '}
          <span className="font-mono">{config.testRecipient || 'the test number'}</span>{' '}
          can be messaged. Every other customer is blocked, never redirected.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-900">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Live
        {config.allowedRecipients.length > 0
          ? ` — restricted to ${config.allowedRecipients.length} allowlisted number(s).`
          : ' — messages go to the insured person on this claim.'}
      </span>
    </div>
  );
}

function PreviewDialog({
  pending,
  sending,
  onConfirm,
  onCancel,
}: {
  pending: PendingSend;
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-stage-preview-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3
              id="claim-stage-preview-title"
              className="text-base font-bold text-slate-900"
            >
              {pending.resend ? 'Send this update again?' : 'Send this update?'}
            </h3>
            <p className="text-xs font-medium text-slate-500">
              {EVENT_LABELS[pending.event]} · sent immediately
            </p>
          </div>
        </div>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Exactly what the customer receives
        </p>
        <pre className="mt-1.5 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-800">
          {pending.preview.previewText}
        </pre>

        {pending.preview.recipientPhone ? (
          <p className="mt-2 text-xs font-semibold text-slate-500">
            To{' '}
            <span className="font-mono">
              ***{pending.preview.recipientPhone.slice(-4)}
            </span>
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? 'Sending…' : 'Send on WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClaimStageNotificationPanel({
  claim,
  onUpdated,
}: {
  claim: ClaimRequest;
  onUpdated?: () => void;
}) {
  const [config, setConfig] = useState<ClaimNotificationConfig | null>(null);
  const [logs, setLogs] = useState<ClaimNotificationLog[]>([]);
  const [previews, setPreviews] = useState<ClaimStagePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyEvent, setBusyEvent] = useState<ClaimStageEvent | null>(null);
  const [pending, setPending] = useState<PendingSend | null>(null);
  const [sending, setSending] = useState(false);
  const [documents, setDocuments] = useState<ClaimRequestableDocumentKey[]>([]);
  const [settlementAmount, setSettlementAmount] = useState<string>(
    claim.approvedPayableAmount ? String(claim.approvedPayableAmount) : '',
  );

  const levels = config?.levels?.length ? config.levels : FALLBACK_LEVELS;
  const requestableDocuments = config?.requestableDocuments?.length
    ? config.requestableDocuments
    : FALLBACK_DOCUMENTS;

  const load = useCallback(async () => {
    const [configResponse, logsResponse, previewResponse] = await Promise.all([
      adminApi.getClaimNotificationConfig(),
      adminApi.getClaimNotifications(claim.id),
      adminApi.getClaimStagePreview(claim.id),
    ]);
    if (configResponse.success && configResponse.data) {
      setConfig(configResponse.data);
    }
    setLogs(logsResponse.data || []);
    setPreviews(previewResponse.data?.stages || []);
    setLoading(false);
  }, [claim.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      adminApi.getClaimNotificationConfig(),
      adminApi.getClaimNotifications(claim.id),
      adminApi.getClaimStagePreview(claim.id),
    ]).then(([configResponse, logsResponse, previewResponse]) => {
      if (!active) return;
      if (configResponse.success && configResponse.data) {
        setConfig(configResponse.data);
      }
      setLogs(logsResponse.data || []);
      setPreviews(previewResponse.data?.stages || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [claim.id]);

  /** Latest delivered send per stage event, used to mark the rail. */
  const sentAtByEvent = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of logs) {
      if (!DELIVERED_STATUSES.includes(log.status)) continue;
      const at = log.sentAt || log.createdAt;
      const existing = map.get(log.notificationType);
      if (!existing || new Date(at) > new Date(existing)) {
        map.set(log.notificationType, at);
      }
    }
    return map;
  }, [logs]);

  const currentLevel = Number(claim.notificationLevel || 0);

  const buildPayload = useCallback(
    (event: ClaimStageEvent) => ({
      event,
      documents: event === 'document_request' ? documents : undefined,
      settlementAmount:
        event === 'claim_settled' && settlementAmount
          ? Number(settlementAmount)
          : undefined,
    }),
    [documents, settlementAmount],
  );

  const requestPreview = useCallback(
    async (event: ClaimStageEvent, resend: boolean) => {
      setBusyEvent(event);
      const response = await adminApi.sendClaimStageNotification(claim.id, {
        ...buildPayload(event),
        dryRun: true,
      });
      setBusyEvent(null);

      const preview = response.data;
      // A dry run always reports sent:false, so judge it on whether the
      // message could actually be built rather than on the success flag.
      if (!preview || preview.reason !== 'preview_only') {
        toast.error(response.message || 'Cannot send this update yet');
        return;
      }
      setPending({ event, preview, resend });
    },
    [buildPayload, claim.id],
  );

  const confirmSend = useCallback(async () => {
    if (!pending) return;
    setSending(true);
    const response = await adminApi.sendClaimStageNotification(claim.id, {
      ...buildPayload(pending.event),
      resend: pending.resend,
    });
    setSending(false);
    setPending(null);

    if (response.success) {
      toast.success(`${EVENT_LABELS[pending.event]} sent on WhatsApp`);
      if (pending.event === 'document_request') setDocuments([]);
      onUpdated?.();
    } else {
      toast.error(response.message || 'WhatsApp update was not sent');
    }
    await load();
  }, [buildPayload, claim.id, load, onUpdated, pending]);

  const advanceSilentLevel = useCallback(
    async (level: number) => {
      const response = await adminApi.setClaimNotificationLevel(claim.id, level);
      if (response.success) {
        toast.success(`Stage set to level ${level} · no message sent`);
        onUpdated?.();
      } else {
        toast.error(response.message || 'Failed to update stage');
      }
    },
    [claim.id, onUpdated],
  );

  const toggleDocument = (key: ClaimRequestableDocumentKey) => {
    setDocuments((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const previewByEvent = useMemo(() => {
    const map = new Map<ClaimStageEvent, ClaimStagePreview>();
    for (const stage of previews) map.set(stage.event, stage);
    return map;
  }, [previews]);

  /**
   * What a send would actually transmit. Customer, vehicle and surveyor values
   * come from the server so they cannot drift from the real message; documents
   * and amount come from what the admin has selected or typed right now.
   */
  const resolveStage = useCallback(
    (event: ClaimStageEvent) => {
      const preview = previewByEvent.get(event);
      const selectedDocumentLabels = requestableDocuments
        .filter((document) => documents.includes(document.key))
        .map((document) => document.label);
      const amount = Number(settlementAmount);

      if (!preview) {
        const localReady =
          event === 'document_request'
            ? selectedDocumentLabels.length > 0
            : event === 'claim_settled'
              ? amount > 0
              : true;
        return { fields: [], ready: localReady, blocker: null };
      }

      const values = [...preview.bodyParameters];
      let ready = preview.ready;

      if (event === 'document_request') {
        values[2] = selectedDocumentLabels.join(', ');
        ready = selectedDocumentLabels.length > 0;
      }
      if (event === 'claim_settled') {
        values[2] = amount > 0 ? formatInr(amount) : '';
        ready = amount > 0;
      }

      // Surveyor company is optional: when it is absent the backend sends a
      // four-parameter template with no Company line, so the positions shift.
      // Survey messages carry the surveyor when one is on file, so the label
      // set depends on how many parameters the backend resolved.
      const surveyorOnSurvey =
        (event === 'survey_onspot' || event === 'survey_destination') &&
        values.length === 4;

      const fields: Array<{
        label: string;
        value: string;
        optional?: boolean;
      }> = surveyorOnSurvey
        ? [
            { label: 'Customer', value: values[0] || '' },
            { label: 'Vehicle', value: values[1] || '' },
            { label: 'Surveyor', value: values[2] || '' },
            { label: 'Contact', value: values[3] || '' },
          ]
        : event === 'surveyor_details'
          ? (() => {
              const hasCompany = values.length === 5;
              return [
                { label: 'Customer', value: values[0] || '' },
                { label: 'Vehicle', value: values[1] || '' },
                { label: 'Surveyor', value: values[2] || '' },
                {
                  label: 'Company',
                  value: hasCompany ? values[3] || '' : '',
                  optional: true,
                },
                {
                  label: 'Contact',
                  value: (hasCompany ? values[4] : values[3]) || '',
                },
              ];
            })()
          : EVENT_FIELD_LABELS[event].map((label, index) => ({
              label,
              value: values[index] || '',
            }));


      let blocker: string | null = null;
      if (!preview.templateConfigured) {
        blocker = 'No approved WhatsApp template is configured for this update';
      } else if (!ready) {
        const reason =
          event === 'document_request'
            ? 'no_documents_selected'
            : event === 'claim_settled'
              ? 'settlement_amount_missing'
              : preview.reason;
        blocker = claimStageFailureMessage(reason);
      }

      return {
        fields,
        ready: ready && preview.templateConfigured,
        blocker,
      };
    },
    [documents, previewByEvent, requestableDocuments, settlementAmount],
  );

  // On a level with a single action the level heading already names it, so the
  // row shows only its delivery state rather than repeating the title.
  const renderEventButton = (
    event: ClaimStageEvent,
    options?: { hideLabel?: boolean },
  ) => {
    const sentAt = sentAtByEvent.get(event);
    const { fields, ready, blocker } = resolveStage(event);
    const disabled = busyEvent === event || !ready;

    return (
      <div
        key={event}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {options?.hideLabel ? null : (
              <p className="text-xs font-bold text-slate-800">
                {EVENT_LABELS[event]}
              </p>
            )}
            {sentAt ? (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <Check className="h-3 w-3" />
                Sent {formatTimestamp(sentAt)}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                Not sent yet
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void requestPreview(event, Boolean(sentAt))}
            disabled={disabled}
            className={
              sentAt
                ? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
                : 'inline-flex items-center gap-1.5 rounded-lg bg-[#4309ac] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#37078d] disabled:opacity-50'
            }
          >
            {busyEvent === event ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : sentAt ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {sentAt ? 'Resend' : 'Send'}
          </button>
        </div>

        {fields.length > 0 ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-slate-50 px-2.5 py-2 text-[11px]">
            {fields.map((field) => (
              <Fragment key={field.label}>
                <dt className="font-bold uppercase tracking-wide text-slate-400">
                  {field.label}
                </dt>
                <dd
                  className={
                    field.value
                      ? 'font-semibold text-slate-800 [overflow-wrap:anywhere]'
                      : field.optional
                        ? 'font-medium italic text-slate-400'
                        : 'font-semibold italic text-amber-600'
                  }
                >
                  {field.value ||
                    (field.optional ? 'not set · left out of the message' : 'missing')}
                </dd>
              </Fragment>
            ))}
          </dl>
        ) : null}

        {blocker ? (
          <p className="mt-1.5 flex items-start gap-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {blocker}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#4309ac]">
          Customer updates · WhatsApp
        </h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <p className="mt-1 text-[11px] font-medium text-slate-500">
        Messages carry the vehicle number only — never the claim number, the
        insurer reference, or assessment details.
      </p>

      <div className="mt-3">
        <ConfigBanner config={config} />
      </div>

      {/* Requests are deliberately not gated on the rail: the claims team can
          ask for a document at any point in the case. */}
      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800">
          Request documents · available at any stage
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {requestableDocuments.map((document) => {
            const active = documents.includes(document.key);
            return (
              <button
                key={document.key}
                type="button"
                onClick={() => toggleDocument(document.key)}
                className={
                  active
                    ? 'rounded-full border border-[#4309ac] bg-[#4309ac] px-3 py-1 text-xs font-bold text-white'
                    : 'rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-bold text-violet-800 hover:bg-violet-100'
                }
              >
                {document.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5">{renderEventButton('document_request')}</div>
      </div>

      <ol className="mt-4 space-y-2.5">
        {levels.map((entry) => {
          const done = currentLevel >= entry.level;
          const isCurrent = currentLevel === entry.level;
          return (
            <li
              key={entry.key}
              className={`rounded-xl border p-3 ${
                isCurrent
                  ? 'border-[#4309ac] bg-violet-50/40'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                    done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : entry.level}
                </span>
                <p className="text-sm font-bold text-slate-900">{entry.label}</p>
              </div>

              {entry.events.length === 0 ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Silent stage — assessment details are never shared.
                  </p>
                  <button
                    type="button"
                    onClick={() => void advanceSilentLevel(entry.level)}
                    disabled={currentLevel >= entry.level}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Mark reached
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {entry.key === 'additional_documents' ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500">
                      Use the request tray above — documents can be asked for at
                      any stage.
                    </p>
                  ) : (
                    entry.events.map((event) =>
                      renderEventButton(event, {
                        hideLabel: entry.events.length === 1,
                      }),
                    )
                  )}

                  {entry.key === 'completed_payment' ? (
                    <label className="block text-[11px] font-bold text-slate-700">
                      Settlement amount quoted to the customer
                      <div className="mt-1 flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2">
                        <span className="text-sm font-black text-slate-900">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={settlementAmount}
                          onChange={(event) =>
                            setSettlementAmount(event.target.value)
                          }
                          placeholder="0"
                          className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none"
                        />
                      </div>
                    </label>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {pending ? (
        <PreviewDialog
          pending={pending}
          sending={sending}
          onConfirm={() => void confirmSend()}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}
