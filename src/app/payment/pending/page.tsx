'use client';
import { getCustomerPaymentCheckoutStatus } from '@/features/customer/api';
import {
  clearCustomerInvoicePaymentAttempt,
  readCustomerInvoicePaymentAttempt,
  writeCustomerInvoicePaymentAttempt,
} from '@/features/customer-app/payment-attempt';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function PendingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const invoiceId = params.get('invoiceId');
  const isCustomerInvoiceReturn = params.get('customerInvoice') === '1';
  const merchantOrderId = params.get('merchantOrderId') || params.get('merchantTransactionId');
  const [checking, setChecking] = useState(Boolean(merchantOrderId));
  const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const checkStatus = async () => {
      if (!merchantOrderId) return;
      setChecking(true);
      const invoicePaymentAttempt = readCustomerInvoicePaymentAttempt();
      const shouldReturnToInvoice =
        isCustomerInvoiceReturn ||
        invoicePaymentAttempt?.merchantOrderId === merchantOrderId;
      const returnToInvoiceRetry = () => {
        if (invoicePaymentAttempt?.merchantOrderId === merchantOrderId) {
          writeCustomerInvoicePaymentAttempt({
            ...invoicePaymentAttempt,
            phase: 'retry',
          });
        }
        router.replace('/insurance?paymentReturn=1');
      };
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const result = await getCustomerPaymentCheckoutStatus(merchantOrderId);
          if (cancelled) return;
          const state = String(result.state || '').toUpperCase();
          const failed = ['FAILED', 'CANCELLED', 'EXPIRED', 'DECLINED'].includes(state);

          if (result.paid) {
            if (shouldReturnToInvoice) {
              if (invoicePaymentAttempt) {
                clearCustomerInvoicePaymentAttempt();
              }
              const paidInvoiceId =
                invoicePaymentAttempt?.invoiceId || invoiceId;
              router.replace(
                paidInvoiceId
                  ? `/payment/success?invoiceId=${encodeURIComponent(paidInvoiceId)}`
                  : '/payment/success',
              );
              return;
            }
            setStatus('success');
            setMessage('Your payment has been confirmed. Receipts and policy updates will be shared on WhatsApp.');
            return;
          }

          if (shouldReturnToInvoice) {
            returnToInvoiceRetry();
            return;
          }

          if (failed) {
            setStatus('failed');
            setMessage('Payment was not completed. Your invoices and full pending dues remain unchanged.');
            return;
          }

          setStatus('pending');
          setMessage('Payment is not confirmed yet. Your dues will remain visible until PhonePe confirms it.');
          if (attempt < 2) {
            await new Promise<void>((resolve) => {
              retryTimer = setTimeout(resolve, 2000);
            });
          }
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (shouldReturnToInvoice) {
          returnToInvoiceRetry();
          return;
        }
        const text = error instanceof Error ? error.message : '';
        setStatus('pending');
        setMessage(text || 'We could not confirm the payment. Your dues remain unchanged until confirmation.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    checkStatus();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [invoiceId, isCustomerInvoiceReturn, merchantOrderId, router]);

  const isSuccess = status === 'success';
  const isFailed = status === 'failed';

  return (
    <div className="min-h-screen bg-[#efeae2] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isSuccess ? 'bg-green-100' : isFailed ? 'bg-red-100' : 'bg-yellow-100'
        }`}>
          <svg className={`w-10 h-10 ${isSuccess ? 'text-green-500' : isFailed ? 'text-red-500' : 'text-yellow-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSuccess ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : isFailed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {checking ? 'Checking Payment' : isSuccess ? 'Payment Successful!' : isFailed ? 'Payment Failed' : 'Payment Pending'}
        </h1>
        <p className="text-gray-500 mb-6">
          {message || 'Your payment is being processed. This may take a few minutes. You will be notified on WhatsApp once confirmed.'}
        </p>
        {invoiceId && (
          <p className="text-xs text-gray-400 mb-6">Invoice ID: {invoiceId}</p>
        )}
        {merchantOrderId && (
          <p className="text-xs text-gray-400 mb-6">Payment Ref: {merchantOrderId}</p>
        )}
        <a
          href="/insurance?paymentReturn=1"
          className="block w-full bg-[#075E54] text-white py-3 rounded-xl font-semibold hover:bg-[#128C7E] transition-colors"
        >
          Back to Insurance
        </a>
      </div>
    </div>
  );
}

export default function PaymentPendingPage() {
  return (
    <Suspense>
      <PendingContent />
    </Suspense>
  );
}
