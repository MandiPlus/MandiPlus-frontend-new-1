"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Calendar,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  User,
  Wallet,
} from "lucide-react";
import {
  AdminCustomerDetailPayload,
  adminApi,
} from "@/features/admin/api/admin.api";

type DetailTab = "invoices" | "commissions" | "tracking";

const tabs: Array<{ key: DetailTab; label: string }> = [
  { key: "invoices", label: "Invoices" },
  { key: "commissions", label: "Commissions" },
  { key: "tracking", label: "Tracking & Trips" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pillClass(status?: string | null) {
  const norm = String(status || "").toUpperCase();
  if (norm === "ACTIVE" || norm === "APPROVED" || norm === "PAYABLE" || norm === "PAID" || norm === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80";
  }
  if (norm === "PENDING" || norm === "PARTIAL" || norm === "IN_PROGRESS") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80";
  }
  if (norm === "SUSPENDED" || norm === "REMOVED" || norm === "VOID" || norm === "REJECTED" || norm === "FAILED" || norm === "CANCELLED") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80";
  }
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
}

function searchable(value: unknown) {
  return String(value || "").toLowerCase();
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as string;

  const [detail, setDetail] = useState<AdminCustomerDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>("invoices");

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("ALL");
  const [commissionStatus, setCommissionStatus] = useState("ALL");
  const [tripStatus, setTripStatus] = useState("ALL");

  const loadCustomerDetail = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    const response = await adminApi.getChannelPartnerCustomerDetail(customerId);
    if (response.success && response.data) {
      setDetail(response.data);
    } else {
      toast.error(response.message || "Failed to load customer profile details");
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    void loadCustomerDetail();
  }, [loadCustomerDetail]);

  const customer = detail?.customer;
  const link = detail?.link;
  const summary = detail?.summary;

  // Filtered lists
  const q = searchTerm.trim().toLowerCase();

  const filteredInvoices = useMemo(() => {
    let rows = detail?.invoices || [];
    if (invoiceStatus !== "ALL") {
      rows = rows.filter((row) => String(row.paymentStatus).toUpperCase() === invoiceStatus);
    }
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.invoiceNumber,
        row.billToName,
        row.shipToName,
        row.vehicleNumber,
        row.productName,
      ].some((val) => searchable(val).includes(q))
    );
  }, [detail?.invoices, invoiceStatus, q]);

  const filteredCommissions = useMemo(() => {
    let rows = detail?.commissions || [];
    if (commissionStatus !== "ALL") {
      rows = rows.filter((row) => String(row.status).toUpperCase() === commissionStatus);
    }
    if (!q) return rows;
    return rows.filter((row) =>
      [row.invoiceNumber, row.status].some((val) => searchable(val).includes(q))
    );
  }, [detail?.commissions, commissionStatus, q]);

  const filteredTrips = useMemo(() => {
    let rows = detail?.trips || [];
    if (tripStatus !== "ALL") {
      rows = rows.filter((row) => String(row.status).toUpperCase() === tripStatus);
    }
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.vehicleNumber,
        row.src,
        row.dest,
        row.status,
        row.lastLocation?.address,
      ].some((val) => searchable(val).includes(q))
    );
  }, [detail?.trips, tripStatus, q]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
          <p className="text-sm font-semibold text-slate-500 font-sans">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 font-sans">
        <p className="text-slate-500">Customer profile not found.</p>
        <button
          onClick={() => router.push("/admin/channel-partners")}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Back to Channel Partners
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 sm:px-8 lg:px-12 font-sans text-slate-900">
      {/* Header */}
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white font-extrabold text-lg shadow-md shadow-blue-500/10">
              M+
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-955">{customer.name}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${pillClass(customer.identity)}`}>
                  {customer.identity || "CUSTOMER"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                MandiPlus Partner Customer · Registered on {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>

        </div>

        {/* Dynamic Details Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Customer Bio & Partner */}
          <div className="space-y-6">
            {/* Bio Card */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <User className="h-4 w-4" /> Profile Details
              </h2>
              <div className="space-y-3.5 text-sm">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Primary Phone</p>
                  <p className="font-semibold text-slate-950 mt-0.5">{customer.mobileNumber}</p>
                </div>
                {customer.secondaryMobileNumber && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Secondary Phone</p>
                    <p className="font-semibold text-slate-950 mt-0.5">{customer.secondaryMobileNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">State / Region</p>
                  <p className="font-semibold text-slate-950 mt-0.5">{customer.state.replace("_", " ")}</p>
                </div>
                {customer.mandiName && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Mandi Association</p>
                    <p className="font-semibold text-slate-950 mt-0.5">{customer.mandiName}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Commodities Traded</p>
                  <div className="flex flex-wrap gap-1">
                    {customer.products?.length ? (
                      customer.products.map((p) => (
                        <span key={p} className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-xs">No commodities recorded</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Balance Card */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Wallet className="h-4 w-4" /> Wallet Health
              </h2>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Current Balance</p>
                  <p className="text-2xl font-black text-slate-950 mt-1">
                    {formatCurrency(customer.walletBalance)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3.5 text-emerald-600 ring-1 ring-emerald-100">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </div>

            {/* Channel Partner Card */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <BadgeIndianRupee className="h-4 w-4" /> Channel Partner Link
              </h2>
              {link ? (
                <div className="space-y-3.5 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{link.partner.name || "Unnamed Partner"}</p>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">Code: {link.partner.code}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${pillClass(link.status)}`}>
                      {link.status}
                    </span>
                  </div>
                  <div className="border-t border-slate-100 pt-3 text-xs text-slate-400 font-medium space-y-1">
                    <p>Source: <span className="font-semibold text-slate-600">{link.source}</span></p>
                    {link.approvedAt && (
                      <p>Linked at: <span className="font-semibold text-slate-600">{formatDate(link.approvedAt)}</span></p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No channel partner assigned</p>
              )}
            </div>
          </div>

          {/* Metrics & Transactions Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <MetricBox icon={FileText} label="Total Invoices" value={String(summary?.invoices ?? 0)} color="slate" />
              <MetricBox icon={BadgeIndianRupee} label="Total Premium" value={formatCurrency(summary?.premiumTotal ?? 0)} color="emerald" />
              <MetricBox icon={BadgeIndianRupee} label="Commissions" value={formatCurrency(summary?.commissionTotal ?? 0)} color="indigo" />
              <MetricBox icon={MapPin} label="Active Trips" value={String(summary?.activeTrips ?? 0)} color="violet" />
            </div>

            {/* Detailed Transaction View with Advanced Filters */}
            <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
              {/* Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="inline-flex rounded-xl border border-slate-200/60 bg-slate-100 p-1 gap-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveTab(tab.key);
                        setSearchTerm("");
                      }}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        activeTab === tab.key
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200/30"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {/* Search Bar */}
                <div className="flex flex-1 items-center gap-2 max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Search ${activeTab}...`}
                    className="w-full bg-transparent text-sm outline-none text-slate-700"
                  />
                </div>
              </div>

              {/* Filtering Controls Sub-Header */}
              <div className="flex flex-wrap gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-2 text-xs">
                {activeTab === "invoices" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold">Payment:</span>
                    <select
                      value={invoiceStatus}
                      onChange={(e) => setInvoiceStatus(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="PAID">PAID</option>
                      <option value="PENDING">PENDING</option>
                      <option value="PARTIAL">PARTIAL</option>
                      <option value="FAILED">FAILED</option>
                      <option value="NOT_REQUIRED">NOT REQUIRED</option>
                    </select>
                  </div>
                )}

                {activeTab === "commissions" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold">Status:</span>
                    <select
                      value={commissionStatus}
                      onChange={(e) => setCommissionStatus(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="PAID">PAID</option>
                      <option value="PAYABLE">PAYABLE</option>
                      <option value="PENDING">PENDING</option>
                      <option value="VOID">VOID</option>
                    </select>
                  </div>
                )}

                {activeTab === "tracking" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-semibold">Trip Status:</span>
                    <select
                      value={tripStatus}
                      onChange={(e) => setTripStatus(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="PENDING">PENDING</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                {activeTab === "invoices" ? (
                  <table className="min-w-full divide-y divide-slate-200/80 text-sm">
                    <thead className="bg-slate-50/70 border-b border-slate-200/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3.5">Invoice Number</th>
                        <th className="px-4 py-3.5">Product Name</th>
                        <th className="px-4 py-3.5">Vehicle</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Payment</th>
                        <th className="px-4 py-3.5 text-right">Premium</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {inv.invoiceNumber}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{inv.productName || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{inv.vehicleNumber || "-"}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${pillClass(inv.paymentStatus)}`}>
                              {inv.paymentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(inv.premiumAmount)}
                          </td>
                        </tr>
                      ))}
                      {!filteredInvoices.length && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-semibold">
                            No invoices match the filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : activeTab === "commissions" ? (
                  <table className="min-w-full divide-y divide-slate-200/80 text-sm">
                    <thead className="bg-slate-50/70 border-b border-slate-200/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3.5">Invoice</th>
                        <th className="px-4 py-3.5">Premium</th>
                        <th className="px-4 py-3.5">Rate</th>
                        <th className="px-4 py-3.5">Commission</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Paid Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCommissions.map((comm) => (
                        <tr key={comm.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {comm.invoiceNumber || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatCurrency(comm.premiumAmount)}</td>
                          <td className="px-4 py-3 text-slate-600">{(comm.commissionRate * 100).toFixed(0)}%</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(comm.commissionAmount)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${pillClass(comm.status)}`}>
                              {comm.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(comm.paidAt)}</td>
                        </tr>
                      ))}
                      {!filteredCommissions.length && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-semibold">
                            No commissions recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200/80 text-sm">
                    <thead className="bg-slate-50/70 border-b border-slate-200/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3.5">Vehicle Number</th>
                        <th className="px-4 py-3.5">Invoice</th>
                        <th className="px-4 py-3.5">Route</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Last Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTrips.map((trip) => (
                        <tr key={trip.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {trip.vehicleNumber || "Vehicle Pending"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{trip.invoice?.invoiceNumber || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {trip.src || "-"} <span className="text-slate-400 mx-1">→</span> {trip.dest || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${pillClass(trip.status)}`}>
                              {trip.status}
                            </span>
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-slate-500">
                            {trip.lastLocation?.address || "Unavailable"}
                          </td>
                        </tr>
                      ))}
                      {!filteredTrips.length && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-semibold">
                            No trips tracked for this customer.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({
  icon: Icon,
  label,
  value,
  color = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: "slate" | "blue" | "emerald" | "amber" | "indigo" | "violet";
}) {
  const bgMap = {
    slate: "bg-slate-50 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`p-2 rounded-xl ${bgMap[color] || bgMap.slate}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}
