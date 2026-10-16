'use client';

import {
  ClaimNotificationLog,
  ClaimPaymentStatus,
  ClaimRequest,
  ClaimStatus,
  adminApi,
} from '@/features/admin/api/admin.api';
import { adminButtonClasses } from '@/features/admin/utils/adminUi';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

function formatTimestamp(value?: string | null): string {
  if (!value) return 'Not sent';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const notificationLabels: Record<ClaimNotificationLog['notificationType'], string> = {
  claim_initiated: 'Claim initiated',
  surveyor_appointment: 'Surveyor appointment initiated',
  surveyor_details: 'Surveyor details shared',
  survey_onspot: 'Survey scheduled · on spot',
  survey_destination: 'Survey scheduled · final destination',
  survey_completed: 'Survey completed',
  document_request: 'Documents requested',
  claim_settled: 'Claim settled',
  document_reminder: 'Document reminder',
  surveyor_assigned: 'Surveyor assigned',
  report_generated: 'Report generated',
  sent_to_tata: 'Sent to TATA',
  bank_details_request: 'Bank details request',
  completed: 'Claim completed',
  document_uploaded_admin: 'Document uploaded · admin alert',
};

function ReminderConfirmation({
  claimNumber,
  missingDocuments,
  sending,
  onConfirm,
  onCancel,
}: {
  claimNumber: string;
  missingDocuments: string[];
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-reminder-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 id="document-reminder-title" className="text-lg font-bold text-slate-900">
              Send WhatsApp reminder?
            </h3>
            <p className="text-xs font-medium text-slate-500">
              This message is sent immediately.
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-600">
          Ask the customer to submit the missing documents for claim{' '}
          <strong className="text-[#4309ac]">{claimNumber}</strong>.
        </p>

        <div className="my-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
            Missing from customer
          </p>
          <ul className="mt-2 space-y-1.5 text-xs font-bold text-slate-800">
            {missingDocuments.map((document) => (
              <li key={document} className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                {document}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className={adminButtonClasses.secondary}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending}
            className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {sending ? 'Sending…' : 'Send reminder'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClaimDocumentReminderPanel({
  claim,
  claimNumber,
}: {
  claim: ClaimRequest;
  claimNumber: string;
}) {
  const requiredDocuments = [
    { label: 'Lorry Receipt (LR)', received: Boolean(claim.lorryReceipt) },
    {
      label: 'Damage Certificate',
      received: Boolean(claim.claimFormUrl || claim.damageFormUrl),
    },
  ];
  const missingDocuments = requiredDocuments
    .filter((document) => !document.received)
    .map((document) => document.label);
  const claimIsClosed = [
    ClaimStatus.REJECTED,
    ClaimStatus.SETTLED,
    ClaimStatus.COMPLETED,
  ].includes(claim.status) || claim.paymentStatus === ClaimPaymentStatus.PAID;
  const [notifications, setNotifications] = useState<ClaimNotificationLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(false);
    const response = await adminApi.getClaimNotifications(claim.id);
    if (response.success) {
      setNotifications(response.data || []);
    } else {
      setHistoryError(true);
    }
    setHistoryLoading(false);
  }, [claim.id]);

  useEffect(() => {
    let active = true;
    void adminApi.getClaimNotifications(claim.id).then((response) => {
      if (!active) return;
      if (response.success) {
        setNotifications(response.data || []);
      } else {
        setHistoryError(true);
      }
      setHistoryLoading(false);
    });

    return () => {
      active = false;
    };
  }, [claim.id]);

  const sendReminder = async () => {
    setSending(true);
    const response = await adminApi.sendClaimDocumentReminder(claim.id);

    if (response.success && response.data?.sent) {
      toast.success(`WhatsApp reminder sent for ${missingDocuments.join(' and ')}`);
      setShowConfirm(false);
    } else {
      const reasonMessages: Record<string, string> = {
        claim_closed: 'This claim is closed, so a reminder was not sent.',
        no_missing_documents: 'All required customer documents are already received.',
        reminder_sent_recently: 'A document reminder was sent recently.',
        manual_reminder_cooldown: 'A manual reminder was sent in the last five minutes.',
        reminder_limit_reached: 'The automatic reminder limit has been reached.',
        claim_too_new: 'This claim is not old enough for an automatic reminder.',
        notifications_disabled: 'Claim WhatsApp notifications are currently disabled.',
        send_failed: 'WhatsApp could not send the reminder. Check the latest delivery status.',
      };
      const reason = response.data?.reason;
      toast.error(
        (reason && reasonMessages[reason]) ||
          response.message ||
          'WhatsApp document reminder was not sent',
      );
    }

    await loadHistory();
    setSending(false);
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-2.5 ${
                  missingDocuments.length > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {missingDocuments.length > 0 ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Customer document follow-up
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {missingDocuments.length > 0
                    ? `${missingDocuments.length} required ${missingDocuments.length === 1 ? 'document is' : 'documents are'} still pending.`
                    : 'Both customer-required documents have been received.'}
                </p>
              </div>
            </div>

            {missingDocuments.length > 0 && !claimIsClosed && (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={sending}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4" />
                Send WhatsApp reminder
              </button>
            )}
          </div>

          {claimIsClosed && missingDocuments.length > 0 && (
            <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500">
              This claim is closed. Document reminders are disabled.
            </p>
          )}
        </div>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {requiredDocuments.map((document) => (
            <div
              key={document.label}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-3 ${
                document.received
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-amber-200 bg-amber-50/70'
              }`}
            >
              <span className="text-xs font-bold text-slate-800">{document.label}</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                  document.received
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {document.received ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                {document.received ? 'Received' : 'Missing'}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Recent WhatsApp activity
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                Latest four notification attempts for this claim
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
              aria-label="Refresh WhatsApp notification history"
              title="Refresh notification history"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyLoading ? (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notification history…
            </div>
          ) : historyError ? (
            <p className="mt-3 text-xs font-semibold text-rose-600">
              Notification history is unavailable. Try refreshing.
            </p>
          ) : notifications.length === 0 ? (
            <p className="mt-3 text-xs font-medium text-slate-400">
              No WhatsApp notifications recorded yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {notifications.slice(0, 4).map((notification) => {
                const statusClasses = {
                  processing: 'bg-blue-100 text-blue-700',
                  accepted: 'bg-cyan-100 text-cyan-700',
                  delivered: 'bg-emerald-100 text-emerald-700',
                  read: 'bg-emerald-100 text-emerald-800',
                  failed: 'bg-rose-100 text-rose-700',
                  skipped: 'bg-slate-100 text-slate-600',
                  unknown: 'bg-amber-100 text-amber-800',
                }[notification.status];

                return (
                  <div
                    key={notification.id}
                    className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">
                        {notificationLabels[notification.notificationType] ||
                          notification.notificationType}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                        {formatTimestamp(notification.sentAt || notification.createdAt)}
                        {notification.recipientPhone
                          ? ` · WhatsApp ••••${notification.recipientPhone.slice(-4)}`
                          : ' · WhatsApp'}
                      </p>
                      {notification.errorMessage && (
                        <p
                          className="mt-1 truncate text-[10px] font-medium text-rose-600"
                          title={notification.errorMessage}
                        >
                          {notification.errorMessage}
                        </p>
                      )}
                    </div>
                    <span
                      className={`self-start rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide sm:self-center ${statusClasses}`}
                    >
                      {notification.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {showConfirm && (
        <ReminderConfirmation
          claimNumber={claimNumber}
          missingDocuments={missingDocuments}
          sending={sending}
          onConfirm={() => void sendReminder()}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
