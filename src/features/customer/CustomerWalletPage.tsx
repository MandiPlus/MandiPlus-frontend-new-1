"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
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

export default function CustomerWalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [statement, setStatement] = useState<WalletStatementItem[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [exportingStatement, setExportingStatement] = useState(false);

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
      <div className="min-h-screen bg-[#e0d7fc] pb-20">
        <div className="bg-white px-5 py-4 rounded-b-4xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Wallet</h2>
            <button
              onClick={() => router.push("/customer/dashboard")}
              className="rounded-xl bg-[#4309ac] px-3 py-2 text-xs font-semibold text-white"
            >
              Back
            </button>
          </div>
        </div>

        <div className="px-5 mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-emerald-700">Available</p>
              <p className="mt-2 text-2xl font-extrabold text-emerald-900">
                {formatCurrency(wallet?.availableBalance ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-amber-700">Used</p>
              <p className="mt-2 text-2xl font-extrabold text-amber-900">
                {formatCurrency(wallet?.usedBalance ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-sky-700">Total</p>
              <p className="mt-2 text-2xl font-extrabold text-sky-900">
                {formatCurrency(wallet?.totalBalance ?? 0)}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#1a2550] bg-gradient-to-r from-[#0b1638] via-[#13224f] to-[#1b1842] p-4 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-[#b6c3ff]">Wallet Actions</p>
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
                  } finally {
                    setExportingStatement(false);
                  }
                }}
                disabled={exportingStatement}
                className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-60"
              >
                {exportingStatement ? "Exporting..." : "Export Excel"}
              </button>
            </div>
            {walletError && (
              <p className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700">{walletError}</p>
            )}
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <h4 className="font-semibold text-slate-800">Recent Statement</h4>
            {statement.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">No wallet transactions yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {statement.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.narration || item.type}</p>
                        <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                      </div>
                      <p className={`text-sm font-bold ${item.direction === "CREDIT" ? "text-emerald-600" : "text-rose-600"}`}>
                        {item.direction === "CREDIT" ? "+ " : "- "}
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
