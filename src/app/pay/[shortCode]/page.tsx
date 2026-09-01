'use client';

import { startGatewayCheckout } from '@/features/payments/gateway-checkout';
import { useCallback, useEffect, useState } from 'react';
import { use } from 'react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type PayCheckout = {
  success: boolean;
  alreadyPaid: boolean;
  amount: number;
  invoiceNumber: string;
  payeeName: string;
  provider: 'RAZORPAY' | 'PHONEPE' | null;
  redirectUrl: string | null;
  razorpayCheckout: Parameters<typeof startGatewayCheckout>[0]['razorpayCheckout'];
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

/**
 * Public payment page for a WhatsApp payment link.
 *
 * No sign-in: the recipient is a customer who only has the link. It exists
 * because Razorpay's own hosted link page always demands the payer's mobile
 * number — a deliberate policy on their side that no API option overrides — so
 * hosting the checkout ourselves is the only way to prefill and lock it.
 */
export default function PayPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = use(params);
  const [checkout, setCheckout] = useState<PayCheckout | null>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/payment/pay/${encodeURIComponent(shortCode)}/checkout`)
      .then(async (response) => {
        if (!response.ok) throw new Error('This payment link is not valid.');
        return (await response.json()) as PayCheckout;
      })
      .then((data) => {
        if (cancelled) return;
        // A PhonePe link is hosted by PhonePe — forward rather than render.
        if (!data.alreadyPaid && data.redirectUrl) {
          window.location.assign(data.redirectUrl);
          return;
        }
        setCheckout(data);
      })
      .catch((err) => !cancelled && setError(err.message || 'Link not found.'));
    return () => {
      cancelled = true;
    };
  }, [shortCode]);

  const pay = useCallback(async () => {
    if (!checkout?.razorpayCheckout || opening) return;
    setOpening(true);
    setError('');
    try {
      await startGatewayCheckout({
        provider: 'RAZORPAY',
        redirectUrl: null,
        razorpayCheckout: checkout.razorpayCheckout,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not open payment. Try again.',
      );
      setOpening(false);
    }
  }, [checkout, opening]);

  if (error) {
    return (
      <Shell>
        <p className="text-lg font-semibold text-gray-900">Payment link</p>
        <p className="mt-2 text-sm text-red-600">{error}</p>
      </Shell>
    );
  }

  if (!checkout) {
    return (
      <Shell>
        <p className="text-sm text-gray-500">Loading payment details…</p>
      </Shell>
    );
  }

  if (checkout.alreadyPaid) {
    return (
      <Shell>
        <p className="text-lg font-semibold text-gray-900">Already paid</p>
        <p className="mt-2 text-sm text-gray-600">
          Invoice {checkout.invoiceNumber} has been paid. Nothing more is due.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-sm font-medium text-gray-500">Payment request</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">
        {money(checkout.amount)}
      </p>
      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">For</dt>
          <dd className="text-right font-medium text-gray-900">
            {checkout.payeeName}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Invoice</dt>
          <dd className="text-right font-medium text-gray-900">
            {checkout.invoiceNumber}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={pay}
        disabled={opening}
        className="mt-8 w-full rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
      >
        {opening ? 'Opening payment…' : `Pay ${money(checkout.amount)}`}
      </button>
      <p className="mt-4 text-center text-xs text-gray-400">
        Secured by Razorpay · UPI, cards and netbanking
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        {children}
      </section>
    </main>
  );
}
