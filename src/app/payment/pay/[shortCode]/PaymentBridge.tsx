'use client';

import { useEffect, useMemo, useState } from 'react';

type CheckoutResponse = {
  success?: boolean;
  status?: string;
  message?: string;
  redirectUrl?: string;
};

type Props = {
  shortCode: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.mandiplus.com';

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

export default function PaymentBridge({ shortCode }: Props) {
  const [error, setError] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');

  const checkoutUrl = useMemo(
    () => joinUrl(API_BASE_URL, `/payment/checkout/${encodeURIComponent(shortCode)}`),
    [shortCode],
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveCheckout() {
      try {
        const response = await fetch(checkoutUrl, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;

        if (!response.ok || !payload?.success || !payload.redirectUrl) {
          throw new Error(payload?.message || 'Payment link not found or expired.');
        }

        if (cancelled) return;
        setRedirectUrl(payload.redirectUrl);
        window.location.assign(payload.redirectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to open payment link.');
        }
      }
    }

    resolveCheckout();

    return () => {
      cancelled = true;
    };
  }, [checkoutUrl]);

  return (
    <main className="min-h-screen bg-[#efeae2] flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-[#075E54]/20 border-t-[#075E54] animate-spin" />
        <h1 className="text-xl font-semibold text-gray-900">
          Opening secure payment
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Please wait while we connect you to PhonePe.
        </p>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {redirectUrl ? (
          <a
            className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[#075E54] px-4 py-3 text-sm font-semibold text-white"
            href={redirectUrl}
          >
            Continue
          </a>
        ) : null}
      </section>
    </main>
  );
}
