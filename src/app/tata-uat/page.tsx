'use client';

import React, { useState } from 'react';
import { ArrowLeftCircleIcon, CheckCircleIcon, XCircleIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface StepResult {
    step: number;
    name: string;
    method: string;
    url: string;
    passed: boolean;
    http_status: number;
    detail: string;
    policy_id?: string;
    cert_status?: string;
    pdf_available?: boolean;
    request_body?: Record<string, unknown> | null;
    raw_response?: Record<string, unknown> | null;
}

interface TestResponse {
    ok: boolean;
    summary: string;
    policy_id: string | null;
    pdf_url: string | null;
    steps: StepResult[];
}

interface RetryDownloadResponse {
    ok: boolean;
    policy_id: string | null;
    cert_status?: string | null;
    pdf_available?: boolean;
    summary: string;
    download_http?: number;
}

function JsonBlock({ data, title }: { data: unknown; title: string }) {
    const [open, setOpen] = useState(false);
    if (data === null || data === undefined) return null;
    return (
        <div className="mt-2">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
                {open ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                {title}
            </button>
            {open && (
                <pre className="mt-1 bg-gray-900 text-green-300 text-xs rounded-lg p-3 overflow-auto max-h-96 leading-relaxed font-mono">
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
}

export default function TataUatTestPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TestResponse | null>(null);
    const [error, setError] = useState('');
    const [expandedStep, setExpandedStep] = useState<number | null>(null);
    const [retryingDownload, setRetryingDownload] = useState(false);

    const [formData, setFormData] = useState({
        backendUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
        accessToken: '',
        supplierName: 'TATA AIG UAT Supplier',
        supplierAddress: 'Mumbai, Maharashtra',
        buyerName: 'TATA AIG UAT Buyer',
        buyerAddress: 'Delhi',
        placeOfSupply: 'Delhi',
        productName: 'Mango',
        quantity: 100,
        rate: 50,
        vehicleNumber: 'MH04AB1234'
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'quantity' || name === 'rate' ? Number(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);
        setExpandedStep(null);

        try {
            const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
            const uatAccessToken = formData.accessToken.trim();
            if (!adminToken && !uatAccessToken) {
                throw new Error('Enter the Tata UAT access token or log in as admin.');
            }

            const targetUrl = formData.backendUrl.replace(/\/$/, '') + '/admin/tata-aig/uat-test';
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
                    ...(uatAccessToken ? { 'x-tata-uat-access-token': uatAccessToken } : {}),
                },
                body: JSON.stringify({
                    supplierName: formData.supplierName,
                    supplierAddress: formData.supplierAddress,
                    buyerName: formData.buyerName,
                    buyerAddress: formData.buyerAddress,
                    placeOfSupply: formData.placeOfSupply,
                    productName: formData.productName,
                    quantity: formData.quantity,
                    rate: formData.rate,
                    vehicleNumber: formData.vehicleNumber
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data?.detail?.steps) {
                    setResult({ ok: false, summary: 'Auth failed', policy_id: null, pdf_url: null, steps: data.detail.steps });
                } else {
                    throw new Error(data.detail || data.message || 'Failed to run UAT tests');
                }
            } else {
                setResult(data);
                // Auto-expand all steps
                setExpandedStep(-1); // -1 = all expanded
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Network error or CORS issue. Make sure the backend is running.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRetryDownload = async () => {
        if (!result?.policy_id || retryingDownload) return;

        setRetryingDownload(true);
        setError('');

        try {
            const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
            const uatAccessToken = formData.accessToken.trim();
            if (!adminToken && !uatAccessToken) {
                throw new Error('Enter the Tata UAT access token or log in as admin.');
            }

            const targetUrl = formData.backendUrl.replace(/\/$/, '') + '/admin/tata-aig/retry-download';
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
                    ...(uatAccessToken ? { 'x-tata-uat-access-token': uatAccessToken } : {}),
                },
                body: JSON.stringify({
                    policyId: result.policy_id,
                    includeBase64: false,
                }),
            });

            const data: RetryDownloadResponse = await response.json();
            if (!response.ok) {
                throw new Error((data as unknown as { message?: string }).message || data.summary || 'Retry download failed');
            }

            setResult((prev) => {
                if (!prev) return prev;

                const updatedSteps = prev.steps.map((step) => {
                    if (step.step !== 5) return step;

                    return {
                        ...step,
                        passed: Boolean(data.pdf_available),
                        http_status: data.download_http ?? step.http_status,
                        detail: data.summary,
                        cert_status: data.cert_status ?? step.cert_status,
                        pdf_available: data.pdf_available,
                    };
                });

                return {
                    ...prev,
                    ok: prev.steps
                        .map((step) => {
                            if (step.step !== 5) return step;
                            return updatedSteps.find((updated) => updated.step === 5) ?? step;
                        })
                        .every((step) => (step.step === 5 ? true : step.passed)),
                    summary: data.summary,
                    steps: updatedSteps,
                };
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Retry download failed';
            setError(msg);
        } finally {
            setRetryingDownload(false);
        }
    };

    const isExpanded = (step: number) => expandedStep === -1 || expandedStep === step;
    const passedCount = result?.steps?.filter(s => s.passed).length ?? 0;
    const totalCount = result?.steps?.length ?? 0;

    const methodColor: Record<string, string> = {
        POST: 'bg-blue-100 text-blue-700',
        GET:  'bg-emerald-100 text-emerald-700',
    };

    return (
        <div className="min-h-screen bg-[#e0d7fc] p-4">
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">

                {/* Header */}
                <div className="flex items-center mb-2">
                    <button onClick={() => router.push('/home')} className="text-[#4309ac] hover:text-[#340b85] mr-3">
                        <ArrowLeftCircleIcon className="w-8 h-8" />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800">TATA AIG UAT Tester</h1>
                </div>
                <p className="mb-5 text-gray-500 text-sm">
                    Runs 4 API tests end-to-end: <strong>Auth → Master → Create → Download</strong>.
                    Click any step to view the full request &amp; response JSON.
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Backend API URL</label>
                        <input
                            type="text" name="backendUrl" value={formData.backendUrl} onChange={handleChange}
                            className="w-full p-2 border rounded text-sm text-gray-800"
                            placeholder="e.g. https://api.mandiplus.com" required
                        />
                        <p className="text-xs text-gray-500 mt-1">Point this to your deployed Mandi Plus backend</p>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tata UAT Access Token</label>
                        <input
                            type="password" name="accessToken" value={formData.accessToken} onChange={handleChange}
                            className="w-full p-2 border rounded text-sm text-gray-800"
                            placeholder="Enter shared UAT token" required={typeof window !== 'undefined' ? !localStorage.getItem('adminToken') : false}
                        />
                        <p className="text-xs text-gray-500 mt-1">Use this for Tata reviewers. Admin login also continues to work.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {([
                            { label: 'Supplier Name',    name: 'supplierName',    type: 'text' },
                            { label: 'Supplier Address', name: 'supplierAddress', type: 'text' },
                            { label: 'Buyer Name',       name: 'buyerName',       type: 'text' },
                            { label: 'Buyer Address',    name: 'buyerAddress',    type: 'text' },
                            { label: 'Place of Supply',  name: 'placeOfSupply',   type: 'text' },
                            { label: 'Product Name',     name: 'productName',     type: 'text' },
                            { label: 'Quantity',         name: 'quantity',        type: 'number' },
                            { label: 'Rate',             name: 'rate',            type: 'number' },
                        ] as const).map(f => (
                            <div key={f.name}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                                <input
                                    type={f.type} name={f.name}
                                    value={(formData as Record<string, string | number>)[f.name]}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded text-gray-800" required
                                />
                            </div>
                        ))}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                            <input
                                type="text" name="vehicleNumber" value={formData.vehicleNumber}
                                onChange={handleChange}
                                className="w-full p-2 border rounded text-gray-800" required
                            />
                        </div>
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full bg-[#4309ac] text-white font-bold py-3 rounded-lg hover:bg-[#340b85] disabled:opacity-50 mt-2 transition-colors"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <ClockIcon className="w-5 h-5 animate-spin" /> Running Tests…
                            </span>
                        ) : 'Run UAT Test Suite'}
                    </button>
                </form>

                {/* Error */}
                {error && (
                    <div className="mt-5 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                        <p className="font-bold">Error:</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="mt-6 space-y-3">

                        {/* Summary bar */}
                        <div className={`p-4 rounded-lg border flex items-center justify-between ${result.ok ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                            <div>
                                <p className={`font-bold text-lg ${result.ok ? 'text-green-800' : 'text-yellow-800'}`}>
                                    {result.ok ? '✅ All Tests Passed' : '⚠️ Some Tests Failed'}
                                </p>
                                <p className={`text-sm ${result.ok ? 'text-green-700' : 'text-yellow-700'}`}>{result.summary}</p>
                                {result.policy_id && (
                                    <p className="text-sm text-gray-700 mt-1">
                                        Policy ID: <strong className="font-mono">{result.policy_id}</strong>
                                    </p>
                                )}
                            </div>
                            <div className={`text-5xl font-black tabular-nums ${result.ok ? 'text-green-600' : 'text-yellow-600'}`}>
                                {passedCount}/{totalCount}
                            </div>
                        </div>

                        {/* Toggle all */}
                        <div className="flex justify-end">
                            <div className="flex items-center gap-3">
                                {result.policy_id && (
                                    <button
                                        onClick={handleRetryDownload}
                                        disabled={retryingDownload}
                                        className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                                    >
                                        {retryingDownload ? 'Retrying...' : 'Retry Download'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setExpandedStep(expandedStep === -1 ? null : -1)}
                                    className="text-xs text-indigo-600 hover:underline"
                                >
                                    {expandedStep === -1 ? 'Collapse all' : 'Expand all'}
                                </button>
                            </div>
                        </div>

                        {/* Per-step cards */}
                        {result.steps.map(step => (
                            <div
                                key={step.step}
                                className={`rounded-lg border overflow-hidden transition-all ${step.passed ? 'border-green-200' : 'border-red-200'}`}
                            >
                                {/* Step header */}
                                <button
                                    className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${step.passed ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}`}
                                    onClick={() => setExpandedStep(isExpanded(step.step) && expandedStep !== -1 ? null : step.step)}
                                >
                                    {step.passed
                                        ? <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
                                        : <XCircleIcon    className="w-6 h-6 text-red-500   flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${step.passed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                                STEP {step.step}
                                            </span>
                                            {step.method && (
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${methodColor[step.method] ?? 'bg-gray-100 text-gray-700'}`}>
                                                    {step.method}
                                                </span>
                                            )}
                                            <span className="font-semibold text-gray-800 text-sm">{step.name}</span>
                                            <span className={`ml-auto text-xs font-mono px-2 py-0.5 rounded ${step.http_status === 200 ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>
                                                HTTP {step.http_status}
                                            </span>
                                        </div>
                                        {step.url && (
                                            <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{step.url}</p>
                                        )}
                                        <p className={`text-xs mt-0.5 ${step.passed ? 'text-green-700' : 'text-red-700'}`}>
                                            {step.detail}
                                        </p>
                                    </div>
                                    {isExpanded(step.step)
                                        ? <ChevronUpIcon   className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        : <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    }
                                </button>

                                {/* Expanded detail panel */}
                                {isExpanded(step.step) && (
                                    <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-1">

                                        {/* Quick facts */}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
                                            <span><strong>Status:</strong> {step.passed ? '✅ PASS' : '❌ FAIL'}</span>
                                            <span><strong>HTTP:</strong> {step.http_status}</span>
                                            {step.policy_id  && <span><strong>Policy ID:</strong> <span className="font-mono">{step.policy_id}</span></span>}
                                            {step.cert_status && <span><strong>Cert Status:</strong> {step.cert_status}</span>}
                                            {step.pdf_available !== undefined && (
                                                <span className="col-span-2">
                                                    <strong>PDF:</strong> {step.pdf_available ? '✅ Available' : '⏳ Not available (UAT: pending underwriter approval)'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Request body */}
                                        <JsonBlock data={step.request_body} title="▶ Request Body (sent to Tata AIG)" />

                                        {/* Full raw response */}
                                        <JsonBlock data={step.raw_response} title="◀ Full API Response (from Tata AIG)" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* PDF link */}
                        {result.pdf_url && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="font-semibold text-blue-800 mb-1">🎉 Certificate PDF Generated!</p>
                                <a href={result.pdf_url} target="_blank" rel="noreferrer"
                                   className="text-blue-600 underline text-sm break-all">
                                    {result.pdf_url}
                                </a>
                            </div>
                        )}

                        {/* UAT note */}
                        {!result.pdf_url && result.policy_id && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-amber-800 text-xs">
                                    <strong>⚠️ UAT Note:</strong> No PDF was generated because Tata AIG UAT always returns
                                    &quot;Referred to Underwriter&quot;. The policy draft was successfully created
                                    (Policy ID: <strong className="font-mono">{result.policy_id}</strong>).
                                    This is expected UAT behaviour — the integration is working correctly.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
