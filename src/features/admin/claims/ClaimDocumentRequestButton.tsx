'use client';

import {
  ClaimRequestableDocumentKey,
  ClaimStageNotificationResult,
  adminApi,
} from '@/features/admin/api/admin.api';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';

/** Document categories on the claim that a customer can actually supply. */
export const REQUESTABLE_DOCUMENT_KEYS: Record<
  string,
  ClaimRequestableDocumentKey
> = {
  lorryReceipt: 'lorry_receipt',
  damageForm: 'damage_certificate',
  fir: 'fir',
  estimationBill: 'estimation_bill',
  accidentPic: 'accident_photos',
  insurancePolicy: 'insurance_policy',
  // inspectionReport is produced by the surveyor, so it is never requested.
};

function maskPhone(phone?: string | null): string {
  if (!phone) return 'no number on file';
  return `***${phone.slice(-4)}`;
}

export default function ClaimDocumentRequestButton({
  claimId,
  documentKey,
  documentLabel,
  onSent,
}: {
  claimId: string;
  documentKey: ClaimRequestableDocumentKey;
  documentLabel: string;
  onSent?: () => void;
}) {
  const [preview, setPreview] = useState<ClaimStageNotificationResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(false);

  const digits = phone.replace(/\D/g, '').slice(-10);
  const phoneValid = /^[6-9]\d{9}$/.test(digits);
  const canSend = editing ? phoneValid : Boolean(preview?.recipientPhone);

  const open = async () => {
    setLoading(true);
    const response = await adminApi.sendClaimStageNotification(claimId, {
      event: 'document_request',
      documents: [documentKey],
      dryRun: true,
    });
    setLoading(false);
    const result = response.data;
    if (!result || result.reason !== 'preview_only') {
      toast.error(response.message || 'Cannot request this document yet');
      return;
    }
    setPreview(result);
    setPhone(result.recipientPhone || '');
    setEditing(!result.recipientPhone);
  };

  const send = async () => {
    setSending(true);
    if (editing && phoneValid) {
      const saved = await adminApi.updateClaim(claimId, {
        notificationRecipientPhone: digits,
      });
      if (!saved.success) {
        setSending(false);
        toast.error(saved.message || 'Could not save the number');
        return;
      }
    }
    const response = await adminApi.sendClaimStageNotification(claimId, {
      event: 'document_request',
      documents: [documentKey],
    });
    setSending(false);
    setPreview(null);
    if (response.success) {
      toast.success(`${documentLabel} requested on WhatsApp`);
      onSent?.();
    } else {
      toast.error(response.message || 'Request was not sent');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={loading}
        title={`Ask the customer for ${documentLabel} on WhatsApp`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-violet-800 transition hover:bg-violet-50 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MessageCircle className="h-3.5 w-3.5" />
        )}
        Request
      </button>

      {preview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-request-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="doc-request-title"
                  className="text-base font-bold text-slate-900"
                >
                  Request {documentLabel}?
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  Sent immediately, with a secure upload link
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Send to
              </p>
              {editing ? (
                <>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#4309ac]"
                  />
                  <p
                    className={`mt-1 text-[11px] font-semibold ${
                      phone && !phoneValid ? 'text-rose-600' : 'text-slate-500'
                    }`}
                  >
                    {phone && !phoneValid
                      ? 'Enter a valid Indian mobile number'
                      : 'Saved on the claim and used for later updates too'}
                  </p>
                </>
              ) : (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {maskPhone(preview.recipientPhone)}
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

            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Exactly what the customer receives
            </p>
            <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-800">
              {preview.previewText}
            </pre>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                disabled={sending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !canSend}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
