'use client';
import {
  getCustomerPaymentCheckoutStatus,
  getCustomerWalletTopupStatus,
  type CustomerPaymentStatusInvoice,
} from '@/features/customer/api';
import {
  clearCustomerInvoicePaymentAttempt,
  readCustomerInvoicePaymentAttempt,
  writeCustomerInvoicePaymentAttempt,
} from '@/features/customer-app/payment-attempt';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const CUSTOMER_PAYMENT_STATUS_ATTEMPTS = 6;
const CUSTOMER_PAYMENT_STATUS_INTERVAL_MS = 1_500;

function customerInvoiceSuccessUrl({
  invoiceId,
  invoiceNumber,
  vehicle,
  merchantOrderId,
}: {
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  vehicle?: string | null;
  merchantOrderId?: string | null;
}) {
  const query = new URLSearchParams();
  if (invoiceId) query.set('invoiceId', invoiceId);
  if (invoiceNumber) query.set('invoiceNumber', invoiceNumber);
  if (vehicle) query.set('vehicle', vehicle);
  if (merchantOrderId) query.set('merchantOrderId', merchantOrderId);
  return `/payment/success?${query.toString()}`;
}

function matchingPaidInvoice(
  invoices: CustomerPaymentStatusInvoice[] | undefined,
  preferredInvoiceIds: Array<string | null | undefined>,
) {
  if (!invoices?.length) return null;
  const preferredIds = preferredInvoiceIds.filter(Boolean);
  return (
    invoices.find((invoice) => preferredIds.includes(invoice.id)) ||
    invoices[0]
  );
}

function PendingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const invoiceId = params.get('invoiceId');
  const isWalletTopup = params.get('walletTopup') === '1';
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
      const invoicePaymentAttempt = isWalletTopup
        ? null
        : readCustomerInvoicePaymentAttempt();
      const matchingInvoicePaymentAttempt =
        invoicePaymentAttempt?.merchantOrderId === merchantOrderId
          ? invoicePaymentAttempt
          : null;
      const shouldReturnToInvoice =
        isCustomerInvoiceReturn ||
        Boolean(matchingInvoicePaymentAttempt);
      const returnToInvoiceRetry = () => {
        if (matchingInvoicePaymentAttempt) {
          writeCustomerInvoicePaymentAttempt({
            ...matchingInvoicePaymentAttempt,
            phase: 'retry',
          });
        }
        router.replace('/insurance?paymentReturn=1');
      };
      try {
        for (
          let attempt = 0;
          attempt < CUSTOMER_PAYMENT_STATUS_ATTEMPTS;
          attempt += 1
        ) {
          const result = isWalletTopup
            ? await getCustomerWalletTopupStatus(merchantOrderId)
            : await getCustomerPaymentCheckoutStatus(merchantOrderId);
          if (cancelled) return;
          const state = String(result.state || '').toUpperCase();
          const failed = ['FAILED', 'CANCELLED', 'EXPIRED', 'DECLINED'].includes(state);

          if (result.paid) {
            if (shouldReturnToInvoice) {
              if (matchingInvoicePaymentAttempt) {
                clearCustomerInvoicePaymentAttempt();
              }
              const paidInvoice =
                !isWalletTopup && 'invoices' in result
                  ? matchingPaidInvoice(result.invoices, [
                      invoiceId,
                      matchingInvoicePaymentAttempt?.invoiceId,
                    ])
                  : null;
              const paidInvoiceId =
                invoiceId ||
                matchingInvoicePaymentAttempt?.invoiceId ||
                paidInvoice?.id;
              router.replace(
                customerInvoiceSuccessUrl({
                  invoiceId: paidInvoiceId,
                  invoiceNumber: paidInvoice?.invoiceNumber,
                  vehicle: paidInvoice?.vehicleNumber,
                  merchantOrderId,
                }),
              );
              return;
            }
            setStatus('success');
            setMessage(
              isWalletTopup
                ? 'Payment confirmed. Credit has been added to your MandiPlus Wallet.'
                : 'Your payment has been confirmed. Receipts and policy updates will be shared on WhatsApp.',
            );
            return;
          }

          if (failed) {
            if (shouldReturnToInvoice) {
              returnToInvoiceRetry();
              return;
            }
            setStatus('failed');
            setMessage(
              isWalletTopup
                ? 'Payment was not completed. Your wallet balance remains unchanged.'
                : 'Payment was not completed. Your invoices and full pending dues remain unchanged.',
            );
            return;
          }

          if (
            shouldReturnToInvoice &&
            attempt === CUSTOMER_PAYMENT_STATUS_ATTEMPTS - 1
          ) {
            returnToInvoiceRetry();
            return;
          }

          setStatus('pending');
          setMessage(
            isWalletTopup
              ? 'Payment is not confirmed yet. Credit will be added only after PhonePe confirms it.'
              : 'Payment is not confirmed yet. Your dues will remain visible until PhonePe confirms it.',
          );
          if (attempt < CUSTOMER_PAYMENT_STATUS_ATTEMPTS - 1) {
            await new Promise<void>((resolve) => {
              retryTimer = setTimeout(
                resolve,
                CUSTOMER_PAYMENT_STATUS_INTERVAL_MS,
              );
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
  }, [
    invoiceId,
    isCustomerInvoiceReturn,
    isWalletTopup,
    merchantOrderId,
    router,
  ]);

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
          {checking
            ? 'Checking Payment'
            : isSuccess
              ? isWalletTopup
                ? 'Money added'
                : 'Payment Successful!'
              : isFailed
                ? 'Payment Failed'
                : 'Payment Pending'}
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
          href={isWalletTopup ? '/customer/wallet' : '/insurance?paymentReturn=1'}
          className="block w-full bg-[#075E54] text-white py-3 rounded-xl font-semibold hover:bg-[#128C7E] transition-colors"
        >
          {isWalletTopup ? 'Back to Wallet' : 'Back to Insurance'}
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
