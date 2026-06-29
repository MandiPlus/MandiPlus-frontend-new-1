"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeIndianRupee,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/context/AuthContext";
import type { ChannelPartnerDetailPayload } from "@/features/admin/api/admin.api";
import { getMyChannelPartnerDashboard } from "./api";

type PartnerTab = "customers" | "invoices" | "commissions" | "tracking";

const partnerTabs: Array<{ key: PartnerTab; label: string }> = [
  { key: "customers", label: "Customers" },
  { key: "invoices", label: "Invoices" },
  { key: "commissions", label: "Commissions" },
  { key: "tracking", label: "Tracking" },
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

function statusClass(status?: string | null) {
  if (status === "PAID" || status === "PAYABLE" || status === "ACTIVE" || status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "PENDING" || status === "PARTIAL") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (status === "SUSPENDED" || status === "VOID" || status === "FAILED" || status === "REJECTED") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function searchable(value: unknown) {
  return String(value || "").toLowerCase();
}

export default function ChannelPartnerDashboardPage() {
  const { user, logout } = useAuth();
  const [payload, setPayload] = useState<ChannelPartnerDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<PartnerTab>("customers");
  const [tableSearch, setTableSearch] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPayload(await getMyChannelPartnerDashboard());
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load channel partner dashboard";
      setError(message);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = payload?.summary;
  const statItems = useMemo(
    () => [
      { label: "Customers", value: String(summary?.customers ?? 0), icon: Users },
      { label: "Invoices", value: String(summary?.invoices ?? 0), icon: FileText },
      { label: "Premium", value: formatCurrency(summary?.premiumTotal ?? 0), icon: BadgeIndianRupee },
      {
        label: "Pending Commission",
        value: formatCurrency(summary?.commissionPending ?? 0),
        icon: BadgeIndianRupee,
      },
      {
        label: "Payable Commission",
        value: formatCurrency(summary?.commissionPayable ?? 0),
        icon: BadgeIndianRupee,
      },
      { label: "Active Trips", value: String(summary?.activeTrips ?? 0), icon: MapPin },
    ],
    [summary],
  );

  const q = tableSearch.trim().toLowerCase();
  const customerRows = useMemo(() => {
    const rows = payload?.customers || [];
    if (!q) return rows;
    return rows.filter((row) =>
      [row.customer.name, row.customer.mobileNumber, row.customer.identity].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [payload?.customers, q]);

  const invoiceRows = useMemo(() => {
    const rows = payload?.invoices || [];
    if (!q) return rows;
    return rows.filter((row) =>
      [row.invoiceNumber, row.billToName, row.shipToName, row.vehicleNumber, row.paymentStatus].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [payload?.invoices, q]);

  const commissionRows = useMemo(() => {
    const rows = payload?.commissions || [];
    if (!q) return rows;
    return rows.filter((row) =>
      [row.invoiceNumber, row.customer?.name, row.customer?.mobileNumber, row.status].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [payload?.commissions, q]);

  const tripRows = useMemo(() => {
    const rows = payload?.trips || [];
    if (!q) return rows;
    return rows.filter((row) =>
      [row.vehicleNumber, row.invoice?.invoiceNumber, row.src, row.dest, row.status, row.lastLocation?.address].some((item) =>
        searchable(item).includes(q),
      ),
    );
  }, [payload?.trips, q]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Channel Partner
              </p>
              <h1 className="text-2xl font-bold tracking-tight">
                {payload?.profile?.partnerUser?.name || user?.name || "Dashboard"}
              </h1>
              {payload?.profile ? (
                <p className="mt-1 text-sm text-slate-500">
                  Code {payload.profile.code} · {(payload.profile.commissionRate * 100).toFixed(0)}% commission
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading channel partner dashboard...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : payload?.message ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-900">{payload.message}</p>
              <p className="mt-1 text-sm text-amber-800">
                Your normal MandiPlus account still works. Channel partner access is an addon.
              </p>
              <Link
                href="/home"
                className="mt-4 inline-flex rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Go to Home
              </Link>
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {statItems.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <item.icon className="h-5 w-5 text-slate-500" />
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </section>

              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                    {partnerTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.key);
                          setTableSearch("");
                        }}
                        className={`rounded px-3 py-1.5 text-sm font-semibold ${
                          activeTab === tab.key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex min-w-[16rem] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={tableSearch}
                      onChange={(event) => setTableSearch(event.target.value)}
                      placeholder={`Search ${activeTab}`}
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                </div>
                <div className="max-h-[520px] overflow-auto">
                  {activeTab === "customers" ? (
                    <PartnerCustomers rows={customerRows} />
                  ) : activeTab === "invoices" ? (
                    <PartnerInvoices rows={invoiceRows} />
                  ) : activeTab === "commissions" ? (
                    <PartnerCommissions rows={commissionRows} />
                  ) : (
                    <PartnerTrips rows={tripRows} />
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

function PartnerCustomers({ rows }: { rows: NonNullable<ChannelPartnerDetailPayload["customers"]> }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Customer</th>
          <th className="px-4 py-3">Invoices</th>
          <th className="px-4 py-3">Premium</th>
          <th className="px-4 py-3">Pending Payments</th>
          <th className="px-4 py-3">Last Invoice</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.linkId}>
            <td className="px-4 py-3">
              <p className="font-semibold text-slate-900">{row.customer.name}</p>
              <p className="text-xs text-slate-500">{row.customer.mobileNumber}</p>
            </td>
            <td className="px-4 py-3">{row.stats.invoices}</td>
            <td className="px-4 py-3">{formatCurrency(row.stats.premiumTotal)}</td>
            <td className="px-4 py-3">{row.stats.pendingPayments}</td>
            <td className="px-4 py-3">{formatDate(row.stats.lastInvoiceDate)}</td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={5} label="No customers match this search." /> : null}
      </tbody>
    </table>
  );
}

function PartnerInvoices({ rows }: { rows: NonNullable<ChannelPartnerDetailPayload["invoices"]> }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Invoice</th>
          <th className="px-4 py-3">Party</th>
          <th className="px-4 py-3">Vehicle</th>
          <th className="px-4 py-3">Payment</th>
          <th className="px-4 py-3">Premium</th>
          <th className="px-4 py-3">PDFs</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">
              <p className="font-semibold">{row.invoiceNumber}</p>
              <p className="text-xs text-slate-500">{formatDate(row.invoiceDate)}</p>
            </td>
            <td className="px-4 py-3">{row.billToName || row.insuredPersonNameSnapshot || row.shipToName || "-"}</td>
            <td className="px-4 py-3">{row.vehicleNumber || "-"}</td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(row.paymentStatus)}`}>
                {row.paymentStatus}
              </span>
            </td>
            <td className="px-4 py-3">{formatCurrency(row.premiumAmount)}</td>
            <td className="px-4 py-3">
              <div className="flex gap-3 text-xs font-semibold">
                {row.pdfUrl ? <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Invoice</a> : null}
                {row.insuranceUrl ? <a href={row.insuranceUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Policy</a> : null}
                {!row.pdfUrl && !row.insuranceUrl ? "-" : null}
              </div>
            </td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={6} label="No invoices match this search." /> : null}
      </tbody>
    </table>
  );
}

function PartnerCommissions({ rows }: { rows: NonNullable<ChannelPartnerDetailPayload["commissions"]> }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Invoice</th>
          <th className="px-4 py-3">Customer</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Premium</th>
          <th className="px-4 py-3">Commission</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">
              <p className="font-semibold">{row.invoiceNumber || row.invoiceId}</p>
              <p className="text-xs text-slate-500">{formatDate(row.invoiceDate)}</p>
            </td>
            <td className="px-4 py-3">{row.customer?.name || "-"}</td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(row.status)}`}>
                {row.status}
              </span>
            </td>
            <td className="px-4 py-3">{formatCurrency(row.premiumAmount)}</td>
            <td className="px-4 py-3 font-semibold">{formatCurrency(row.commissionAmount)}</td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={5} label="No commission rows match this search." /> : null}
      </tbody>
    </table>
  );
}

function PartnerTrips({ rows }: { rows: NonNullable<ChannelPartnerDetailPayload["trips"]> }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Vehicle</th>
          <th className="px-4 py-3">Invoice</th>
          <th className="px-4 py-3">Route</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Last Location</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">{row.vehicleNumber || "Vehicle pending"}</td>
            <td className="px-4 py-3">{row.invoice?.invoiceNumber || "-"}</td>
            <td className="px-4 py-3">{row.src || "-"} to {row.dest || "-"}</td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(row.status)}`}>
                {row.status}
              </span>
            </td>
            <td className="px-4 py-3">{row.lastLocation?.address || "Latest location unavailable"}</td>
          </tr>
        ))}
        {!rows.length ? <EmptyRow colSpan={5} label="No tracking trips match this search." /> : null}
      </tbody>
    </table>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
        {label}
      </td>
    </tr>
  );
}
