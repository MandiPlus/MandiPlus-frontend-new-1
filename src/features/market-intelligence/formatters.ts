export function formatMoney(value: number): string {
  const abs = Math.abs(value || 0);
  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Math.round(value || 0).toLocaleString('en-IN')}`;
}

export function formatNumber(value: number): string {
  return Math.round(value || 0).toLocaleString('en-IN');
}

export function formatPct(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatEnumLabel(value: string | null | undefined, fallback = 'unknown'): string {
  return (value || fallback).replace(/_/g, ' ');
}

export function severityClass(severity: 'high' | 'medium' | 'low') {
  if (severity === 'high') return 'border-red-200 bg-red-50 text-red-800';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}
