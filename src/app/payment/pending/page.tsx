'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PendingContent() {
  const params = useSearchParams();
  const invoiceId = params.get('invoiceId');

  return (
    <div className="min-h-screen bg-[#efeae2] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Pending</h1>
        <p className="text-gray-500 mb-6">
          Your payment is being processed. This may take a few minutes. You will be notified on WhatsApp once confirmed.
        </p>
        {invoiceId && (
          <p className="text-xs text-gray-400 mb-6">Invoice ID: {invoiceId}</p>
        )}
        <a
          href="/home"
          className="block w-full bg-[#075E54] text-white py-3 rounded-xl font-semibold hover:bg-[#128C7E] transition-colors"
        >
          Go to Home
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
