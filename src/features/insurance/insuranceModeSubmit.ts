export type InsuranceInvoiceMode = 'cash' | 'commission';

export function normalizeInsuranceInvoiceMode(
  value: string | null | undefined,
): InsuranceInvoiceMode | '' {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'cash' || normalized === 'commission' ? normalized : '';
}

export function resolveInsuranceInvoiceModeForSubmit(
  formMode: string | null | undefined,
  latestMode: string | null | undefined,
): InsuranceInvoiceMode | '' {
  return (
    normalizeInsuranceInvoiceMode(formMode) ||
    normalizeInsuranceInvoiceMode(latestMode)
  );
}

export function formatInsuranceInvoiceMode(mode: InsuranceInvoiceMode): string {
  return mode === 'cash' ? 'Cash' : 'Commission';
}
