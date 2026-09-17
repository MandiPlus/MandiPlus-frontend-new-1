/**
 * The pieces every growth screen shares: money, rates, phone numbers and the
 * small typographic primitives. Extracted so the Data tab and the send console
 * render a rupee figure exactly the way the campaign tables already do.
 */
import React from 'react';

export const BRAND = '#4309ac';
export const IST = 'Asia/Kolkata';

export const rupees = (paise: number | null | undefined) => {
  if (paise === null || paise === undefined) return '—';
  const value = paise / 100;
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: value < 100 ? 2 : 0,
  })}`;
};

export const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value}%`;

/** Stored as a bare 91XXXXXXXXXX; shown the way it would be dialled. */
export const phoneNumber = (raw: string) => {
  const digits = (raw || '').replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  const country = digits.slice(0, digits.length - local.length);
  const spaced = local.length === 10 ? `${local.slice(0, 5)} ${local.slice(5)}` : local;
  return country ? `+${country} ${spaced}` : spaced;
};

export const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        timeZone: IST,
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'warn' | 'brand';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'brand'
          ? 'text-[#4309ac]'
          : 'text-gray-900';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  muted,
}: {
  children: React.ReactNode;
  right?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 text-sm ${right ? 'text-right' : ''} ${
        muted ? 'text-gray-500' : 'text-gray-900'
      }`}
    >
      {children}
    </td>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const marketing = category?.toUpperCase() === 'MARKETING';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        marketing
          ? 'bg-amber-100 text-amber-800'
          : 'bg-emerald-100 text-emerald-800'
      }`}
      title={
        marketing
          ? 'Marketing pricing — roughly ₹0.86 + GST per message'
          : 'Utility pricing — roughly ₹0.115 + GST per message'
      }
    >
      {category}
    </span>
  );
}

