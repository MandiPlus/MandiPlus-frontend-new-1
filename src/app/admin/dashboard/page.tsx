'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import axios from 'axios';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { FileText, Filter, HandCoins, IndianRupee, Timer, Users, UserSquare2 } from 'lucide-react';

type InvoiceStatus = 'Verified' | 'Pending' | 'Rejected';
type ClaimStatus = 'Pending' | 'Surveyor Assigned' | 'Completed';
type PaymentStatus = 'Paid' | 'Not Required' | 'Pending';

interface InvoiceRecord {
    id: string;
    invoiceNumber: string;
    createdAt: string;
    supplier: string;
    buyer: string;
    product: string;
    category: string;
    state: string;
    agent: string;
    salesAmount: number;
    commissionAmount: number;
    invoiceStatus: InvoiceStatus;
    claimStatus: ClaimStatus;
    paymentStatus: PaymentStatus;
}
interface ClaimRecord {
    invoiceId: string;
    status: ClaimStatus;
}

interface FilterOptions {
    suppliers: string[];
    buyers: string[];
    products: string[];
    states: string[];
}

interface RawInvoice {
    id?: string;
    invoiceNumber?: string;
    createdAt?: string;
    supplierName?: string;
    billToName?: string;
    productName?: string[] | string;
    placeOfSupply?: string;
    amount?: number | string;
    premiumAmount?: number | string;
    paymentAmount?: number | string | null;
    isVerified?: boolean;
    isRejected?: boolean;
    paymentStatus?: string;
    user?: {
        name?: string;
        identity?: string;
        commissionRate?: number | string;
    };
}

interface RawClaim {
    status?: string;
    invoice?: { id?: string };
}

interface DonutDatum {
    name: string;
    value: number;
    color: string;
}

const PALETTE = ['#1d4ed8', '#0f766e', '#b45309', '#be123c', '#7c3aed', '#475569'];

const PRODUCT_CATEGORY: Record<string, string> = {
    Onion: 'Vegetables',
    Tomato: 'Vegetables',
    Potato: 'Vegetables',
    Mango: 'Fruits',
    Pomegranate: 'Fruits',
    Guava: 'Fruits',
    Cotton: 'Cash Crop',
    Soybean: 'Pulses',
    Wheat: 'Cereals',
    Rice: 'Cereals'
};

function formatCurrency(value: number) {
    return `Rs ${Math.round(value).toLocaleString('en-IN')}`;
}

function formatPercent(value: number) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

function trendClass(value: number) {
    return value >= 0 ? 'text-emerald-600' : 'text-rose-600';
}

function safePct(current: number, previous: number) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / previous) * 100;
}

function monthKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date) {
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function toNum(v: unknown) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function normalizePaymentStatus(raw: unknown): PaymentStatus {
    const v = String(raw || '').toUpperCase();
    if (v === 'PAID') return 'Paid';
    if (v === 'NOT_REQUIRED') return 'Not Required';
    return 'Pending';
}

function normalizeClaimStatus(raw: unknown): ClaimStatus {
    const v = String(raw || '').toLowerCase();
    if (v === 'completed') return 'Completed';
    if (v === 'surveyor_assigned') return 'Surveyor Assigned';
    return 'Pending';
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
            </div>
            {children}
        </div>
    );
}

