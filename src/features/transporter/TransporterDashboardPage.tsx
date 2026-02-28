"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/context/AuthContext";
import {
  ClaimRequest,
  getMyClaimsForms,
  InsuranceForm,
  updateInvoice,
} from "@/features/insurance/api";
import {
  getMyWalletStatement,
  getMyWalletSummary,
  exportMyWalletStatementExcel,
  getCustomerDashboardInvoices,
  getMyUserInvoices,
  getCustomerDashboardClaims,
  WalletStatementItem,
  WalletSummary,
} from "@/features/customer/api";

type DashboardTab = "overview" | "wallet" | "claims" | "policies";
type BotView = "tracking" | "knowVehicle" | "createNew";
type ServiceLinkCard = { title: string; subtitle: string; href: string };
type ServiceActionCard = {
  title: string;
  subtitle: string;
  action: "tracking" | "knowVehicle" | "support";
};

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

function getPremiumAmount(invoice: InsuranceForm) {
  const premium = (invoice as InsuranceForm & { premiumAmount?: number }).premiumAmount;
  if (typeof premium === "number") return premium;
  return Number(invoice.amount || 0) * 0.002;
}

function getProductLabel(invoice: InsuranceForm) {
  const rawProduct = (invoice as unknown as { productName?: unknown }).productName;
  const rawItemName = (invoice as unknown as { itemName?: unknown }).itemName;

  if (Array.isArray(rawProduct)) {
    const first = rawProduct.find((p) => typeof p === "string" && p.trim());
    return typeof first === "string" ? first.trim() : "-";
  }
  if (typeof rawProduct === "string" && rawProduct.trim()) {
    return rawProduct.trim();
  }
  if (typeof rawItemName === "string" && rawItemName.trim()) {
    return rawItemName.trim();
  }
  return "-";
}

function getEditProduct(invoice: InsuranceForm) {
  const rawProduct = (invoice as unknown as { productName?: unknown }).productName;
  if (Array.isArray(rawProduct)) {
    const first = rawProduct.find((p) => typeof p === "string" && p.trim());
    return typeof first === "string" ? first.trim() : "";
  }
  return typeof rawProduct === "string" ? rawProduct : "";
}

