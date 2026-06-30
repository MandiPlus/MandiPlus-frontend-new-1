'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorContent() {
  const params = useSearchParams();
  const message = params.get('message');

  return (
    <div className="min-h-screen bg-[#efeae2] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Link Error</h1>
        <p className="text-gray-500 mb-6">
          We could not verify this payment link. Please ask the mandi team to resend it.
        </p>
        {message && (
          <p className="text-xs text-gray-400 mb-6 break-words">{message}</p>
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

export default function PaymentErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
