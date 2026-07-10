'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { adminApi } from '@/features/admin/api/admin.api';
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
import { Download, FileText, Filter, IndianRupee, Timer, Users, UserSquare2 } from 'lucide-react';

type InvoiceStatus = 'Verified' | 'Pending' | 'Rejected';
type ClaimStatus =
    | 'Pending'
    | 'In Progress'
    | 'Surveyor Assigned'
    | 'Completed'
    | 'Approved'
    | 'Rejected'
    | 'Settled';
type PaymentStatus = 'Paid' | 'Not Required' | 'Pending';
type TopProductsMetric = 'premium' | 'invoices';

interface InvoiceRecord {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
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
    invoiceDate?: string;
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
const DASHBOARD_TIME_ZONE = 'Asia/Kolkata';
const dashboardDateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: DASHBOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});

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

function dashboardDateKey(value: Date | string | null | undefined) {
    const date = value instanceof Date ? value : new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) return '';

    const parts = dashboardDateFormatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}`;
}

function monthKey(value: Date | string | null | undefined) {
    return dashboardDateKey(value).slice(0, 7);
}

function monthLabel(d: Date) {
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function toNum(v: unknown) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to run tender coconut report.';
}

function dateKeyToUtcDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function addDaysToDateKey(value: string, days: number) {
    const date = dateKeyToUtcDate(value);
    date.setUTCDate(date.getUTCDate() + days);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function diffDaysInclusive(startKey: string, endKey: string) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const start = dateKeyToUtcDate(startKey);
    const end = dateKeyToUtcDate(endKey);
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
}

function addMonthsToMonthKey(value: string, months: number) {
    const [year, month] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + months, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysInMonthKey(value: string) {
    const [year, month] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function startOfWeekKey(value: string) {
    const date = dateKeyToUtcDate(value);
    const diffToMonday = (date.getUTCDay() + 6) % 7;
    return addDaysToDateKey(value, -diffToMonday);
}

function buildInvoiceRecords(invoiceRows: RawInvoice[], claimByInvoiceId: Map<string, ClaimStatus>): InvoiceRecord[] {
    return invoiceRows.map((row) => {
        const product = Array.isArray(row.productName)
            ? String(row.productName[0] || 'Unknown')
            : String(row.productName || 'Unknown');
        const baseAmount = toNum(row.amount);
        const premiumBase = baseAmount > 0
            ? Number((baseAmount * 0.002).toFixed(2))
            : toNum(row.premiumAmount || row.paymentAmount);
        const commissionRate = toNum(row.user?.commissionRate);
        const commissionAmount = String(row.user?.identity || '').toUpperCase() === 'AGENT'
            ? (premiumBase * commissionRate) / 100
            : 0;
        const invoiceStatus: InvoiceStatus = row.isRejected ? 'Rejected' : row.isVerified ? 'Verified' : 'Pending';

        return {
            id: String(row.id || ''),
            invoiceNumber: String(row.invoiceNumber || 'NA'),
            invoiceDate: String(row.invoiceDate || row.createdAt || ''),
            createdAt: String(row.createdAt || row.invoiceDate || ''),
            supplier: String(row.supplierName || 'Unknown'),
            buyer: String(row.billToName || 'Unknown'),
            product,
            category: PRODUCT_CATEGORY[product] || 'Others',
            state: String(row.placeOfSupply || 'Unknown'),
            agent: String(row.user?.name || 'Unassigned'),
            salesAmount: premiumBase,
            commissionAmount,
            invoiceStatus,
            claimStatus: claimByInvoiceId.get(String(row.id || '')) || 'Pending',
            paymentStatus: normalizePaymentStatus(row.paymentStatus)
        };
    });
}

function normalizePaymentStatus(raw: unknown): PaymentStatus {
    const v = String(raw || '').toUpperCase();
    if (v === 'PAID') return 'Paid';
    if (v === 'NOT_REQUIRED') return 'Not Required';
    return 'Pending';
}

function normalizeClaimStatus(raw: unknown): ClaimStatus {
    const v = String(raw || '').toLowerCase();
    if (v === 'inprogress' || v === 'in_progress') return 'In Progress';
    if (v === 'approved') return 'Approved';
    if (v === 'rejected') return 'Rejected';
    if (v === 'settled') return 'Settled';
    if (v === 'completed') return 'Completed';
    if (v === 'surveyor_assigned') return 'Surveyor Assigned';
    return 'Pending';
}

function isPendingClaimStatus(status: ClaimStatus) {
    return status === 'Pending' || status === 'In Progress' || status === 'Surveyor Assigned';
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

function DonutChartCard({
    title,
    data,
    valueFormatter,
    scrollLegend = false
}: {
    title: string;
    data: DonutDatum[];
    valueFormatter: (v: number) => string;
    scrollLegend?: boolean;
}) {
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
                                formatter={(raw: unknown, name: unknown) => {
                                    const value = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
                                    const pct = total ? (value / total) * 100 : 0;
                                    return [`${valueFormatter(value)} (${pct.toFixed(1)}%)`, String(name || '')];
                                }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className={`space-y-2 ${scrollLegend ? 'max-h-56 overflow-y-auto pr-1' : ''}`}>
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
    const [comparisonRecords, setComparisonRecords] = useState<InvoiceRecord[]>([]);
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
    const [topProductsMetric, setTopProductsMetric] = useState<TopProductsMetric>('premium');
    const [runningTenderReport, setRunningTenderReport] = useState(false);
    const [tenderReportMessage, setTenderReportMessage] = useState('');
    const [tenderReportError, setTenderReportError] = useState('');

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
                if (fromDate) invoiceParams.startDate = fromDate;
                if (toDate) invoiceParams.endDate = toDate;
                if (supplier) invoiceParams.supplierName = supplier;
                if (buyer) invoiceParams.buyerName = buyer;
                const hasExplicitDateRange = Boolean(fromDate && toDate);

                let comparisonInvoiceParams: Record<string, string> | undefined;
                if (hasExplicitDateRange) {
                    const rangeDays = diffDaysInclusive(fromDate, toDate);
                    const previousRangeEnd = addDaysToDateKey(fromDate, -1);
                    const previousRangeStart = addDaysToDateKey(previousRangeEnd, -(rangeDays - 1));

                    comparisonInvoiceParams = {
                        ...invoiceParams,
                        startDate: previousRangeStart,
                        endDate: previousRangeEnd
                    };
                }

                const requests = [
                    axios.get(`${baseUrl}/invoices/admin/filter`, { headers, params: invoiceParams }),
                    axios.get(`${baseUrl}/claim-requests/admin`, { headers })
                ];
                if (comparisonInvoiceParams) {
                    requests.push(axios.get(`${baseUrl}/invoices/admin/filter`, { headers, params: comparisonInvoiceParams }));
                }

                const responses = await Promise.all(requests);
                const invoicesRes = responses[0];
                const claimsRes = responses[1];
                const comparisonInvoicesRes = comparisonInvoiceParams ? responses[2] : null;

                const invoiceRows: RawInvoice[] = Array.isArray(invoicesRes.data)
                    ? invoicesRes.data
                    : Array.isArray(invoicesRes.data?.data)
                        ? invoicesRes.data.data
                        : [];
                const comparisonInvoiceRows: RawInvoice[] = Array.isArray(comparisonInvoicesRes?.data)
                    ? comparisonInvoicesRes.data
                    : Array.isArray(comparisonInvoicesRes?.data?.data)
                        ? comparisonInvoicesRes.data.data
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

                const mapped = buildInvoiceRecords(invoiceRows, claimByInvoiceId);
                const mappedComparison = buildInvoiceRecords(comparisonInvoiceRows, claimByInvoiceId);

                setRecords(mapped);
                setComparisonRecords(mappedComparison);
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
                setComparisonRecords([]);
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
        () => filteredRecords.filter((r) => r.invoiceStatus === 'Verified'),
        [filteredRecords]
    );
    const comparisonFilteredRecords = useMemo(() => {
        return comparisonRecords.filter((r) => {
            const productOk = product ? r.product === product : true;
            const stateOk = state ? r.state === state : true;
            return productOk && stateOk;
        });
    }, [comparisonRecords, product, state]);
    const comparisonPremiumEligibleRecords = useMemo(
        () => comparisonFilteredRecords.filter((r) => r.invoiceStatus === 'Verified'),
        [comparisonFilteredRecords]
    );

    const filteredInvoiceIds = useMemo(() => new Set(filteredRecords.map((r) => r.id).filter(Boolean)), [filteredRecords]);
    const filteredClaimRecords = useMemo(
        () => claimRecords.filter((c) => filteredInvoiceIds.has(c.invoiceId)),
        [claimRecords, filteredInvoiceIds]
    );
    const comparisonInvoiceIds = useMemo(
        () => new Set(comparisonFilteredRecords.map((r) => r.id).filter(Boolean)),
        [comparisonFilteredRecords]
    );
    const comparisonClaimRecords = useMemo(
        () => claimRecords.filter((c) => comparisonInvoiceIds.has(c.invoiceId)),
        [claimRecords, comparisonInvoiceIds]
    );

    const todayKey = dashboardDateKey(new Date());
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    const currentWeekStartKey = startOfWeekKey(todayKey);
    const currentMonthKey = todayKey.slice(0, 7);
    const previousMonthKey = addMonthsToMonthKey(currentMonthKey, -1);
    const previousMonthDays = daysInMonthKey(previousMonthKey);
    const summaryCompareLabel = fromDate && toDate ? 'vs previous period' : 'vs last month';

    const currentMonthInvoiceRecords = filteredRecords.filter((r) => monthKey(r.invoiceDate) === currentMonthKey);
    const previousMonthInvoiceRecords = filteredRecords.filter((r) => monthKey(r.invoiceDate) === previousMonthKey);
    const currentMonthPremiumRecords = premiumEligibleRecords.filter((r) => monthKey(r.invoiceDate) === currentMonthKey);
    const previousMonthPremiumRecords = premiumEligibleRecords.filter((r) => monthKey(r.invoiceDate) === previousMonthKey);

    const kpis = useMemo(() => {
        const currentMonthDaysElapsed = Math.max(1, Number(todayKey.slice(8, 10)) || 1);

        const totalInvoices = filteredRecords.length;
        const todayInvoices = filteredRecords.filter((r) => dashboardDateKey(r.invoiceDate) === todayKey).length;
        const yesterdayInvoices = filteredRecords.filter((r) => dashboardDateKey(r.invoiceDate) === yesterdayKey).length;
        const totalSalesAmount = premiumEligibleRecords.reduce((sum, r) => sum + r.salesAmount, 0);
        const averagePremiumValue = premiumEligibleRecords.length ? totalSalesAmount / premiumEligibleRecords.length : 0;
        const uniqueSuppliers = new Set(filteredRecords.map((r) => r.supplier)).size;
        const uniqueBuyers = new Set(filteredRecords.map((r) => r.buyer)).size;
        const pendingClaims = filteredClaimRecords.filter((r) => isPendingClaimStatus(r.status)).length;
        const currentMonthAveragePremium = currentMonthPremiumRecords.length
            ? currentMonthPremiumRecords.reduce((sum, r) => sum + r.salesAmount, 0) / currentMonthPremiumRecords.length
            : 0;
        const hasExplicitDateRange = Boolean(fromDate && toDate);

        let averageDailyInvoices = currentMonthInvoiceRecords.length / currentMonthDaysElapsed;
        let previousAverageDailyInvoices = previousMonthInvoiceRecords.length / Math.max(1, previousMonthDays);
        let trendTotalInvoices = currentMonthInvoiceRecords.length;
        let previousTotalInvoices = previousMonthInvoiceRecords.length;
        let trendTotalSalesAmount = currentMonthPremiumRecords.reduce((sum, r) => sum + r.salesAmount, 0);
        let previousTotalSalesAmount = previousMonthPremiumRecords.reduce((sum, r) => sum + r.salesAmount, 0);
        let trendAveragePremiumValue = currentMonthAveragePremium;
        let previousAveragePremiumValue = previousMonthPremiumRecords.length
            ? previousMonthPremiumRecords.reduce((sum, r) => sum + r.salesAmount, 0) / previousMonthPremiumRecords.length
            : 0;
        let trendUniqueSuppliers = new Set(currentMonthInvoiceRecords.map((r) => r.supplier)).size;
        let previousUniqueSuppliers = new Set(previousMonthInvoiceRecords.map((r) => r.supplier)).size;
        let trendUniqueBuyers = new Set(currentMonthInvoiceRecords.map((r) => r.buyer)).size;
        let previousUniqueBuyers = new Set(previousMonthInvoiceRecords.map((r) => r.buyer)).size;
        let previousPendingClaims = 0;

        if (hasExplicitDateRange) {
            const rangeDays = diffDaysInclusive(fromDate, toDate);

            averageDailyInvoices = filteredRecords.length / rangeDays;
            previousAverageDailyInvoices = comparisonFilteredRecords.length / rangeDays;
            trendTotalInvoices = totalInvoices;
            previousTotalInvoices = comparisonFilteredRecords.length;
            trendTotalSalesAmount = totalSalesAmount;
            previousTotalSalesAmount = comparisonPremiumEligibleRecords.reduce((sum, r) => sum + r.salesAmount, 0);
            trendAveragePremiumValue = averagePremiumValue;
            previousAveragePremiumValue = comparisonPremiumEligibleRecords.length
                ? previousTotalSalesAmount / comparisonPremiumEligibleRecords.length
                : 0;
            trendUniqueSuppliers = uniqueSuppliers;
            previousUniqueSuppliers = new Set(comparisonFilteredRecords.map((r) => r.supplier)).size;
            trendUniqueBuyers = uniqueBuyers;
            previousUniqueBuyers = new Set(comparisonFilteredRecords.map((r) => r.buyer)).size;
            previousPendingClaims = comparisonClaimRecords.filter((r) => isPendingClaimStatus(r.status)).length;
        } else {
            const previousMonthInvoiceIds = new Set(previousMonthInvoiceRecords.map((r) => r.id).filter(Boolean));
            previousPendingClaims = claimRecords.filter((r) => previousMonthInvoiceIds.has(r.invoiceId) && isPendingClaimStatus(r.status)).length;
        }

        const prev = {
            totalInvoices: previousTotalInvoices,
            totalSalesAmount: previousTotalSalesAmount,
            averagePremiumValue: previousAveragePremiumValue,
            uniqueSuppliers: previousUniqueSuppliers,
            uniqueBuyers: previousUniqueBuyers,
            pendingClaims: previousPendingClaims,
            averageDailyInvoices: previousAverageDailyInvoices
        };

        return {
            totalInvoices: { value: totalInvoices, trend: safePct(trendTotalInvoices, prev.totalInvoices) },
            todayInvoices: { value: todayInvoices, trend: safePct(todayInvoices, yesterdayInvoices) },
            totalSalesAmount: {
                value: totalSalesAmount,
                trend: safePct(trendTotalSalesAmount, prev.totalSalesAmount)
            },
            averagePremiumValue: {
                value: averagePremiumValue,
                trend: safePct(trendAveragePremiumValue, prev.averagePremiumValue)
            },
            uniqueSuppliers: {
                value: uniqueSuppliers,
                trend: safePct(trendUniqueSuppliers, prev.uniqueSuppliers)
            },
            uniqueBuyers: {
                value: uniqueBuyers,
                trend: safePct(trendUniqueBuyers, prev.uniqueBuyers)
            },
            pendingClaims: {
                value: pendingClaims,
                trend: safePct(pendingClaims, prev.pendingClaims)
            },
            averageDailyInvoices: {
                value: averageDailyInvoices,
                trend: safePct(averageDailyInvoices, prev.averageDailyInvoices)
            }
        };
    }, [
        claimRecords,
        comparisonClaimRecords,
        comparisonFilteredRecords,
        comparisonPremiumEligibleRecords,
        currentMonthInvoiceRecords,
        currentMonthPremiumRecords,
        filteredClaimRecords,
        filteredRecords,
        fromDate,
        premiumEligibleRecords,
        previousMonthDays,
        previousMonthInvoiceRecords,
        previousMonthPremiumRecords,
        todayKey,
        toDate,
        yesterdayKey
    ]);

    const monthlySalesTrend = useMemo(() => {
        const buckets = new Map<string, number>();
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            buckets.set(monthKey(d), 0);
        }

        premiumEligibleRecords.forEach((r) => {
            const key = monthKey(r.invoiceDate);
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

    const topProductsByInvoices = useMemo(() => {
        const bucket = new Map<string, number>();
        filteredRecords.forEach((r) => bucket.set(r.product, (bucket.get(r.product) || 0) + 1));
        return [...bucket.entries()]
            .map(([name, invoices]) => ({ name, invoices }))
            .sort((a, b) => b.invoices - a.invoices)
            .slice(0, 6);
    }, [filteredRecords]);

    const topProductsChartData = useMemo(
        () =>
            topProductsMetric === 'premium'
                ? topProductsBySales.map((item) => ({ name: item.name, value: item.sales }))
                : topProductsByInvoices.map((item) => ({ name: item.name, value: item.invoices })),
        [topProductsBySales, topProductsByInvoices, topProductsMetric]
    );

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

    const productPremiumDistribution = useMemo<DonutDatum[]>(() => {
        const bucket = new Map<string, number>();
        premiumEligibleRecords.forEach((r) => bucket.set(r.product, (bucket.get(r.product) || 0) + r.salesAmount));
        return [...bucket.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
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
        const statuses: ClaimStatus[] = ['Pending', 'In Progress', 'Surveyor Assigned', 'Approved', 'Settled', 'Completed', 'Rejected'];
        return statuses.map((status, i) => ({
            name: status,
            value: filteredClaimRecords.filter((r) => r.status === status).length,
            color: PALETTE[i % PALETTE.length]
        }));
    }, [filteredClaimRecords]);

    const invoiceCreatedPeriodDistribution = useMemo<DonutDatum[]>(() => {
        const daily = filteredRecords.filter((r) => dashboardDateKey(r.invoiceDate) === todayKey).length;
        const yesterday = filteredRecords.filter((r) => dashboardDateKey(r.invoiceDate) === yesterdayKey).length;
        const weekly = filteredRecords.filter((r) => {
            const key = dashboardDateKey(r.invoiceDate);
            return key >= currentWeekStartKey && key <= todayKey;
        }).length;
        const monthly = filteredRecords.filter((r) => monthKey(r.invoiceDate) === currentMonthKey).length;

        return [
            { name: 'Daily', value: daily, color: PALETTE[0] },
            { name: 'Yesterday', value: yesterday, color: PALETTE[1] },
            { name: 'Weekly', value: weekly, color: PALETTE[2] },
            { name: 'Monthly', value: monthly, color: PALETTE[3] }
        ];
    }, [currentMonthKey, currentWeekStartKey, filteredRecords, todayKey, yesterdayKey]);

    const invoicePremiumPeriodDistribution = useMemo<DonutDatum[]>(() => {
        const daily = premiumEligibleRecords
            .filter((r) => dashboardDateKey(r.invoiceDate) === todayKey)
            .reduce((sum, r) => sum + r.salesAmount, 0);
        const weekly = premiumEligibleRecords
            .filter((r) => {
                const key = dashboardDateKey(r.invoiceDate);
                return key >= currentWeekStartKey && key <= todayKey;
            })
            .reduce((sum, r) => sum + r.salesAmount, 0);
        const monthly = premiumEligibleRecords
            .filter((r) => monthKey(r.invoiceDate) === currentMonthKey)
            .reduce((sum, r) => sum + r.salesAmount, 0);

        return [
            { name: 'Daily', value: daily, color: PALETTE[0] },
            { name: 'Weekly', value: weekly, color: PALETTE[1] },
            { name: 'Monthly', value: monthly, color: PALETTE[2] }
        ];
    }, [currentMonthKey, currentWeekStartKey, premiumEligibleRecords, todayKey]);

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

    const handleRunTenderCoconutReport = async () => {
        try {
            setRunningTenderReport(true);
            setTenderReportError('');
            setTenderReportMessage('');

            const response = await adminApi.runLatestTenderCoconutReport();
            if (!response.success) {
                throw new Error(response.message || 'Failed to run tender coconut report.');
            }

            const data = response.data;
            if (!data) {
                setTenderReportMessage('Report run completed, but no tender coconut invoices were found for the previous day.');
                return;
            }

            if ((data.totalInvoices || 0) === 0) {
                setTenderReportMessage(`No tender coconut invoices found for ${data.reportDate}.`);
                return;
            }

            setTenderReportMessage(
                `Tender coconut reports generated for ${data.reportDate}. ${data.totalInvoices} invoices included and sent to ${data.recipients.join(', ')}.`
            );
        } catch (error: unknown) {
            setTenderReportError(getErrorMessage(error));
        } finally {
            setRunningTenderReport(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 py-8">
            <div className="mx-auto w-full max-w-[1560px] px-2 sm:px-3 lg:px-4">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">MandiPlus Analytics Dashboard</h1>
                        <p className="mt-1 text-sm text-slate-500">     </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleRunTenderCoconutReport}
                        disabled={runningTenderReport}
                        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#1155b8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d4697] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Download className="h-4 w-4" />
                        {runningTenderReport ? 'Generating...' : 'Run Tender Coconut Report'}
                    </button>
                </div>
                {error ? (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}
                {tenderReportError ? (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {tenderReportError}
                    </div>
                ) : null}
                {tenderReportMessage ? (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {tenderReportMessage}
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
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                                { label: 'Total Invoices', data: kpis.totalInvoices, icon: FileText, value: kpis.totalInvoices.value.toLocaleString('en-IN'), compareLabel: summaryCompareLabel },
                                { label: 'Today Invoices', data: kpis.todayInvoices, icon: FileText, value: kpis.todayInvoices.value.toLocaleString('en-IN'), compareLabel: 'vs yesterday' },
                                { label: 'Total Premium Amount', data: kpis.totalSalesAmount, icon: IndianRupee, value: formatCurrency(kpis.totalSalesAmount.value), compareLabel: summaryCompareLabel },
                                { label: 'Average Premium Value', data: kpis.averagePremiumValue, icon: IndianRupee, value: formatCurrency(kpis.averagePremiumValue.value), compareLabel: summaryCompareLabel },
                                { label: 'Unique Suppliers', data: kpis.uniqueSuppliers, icon: Users, value: kpis.uniqueSuppliers.value.toLocaleString('en-IN'), compareLabel: summaryCompareLabel },
                                { label: 'Unique Buyers', data: kpis.uniqueBuyers, icon: UserSquare2, value: kpis.uniqueBuyers.value.toLocaleString('en-IN'), compareLabel: summaryCompareLabel },
                                { label: 'Pending Claims', data: kpis.pendingClaims, icon: Timer, value: kpis.pendingClaims.value.toLocaleString('en-IN'), compareLabel: summaryCompareLabel },
                                { label: 'Average Daily Invoices', data: kpis.averageDailyInvoices, icon: FileText, value: Math.round(kpis.averageDailyInvoices.value).toLocaleString('en-IN'), compareLabel: summaryCompareLabel }
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</span>
                                        <item.icon className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900">{item.value}</div>
                                    <div className={`mt-2 text-xs font-semibold ${trendClass(item.data.trend)}`}>{formatPercent(item.data.trend)} {item.compareLabel}</div>
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
                                            formatter={(v: unknown) => formatCurrency(Number(Array.isArray(v) ? v[0] : v) || 0)}
                                        />
                                        <Line type="monotone" dataKey="sales" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">Top Products</h3>
                                    <p className="mt-0.5 text-xs text-slate-500">Switch between premium contribution and invoice count</p>
                                </div>
                                <div className="inline-flex rounded-xl border border-slate-300 bg-slate-50 p-1 text-xs font-semibold">
                                    <button
                                        type="button"
                                        onClick={() => setTopProductsMetric('premium')}
                                        className={`rounded-lg px-3 py-1.5 transition ${
                                            topProductsMetric === 'premium' ? 'bg-[#1155b8] text-white' : 'text-slate-700'
                                        }`}
                                    >
                                        By Premium
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTopProductsMetric('invoices')}
                                        className={`rounded-lg px-3 py-1.5 transition ${
                                            topProductsMetric === 'invoices' ? 'bg-[#1155b8] text-white' : 'text-slate-700'
                                        }`}
                                    >
                                        By Invoices
                                    </button>
                                </div>
                            </div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topProductsChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={52} />
                                        <YAxis
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(v) =>
                                                topProductsMetric === 'premium' ? `${Math.round(Number(v) / 1000)}k` : String(Math.round(Number(v)))
                                            }
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10 }}
                                            labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                                            itemStyle={{ color: '#0f172a' }}
                                            formatter={(v: unknown) =>
                                                topProductsMetric === 'premium'
                                                    ? formatCurrency(Number(Array.isArray(v) ? v[0] : v) || 0)
                                                    : `${Math.round(Number(Array.isArray(v) ? v[0] : v) || 0).toLocaleString('en-IN')} invoices`
                                            }
                                        />
                                        <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#0f766e" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

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
                                            formatter={(v: unknown) => formatCurrency(Number(Array.isArray(v) ? v[0] : v) || 0)}
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
                        <DonutChartCard title="Invoice Created (Daily/Yesterday/Weekly/Monthly)" data={invoiceCreatedPeriodDistribution} valueFormatter={(v) => v.toLocaleString('en-IN')} />
                        <DonutChartCard title="Invoice Premium (Daily/Weekly/Monthly)" data={invoicePremiumPeriodDistribution} valueFormatter={formatCurrency} />
                        <DonutChartCard title="Product Wise Premium Distribution" data={productPremiumDistribution} valueFormatter={formatCurrency} scrollLegend />
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
