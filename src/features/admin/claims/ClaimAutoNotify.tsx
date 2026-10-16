'use client';

import {
  ClaimStageAutomationResult,
  adminApi,
} from '@/features/admin/api/admin.api';
import { AlertTriangle, Loader2, MessageCircle, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { EVENT_LABELS } from './ClaimStageNotificationPanel';

function maskPhone(phone?: string | null): string {
  if (!phone) return 'no number on file';
  return `***${phone.slice(-4)}`;
}

/**
 * Shown instead of a confirmation dialog for the ordinary case. Nothing has
 * reached WhatsApp yet, so this is a real cancellation and not a recall — which
 * is what lets the admin stay in flow rather than clearing a modal per save.
 */
function UndoToastBody({
  claimId,
  plan,
  closeToast,
}: {
  claimId: string;
  plan: ClaimStageAutomationResult;
  closeToast?: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(plan.undoWindowSeconds);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    const timer = setInterval(
      () => setSecondsLeft((value) => Math.max(value - 1, 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const label = plan.entries
    .map((entry) => EVENT_LABELS[entry.event])
    .join(', ');

  const undo = async () => {
    setUndoing(true);
    const response = await adminApi.undoScheduledClaimNotifications(claimId);
    setUndoing(false);
    if (response.success && (response.data?.cancelled || 0) > 0) {
      setUndone(true);
      setTimeout(() => closeToast?.(), 1200);
    } else {
      toast.error(
        response.message || 'Too late to undo — the update has already gone out',
      );
      closeToast?.();
    }
  };

  if (undone) {
    return (
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Undo2 className="h-4 w-4 text-slate-500" />
        Update cancelled — nothing was sent
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">
          Sending {label} to {maskPhone(plan.recipientPhone)}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-slate-500">
          {secondsLeft > 0
            ? `Goes out in ${secondsLeft}s`
            : 'Sending now…'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void undo()}
        disabled={undoing}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {undoing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Undo2 className="h-3.5 w-3.5" />
        )}
        Undo
      </button>
    </div>
  );
}

export function showClaimUpdateQueuedToast(
  claimId: string,
  plan: ClaimStageAutomationResult,
) {
  toast(
    ({ closeToast }) => (
      <UndoToastBody claimId={claimId} plan={plan} closeToast={closeToast} />
    ),
    {
      // Stays up for the whole grace period so Undo is reachable throughout.
      autoClose: Math.max(plan.undoWindowSeconds, 5) * 1000,
      closeButton: false,
      closeOnClick: false,
      draggable: false,
    },
  );
}

/**
 * The exception path: confirmation is spent only where there is a real decision
 * — nobody to send to, or the first thing this person will ever receive.
 */
export default function ClaimAutoNotifySheet({
  claimId,
  plan,
  onClose,
  onSent,
}: {
  claimId: string;
  plan: ClaimStageAutomationResult;
  onClose: () => void;
  onSent: () => void;
}) {
  const [phone, setPhone] = useState(plan.recipientPhone || '');
  const [editing, setEditing] = useState(!plan.recipientPhone);
  const [sending, setSending] = useState(false);

  const digits = phone.replace(/\D/g, '').slice(-10);
  const phoneValid = /^[6-9]\d{9}$/.test(digits);

  const send = async () => {
    setSending(true);

    // Persist a corrected number first so it is audited on the claim and every
    // later update goes to the same place.
    if (editing && phoneValid && digits !== (plan.recipientPhone || '').slice(-10)) {
      const saved = await adminApi.updateClaim(claimId, {
        notificationRecipientPhone: digits,
      });
      if (!saved.success) {
        setSending(false);
        toast.error(saved.message || 'Could not save the number');
        return;
      }
    }

    let sent = 0;
    for (const entry of plan.entries) {
      const response = await adminApi.sendClaimStageNotification(claimId, {
        event: entry.event,
      });
      if (response.success) sent += 1;
      else toast.error(response.message || 'Update was not sent');
    }
    setSending(false);
    if (sent > 0) toast.success(`${sent} update(s) sent on WhatsApp`);
    onSent();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-notify-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id="auto-notify-title" className="text-base font-bold text-slate-900">
              Send this update to the customer?
            </h3>
            <p className="text-xs font-medium text-slate-500">
              {plan.reason === 'no_recipient_phone'
                ? 'This claim has no WhatsApp number yet'
                : 'This is the first update this customer will receive'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Send to
          </p>
          {editing ? (
            <div className="mt-1.5">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#4309ac]"
              />
              {phone && !phoneValid ? (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  Enter a valid Indian mobile number
                </p>
              ) : (
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Saved on the claim and used for later updates too
                </p>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-slate-900">
                {maskPhone(plan.recipientPhone)}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                Change
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {plan.entries.map((entry) => (
            <div
              key={entry.event}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <p className="text-xs font-bold text-slate-800">
                {EVENT_LABELS[entry.event]}
              </p>
              <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-sans text-[11px] leading-relaxed text-slate-700">
                {entry.previewText}
              </pre>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !phoneValid}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {sending ? 'Sending…' : 'Send on WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}
