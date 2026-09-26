export const ADMIN_BRAND_PURPLE = '#4309ac';

export const adminButtonClasses = {
  primary:
    'inline-flex items-center justify-center rounded-lg border border-violet-300 bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition',
  outline:
    'inline-flex items-center justify-center rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition',
  secondary:
    'inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition',
};

export const adminChipClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
};

export function adminStatusChipVariant(status: string): keyof typeof adminChipClasses {
  const s = (status || '').toLowerCase();

  if (s === 'completed' || s === 'success' || s === 'verified' || s === 'approved') return 'success';
  if (s === 'pending' || s === 'inprogress' || s === 'in_progress' || s === 'processing') return 'pending';

  return 'info';
}
