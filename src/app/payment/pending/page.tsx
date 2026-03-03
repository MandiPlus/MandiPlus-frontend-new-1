'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function PendingContent() {
    const params = useSearchParams();
    const router = useRouter();
    const txnId = params.get('transactionId') || params.get('merchantTransactionId') || '';
    const invoiceNo = params.get('invoiceNumber') || '';
    const [attempts, setAttempts] = useState(0);
    const MAX_ATTEMPTS = 12; // Poll for ~60 seconds

    useEffect(() => {
        if (!txnId) return;

        const poll = async () => {
            try {
                const res = await fetch(`/api/payment/status/${txnId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.status === 'PAYMENT_SUCCESS') {
                        router.replace(`/payment/success?transactionId=${txnId}&invoiceNumber=${invoiceNo}`);
                        return;
                    }
                    if (data?.status === 'PAYMENT_ERROR' || data?.status === 'PAYMENT_DECLINED') {
                        router.replace(`/payment/failed?transactionId=${txnId}&invoiceNumber=${invoiceNo}`);
                        return;
                    }
                }
            } catch (e) {
                console.error('Status poll error', e);
            }

            setAttempts(prev => prev + 1);
        };

        if (attempts < MAX_ATTEMPTS) {
            const timer = setTimeout(poll, 5000);
            return () => clearTimeout(timer);
        }
    }, [txnId, attempts, router, invoiceNo]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 mx-auto mb-6">
                    <svg
                        className="w-10 h-10 text-yellow-600 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Pending</h1>
                <p className="text-gray-500 mb-6">
                    Your payment is being processed. This page will update automatically.
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

                {attempts >= MAX_ATTEMPTS && (
                    <p className="text-yellow-600 text-sm mb-4">
                        Taking longer than expected. Please check back later or contact support.
                    </p>
                )}

                <a
                    href="/home"
                    className="block w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                    Go to Home
                </a>
            </div>
        </div>
    );
}

export default function PaymentPendingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <PendingContent />
        </Suspense>
    );
}
