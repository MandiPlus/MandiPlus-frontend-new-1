'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import {
  AdminLedgerUser,
  PromoLinkRow,
  adminApi,
} from '@/features/admin/api/admin.api';
import { getPromoCopy, PROMO_LANGUAGES } from '@/features/promo/copy';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'Hinglish',
  hi: 'हिन्दी',
  mr: 'मराठी',
  kn: 'ಕನ್ನಡ',
  ta: 'தமிழ்',
  te: 'తెలుగు',
};

function getUserId(user?: AdminLedgerUser | null) {
  return user?.id || user?._id || '';
}

function formatPhone(value?: string | null) {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return value;
}

function waNumber(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copy ho gaya`);
  } catch {
    toast.error('Copy nahi hua');
  }
}

export default function PromoLinksPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminLedgerUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AdminLedgerUser | null>(null);
  const [nameOverride, setNameOverride] = useState('');
  const [language, setLanguage] = useState('en');
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<PromoLinkRow | null>(null);
  const [recent, setRecent] = useState<PromoLinkRow[]>([]);

  const loadRecent = useCallback(async () => {
    const response = await adminApi.listPromoLinks();
    if (response.success) setRecent(response.data || []);
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // With an empty box the page still shows who you could send to — the most
  // recent app customers — so it is useful before anyone types anything.
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length === 0) {
      let cancelled = false;
      setSearching(true);
      void adminApi
        .getAdminAppCustomers({ page: 1, limit: 15 })
        .then((response) => {
          if (cancelled) return;
          setSearching(false);
          if (!response.success) return;
          setResults(
            (response.data || []).map((customer) => ({
              _id: customer.id,
              id: customer.id,
              name: customer.name,
              mobileNumber: customer.mobileNumber,
              state: customer.state || undefined,
              identity: customer.identity || undefined,
              createdAt: customer.createdAt,
              isLedgerMasterVerified:
                customer.onboarding?.verifiedLedgerMaster ?? false,
            })) as AdminLedgerUser[],
          );
        });
      return () => {
        cancelled = true;
      };
    }

    if (trimmed.length < 2) return;

    const timer = window.setTimeout(async () => {
      setSearching(true);
      const response = await adminApi.searchUsers(trimmed, 15);
      setSearching(false);
      if (response.success) setResults(response.data || []);
      else toast.error(response.message || 'Search fail ho gaya');
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const selectUser = useCallback((user: AdminLedgerUser) => {
    setSelected(user);
    setLink(null);
    setNameOverride('');
    setLanguage('en');
  }, []);

  const generate = useCallback(async () => {
    if (!selected) return;
    setCreating(true);
    const response = await adminApi.createPromoLink({
      userId: getUserId(selected),
      displayNameOverride: nameOverride.trim() || null,
      language,
    });
    setCreating(false);
    if (!response.success || !response.data) {
      toast.error(response.message || 'Link nahi bana');
      return;
    }
    setLink(response.data);
    void loadRecent();
  }, [selected, nameOverride, language, loadRecent]);

  const copy = useMemo(() => getPromoCopy(language), [language]);
  const previewName = nameOverride.trim() || link?.displayName || selected?.name || '';

  const message = link
    ? `${copy.greeting} ${link.displayName}${copy.honorific}\n${copy.headline}\n\n${link.url}`
    : '';

  return (
    <div className="space-y-5 p-5">
      <div>
        <h1 className="text-lg font-black uppercase tracking-[0.08em] text-slate-800">
          Promo Links
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          User chunein, preview dekhein, link WhatsApp par bhejein.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Search */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
              Search
            </h2>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-[#4309ac] focus-within:ring-2 focus-within:ring-[#4309ac]/15">
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                value={query}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Naam ya mobile number…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {!searching && query.trim().length === 0 && results.length > 0 ? (
              <p className="px-4 pb-1 text-xs font-black uppercase tracking-[0.08em] text-slate-400">
                Naye app customers
              </p>
            ) : null}
            {searching ? (
              <p className="px-4 py-3 text-sm font-semibold text-slate-400">
                Dhoond rahe hain…
              </p>
            ) : null}
            {!searching && query.trim().length >= 2 && results.length === 0 ? (
              <p className="px-4 py-3 text-sm font-semibold text-slate-400">
                Koi user nahi mila
              </p>
            ) : null}
            {results.map((user) => {
              const id = getUserId(user);
              const isSelected = getUserId(selected) === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectUser(user)}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                    isSelected ? 'bg-[#4309ac]/5' : ''
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100">
                    <UserCircleIcon className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {user.name || 'Unnamed user'}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      {formatPhone(user.mobileNumber)}
                      {user.identity ? ` | ${user.identity}` : ''}
                    </p>
                  </div>
                  {user.isLedgerMasterVerified ? (
                    <ShieldCheckIcon className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Preview and copy */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
              Preview &amp; copy
            </h2>
          </div>

          {!selected ? (
            <p className="px-4 py-6 text-sm font-semibold text-slate-400">
              Left se ek user chunein.
            </p>
          ) : (
            <div className="space-y-4 p-4">
              <RevealPreview
                name={previewName}
                greeting={copy.greeting}
                honorific={copy.honorific}
                headline={copy.headline}
                tagline={copy.tagline}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                    Naam badlein
                  </span>
                  <input
                    value={nameOverride}
                    onChange={(event) => setNameOverride(event.target.value)}
                    placeholder={selected.name || ''}
                    maxLength={40}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#4309ac]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                    Language
                  </span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#4309ac]"
                  >
                    {PROMO_LANGUAGES.map((code) => (
                      <option key={code} value={code}>
                        {LANGUAGE_LABELS[code] || code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {link?.isFallbackName ? (
                <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                  Is user ka naam use nahi ho sakta. Upar apna naam likhein,
                  warna &ldquo;MandiPlus parivaar&rdquo; dikhega.
                </p>
              ) : null}

              {!link ? (
                <button
                  type="button"
                  onClick={generate}
                  disabled={creating}
                  className="w-full rounded-md bg-[#4309ac] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {creating ? 'Ban raha hai…' : 'Link banayein'}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="truncate rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
                    {link.url}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://wa.me/${waNumber(
                        selected.mobileNumber,
                      )}?text=${encodeURIComponent(message)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-[#4309ac] px-4 py-2 text-sm font-bold text-white"
                    >
                      WhatsApp par bhejein
                    </a>
                    <button
                      type="button"
                      onClick={() => copyText(link.url, 'Link')}
                      className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Link copy
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(message, 'Message')}
                      className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Message copy
                    </button>
                    <button
                      type="button"
                      onClick={generate}
                      className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Update
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Who opened theirs */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
            Banaye gaye links
          </h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-sm font-semibold text-slate-400">
            Abhi tak koi link nahi bana.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 py-2.5 text-left">User</th>
                  <th className="px-4 py-2.5 text-left">Dikhega</th>
                  <th className="px-4 py-2.5 text-left">Khola</th>
                  <th className="px-4 py-2.5 text-left">Video</th>
                  <th className="px-4 py-2.5 text-right">Link</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-900">
                        {row.userName || '-'}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {formatPhone(row.mobileNumber)}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          row.isFallbackName
                            ? 'font-bold text-amber-700'
                            : 'font-bold text-slate-700'
                        }
                      >
                        {row.displayName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">
                      {formatDateTime(row.firstViewedAt) || (
                        <span className="text-slate-400">Nahi khola</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">
                      {formatDateTime(row.videoPlayedAt) || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => copyText(row.url, 'Link')}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** The frame the customer will actually see, at the type they will see it. */
function RevealPreview({
  name,
  greeting,
  honorific,
  headline,
  tagline,
}: {
  name: string;
  greeting: string;
  honorific: string;
  headline: string;
  tagline: string;
}) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-xl bg-[#eeeafc]">
      <img
        src="/promo/scene-tall.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 top-[8%] px-3 text-center">
        <p className="text-[10px] font-medium text-[#4a4770]">{greeting}</p>
        <p className="break-words text-[17px] font-extrabold leading-tight tracking-tight text-[#241a52]">
          {name || 'MandiPlus parivaar'}
          {name ? honorific : ''}
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-4 px-3 text-center">
        <p className="text-[12px] font-extrabold leading-tight text-[#241a52]">
          {headline}
        </p>
        <p className="mt-0.5 text-[9px] font-bold text-[#5b5486]">{tagline}</p>
      </div>
    </div>
  );
}