function DonutChartCard({ title, data, valueFormatter }: { title: string; data: DonutDatum[]; valueFormatter: (v: number) => string }) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const chartData = data.filter((item) => item.value > 0);

    return (
        <ChartCard title={title} subtitle="Hover to view absolute values and share percentage">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="h-56">
                    {chartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                            No data for selected filters
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={54}
                                    outerRadius={86}
                                    labelLine={false}
                                    label={false}
                                >
                                    {chartData.map((entry) => (
                                        <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10 }}
                                labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                                itemStyle={{ color: '#0f172a' }}
                                formatter={(raw: number | string | undefined, name: string | number | undefined) => {
                                    const value = Number(raw) || 0;
                                    const pct = total ? (value / total) * 100 : 0;
                                    return [`${valueFormatter(value)} (${pct.toFixed(1)}%)`, String(name || '')];
                                }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className="space-y-2">
                    {data.map((item) => {
                        const pct = total ? (item.value / total) * 100 : 0;
                        return (
                            <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="flex items-center gap-2 text-xs text-slate-700">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span>{item.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-semibold text-slate-800">{valueFormatter(item.value)}</div>
                                    <div className="text-[11px] text-slate-500">{pct.toFixed(1)}%</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ChartCard>
    );
}

function SkeletonCard() {
    return <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />;
}

export default function AnalyticsDashboardPage() {
    const router = useRouter();
    const { isAuthenticated } = useAdmin();

    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<InvoiceRecord[]>([]);
    const [claimRecords, setClaimRecords] = useState<ClaimRecord[]>([]);
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        suppliers: [],
        buyers: [],
        products: [],
        states: []
    });
    const [error, setError] = useState('');

    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [supplier, setSupplier] = useState('');
    const [buyer, setBuyer] = useState('');
    const [product, setProduct] = useState('');
    const [state, setState] = useState('');

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/admin/login');
            return;
        }

        const fetchLiveData = async () => {
            try {
                setLoading(true);
                setError('');

                const token = localStorage.getItem('adminToken');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

                const invoiceParams: Record<string, string> = {};
                if (fromDate) invoiceParams.startDate = new Date(fromDate).toISOString();
                if (toDate) invoiceParams.endDate = new Date(`${toDate}T23:59:59.999Z`).toISOString();
                if (supplier) invoiceParams.supplierName = supplier;
                if (buyer) invoiceParams.buyerName = buyer;

                const [invoicesRes, claimsRes] = await Promise.all([
                    axios.get(`${baseUrl}/invoices/admin/filter`, { headers, params: invoiceParams }),
                    axios.get(`${baseUrl}/claim-requests/admin`, { headers })
                ]);

                const invoiceRows: RawInvoice[] = Array.isArray(invoicesRes.data)
                    ? invoicesRes.data
                    : Array.isArray(invoicesRes.data?.data)
                        ? invoicesRes.data.data
                        : [];

                const claimRows: RawClaim[] = Array.isArray(claimsRes.data)
                    ? claimsRes.data
                    : Array.isArray(claimsRes.data?.data)
                        ? claimsRes.data.data
                        : [];

                const claimByInvoiceId = new Map<string, ClaimStatus>();
                const normalizedClaimRows: ClaimRecord[] = [];
                claimRows.forEach((claim) => {
                    const invoiceId = claim?.invoice?.id;
                    if (invoiceId) {
                        const normalized = normalizeClaimStatus(claim.status);
                        claimByInvoiceId.set(invoiceId, normalized);
                        normalizedClaimRows.push({ invoiceId, status: normalized });
                    }
                });

                const mapped: InvoiceRecord[] = invoiceRows.map((row) => {
                    const product = Array.isArray(row.productName)
                        ? String(row.productName[0] || 'Unknown')
                        : String(row.productName || 'Unknown');
                    const baseAmount = toNum(row.amount);
                    const premiumBase = toNum(row.premiumAmount || row.paymentAmount || baseAmount * 0.002);
                    const commissionRate = toNum(row.user?.commissionRate);
                    const commissionAmount = String(row.user?.identity || '').toUpperCase() === 'AGENT'
                        ? (premiumBase * commissionRate) / 100
                        : 0;

                    return {
                        id: String(row.id || ''),
                        invoiceNumber: String(row.invoiceNumber || 'NA'),
                        createdAt: String(row.createdAt || new Date().toISOString()),
                        supplier: String(row.supplierName || 'Unknown'),
                        buyer: String(row.billToName || 'Unknown'),
                        product,
                        category: PRODUCT_CATEGORY[product] || 'Others',
                        state: String(row.placeOfSupply || 'Unknown'),
                        agent: String(row.user?.name || 'Unassigned'),
                        salesAmount: premiumBase,
                        commissionAmount,
                        invoiceStatus: row.isRejected ? 'Rejected' : row.isVerified ? 'Verified' : 'Pending',
                        claimStatus: claimByInvoiceId.get(String(row.id || '')) || 'Pending',
                        paymentStatus: normalizePaymentStatus(row.paymentStatus)
                    };
                });

                setRecords(mapped);
                setClaimRecords(normalizedClaimRows);
                setFilterOptions({
                    suppliers: [...new Set(mapped.map((r) => r.supplier))].sort(),
                    buyers: [...new Set(mapped.map((r) => r.buyer))].sort(),
                    products: [...new Set(mapped.map((r) => r.product))].sort(),
                    states: [...new Set(mapped.map((r) => r.state))].sort()
                });
            } catch {
                setError('Failed to load analytics from database.');
                setRecords([]);
                setClaimRecords([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLiveData();
    }, [isAuthenticated, router, fromDate, toDate, supplier, buyer]);

    const filteredRecords = useMemo(() => {
        return records.filter((r) => {
            const productOk = product ? r.product === product : true;
            const stateOk = state ? r.state === state : true;
            return productOk && stateOk;
        });
    }, [records, product, state]);
    const premiumEligibleRecords = useMemo(
        () => filteredRecords.filter((r) => r.invoiceStatus !== 'Rejected'),
        [filteredRecords]
    );

    const filteredInvoiceIds = useMemo(() => new Set(filteredRecords.map((r) => r.id).filter(Boolean)), [filteredRecords]);
    const filteredClaimRecords = useMemo(
        () => claimRecords.filter((c) => filteredInvoiceIds.has(c.invoiceId)),
        [claimRecords, filteredInvoiceIds]
    );

    const currentMonthKey = monthKey(new Date());
    const previousMonthDate = new Date();
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    const previousMonthKey = monthKey(previousMonthDate);

    const currentMonthRecords = premiumEligibleRecords.filter((r) => monthKey(new Date(r.createdAt)) === currentMonthKey);
    const previousMonthRecords = premiumEligibleRecords.filter((r) => monthKey(new Date(r.createdAt)) === previousMonthKey);

    const kpis = useMemo(() => {
        const totalInvoices = filteredRecords.length;
        const totalSalesAmount = premiumEligibleRecords.reduce((sum, r) => sum + r.salesAmount, 0);
        const uniqueSuppliers = new Set(filteredRecords.map((r) => r.supplier)).size;
        const uniqueBuyers = new Set(filteredRecords.map((r) => r.buyer)).size;
        const pendingClaims = filteredClaimRecords.filter((r) => r.status === 'Pending').length;
        const totalAgentCommission = premiumEligibleRecords.reduce((sum, r) => sum + r.commissionAmount, 0);

        const prev = {
            totalInvoices: previousMonthRecords.length,
            totalSalesAmount: previousMonthRecords.reduce((sum, r) => sum + r.salesAmount, 0),
            uniqueSuppliers: new Set(previousMonthRecords.map((r) => r.supplier)).size,
            uniqueBuyers: new Set(previousMonthRecords.map((r) => r.buyer)).size,
            pendingClaims: 0,
            totalAgentCommission: previousMonthRecords.reduce((sum, r) => sum + r.commissionAmount, 0)
        };

        return {
            totalInvoices: { value: totalInvoices, trend: safePct(currentMonthRecords.length, prev.totalInvoices) },
            totalSalesAmount: {
                value: totalSalesAmount,
                trend: safePct(currentMonthRecords.reduce((sum, r) => sum + r.salesAmount, 0), prev.totalSalesAmount)
            },
            uniqueSuppliers: {
                value: uniqueSuppliers,
                trend: safePct(new Set(currentMonthRecords.map((r) => r.supplier)).size, prev.uniqueSuppliers)
            },
            uniqueBuyers: {
                value: uniqueBuyers,
                trend: safePct(new Set(currentMonthRecords.map((r) => r.buyer)).size, prev.uniqueBuyers)
            },
            pendingClaims: {
                value: pendingClaims,
                trend: safePct(pendingClaims, prev.pendingClaims)
            },
            totalAgentCommission: {
                value: totalAgentCommission,
                trend: safePct(
                    currentMonthRecords.reduce((sum, r) => sum + r.commissionAmount, 0),
                    prev.totalAgentCommission
                )
            }
        };
    }, [filteredRecords, premiumEligibleRecords, currentMonthRecords, previousMonthRecords, filteredClaimRecords]);

    const monthlySalesTrend = useMemo(() => {
        const buckets = new Map<string, number>();
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            buckets.set(monthKey(d), 0);
        }

        premiumEligibleRecords.forEach((r) => {
            const key = monthKey(new Date(r.createdAt));
            if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + r.salesAmount);
        });

        return [...buckets.entries()].map(([key, sales]) => {
            const [year, month] = key.split('-').map(Number);
            return { month: monthLabel(new Date(year, month - 1, 1)), sales };
        });
    }, [premiumEligibleRecords]);

    const topProductsBySales = useMemo(() => {
        const bucket = new Map<string, number>();
        premiumEligibleRecords.forEach((r) => bucket.set(r.product, (bucket.get(r.product) || 0) + r.salesAmount));
        return [...bucket.entries()]
            .map(([name, sales]) => ({ name, sales }))
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 6);
    }, [premiumEligibleRecords]);

    const topSuppliersByRevenue = useMemo(() => {
        const bucket = new Map<string, number>();
        premiumEligibleRecords.forEach((r) => bucket.set(r.supplier, (bucket.get(r.supplier) || 0) + r.salesAmount));
        return [...bucket.entries()]
            .map(([name, revenue]) => ({ name, revenue }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6);
    }, [premiumEligibleRecords]);

    const stateSalesDistribution = useMemo<DonutDatum[]>(() => {
        const bucket = new Map<string, number>();
        premiumEligibleRecords.forEach((r) => bucket.set(r.state, (bucket.get(r.state) || 0) + r.salesAmount));
        return [...bucket.entries()].map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
    }, [premiumEligibleRecords]);

    const categoryDistribution = useMemo<DonutDatum[]>(() => {
        const bucket = new Map<string, number>();
        premiumEligibleRecords.forEach((r) => bucket.set(r.category, (bucket.get(r.category) || 0) + r.salesAmount));
        return [...bucket.entries()].map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
    }, [premiumEligibleRecords]);

    const invoiceStatusDistribution = useMemo<DonutDatum[]>(() => {
        const statuses: InvoiceStatus[] = ['Verified', 'Pending', 'Rejected'];
        return statuses.map((status, i) => ({
            name: status,
            value: filteredRecords.filter((r) => r.invoiceStatus === status).length,
            color: PALETTE[i % PALETTE.length]
        }));
    }, [filteredRecords]);

    const claimsStatusDistribution = useMemo<DonutDatum[]>(() => {
        const statuses: ClaimStatus[] = ['Pending', 'Surveyor Assigned', 'Completed'];
        return statuses.map((status, i) => ({
            name: status,
            value: filteredClaimRecords.filter((r) => r.status === status).length,
            color: PALETTE[i % PALETTE.length]
        }));
    }, [filteredClaimRecords]);

    const invoiceCreatedPeriodDistribution = useMemo<DonutDatum[]>(() => {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date(dayStart);
        const day = weekStart.getDay();
        const diffToMonday = (day + 6) % 7;
        weekStart.setDate(weekStart.getDate() - diffToMonday);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const daily = filteredRecords.filter((r) => new Date(r.createdAt) >= dayStart).length;
        const weekly = filteredRecords.filter((r) => new Date(r.createdAt) >= weekStart).length;
        const monthly = filteredRecords.filter((r) => new Date(r.createdAt) >= monthStart).length;

        return [
            { name: 'Daily', value: daily, color: PALETTE[0] },
            { name: 'Weekly', value: weekly, color: PALETTE[1] },
            { name: 'Monthly', value: monthly, color: PALETTE[2] }
        ];
    }, [filteredRecords]);

    const invoicePremiumPeriodDistribution = useMemo<DonutDatum[]>(() => {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date(dayStart);
        const day = weekStart.getDay();
        const diffToMonday = (day + 6) % 7;
        weekStart.setDate(weekStart.getDate() - diffToMonday);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const daily = premiumEligibleRecords
            .filter((r) => new Date(r.createdAt) >= dayStart)
            .reduce((sum, r) => sum + r.salesAmount, 0);
        const weekly = premiumEligibleRecords
            .filter((r) => new Date(r.createdAt) >= weekStart)
            .reduce((sum, r) => sum + r.salesAmount, 0);
        const monthly = premiumEligibleRecords
            .filter((r) => new Date(r.createdAt) >= monthStart)
            .reduce((sum, r) => sum + r.salesAmount, 0);

        return [
            { name: 'Daily', value: daily, color: PALETTE[0] },
            { name: 'Weekly', value: weekly, color: PALETTE[1] },
            { name: 'Monthly', value: monthly, color: PALETTE[2] }
        ];
    }, [premiumEligibleRecords]);

    const agentPerformance = useMemo(() => {
        const bucket = new Map<string, { commission: number; invoices: number }>();
        premiumEligibleRecords.forEach((r) => {
            const prev = bucket.get(r.agent) || { commission: 0, invoices: 0 };
            bucket.set(r.agent, {
                commission: prev.commission + r.commissionAmount,
                invoices: prev.invoices + 1
            });
        });

        return [...bucket.entries()]
            .map(([agent, data]) => ({
                agent,
                commission: data.commission,
                invoices: data.invoices,
                avgCommission: data.invoices ? data.commission / data.invoices : 0
            }))
            .sort((a, b) => b.commission - a.commission);
    }, [premiumEligibleRecords]);

    const topBuyers = useMemo(() => {
        const bucket = new Map<string, { total: number; invoices: number }>();
        premiumEligibleRecords.forEach((r) => {
            const prev = bucket.get(r.buyer) || { total: 0, invoices: 0 };
            bucket.set(r.buyer, { total: prev.total + r.salesAmount, invoices: prev.invoices + 1 });
        });

        return [...bucket.entries()]
            .map(([buyerName, data]) => ({ buyerName, totalSpent: data.total, invoices: data.invoices }))
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 8);
    }, [premiumEligibleRecords]);

    const insights = useMemo(() => {
        const topSupplier = topSuppliersByRevenue[0];

        const productVolume = new Map<string, number>();
        filteredRecords.forEach((r) => productVolume.set(r.product, (productVolume.get(r.product) || 0) + 1));
        const mostSoldProduct = [...productVolume.entries()].sort((a, b) => b[1] - a[1])[0];

        const topState = [...stateSalesDistribution].sort((a, b) => b.value - a.value)[0];

        const totalSales = premiumEligibleRecords.reduce((sum, r) => sum + r.salesAmount, 0);
        const avgInvoiceValue = premiumEligibleRecords.length ? totalSales / premiumEligibleRecords.length : 0;

        const buyerCounts = new Map<string, number>();
        filteredRecords.forEach((r) => buyerCounts.set(r.buyer, (buyerCounts.get(r.buyer) || 0) + 1));
        const repeatBuyerCount = [...buyerCounts.values()].filter((v) => v > 1).length;
        const repeatCustomerPct = buyerCounts.size ? (repeatBuyerCount / buyerCounts.size) * 100 : 0;

        return {
            topSupplierByRevenue: topSupplier ? `${topSupplier.name} (${formatCurrency(topSupplier.revenue)})` : 'N/A',
            mostSoldProduct: mostSoldProduct ? `${mostSoldProduct[0]} (${mostSoldProduct[1]} invoices)` : 'N/A',
            highestSalesState: topState ? `${topState.name} (${formatCurrency(topState.value)})` : 'N/A',
            averageInvoiceValue: formatCurrency(avgInvoiceValue),
            repeatCustomerPercentage: `${repeatCustomerPct.toFixed(1)}%`
        };
    }, [premiumEligibleRecords, filteredRecords, topSuppliersByRevenue, stateSalesDistribution]);

    const filters = filterOptions;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-5">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">MandiPlus Analytics Dashboard</h1>
                    <p className="mt-1 text-sm text-slate-500">     </p>
                </div>
                {error ? (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Filter className="h-4 w-4" /> Global Filters
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                        <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                            <option value="">All Suppliers</option>
                            {filters?.suppliers.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <select value={buyer} onChange={(e) => setBuyer(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                            <option value="">All Buyers</option>
                            {filters?.buyers.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <select value={product} onChange={(e) => setProduct(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                            <option value="">All Products</option>
                            {filters?.products.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <select value={state} onChange={(e) => setState(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                            <option value="">All States</option>
                            {filters?.states.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mt-6">
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">Overall Summary</h2>
                    {loading ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {[
                                { label: 'Total Invoices', data: kpis.totalInvoices, icon: FileText, value: kpis.totalInvoices.value.toLocaleString('en-IN') },
                                { label: 'Total Premium Amount', data: kpis.totalSalesAmount, icon: IndianRupee, value: formatCurrency(kpis.totalSalesAmount.value) },
                                { label: 'Unique Suppliers', data: kpis.uniqueSuppliers, icon: Users, value: kpis.uniqueSuppliers.value.toLocaleString('en-IN') },
                                { label: 'Unique Buyers', data: kpis.uniqueBuyers, icon: UserSquare2, value: kpis.uniqueBuyers.value.toLocaleString('en-IN') },
                                { label: 'Pending Claims', data: kpis.pendingClaims, icon: Timer, value: kpis.pendingClaims.value.toLocaleString('en-IN') },
                                { label: 'Total Agent Commission', data: kpis.totalAgentCommission, icon: HandCoins, value: formatCurrency(kpis.totalAgentCommission.value) }
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</span>
                                        <item.icon className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900">{item.value}</div>
                                    <div className={`mt-2 text-xs font-semibold ${trendClass(item.data.trend)}`}>{formatPercent(item.data.trend)} vs last month</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-8">
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">Premium Analytics</h2>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        <ChartCard title="Monthly Premium Trend" subtitle="Last 6 months">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={monthlySalesTrend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10 }}
                                            labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                                            itemStyle={{ color: '#0f172a' }}
                                            formatter={(v: number | string | undefined) => formatCurrency(Number(v) || 0)}
                                        />
                                        <Line type="monotone" dataKey="sales" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Top Products by Premium" subtitle="Premium contribution">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topProductsBySales}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={52} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10 }}
                                            labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                                            itemStyle={{ color: '#0f172a' }}
                                            formatter={(v: number | string | undefined) => formatCurrency(Number(v) || 0)}
                                        />
                                        <Bar dataKey="sales" radius={[8, 8, 0, 0]} fill="#0f766e" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Top Suppliers by Premium" subtitle="Highest suppliers by total premium">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topSuppliersByRevenue} layout="vertical" margin={{ left: 16 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10 }}
                                            labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                                            itemStyle={{ color: '#0f172a' }}
                                            formatter={(v: number | string | undefined) => formatCurrency(Number(v) || 0)}
                                        />
                                        <Bar dataKey="revenue" radius={[0, 8, 8, 0]} fill="#b45309" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>
                    </div>
                </div>

                <div className="mt-8">
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">Pie Chart Analytics</h2>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <DonutChartCard title="Invoice Created (Daily/Weekly/Monthly)" data={invoiceCreatedPeriodDistribution} valueFormatter={(v) => v.toLocaleString('en-IN')} />
                        <DonutChartCard title="Invoice Premium (Daily/Weekly/Monthly)" data={invoicePremiumPeriodDistribution} valueFormatter={formatCurrency} />
                        <DonutChartCard title="Product Category Premium Distribution" data={categoryDistribution} valueFormatter={formatCurrency} />
                        <DonutChartCard title="Invoice Status Breakdown" data={invoiceStatusDistribution} valueFormatter={(v) => v.toLocaleString('en-IN')} />
                        <DonutChartCard title="Claims Status Distribution" data={claimsStatusDistribution} valueFormatter={(v) => v.toLocaleString('en-IN')} />
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <ChartCard title="Agent Commission Performance" subtitle="Commission efficiency by agent">
                        <div className="max-h-72 overflow-y-auto overflow-x-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2">Agent</th>
                                        <th className="px-3 py-2 text-right">Invoices</th>
                                        <th className="px-3 py-2 text-right">Commission</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {agentPerformance.map((row) => (
                                        <tr key={row.agent}>
                                            <td className="px-3 py-2 text-slate-700">{row.agent}</td>
                                            <td className="px-3 py-2 text-right text-slate-700">{row.invoices}</td>
                                            <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(row.commission)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ChartCard>

                    <ChartCard title="Top Buyers" subtitle="High value buyers">
                        <div className="max-h-72 overflow-y-auto overflow-x-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2">Buyer</th>
                                        <th className="px-3 py-2 text-right">Invoices</th>
                                        <th className="px-3 py-2 text-right">Spent</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {topBuyers.map((row) => (
                                        <tr key={row.buyerName}>
                                            <td className="px-3 py-2 text-slate-700">{row.buyerName}</td>
                                            <td className="px-3 py-2 text-right text-slate-700">{row.invoices}</td>
                                            <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(row.totalSpent)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ChartCard>

                </div>

                <div className="mt-8">
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">Smart Insights</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                        {[
                            { label: 'Top Supplier by Premium', value: insights.topSupplierByRevenue },
                            { label: 'Most Sold Product', value: insights.mostSoldProduct },
                            { label: 'Highest Premium State', value: insights.highestSalesState },
                            { label: 'Average Premium Value', value: insights.averageInvoiceValue },
                            { label: 'Repeat Customer %', value: insights.repeatCustomerPercentage }
                        ].map((item) => (
                            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                                <div className="mt-3 text-sm font-semibold text-slate-900">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
