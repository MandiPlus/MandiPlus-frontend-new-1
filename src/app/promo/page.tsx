'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import {
  PromoCommodity,
  PromoLinkRow,
  adminApi,
  setPromoConsoleKey,
} from '@/features/admin/api/admin.api';

/** This campaign goes to tomato traders only. */
const CAMPAIGN_COMMODITY = 'TOMATO';

/*
 * The single-user search and the reveal preview are intentionally not here.
 * This console does one job for one campaign; both sections still exist in
 * git history (app/admin/promo/page.tsx) if they are ever wanted back.
 */

function formatPhone(value?: string | null) {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return value;
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

export default function PromoConsolePage() {
  return (
    <Suspense fallback={null}>
      <PromoConsole />
    </Suspense>
  );
}

function PromoConsole() {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  const [commodity, setCommodity] = useState<PromoCommodity | null>(null);
  const [recent, setRecent] = useState<PromoLinkRow[]>([]);
  const [testPhone, setTestPhone] = useState('');
  const [busy, setBusy] = useState<'generate' | 'test' | 'send' | null>(null);

  // The key rides in the URL so the console can be opened from a link with no
  // login, without the key ever being baked into the bundle.
  useEffect(() => {
    setPromoConsoleKey(searchParams.get('k'));
    setReady(true);
  }, [searchParams]);

  const loadRecent = useCallback(async () => {
    const response = await adminApi.listPromoLinks();
    if (response.success) setRecent(response.data || []);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void adminApi.listPromoCommodities().then((response) => {
      if (!response.success) {
        setDenied(true);
        return;
      }
      setCommodity(
        (response.data || []).find((row) => row.code === CAMPAIGN_COMMODITY) ||
          null,
      );
    });
    void loadRecent();
  }, [ready, loadRecent]);

  const audience = commodity?.users ?? 0;

  const generateBulk = useCallback(async () => {
    setBusy('generate');
    const response = await adminApi.createPromoLinksForCommodity(
      CAMPAIGN_COMMODITY,
    );
    setBusy(null);
    if (!response.success) {
      toast.error(response.message || 'Links nahi bane');
      return;
    }
    toast.success(`${response.count} link ban gaye`);
    void loadRecent();
  }, [loadRecent]);

  const sendBulk = useCallback(
    async (mode: 'test' | 'send') => {
      if (mode === 'send') {
        const ok = window.confirm(
          `${audience} logon ko WhatsApp par bheja jayega. Pakka?`,
        );
        if (!ok) return;
      }
      setBusy(mode);
      const response = await adminApi.sendPromoBulk({
        commodity: CAMPAIGN_COMMODITY,
        testPhone: mode === 'test' ? testPhone.trim() : undefined,
      });
      setBusy(null);
      if (!response.success || !response.data) {
        toast.error(response.message || 'Bhej nahi paya');
        return;
      }
      // WhatsApp accepting the call is not delivery, so a run with nothing
      // through is a failure rather than a success with a number in it.
      const { sent, failed } = response.data;
      if (sent === 0) toast.error(`Koi nahi gaya — ${failed} fail`);
      else if (failed > 0) toast(`${sent} gaye, ${failed} fail`);
      else toast.success(`${sent} bhej diye`);
      void loadRecent();
    },
    [testPhone, audience, loadRecent],
  );

  const sentCount = useMemo(
    () => recent.filter((row) => row.whatsappSentAt).length,
    [recent],
  );

  if (!ready) return null;

  if (denied) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
        <p className="text-sm font-bold text-slate-500">
          Is link se access nahi hai.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-5 p-5">
        <h1 className="text-lg font-black uppercase tracking-[0.08em] text-slate-800">
          Promo Links
        </h1>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
              Tomato
            </h2>
          </div>
          <div className="space-y-4 p-4">
            <p className="text-sm font-bold text-slate-700">
              {audience} log · {sentCount} ko bheja
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
        </section>

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
                          <span
                            className="text-rose-700"
                            title={row.whatsappSendError}
                          >
                            Fail
                          </span>
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

        {recent.some((row) => row.isFallbackName) ? (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
            Kuch naam use nahi ho sakte — unhe &ldquo;MandiPlus parivaar&rdquo;
            dikhega
          </p>
        ) : null}
      </div>
    </main>
  );
}
