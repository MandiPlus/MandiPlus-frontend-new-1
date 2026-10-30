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
    policy_id?: string | null;
    cert_status?: string | null;
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

type StreamEvent =
    | { type: 'step'; step: StepResult }
    | { type: 'final'; result: TestResponse }
    | { type: 'error'; message?: string; detail?: unknown };

function JsonBlock({ data, title }: { data: unknown; title: string }) {
    const [open, setOpen] = useState(false);
    if (data === null || data === undefined) return null;
    return (
        <div className="mt-2 w-full min-w-0 max-w-full overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
                {open ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                {title}
            </button>
            {open && (
                <pre
                    className="mt-1 max-h-80 w-full min-w-0 max-w-full overflow-auto rounded-md bg-gray-900 p-3 font-mono text-[11px] leading-relaxed text-green-300"
                    style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                    }}
                >
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
}

function getTodayInputDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createRunningResult(summary = 'Starting Tata AIG UAT flow...'): TestResponse {
    return {
        ok: false,
        summary,
        policy_id: null,
        pdf_url: null,
        steps: [],
    };
}

export default function TataUatTestPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TestResponse | null>(null);
    const [error, setError] = useState('');
    const [expandedStep, setExpandedStep] = useState<number | null>(null);
    const [retryingDownload, setRetryingDownload] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    const [formData, setFormData] = useState({
        backendUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
        policyNo: '',
        supplierName: 'TATA AIG UAT Supplier',
        supplierAddress: 'Mumbai, Maharashtra',
        buyerName: 'TATA AIG UAT Buyer',
        buyerAddress: 'Delhi',
        placeOfSupply: 'Delhi',
        productName: 'Mango',
        quantity: 100,
        rate: 50,
        invoiceType: 'CASH',
        mode_of_shipment: 'Road',
        from_city: 'Mumbai',
        to_city: 'Delhi',
        vehicleNumber: 'MH04AB1234',
        shipmentDate: getTodayInputDate()
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'quantity' || name === 'rate' ? Number(value) : value
        }));
    };

    const mergeStep = (step: StepResult) => {
        setResult((prev) => {
            const current = prev || createRunningResult('Running Tata AIG UAT flow...');
            const steps = [
                ...current.steps.filter((item) => item.step !== step.step),
                step,
            ].sort((a, b) => a.step - b.step);

            return {
                ...current,
                summary: step.detail,
                policy_id: step.policy_id || current.policy_id,
                steps,
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(createRunningResult());
        setExpandedStep(-1);

        try {
            const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
            if (!adminToken) {
                throw new Error('Log in as admin to run Tata AIG UAT tests.');
            }

            const policyNo = formData.policyNo.trim();
            if (!policyNo) {
                throw new Error('Enter the Tata AIG policy number.');
            }

            const targetUrl = formData.backendUrl.replace(/\/$/, '') + '/admin/tata-aig/uat-test-stream';
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
                },
                body: JSON.stringify({
                    policyNo,
                    supplierName: formData.supplierName,
                    supplierAddress: formData.supplierAddress,
                    buyerName: formData.buyerName,
                    buyerAddress: formData.buyerAddress,
                    placeOfSupply: formData.placeOfSupply,
                    productName: formData.productName,
                    quantity: formData.quantity,
                    rate: formData.rate,
                    invoiceType: formData.invoiceType,
                    mode_of_shipment: formData.mode_of_shipment,
                    from_city: formData.from_city,
                    to_city: formData.to_city,
                    city_name: formData.to_city,
                    vehicleNumber: formData.vehicleNumber,
                    shipmentDate: formData.shipmentDate
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.detail || data?.message || 'Failed to run UAT tests');
            }

            if (!response.body) {
                throw new Error('Backend did not return a streaming response.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    const event = JSON.parse(trimmed) as StreamEvent;
                    if (event.type === 'step') {
                        mergeStep(event.step);
                    } else if (event.type === 'final') {
                        setResult(event.result);
                    } else if (event.type === 'error') {
                        throw new Error(event.message || 'Failed to run UAT tests');
                    }
                }
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
            if (!adminToken) {
                throw new Error('Log in as admin to retry Tata AIG downloads.');
            }

            const targetUrl = formData.backendUrl.replace(/\/$/, '') + '/admin/tata-aig/retry-download';
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
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
                    ok: updatedSteps.every((step) => (step.step === 5 ? true : step.passed)),
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

    const handleDownloadPdf = async () => {
        if (!result?.policy_id || downloadingPdf) return;

        setDownloadingPdf(true);
        setError('');

        try {
            const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
            if (!adminToken) {
                throw new Error('Log in as admin to download Tata AIG certificates.');
            }

            const targetUrl = `${formData.backendUrl.replace(/\/$/, '')}/admin/tata-aig/download/${encodeURIComponent(result.policy_id)}`;
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
                },
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Certificate PDF download failed');
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `tata-aig-certificate-${result.policy_id}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(blobUrl);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Certificate PDF download failed';
            setError(msg);
        } finally {
            setDownloadingPdf(false);
        }
    };

    const isExpanded = (step: number) => expandedStep === -1 || expandedStep === step;
    const passedCount = result?.steps?.filter(s => s.passed).length ?? 0;
    const totalCount = result?.steps?.length ?? 0;
    const pdfStep = result?.steps?.find((step) => step.step === 5);
    const pdfAvailable = Boolean(result?.pdf_url || pdfStep?.pdf_available);
    const hasSteps = totalCount > 0;

    const methodColor: Record<string, string> = {
        POST: 'bg-blue-100 text-blue-700',
        GET:  'bg-emerald-100 text-emerald-700',
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#e0d7fc] p-4">
            <div className="mx-auto grid w-full max-w-5xl gap-4">
                <div className="min-w-0 rounded-lg border border-white/70 bg-white shadow-xl shadow-[#b8a6ea]/30">
                    <div className="border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center">
                            <button onClick={() => router.push('/home')} className="mr-3 text-[#4309ac] hover:text-[#340b85]">
                                <ArrowLeftCircleIcon className="h-7 w-7" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">TATA AIG UAT Tester</h1>
                                <p className="mt-1 text-xs text-slate-500">
                                    Auth - Master - Create - Status - Download
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5">
                    <p className="mb-4 text-sm text-slate-500">
                        Run the full UAT flow and inspect each Tata AIG request and response as it completes.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="rounded-lg border border-violet-100 bg-violet-50/70 p-4">
                            <label className="mb-1.5 block text-sm font-semibold text-slate-800">Backend API URL</label>
                            <input
                                type="text" name="backendUrl" value={formData.backendUrl} onChange={handleChange}
                                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15"
                                placeholder="e.g. https://api.mandiplus.com" required
                            />
                            <p className="mt-1.5 text-xs text-slate-500">Point this to your deployed Mandi Plus backend</p>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
                            <label className="mb-1.5 block text-sm font-semibold text-slate-800">Tata AIG Policy Number</label>
                            <input
                                type="text" name="policyNo" value={formData.policyNo} onChange={handleChange}
                                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15"
                                placeholder="Enter Tata AIG policy number" required
                            />
                            <p className="mt-1.5 text-xs text-slate-500">This value is sent with the UAT request.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Invoice Type</label>
                                <select
                                    name="invoiceType"
                                    value={formData.invoiceType}
                                    onChange={handleChange}
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15"
                                >
                                    <option value="CASH">CASH - Domestic Purchase</option>
                                    <option value="COMMISSION">COMMISSION - Domestic Sales</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Mode of Shipment</label>
                                <select
                                    name="mode_of_shipment"
                                    value={formData.mode_of_shipment}
                                    onChange={handleChange}
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15"
                                >
                                    <option value="Road">Road</option>
                                    <option value="Rail">Rail</option>
                                    <option value="Air">Air</option>
                                    <option value="Sea">Sea</option>
                                    <option value="Post">Post</option>
                                    <option value="Courier">Courier</option>
                                    <option value="Registered Post Parcel">Registered Post Parcel</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">From City</label>
                                <input
                                    type="text" name="from_city" value={formData.from_city}
                                    onChange={handleChange}
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15" required
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">To City</label>
                                <input
                                    type="text" name="to_city" value={formData.to_city}
                                    onChange={handleChange}
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15" required
                                />
                            </div>
                            {([
                                { label: 'Supplier Name',    name: 'supplierName',    type: 'text' },
                                { label: 'Supplier Address', name: 'supplierAddress', type: 'text' },
                                { label: 'Buyer Name',       name: 'buyerName',       type: 'text' },
                                { label: 'Buyer Address',    name: 'buyerAddress',    type: 'text' },
                                { label: 'Place of Supply',  name: 'placeOfSupply',   type: 'text' },
                                { label: 'Product Name',     name: 'productName',     type: 'text' },
                                { label: 'Quantity',         name: 'quantity',        type: 'number' },
                                { label: 'Rate',             name: 'rate',            type: 'number' },
                                { label: 'Shipment / Issue Date', name: 'shipmentDate', type: 'date' },
                            ] as const).map(f => (
                                <div key={f.name}>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">{f.label}</label>
                                    <input
                                        type={f.type} name={f.name}
                                        value={(formData as Record<string, string | number>)[f.name]}
                                        onChange={handleChange}
                                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15" required
                                    />
                                </div>
                            ))}
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Vehicle Number</label>
                                <input
                                    type="text" name="vehicleNumber" value={formData.vehicleNumber}
                                    onChange={handleChange}
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4309ac] focus:ring-2 focus:ring-[#4309ac]/15" required
                                />
                            </div>
                        </div>

                        <button
                            type="submit" disabled={loading}
                            className="h-11 w-full rounded-lg bg-[#4309ac] text-sm font-bold text-white shadow-md shadow-[#4309ac]/20 transition hover:bg-[#340b85] disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <ClockIcon className="h-4 w-4 animate-spin" /> Running Tests...
                                </span>
                            ) : 'Run UAT Test Suite'}
                        </button>
                    </form>
                    </div>
                </div>

                <div className="min-w-0 rounded-lg border border-white/70 bg-white shadow-xl shadow-[#b8a6ea]/30">
                    <div className="border-b border-slate-100 bg-white px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Test Results</h2>
                                <p className="mt-1 text-xs text-slate-500">Each API call appears here as soon as it completes.</p>
                            </div>
                            {loading && <ClockIcon className="h-5 w-5 animate-spin text-[#4309ac]" />}
                        </div>
                    </div>

                    <div className="p-5">
                    {error && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                            <p className="text-sm font-bold">Error</p>
                            <p className="mt-1 text-sm">{error}</p>
                        </div>
                    )}

                    {!result && (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                            Run the UAT suite to see Auth, Master, Create, Certificate Status, and Download results here.
                        </div>
                    )}

                    {result && (
                        <div className="min-w-0 space-y-3">
                            <div className={`flex min-w-0 items-center justify-between gap-4 rounded-lg border p-4 ${result.ok ? 'bg-green-50 border-green-200' : hasSteps ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="min-w-0">
                                    <p className={`text-base font-bold ${result.ok ? 'text-green-800' : hasSteps ? 'text-yellow-800' : 'text-slate-700'}`}>
                                        {loading ? 'Running UAT Flow' : result.ok ? 'All Tests Passed' : 'Some Tests Failed'}
                                    </p>
                                    <p className={`mt-1 text-xs ${result.ok ? 'text-green-700' : hasSteps ? 'text-yellow-700' : 'text-slate-500'}`}>{result.summary}</p>
                                    {result.policy_id && (
                                        <p className="mt-1 text-xs text-slate-700">
                                            Policy ID: <strong className="font-mono">{result.policy_id}</strong>
                                        </p>
                                    )}
                                </div>
                                <div className={`shrink-0 text-4xl font-black tabular-nums ${result.ok ? 'text-green-600' : hasSteps ? 'text-yellow-600' : 'text-slate-400'}`}>
                                    {passedCount}/{Math.max(totalCount, 5)}
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <div className="flex items-center gap-3">
                                    {result.policy_id && (
                                        <button
                                            type="button"
                                            onClick={handleRetryDownload}
                                            disabled={retryingDownload}
                                            className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                                        >
                                            {retryingDownload ? 'Retrying...' : 'Retry Download'}
                                        </button>
                                    )}
                                    {hasSteps && (
                                        <button
                                            type="button"
                                            onClick={() => setExpandedStep(expandedStep === -1 ? null : -1)}
                                            className="text-xs text-indigo-600 hover:underline"
                                        >
                                            {expandedStep === -1 ? 'Collapse all' : 'Expand all'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {result.steps.map(step => (
                                <div
                                    key={step.step}
                                    className={`min-w-0 overflow-hidden rounded-lg border transition-all ${step.passed ? 'border-green-200' : 'border-red-200'}`}
                                >
                                    <button
                                        type="button"
                                        className={`flex w-full min-w-0 items-center gap-3 p-3 text-left transition-colors ${step.passed ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}`}
                                        onClick={() => setExpandedStep(isExpanded(step.step) && expandedStep !== -1 ? null : step.step)}
                                    >
                                        {step.passed
                                            ? <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                                            : <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                                        }
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${step.passed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                                    STEP {step.step}
                                                </span>
                                                {step.method && (
                                                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${methodColor[step.method] ?? 'bg-gray-100 text-gray-700'}`}>
                                                        {step.method}
                                                    </span>
                                                )}
                                                <span className="text-sm font-semibold text-slate-900">{step.name}</span>
                                                <span className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] ${step.http_status === 200 ? 'bg-white/80 text-slate-600' : 'bg-orange-100 text-orange-700'}`}>
                                                    HTTP {step.http_status}
                                                </span>
                                            </div>
                                            {step.url && (
                                                <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{step.url}</p>
                                            )}
                                            <p className={`mt-0.5 text-xs ${step.passed ? 'text-green-700' : 'text-red-700'}`}>
                                                {step.detail}
                                            </p>
                                        </div>
                                        {isExpanded(step.step)
                                            ? <ChevronUpIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                            : <ChevronDownIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                        }
                                    </button>

                                    {isExpanded(step.step) && (
                                        <div className="min-w-0 space-y-1 border-t border-slate-100 bg-white px-4 py-3">
                                            <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                                                <span><strong>Status:</strong> {step.passed ? 'PASS' : 'FAIL'}</span>
                                                <span><strong>HTTP:</strong> {step.http_status}</span>
                                                {step.policy_id && <span><strong>Policy ID:</strong> <span className="font-mono">{step.policy_id}</span></span>}
                                                {step.cert_status && <span><strong>Cert Status:</strong> {step.cert_status}</span>}
                                                {step.pdf_available !== undefined && (
                                                    <span className="col-span-2">
                                                        <strong>PDF:</strong> {step.pdf_available ? 'Available' : 'Not available yet'}
                                                    </span>
                                                )}
                                            </div>

                                            <JsonBlock data={step.request_body} title="Request Body (sent to Tata AIG)" />
                                            <JsonBlock data={step.raw_response} title="Full API Response (from Tata AIG)" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {pdfAvailable && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <p className="mb-1 text-sm font-semibold text-blue-800">Certificate PDF Generated</p>
                                    {result.pdf_url ? (
                                        <a href={result.pdf_url} target="_blank" rel="noreferrer"
                                           className="text-sm text-blue-600 underline break-all">
                                            {result.pdf_url}
                                        </a>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleDownloadPdf}
                                            disabled={downloadingPdf}
                                            className="mt-2 inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {downloadingPdf ? 'Downloading...' : 'Download Certificate PDF'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {!pdfAvailable && result.policy_id && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                    <p className="text-xs text-amber-800">
                                        <strong>UAT Note:</strong> Tata AIG created the policy draft
                                        (Policy ID: <strong className="font-mono">{result.policy_id}</strong>),
                                        but the certificate PDF is not available from Tata yet. Retry the download after the
                                        certificate status changes.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );
}
