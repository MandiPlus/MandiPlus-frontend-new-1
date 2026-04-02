"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../auth/context/AuthContext';
import {
    getMyInsuranceForms,
    InsuranceForm,
    getBackendURL
} from '../api';
import { getCustomerDashboardInvoices } from '../../customer/api';

const MyInsuranceForms = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [forms, setForms] = useState<InsuranceForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchForms();
    }, []);

    const fetchForms = async () => {
        try {
            const data = user?.identity === 'CUSTOMER'
                ? await getCustomerDashboardInvoices()
                : await getMyInsuranceForms();
            setForms(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load forms');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (pdfUrl?: string) => {
        if (!pdfUrl) {
            alert('PDF not available');
            return;
        }
        // If it's a full Cloudinary URL, use it. Otherwise prepend backend URL.
        const link = pdfUrl.startsWith('http')
            ? pdfUrl
            : `${getBackendURL()}${pdfUrl}`;

        window.open(link, '_blank');
    };

    if (loading) return <div className="p-4 text-center">Loading...</div>;
    if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

    return (
        <div className="min-h-screen bg-[#e0d7fc] p-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => router.push('/home')}
                        className="flex items-center text-[#4309ac] hover:text-[#340b85] transition-colors"
                    >
                        <ArrowLeftCircleIcon className="w-8 h-8 mr-1" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">My Invoices</h1>
                    <div className="w-20">
                        <button
                            onClick={() => router.push('/insurance')}
                            className="bg-[#4309ac] text-white px-4 py-2 rounded-lg hover:bg-[#340b85] transition-colors"
                        >
                            + New
                        </button>
                    </div>
                </div>

                {forms.length === 0 ? (
                    <div className="text-center text-gray-500 mt-10">
                        <p>No invoices found.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {forms.map((form) => (
                            <div key={form.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                                <div className="flex justify-between items-start text-slate-800">
                                    <div>
                                        <p className="font-bold text-lg">{form.invoiceNumber}</p>
                                        <p className="text-sm text-gray-500">
                                            {form.createdAt
                                                ? new Date(form.createdAt).toLocaleDateString()
                                                : 'N/A'}
                                        </p>
                                    </div>
                                    <span className="bg-purple-100 text-[#4309ac] text-xs px-2 py-1 rounded">
                                        ₹{form.amount}
                                    </span>
                                </div>

                                <div className="mt-3 text-sm text-gray-700 space-y-1">
                                    <p><strong>Bill To:</strong> {form.billToName}</p>
                                    <p><strong>Item:</strong> {form.productName && form.productName[0]}</p>
                                </div>

                                <div className="mt-4 flex gap-3">
                                    <button
                                        onClick={() => handleDownload(form.pdfUrl || form.pdfURL)}
                                        className="text-[#075E54] font-medium hover:underline text-sm flex items-center gap-1"
                                    >
                                        <span className="text-[#4309ac]">📄</span> Download PDF
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyInsuranceForms;
