'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function FailedContent() {
    const params = useSearchParams();
    const txnId = params.get('transactionId') || params.get('merchantTransactionId') || '';
    const invoiceNo = params.get('invoiceNumber') || '';

    return (
        <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mx-auto mb-6">
                    <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
                <p className="text-gray-500 mb-6">
                    Your payment could not be processed. Please try again or contact support.
                </p>

                {invoiceNo && (
                    <div className="bg-gray-50 rounded-lg px-4 py-3 mb-2 text-left">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Invoice Number</p>
                        <p className="font-semibold text-gray-800">{invoiceNo}</p>
                    </div>
                )}
                {txnId && (
                    <div className="bg-gray-50 rounded-lg px-4 py-3 mb-6 text-left">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Transaction ID</p>
                        <p className="font-semibold text-gray-800 text-sm break-all">{txnId}</p>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => window.history.back()}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                    >
                        Try Again
                    </button>
                    <Link
                        href="/home"
                        className="block w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-3 px-6 rounded-xl transition-colors"
                    >
                        Go to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function PaymentFailedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <FailedContent />
        </Suspense>
    );
}
