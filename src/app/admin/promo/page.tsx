'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import {
  AdminLedgerUser,
  PromoCommodity,
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
  const [sending, setSending] = useState(false);

  const [commodities, setCommodities] = useState<PromoCommodity[]>([]);
  const [commodity, setCommodity] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [busy, setBusy] = useState<'generate' | 'test' | 'send' | null>(null);

  const loadRecent = useCallback(async () => {
    const response = await adminApi.listPromoLinks();
    if (response.success) setRecent(response.data || []);
  }, []);

  useEffect(() => {
    void loadRecent();
    void adminApi.listPromoCommodities().then((response) => {
      if (response.success) setCommodities(response.data || []);
    });
  }, [loadRecent]);

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

  const sendViaBot = useCallback(async () => {
    if (!link) return;
    setSending(true);
    const response = await adminApi.sendPromoLinkWhatsapp(link.id);
    setSending(false);
    if (!response.success) {
      toast.error(response.message || 'Bot se bhej nahi paya');
      return;
    }
    toast.success('Bhej diya');
    setLink({
      ...link,
      whatsappSentAt: new Date().toISOString(),
      whatsappSendError: null,
    });
    void loadRecent();
  }, [link, loadRecent]);

  const audience = useMemo(
    () => commodities.find((row) => row.code === commodity)?.users ?? 0,
    [commodities, commodity],
  );

  const generateBulk = useCallback(async () => {
    if (!commodity) return;
    setBusy('generate');
    const response = await adminApi.createPromoLinksForCommodity(commodity);
    setBusy(null);
    if (!response.success) {
      toast.error(response.message || 'Links nahi bane');
      return;
    }
    toast.success(`${response.count} link ban gaye`);
    void loadRecent();
  }, [commodity, loadRecent]);

  const sendBulk = useCallback(
    async (mode: 'test' | 'send') => {
      if (!commodity) return;
      if (mode === 'send') {
        const ok = window.confirm(
          `${audience} logon ko WhatsApp par bheja jayega. Pakka?`,
        );
        if (!ok) return;
      }
      setBusy(mode);
      const response = await adminApi.sendPromoBulk({
        commodity,
        testPhone: mode === 'test' ? testPhone.trim() : undefined,
      });
      setBusy(null);
      if (!response.success || !response.data) {
        toast.error(response.message || 'Bhej nahi paya');
        return;
      }
      const { sent, failed } = response.data;
      toast.success(failed ? `${sent} gaye, ${failed} fail` : `${sent} bhej diye`);
      void loadRecent();
    },
    [commodity, testPhone, audience, loadRecent],
  );

  const copy = useMemo(() => getPromoCopy(language), [language]);
  const previewName =
    nameOverride.trim() || link?.displayName || selected?.name || '';

  const message = link
    ? `${copy.greeting} ${link.displayName}${copy.honorific}\n${copy.headline}\n\n${link.url}`
    : '';

  return (
    <div className="space-y-5 p-5">
      <h1 className="text-lg font-black uppercase tracking-[0.08em] text-slate-800">
        Promo Links
      </h1>

      {/* Commodity audience */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
            Commodity
          </h2>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {commodities.map((row) => (
              <button
                key={row.code}
                type="button"
                onClick={() => setCommodity(row.code)}
                className={`rounded-md border px-3 py-2 text-sm font-bold ${
                  commodity === row.code
                    ? 'border-[#4309ac] bg-[#4309ac]/5 text-[#4309ac]'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {row.label}
                <span className="ml-2 text-xs font-semibold text-slate-400">
                  {row.users}
                </span>
              </button>
            ))}
          </div>

          {commodity ? (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <p className="text-sm font-bold text-slate-700">
                {audience} log
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={generateBulk}
                  disabled={busy !== null}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {busy === 'generate' ? 'Ban rahe hain…' : 'Links banayein'}
                </button>

                <input
                  value={testPhone}
                  onChange={(event) => setTestPhone(event.target.value)}
                  placeholder="Test number"
                  inputMode="numeric"
                  className="w-40 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#4309ac]"
                />
                <button
                  type="button"
                  onClick={() => sendBulk('test')}
                  disabled={busy !== null || testPhone.trim().length < 10}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {busy === 'test' ? 'Bhej rahe hain…' : 'Test bhejein'}
                </button>

                <button
                  type="button"
                  onClick={() => sendBulk('send')}
                  disabled={busy !== null || audience === 0}
                  className="flex items-center gap-2 rounded-md bg-[#4309ac] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {busy === 'send'
                    ? 'Bhej rahe hain…'
                    : `Sabko bhejein (${audience})`}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Search */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
              Ek user
            </h2>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-[#4309ac] focus-within:ring-2 focus-within:ring-[#4309ac]/15">
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Naam ya mobile number"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
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

        {/* Preview */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
              Preview
            </h2>
          </div>

          {!selected ? (
            <p className="px-4 py-6 text-sm font-semibold text-slate-400">
              Ek user chunein
            </p>
          ) : (
            <div className="space-y-4 p-4">
              <RevealPreview
                name={previewName}
                greeting={copy.greeting}
                honorific={copy.honorific}
                headline={copy.headline}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={nameOverride}
                  onChange={(event) => setNameOverride(event.target.value)}
                  placeholder={selected.name || 'Naam'}
                  maxLength={40}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#4309ac]"
                />
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#4309ac]"
                >
                  {PROMO_LANGUAGES.map((code) => (
                    <option key={code} value={code}>
                      {LANGUAGE_LABELS[code] || code}
                    </option>
                  ))}
                </select>
              </div>

              {link?.isFallbackName ? (
                <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                  Naam use nahi ho sakta — upar likhein
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

                  <button
                    type="button"
                    onClick={sendViaBot}
                    disabled={sending}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-[#4309ac] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                    {sending ? 'Bhej rahe hain…' : 'Bhejein'}
                  </button>

                  {link.whatsappSentAt ? (
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <CheckCircleIcon className="h-4 w-4" />
                      {formatDateTime(link.whatsappSentAt)}
                    </p>
                  ) : null}
                  {link.whatsappSendError ? (
                    <p className="flex items-start gap-1.5 text-xs font-bold text-rose-700">
                      <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                      {link.whatsappSendError}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <a
                      href={`https://wa.me/${waNumber(
                        selected.mobileNumber,
                      )}?text=${encodeURIComponent(message)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      wa.me
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
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Generated links */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
            Links
          </h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-sm font-semibold text-slate-400">
            Abhi tak koi link nahi
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 py-2.5 text-left">User</th>
                  <th className="px-4 py-2.5 text-left">Dikhega</th>
                  <th className="px-4 py-2.5 text-left">Bheja</th>
                  <th className="px-4 py-2.5 text-left">Khola</th>
                  <th className="px-4 py-2.5 text-left">Video</th>
                  <th className="px-4 py-2.5 text-right" />
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
                    <td className="px-4 py-2.5 text-xs font-semibold">
                      {row.whatsappSentAt ? (
                        <span className="text-emerald-700">
                          {formatDateTime(row.whatsappSentAt)}
                        </span>
                      ) : row.whatsappSendError ? (
                        <span className="text-rose-700">Fail</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">
                      {formatDateTime(row.firstViewedAt) || (
                        <span className="text-slate-400">—</span>
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
}: {
  name: string;
  greeting: string;
  honorific: string;
  headline: string;
}) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl bg-[#eeeafc]">
      <img
        src="/promo/scene-tall.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 top-[10%] px-3 text-center">
        <p className="text-[9px] font-medium text-[#4a4770]">{greeting}</p>
        <p className="break-words text-[15px] font-extrabold leading-tight tracking-tight text-[#241a52]">
          {name || 'MandiPlus parivaar'}
          {name ? honorific : ''}
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-4 px-3 text-center">
        <p className="text-[11px] font-extrabold leading-tight text-[#241a52]">
          {headline}
        </p>
      </div>
    </div>
  );
}
