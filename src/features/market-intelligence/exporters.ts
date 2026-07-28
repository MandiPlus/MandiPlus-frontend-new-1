export function downloadCsv(
  fileName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  if (typeof window === 'undefined') return;

  const csv = [
    headers,
    ...rows.map((row) => row.map((value) => escapeCsv(value)).join(',')),
  ].join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function phoneHref(phone: string) {
  const cleaned = normalizePhone(phone);
  return cleaned ? `tel:${cleaned}` : undefined;
}

export function whatsappHref(phone: string, message: string) {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return undefined;
  const withCountry = cleaned.length === 10 ? `91${cleaned}` : cleaned;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function escapeCsv(value: string | number | null | undefined) {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}
