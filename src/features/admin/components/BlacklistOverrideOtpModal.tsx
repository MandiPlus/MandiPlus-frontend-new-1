'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, X } from 'lucide-react';

export type BlacklistOverrideAction = 'create_invoice' | 'edit_claim_invoice';

type BlacklistOverrideOtpModalProps = {
  open: boolean;
  onClose: () => void;
  action: BlacklistOverrideAction;
  vehicleNumber?: string | null;
  invoiceId?: string | null;
  title?: string;
  description?: string;
  requestOtp: (input: {
    action: BlacklistOverrideAction;
    ownerMobile: string;
    vehicleNumber?: string | null;
    invoiceId?: string | null;
    reason?: string;
  }) => Promise<{ requestId: string }>;
  verifyOtp: (input: {
    requestId: string;
    otp: string;
  }) => Promise<{ overrideToken: string }>;
  onVerified: (overrideToken: string) => void | Promise<void>;
};

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

function normalizeMobileInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

function extractErrorMessage(error: unknown): string {
  const payload = (error as { response?: { data?: unknown } })?.response?.data ?? error;
  if (!payload || typeof payload !== 'object') {
    return 'Something went wrong. Please try again.';
  }

  const record = payload as Record<string, unknown>;
  if (record.code === 'BLACKLIST_OTP_MOBILE_UNAUTHORIZED') {
    return 'This mobile number is not authorized for owner approval. Please contact admin.';
  }

  const message = record.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  return 'Something went wrong. Please try again.';
}

export function BlacklistOverrideOtpModal({
  open,
  onClose,
  action,
  vehicleNumber,
  invoiceId,
  title,
  description,
  requestOtp,
  verifyOtp,
  onVerified,
}: BlacklistOverrideOtpModalProps) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [ownerMobile, setOwnerMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  useEffect(() => {
    if (!open) {
      setRequestId(null);
      setOwnerMobile('');
      setOtp('');
      setError('');
      setStep('phone');
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const handleRequestOtp = async () => {
    const normalizedMobile = normalizeMobileInput(ownerMobile);
    if (!INDIAN_MOBILE_REGEX.test(normalizedMobile)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await requestOtp({
        action,
        ownerMobile: normalizedMobile,
        vehicleNumber,
        invoiceId,
      });
      setRequestId(response.requestId);
      setStep('otp');
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!requestId || !otp.trim()) {
      setError('Enter the OTP you received.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await verifyOtp({ requestId, otp: otp.trim() });
      await onVerified(response.overrideToken);
      onClose();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {title || 'Owner OTP Required'}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {description ||
                  'Enter the authorized owner mobile number to receive an OTP before continuing.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'phone' ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-slate-800">
              Owner mobile number
              <input
                value={ownerMobile}
                onChange={(e) => setOwnerMobile(normalizeMobileInput(e.target.value))}
                inputMode="numeric"
                maxLength={10}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                placeholder="10-digit mobile number"
              />
            </label>
            {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
            <button
              type="button"
              onClick={() => void handleRequestOtp()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send OTP
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              Enter the OTP sent to your mobile number.
            </p>
            <label className="block text-sm font-semibold text-slate-800">
              OTP
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.3em] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                placeholder="6-digit OTP"
              />
            </label>
            {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setRequestId(null);
                  setError('');
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleVerify()}
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify & Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