export default function TransporterDashboardPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [botView, setBotView] = useState<BotView>("tracking");
  const [botOpen, setBotOpen] = useState(false);
  const [botStage, setBotStage] = useState<"question" | "view">("question");
  const [supportOpen, setSupportOpen] = useState(false);
  const [invoices, setInvoices] = useState<InsuranceForm[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [statement, setStatement] = useState<WalletStatementItem[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [exportingStatement, setExportingStatement] = useState(false);
  const [newClaimTruckNo, setNewClaimTruckNo] = useState("");
  const [creatingClaim, setCreatingClaim] = useState(false);
  const [claimActionMessage, setClaimActionMessage] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InsuranceForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSlipFile, setEditSlipFile] = useState<File | null>(null);
  const editSlipInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    invoiceType: "BUYER_INVOICE" as "BUYER_INVOICE" | "SUPPLIER_INVOICE",
    supplierName: "",
    supplierAddress: "",
    placeOfSupply: "",
    billToName: "",
    billToAddress: "",
    shipToName: "",
    shipToAddress: "",
    productName: "",
    vehicleNumber: "",
    hsnCode: "",
    quantity: 0,
    rate: 0,
    weighmentSlipNote: "",
  });

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

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [customerInvoices, ownInvoices, ownClaims, customerClaims] = await Promise.all([
        getCustomerDashboardInvoices().catch(() => []),
        getMyUserInvoices().catch(() => []),
        getMyClaimsForms().catch(() => []),
        getCustomerDashboardClaims().catch(() => []),
      ]);

      const mergedInvoicesMap = new Map<string, InsuranceForm>();
      for (const inv of ownInvoices) {
        mergedInvoicesMap.set(inv.id, inv);
      }
      for (const inv of customerInvoices) {
        mergedInvoicesMap.set(inv.id, inv);
      }
      const mergedInvoices = Array.from(mergedInvoicesMap.values()).sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      const mergedClaimsMap = new Map<string, ClaimRequest>();
      for (const c of ownClaims) {
        mergedClaimsMap.set(c.id, c);
      }
      for (const c of customerClaims) {
        mergedClaimsMap.set(c.id, c);
      }
      const mergedClaims = Array.from(mergedClaimsMap.values()).sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      setInvoices(mergedInvoices);
      setClaims(mergedClaims);
      await loadWalletData();
    } finally {
      setLoading(false);
    }
  }, [loadWalletData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event?.data?.type === "MANDI_BOT_CLOSE") {
        setBotOpen(false);
      }
      if (event?.data?.type === "MANDI_BOT_INVOICE_CREATED") {
        setBotOpen(false);
        setActiveTab("policies");
        loadDashboardData();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadDashboardData]);

  useEffect(() => {
    if (activeTab === "wallet") {
      loadWalletData();
    }
  }, [activeTab, loadWalletData]);

  const stats = useMemo(() => {
    const activeClaims = claims.filter((c) => c.status !== "REJECTED").length;
    const approvedClaims = claims.filter((c) => c.status === "APPROVED").length;
    const pendingClaims = claims.filter((c) => c.status === "PENDING").length;
    return {
      totalForms: invoices.length,
      activeClaims,
      approvedClaims,
      pendingClaims,
    };
  }, [claims, invoices.length]);

  const serviceCards: Array<ServiceLinkCard | ServiceActionCard> = [
    { title: "Track Deliveries", subtitle: "Real-time updates", action: "tracking" as const },
    { title: "Know Your Vehicle", subtitle: "Vehicle details in one click", action: "knowVehicle" as const },
    { title: "Explore", subtitle: "Discover routes and products", href: "/explore" },
    { title: "Support", subtitle: "Need help? Talk to our team", action: "support" as const },
  ];

  const navItems: Array<{ key: DashboardTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "wallet", label: "Wallet" },
    { key: "claims", label: "My Claims" },
    { key: "policies", label: "My Policies" },
  ];

  return (
    <ProtectedRoute allowedIdentities={["TRANSPORTER"]}>
      <div className="min-h-screen bg-gradient-to-br from-[#f6f4ff] via-[#f9f9ff] to-[#f4f2ff] text-slate-900">
        <div className="flex min-h-screen">
          <aside className="hidden w-[280px] border-r border-[#2a3150] bg-[#0e1428] text-slate-100 lg:flex lg:flex-col">
            <div className="border-b border-white/10 px-6 py-8">
              <h1 className="text-4xl font-extrabold tracking-tight">
                <span className="text-white">Mandi</span>
                <span className="bg-gradient-to-r from-[#6d1cff] to-[#9d33ff] bg-clip-text text-transparent">Plus</span>
              </h1>
              <p className="mt-1 text-sm text-slate-300">Transporter Dashboard</p>
            </div>

            <nav className="space-y-2 px-4 py-6">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeTab === item.key
                      ? "bg-gradient-to-r from-[#6d1cff] to-[#9d33ff] text-white shadow-lg shadow-purple-900/30"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mt-auto p-4">
              <button
                onClick={logout}
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </aside>

          <main className="flex-1">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
              <div className="flex items-center justify-between px-5 py-4 lg:px-8">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">
                    Welcome, {user?.name || "User"}
                  </h2>
                  <p className="text-sm text-slate-500">Here&apos;s your insurance overview</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-right shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">
                      Wallet
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {formatCurrency(wallet?.availableBalance ?? 0)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSupportOpen(true)}
                    className="rounded-xl bg-gradient-to-r from-[#6d1cff] to-[#9d33ff] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:scale-[1.02]"
                  >
                    Support
                  </button>
                </div>
              </div>
            </header>

            <div className="space-y-8 p-5 lg:p-8">
              {activeTab === "overview" && (
                <>
                  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total Forms" value={stats.totalForms} />
                    <StatCard label="Active Claims" value={stats.activeClaims} />
                    <StatCard label="Approved Claims" value={stats.approvedClaims} />
                    <StatCard label="Pending Claims" value={stats.pendingClaims} />
                  </section>

                  <section>
                    <h3 className="text-3xl font-bold text-slate-900">Our Services</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {serviceCards.map((item) => {
                        if ("href" in item) {
                          return (
                            <Link
                              key={item.title}
                              href={item.href}
                              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                            >
                              <p className="text-2xl font-bold text-slate-900">{item.title}</p>
                              <p className="mt-2 text-slate-600">{item.subtitle}</p>
                              <div className="mt-4 h-1 w-16 rounded bg-gradient-to-r from-[#6d1cff] to-[#9d33ff] opacity-0 transition group-hover:opacity-100" />
                            </Link>
                          );
                        }

                        return (
                          <button
                            key={item.title}
                            onClick={() => {
                              if (item.action === "support") {
                                setSupportOpen(true);
                                return;
                              }
                              setBotView(item.action);
                              setBotStage("question");
                              setBotOpen(true);
                            }}
                            className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                          >
                            <p className="text-2xl font-bold text-slate-900">{item.title}</p>
                            <p className="mt-2 text-slate-600">{item.subtitle}</p>
                            <div className="mt-4 h-1 w-16 rounded bg-gradient-to-r from-[#6d1cff] to-[#9d33ff] opacity-0 transition group-hover:opacity-100" />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}

              {activeTab === "wallet" && (
                <section className="max-w-6xl space-y-5">
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
              )}

              {activeTab === "claims" && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-2xl font-bold">My Claims</h3>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const truckNo = newClaimTruckNo.trim();
                        if (!truckNo) return;
                        setCreatingClaim(true);
                        setClaimActionMessage(null);
                        try {
                          await import("@/features/insurance/api").then((m) =>
                            m.createClaimByTruck(truckNo),
                          );
                          setClaimActionMessage("Claim request created successfully.");
                          setNewClaimTruckNo("");
                          const [refreshedOwnClaims, refreshedCustomerClaims] = await Promise.all([
                            getMyClaimsForms().catch(() => []),
                            getCustomerDashboardClaims().catch(() => []),
                          ]);
                          const refreshedClaimsMap = new Map<string, ClaimRequest>();
                          for (const c of refreshedOwnClaims) {
                            refreshedClaimsMap.set(c.id, c);
                          }
                          for (const c of refreshedCustomerClaims) {
                            refreshedClaimsMap.set(c.id, c);
                          }
                          const refreshedClaims = Array.from(refreshedClaimsMap.values()).sort((a, b) => {
                            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return tb - ta;
                          });
                          setClaims(refreshedClaims);
                        } catch (err: any) {
                          const msg =
                            err?.message ||
                            err?.response?.data?.message ||
                            "Failed to create claim request.";
                          setClaimActionMessage(Array.isArray(msg) ? msg.join(", ") : msg);
                        } finally {
                          setCreatingClaim(false);
                        }
                      }}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="text"
                        value={newClaimTruckNo}
                        onChange={(e) => setNewClaimTruckNo(e.target.value.toUpperCase())}
                        placeholder="Enter truck number (e.g., MH12AB1234)"
                        className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#6d1cff] focus:ring-2 focus:ring-[#6d1cff]/20"
                      />
                      <button
                        type="submit"
                        disabled={creatingClaim || !newClaimTruckNo.trim()}
                        className="rounded-lg bg-[#6d1cff] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5915d1] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatingClaim ? "Creating..." : "Create Claim Request"}
                      </button>
                    </form>
                  </div>
                  {claimActionMessage && (
                    <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
                      {claimActionMessage}
                    </p>
                  )}
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-slate-600">
                          <th className="px-3 py-2 font-semibold">Invoice Number</th>
                          <th className="px-3 py-2 font-semibold">Date</th>
                          <th className="px-3 py-2 font-semibold">Vehicle</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                          <th className="px-3 py-2 font-semibold">Claim PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Loading...</td></tr>
                        ) : claims.length === 0 ? (
                          <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">No claims found.</td></tr>
                        ) : (
                          claims.map((claim) => (
                            <tr key={claim.id} className="border-b last:border-none">
                              <td className="px-3 py-3">{claim.invoice?.invoiceNumber || "-"}</td>
                              <td className="px-3 py-3">{formatDate(claim.createdAt)}</td>
                              <td className="px-3 py-3">{claim.invoice?.vehicleNumber || "-"}</td>
                              <td className="px-3 py-3">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{claim.status}</span>
                              </td>
                              <td className="px-3 py-3">
                                {claim.claimFormUrl ? (
                                  <a href={claim.claimFormUrl} target="_blank" className="text-[#6d1cff] hover:underline">Open PDF</a>
                                ) : "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeTab === "policies" && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold">My Policies</h3>
                    <button
                      onClick={() => {
                        setBotView("createNew");
                        setBotStage("question");
                        setBotOpen(true);
                      }}
                      className="rounded-xl bg-gradient-to-r from-[#6d1cff] to-[#9d33ff] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Create New
                    </button>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-slate-600">
                          <th className="px-3 py-2 font-semibold">Invoice Number</th>
                          <th className="px-3 py-2 font-semibold">Date</th>
                          <th className="px-3 py-2 font-semibold">Product</th>
                          <th className="px-3 py-2 font-semibold">Vehicle</th>
                          <th className="px-3 py-2 font-semibold">Premium Amount</th>
                          <th className="px-3 py-2 font-semibold">PDF</th>
                          <th className="px-3 py-2 font-semibold">Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">Loading...</td></tr>
                        ) : invoices.length === 0 ? (
                          <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">No policies found.</td></tr>
                        ) : (
                          invoices.map((inv) => (
                            <tr key={inv.id} className="border-b last:border-none">
                              <td className="px-3 py-3 font-semibold text-slate-900">{inv.invoiceNumber}</td>
                              <td className="px-3 py-3">{formatDate(inv.createdAt)}</td>
                              <td className="px-3 py-3">{getProductLabel(inv)}</td>
                              <td className="px-3 py-3">{inv.vehicleNumber || inv.truckNumber || "-"}</td>
                              <td className="px-3 py-3">{formatCurrency(getPremiumAmount(inv))}</td>
                              <td className="px-3 py-3">
                                {inv.pdfUrl || inv.pdfURL ? (
                                  <a href={inv.pdfUrl || inv.pdfURL} target="_blank" className="text-[#6d1cff] hover:underline">View PDF</a>
                                ) : "-"}
                              </td>
                              <td className="px-3 py-3">
                                <button
                                  onClick={() => {
                                    setEditingInvoice(inv);
                                    setEditForm({
                                      invoiceType:
                                        (inv.invoiceType as "BUYER_INVOICE" | "SUPPLIER_INVOICE") ||
                                        "BUYER_INVOICE",
                                      supplierName: inv.supplierName || "",
                                      supplierAddress:
                                        Array.isArray(inv.supplierAddress) ? inv.supplierAddress[0] || "" : "",
                                      placeOfSupply: inv.placeOfSupply || "",
                                      billToName: inv.billToName || "",
                                      billToAddress:
                                        Array.isArray(inv.billToAddress) ? inv.billToAddress[0] || "" : "",
                                      shipToName: inv.shipToName || "",
                                      shipToAddress:
                                        Array.isArray(inv.shipToAddress) ? inv.shipToAddress[0] || "" : "",
                                      productName: getEditProduct(inv),
                                      vehicleNumber: inv.vehicleNumber || inv.truckNumber || "",
                                      hsnCode: inv.hsnCode || "",
                                      quantity: Number(inv.quantity || 0),
                                      rate: Number(inv.rate || 0),
                                      weighmentSlipNote: inv.weighmentSlipNote || "",
                                    });
                                    setEditSlipFile(null);
                                    setShowEditModal(true);
                                  }}
                                  className="rounded-lg border border-[#6d1cff] px-3 py-1 text-[#6d1cff] transition hover:bg-[#6d1cff] hover:text-white"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          </main>
        </div>

        {supportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Support</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Tell us your issue and our team will help you.
                  </p>
                </div>
                <button
                  onClick={() => setSupportOpen(false)}
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                  x
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Call Support</p>
                  <p className="text-sm text-slate-600">+91 90000 00000</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Email</p>
                  <p className="text-sm text-slate-600">support@mandiplus.com</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">WhatsApp</p>
                  <a
                    href="https://wa.me/919000000000"
                    target="_blank"
                    className="text-sm text-[#6d1cff] hover:underline"
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setSupportOpen(false)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && editingInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 border-b bg-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">Update Invoice</h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
                  >
                    X
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-slate-300 p-4">
                  <label className="mb-2 block text-sm font-medium text-slate-800">
                    Upload Weighment Slip
                  </label>
                  <input
                    ref={editSlipInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditSlipFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div className="space-y-2">
                    <p className="text-center text-sm text-slate-500">
                      {editSlipFile ? editSlipFile.name : "No new slip selected"}
                    </p>
                    <button
                      type="button"
                      onClick={() => editSlipInputRef.current?.click()}
                      className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Upload New Photo
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                  Invoice: <span className="font-semibold">{editingInvoice.invoiceNumber}</span>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-800">Invoice Type</label>
                  <select
                    value={editForm.invoiceType}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        invoiceType: e.target.value as "BUYER_INVOICE" | "SUPPLIER_INVOICE",
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                  >
                    <option value="BUYER_INVOICE">Buyer Invoice</option>
                    <option value="SUPPLIER_INVOICE">Supplier Invoice</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Supplier Name" value={editForm.supplierName} onChange={(e) => setEditForm((p) => ({ ...p, supplierName: e.target.value }))} />
                  <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Place of Supply" value={editForm.placeOfSupply} onChange={(e) => setEditForm((p) => ({ ...p, placeOfSupply: e.target.value }))} />
                  <textarea className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Supplier Address" value={editForm.supplierAddress} onChange={(e) => setEditForm((p) => ({ ...p, supplierAddress: e.target.value }))} />
                  <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Bill To Name" value={editForm.billToName} onChange={(e) => setEditForm((p) => ({ ...p, billToName: e.target.value }))} />
                  <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ship To Name" value={editForm.shipToName} onChange={(e) => setEditForm((p) => ({ ...p, shipToName: e.target.value }))} />
                  <textarea className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Bill To Address" value={editForm.billToAddress} onChange={(e) => setEditForm((p) => ({ ...p, billToAddress: e.target.value }))} />
                  <textarea className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ship To Address" value={editForm.shipToAddress} onChange={(e) => setEditForm((p) => ({ ...p, shipToAddress: e.target.value }))} />
                  <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Product Name" value={editForm.productName} onChange={(e) => setEditForm((p) => ({ ...p, productName: e.target.value }))} />
                  <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="HSN Code" value={editForm.hsnCode} onChange={(e) => setEditForm((p) => ({ ...p, hsnCode: e.target.value }))} />
                  <input type="number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Quantity" value={editForm.quantity} onChange={(e) => setEditForm((p) => ({ ...p, quantity: Number(e.target.value || 0) }))} />
                  <input type="number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Rate" value={editForm.rate} onChange={(e) => setEditForm((p) => ({ ...p, rate: Number(e.target.value || 0) }))} />
                  <input className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Vehicle Number" value={editForm.vehicleNumber} onChange={(e) => setEditForm((p) => ({ ...p, vehicleNumber: e.target.value.toUpperCase() }))} />
                  <textarea className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Weighment Slip Note" value={editForm.weighmentSlipNote} onChange={(e) => setEditForm((p) => ({ ...p, weighmentSlipNote: e.target.value }))} />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-slate-600">
                    Amount: {formatCurrency((editForm.quantity || 0) * (editForm.rate || 0))}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={savingEdit}
                      onClick={async () => {
                        setSavingEdit(true);
                        try {
                          const fd = new FormData();
                          fd.append("invoiceType", editForm.invoiceType);
                          fd.append("supplierName", editForm.supplierName);
                          fd.append("supplierAddress", editForm.supplierAddress);
                          fd.append("placeOfSupply", editForm.placeOfSupply);
                          fd.append("billToName", editForm.billToName);
                          fd.append("billToAddress", editForm.billToAddress);
                          fd.append("shipToName", editForm.shipToName || editForm.billToName);
                          fd.append("shipToAddress", editForm.shipToAddress || editForm.billToAddress);
                          fd.append("productName", editForm.productName);
                          fd.append("hsnCode", editForm.hsnCode);
                          fd.append("vehicleNumber", editForm.vehicleNumber);
                          fd.append("truckNumber", editForm.vehicleNumber);
                          fd.append("quantity", String(editForm.quantity || 0));
                          fd.append("rate", String(editForm.rate || 0));
                          fd.append("amount", String((editForm.quantity || 0) * (editForm.rate || 0)));
                          fd.append("weighmentSlipNote", editForm.weighmentSlipNote || "");
                          if (editSlipFile) {
                            fd.append("weighmentSlips", editSlipFile);
                          }
                          await updateInvoice(editingInvoice.id, fd);
                          await loadDashboardData();
                          setShowEditModal(false);
                        } catch (err: any) {
                          alert(err?.message || "Failed to update invoice");
                        } finally {
                          setSavingEdit(false);
                        }
                      }}
                      className="rounded-xl bg-[#6d1cff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5915d1] disabled:opacity-60"
                    >
                      {savingEdit ? "Updating..." : "Update & Regenerate PDF"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {botOpen && (
          <div className="fixed inset-0 z-40 bg-black/20">
            <div className="absolute right-4 top-4 h-[92vh] w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {botView === "tracking"
                      ? "Track Deliveries Bot"
                      : botView === "knowVehicle"
                        ? "Know Your Vehicle Bot"
                        : "Create New Policy"}
                  </p>
                  <p className="text-xs text-slate-500">Live assistant inside dashboard</p>
                </div>
                <button
                  onClick={() => setBotOpen(false)}
                  className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-200"
                >
                  X
                </button>
              </div>
              {botStage === "question" ? (
                <div className="h-[calc(92vh-64px)] w-full bg-[#ece5dd] p-4">
                  <div className="rounded-2xl bg-white p-4 shadow">
                    <p className="text-sm text-slate-800">
                      Hi! What do you want to do right now?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setBotView("tracking");
                          setBotStage("view");
                        }}
                        className="rounded-full bg-[#6d1cff] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Track Deliveries
                      </button>
                      <button
                        onClick={() => {
                          setBotView("knowVehicle");
                          setBotStage("view");
                        }}
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Know Vehicle
                      </button>
                      <button
                        onClick={() => {
                          setBotView("createNew");
                          setBotStage("view");
                        }}
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Create New Policy
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <iframe
                  key={botView}
                  title={
                    botView === "tracking"
                      ? "Track Deliveries"
                      : botView === "knowVehicle"
                        ? "Know Your Vehicle"
                        : "Create New Policy"
                  }
                  src={
                    botView === "tracking"
                      ? "/tracking?embedBot=1"
                      : botView === "knowVehicle"
                        ? "/know-your-vehicle?embedBot=1"
                        : "/insurance?embedBot=1"
                  }
                  className="h-[calc(92vh-64px)] w-full"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-[#111827]">{value}</p>
    </div>
  );
}
