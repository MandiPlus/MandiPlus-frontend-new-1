"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/context/AuthContext";
import {
  exportMyWalletStatementExcel,
  getMyWalletStatement,
  getMyWalletSummary,
  WalletStatementItem,
  WalletSummary,
} from "./api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CustomerDashboardPage() {
  const { user, logout } = useAuth();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [statement, setStatement] = useState<WalletStatementItem[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [exportingStatement, setExportingStatement] = useState(false);

  const serviceCards = [
    { title: "Track Deliveries", subtitle: "Real-time updates", href: "/tracking" },
    { title: "Know Your Vehicle", subtitle: "Vehicle details in one click", href: "/know-your-vehicle" },
    { title: "Create Policy", subtitle: "Create invoice insurance quickly", href: "/insurance" },
    { title: "My Policies", subtitle: "View all insurance forms", href: "/my-insurance-forms" },
  ];

  const loadWalletData = useCallback(async () => {
    setWalletError(null);
    try {
      const [walletData, statementData] = await Promise.all([
        getMyWalletSummary(),
        getMyWalletStatement(),
      ]);
      setWallet(walletData);
      setStatement(statementData);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load wallet data";
      setWalletError(Array.isArray(message) ? message.join(", ") : message);
      setWallet(null);
      setStatement([]);
    }
  }, []);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  return (
    <ProtectedRoute allowedIdentities={["CUSTOMER"]}>
      <div className="min-h-screen bg-[#f6f7fb]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">Welcome, {user?.name || "Customer"}</h1>
              <p className="text-sm text-slate-600">Home dashboard with wallet overview</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
          <section>
            <h2 className="text-2xl font-bold text-slate-900">Services</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {serviceCards.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <p className="text-2xl font-bold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-slate-600">{item.subtitle}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="overflow-hidden rounded-3xl border border-[#1a2550] bg-gradient-to-r from-[#0b1638] via-[#13224f] to-[#1b1842] p-6 text-white shadow-2xl lg:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b6c3ff]">MandiPlus Wallet</p>
                  <h3 className="mt-2 text-3xl font-extrabold leading-tight">Available Balance</h3>
                  <p className="mt-1 text-sm text-slate-300">Auto debited by invoice amount (quantity x rate).</p>
                  <p className="mt-4 text-5xl font-extrabold leading-none">
                    {formatCurrency(wallet?.availableBalance ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-300">Last Updated</p>
                  <p className="text-sm font-semibold text-white">{formatDate(wallet?.updatedAt)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Available</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-900">
                  {formatCurrency(wallet?.availableBalance ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Used</p>
                <p className="mt-2 text-2xl font-extrabold text-amber-900">
                  {formatCurrency(wallet?.usedBalance ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Total</p>
                <p className="mt-2 text-2xl font-extrabold text-sky-900">
                  {formatCurrency(wallet?.totalBalance ?? 0)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Recent Statement</h4>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {statement.length} entries
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        setExportingStatement(true);
                        const blob = await exportMyWalletStatementExcel();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `wallet-statement-${new Date().toISOString().slice(0, 10)}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      } catch (err: any) {
                        const message =
                          err?.response?.data?.message ||
                          err?.message ||
                          "Failed to export wallet statement";
                        setWalletError(Array.isArray(message) ? message.join(", ") : message);
                      } finally {
                        setExportingStatement(false);
                      }
                    }}
                    disabled={exportingStatement}
                    className="rounded-lg bg-[#6d1cff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5d18df] disabled:opacity-60"
                  >
                    {exportingStatement ? "Exporting..." : "Export to Excel"}
                  </button>
                </div>
              </div>
              {walletError && (
                <div className="mt-3 rounded-lg border border-rose-300 bg-rose-100/90 px-3 py-2 text-sm text-rose-700">
                  {walletError}
                </div>
              )}
              {statement.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No wallet transactions yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {statement.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.narration || item.type}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-bold ${
                              item.direction === "CREDIT" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {item.direction === "CREDIT" ? "+ " : "- "}
                            {formatCurrency(item.amount)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Bal: {formatCurrency(item.balanceAfter ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
