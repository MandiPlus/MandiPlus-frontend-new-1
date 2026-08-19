export type BlacklistOverrideRequirement = {
  requiresOtp: boolean;
  reason: 'blacklisted_vehicle' | 'claim_invoice_edit' | null;
  action: 'create_invoice' | 'edit_claim_invoice' | null;
  vehicleNumber?: string | null;
  invoiceId?: string | null;
  claimCaseNumber?: string | null;
  flagReason?: string | null;
};

export type BlacklistOtpRequiredError = {
  code: 'BLACKLIST_OTP_REQUIRED';
  message: string;
  reason?: string | null;
  action?: 'create_invoice' | 'edit_claim_invoice' | null;
  vehicleNumber?: string | null;
  invoiceId?: string | null;
  claimCaseNumber?: string | null;
};

export function parseBlacklistOtpRequiredError(
  error: unknown,
): BlacklistOtpRequiredError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidates: unknown[] = [
    error,
    (error as { response?: { data?: unknown } })?.response?.data,
    (error as { data?: unknown })?.data,
  ].filter(Boolean);

  for (const payload of candidates) {
    if (!payload || typeof payload !== 'object') {
      continue;
    }

    const record = payload as Record<string, unknown>;
    if (record.code === 'BLACKLIST_OTP_REQUIRED') {
      return record as BlacklistOtpRequiredError;
    }

    if (
      record.message &&
      typeof record.message === 'object' &&
      (record.message as Record<string, unknown>).code === 'BLACKLIST_OTP_REQUIRED'
    ) {
      return record.message as BlacklistOtpRequiredError;
    }
  }

  return null;
}

export function isBlacklistOtpRequiredMessage(message?: string | null): boolean {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('owner otp approval is required') ||
    text.includes('flagged in system') ||
    text.includes('insurance claim')
  );
}
