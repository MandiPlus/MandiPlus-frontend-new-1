'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const ATTEMPTS = 6;
const INTERVAL_MS = 1_500;

type PayStatus = {
  paid: boolean;
  paymentStatus: string | null;
  invoiceNumber: string | null;
  amount: number;
};

/**
 * Landing page after the customer closes the Razorpay modal.
 *
 * The browser is never trusted for payment truth: this polls our own backend,
 * which re-reads the order from the gateway. That also means a dismissed modal
 * which actually completed (common on mobile UPI app-switch) still resolves.
 */
export default function PayDonePage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = use(params);
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/payment/pay/${encodeURIComponent(shortCode)}/status`,
          );
          const data = (await response.json()) as PayStatus;
          if (cancelled) return;
          setStatus(data);
          if (data.paid) break;
        } catch {
          // Keep polling — a transient failure is not a payment outcome.
        }
        if (attempt < ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
        }
      }
      if (!cancelled) setChecking(false);
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [shortCode]);

  const paid = status?.paid;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
        {paid ? (
          <>
            <p className="text-2xl font-bold text-emerald-700">Payment received</p>
            <p className="mt-2 text-sm text-gray-600">
              {status?.invoiceNumber
                ? `Invoice ${status.invoiceNumber} is now paid.`
                : 'Your payment is confirmed.'}
            </p>
          </>
        ) : checking ? (
          <>
            <p className="text-lg font-semibold text-gray-900">
              Confirming your payment…
            </p>
            <p className="mt-2 text-sm text-gray-500">
              This takes a few seconds. Please do not close this page.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-gray-900">
              Payment not confirmed yet
            </p>
            <p className="mt-2 text-sm text-gray-600">
              If money has left your account it will be confirmed shortly. You do
              not need to pay again — reopen the link to check.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
