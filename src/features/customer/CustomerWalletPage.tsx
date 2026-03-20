"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatTime(dateStr?: string) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isUuidLike(value?: string) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export default function CustomerWalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [statement, setStatement] = useState<WalletStatementItem[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [exportingStatement, setExportingStatement] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "CREDIT" | "DEBIT">(
    "ALL",
  );

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

  const totalCredits = useMemo(
    () =>
      statement.reduce(
        (sum, item) =>
          sum + (item.direction === "CREDIT" ? Number(item.amount || 0) : 0),
        0,
      ),
    [statement],
  );

  const totalDebits = useMemo(
    () =>
      statement.reduce(
        (sum, item) =>
          sum + (item.direction === "DEBIT" ? Number(item.amount || 0) : 0),
        0,
      ),
    [statement],
  );

  const filteredStatement = useMemo(() => {
    return statement.filter((item) => {
      if (activeFilter !== "ALL" && item.direction !== activeFilter) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const haystack = `${item.narration || ""} ${item.type || ""} ${
        item.referenceId || ""
      }`.toLowerCase();
      return haystack.includes(searchTerm.trim().toLowerCase());
    });
  }, [statement, activeFilter, searchTerm]);

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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-3xl bg-gradient-to-r from-[#0d4fb8] to-[#0d55c7] p-5 text-white shadow-sm lg:col-span-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-blue-100">
                    Available Balance
                  </p>
                  <p className="mt-2 text-3xl font-extrabold leading-none">
                    {formatCurrency(wallet?.availableBalance ?? 0)}
                  </p>
                  <p className="mt-2 text-xs text-blue-100">
                    Last updated: {formatDate(wallet?.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-white/10 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-blue-100">
                    Used Balance
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {formatCurrency(wallet?.usedBalance ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-blue-100">
                    Total Balance
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {formatCurrency(wallet?.totalBalance ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:col-span-4">
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Total Credits
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {formatCurrency(totalCredits)}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-rose-700">
                  Total Debits
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {formatCurrency(totalDebits)}
                </p>
              </div>
            </div>
          </div>

          {walletError && (
            <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-700">
              {walletError}
            </p>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800">Transaction History</h4>
                  <p className="text-xs text-slate-500">
                    {filteredStatement.length} transactions found
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-slate-500 text-sm mr-2">🔍</span>
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search transactions..."
                      className="w-44 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        setExportingStatement(true);
                        const blob = await exportMyWalletStatementExcel();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `wallet-statement-${new Date()
                          .toISOString()
                          .slice(0, 10)}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      } finally {
                        setExportingStatement(false);
                      }
                    }}
                    disabled={exportingStatement}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {exportingStatement ? "Exporting..." : "Export"}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                {(["ALL", "CREDIT", "DEBIT"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      activeFilter === key
                        ? "bg-[#0d4fb8] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {key === "ALL" ? "All" : key === "CREDIT" ? "Credits" : "Debits"}
                  </button>
                ))}
              </div>
            </div>

            {filteredStatement.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">No wallet transactions yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredStatement.map((item) => {
                  const isCredit = item.direction === "CREDIT";
                  const readableReference =
                    item.referenceId && !isUuidLike(item.referenceId)
                      ? item.referenceId
                      : null;
                  return (
                    <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                            isCredit
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {isCredit ? "↙" : "↗"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.narration || item.type}
                          </p>
                          {item.remark ? (
                            <p className="mt-1 text-xs text-slate-500">{item.remark}</p>
                          ) : null}
                          {item.attachmentUrl ? (
                            <a
                              href={item.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline"
                            >
                              View image
                            </a>
                          ) : null}
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDate(item.createdAt)}{" "}
                            <span className="mx-1">|</span>
                            {formatTime(item.createdAt)}
                            {readableReference ? (
                              <>
                                <span className="mx-1">|</span>
                                {readableReference}
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            isCredit ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isCredit ? "+" : "-"}
                          {formatCurrency(item.amount)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {isCredit ? "Credit" : "Debit"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
