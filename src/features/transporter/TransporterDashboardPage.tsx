"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  getTransporterDashboardInvoices,
  getMyUserInvoices,
  getTransporterDashboardClaims,
  WalletStatementItem,
  WalletSummary,
} from "@/features/customer/api";

type DashboardTab = "overview" | "wallet" | "claims" | "policies";
type BotView = "tracking" | "knowVehicle" | "createNew";
type RangeKey = "7D" | "1M" | "3M" | "6M" | "1Y";
type InvoiceNotification = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  createdAt?: string;
  isRead: boolean;
};
const RANGE_OPTIONS: RangeKey[] = ["7D", "1M", "3M", "6M", "1Y"];

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

function formatDateTime(dateStr?: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  const date = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
  return `${date} | ${time}`;
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
  const hasWalletAccess = user?.billingType !== "PER_POLICY";
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [rangeKey, setRangeKey] = useState<RangeKey>("1Y");
  const [botView, setBotView] = useState<BotView>("tracking");
  const [botOpen, setBotOpen] = useState(false);
  const [botStage, setBotStage] = useState<"question" | "view">("question");
  const [botGreetingVisible, setBotGreetingVisible] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [invoiceNotifications, setInvoiceNotifications] = useState<InvoiceNotification[]>([]);
  const [dashboardInitialized, setDashboardInitialized] = useState(false);
  const [browserNotificationSupported, setBrowserNotificationSupported] = useState(false);
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<NotificationPermission>("default");
  const [showBrowserNotificationPrompt, setShowBrowserNotificationPrompt] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [invoices, setInvoices] = useState<InsuranceForm[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [statement, setStatement] = useState<WalletStatementItem[]>([]);
  const [walletSearch, setWalletSearch] = useState("");
  const [walletTxnFilter, setWalletTxnFilter] = useState<"ALL" | "CREDITS" | "DEBITS">("ALL");
  const [exportingStatement, setExportingStatement] = useState(false);
  const [newClaimTruckNo, setNewClaimTruckNo] = useState("");
  const [creatingClaim, setCreatingClaim] = useState(false);
  const [claimActionMessage, setClaimActionMessage] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InsuranceForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSlipFile, setEditSlipFile] = useState<File | null>(null);
  const editSlipInputRef = useRef<HTMLInputElement>(null);
  const botGreetingTimerRef = useRef<number | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const knownInvoiceIdsRef = useRef<Set<string>>(new Set());
  const hasPrimedNotificationsRef = useRef(false);
  const prevUnreadNotificationCountRef = useRef(0);
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
    try {
      const [walletData, statementData] = await Promise.all([
        getMyWalletSummary(),
        getMyWalletStatement(),
      ]);
      setWallet(walletData);
      setStatement(statementData);
    } catch {
      setWallet(null);
      setStatement([]);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const [customerInvoices, ownInvoices, ownClaims, customerClaims] = await Promise.all([
        getTransporterDashboardInvoices().catch(() => []),
        getMyUserInvoices().catch(() => []),
        getMyClaimsForms().catch(() => []),
        getTransporterDashboardClaims().catch(() => []),
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
      if (hasWalletAccess) {
        await loadWalletData();
      } else {
        setWallet(null);
        setStatement([]);
      }
    } catch {
      setInvoices([]);
      setClaims([]);
    } finally {
      setDashboardInitialized(true);
    }
  }, [hasWalletAccess, loadWalletData]);

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
    if (!hasWalletAccess && activeTab === "wallet") {
      setActiveTab("overview");
    }
  }, [activeTab, hasWalletAccess]);

  useEffect(() => {
    if (hasWalletAccess && activeTab === "wallet") {
      loadWalletData();
    }
  }, [activeTab, hasWalletAccess, loadWalletData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "Notification" in window;
    setBrowserNotificationSupported(supported);
    if (!supported) return;

    const permission = window.Notification.permission;
    setBrowserNotificationPermission(permission);
    const dismissed = window.sessionStorage.getItem("transporter_notification_prompt_dismissed") === "1";
    if (permission === "default" && !dismissed) {
      setShowBrowserNotificationPrompt(true);
    }
  }, []);

  const requestBrowserNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const permission = await window.Notification.requestPermission();
      setBrowserNotificationPermission(permission);
      if (permission !== "default") {
        setShowBrowserNotificationPrompt(false);
      }
      if (permission === "granted") {
        const welcomeNotification = new window.Notification("MandiPlus notifications enabled", {
          body: "You will now get invoice alerts on this device.",
          tag: "mandiplus-notification-enabled",
        });
        welcomeNotification.onclick = () => {
          window.focus();
          welcomeNotification.close();
        };
      }
    } catch {
      // Ignore permission request errors.
    }
  }, []);

  const dismissBrowserNotificationPrompt = useCallback(() => {
    setShowBrowserNotificationPrompt(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("transporter_notification_prompt_dismissed", "1");
    }
  }, []);

  const pollInvoicesForNotifications = useCallback(async () => {
    try {
      const [customerInvoices, ownInvoices] = await Promise.all([
        getTransporterDashboardInvoices().catch(() => []),
        getMyUserInvoices().catch(() => []),
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
      setInvoices(mergedInvoices);
    } catch {
      // Ignore polling failures and keep existing state.
    }
  }, []);

  useEffect(() => {
    if (!dashboardInitialized) return;

    const currentIds = new Set(
      invoices
        .map((inv) => inv.id)
        .filter((id): id is string => Boolean(id)),
    );

    if (!hasPrimedNotificationsRef.current) {
      knownInvoiceIdsRef.current = currentIds;
      hasPrimedNotificationsRef.current = true;
      return;
    }

    const newInvoices = invoices.filter(
      (inv) => Boolean(inv.id) && !knownInvoiceIdsRef.current.has(inv.id),
    );

    if (newInvoices.length > 0) {
      setInvoiceNotifications((prev) => {
        const dedupe = new Set(prev.map((n) => n.invoiceId));
        const nextItems: InvoiceNotification[] = [];

        for (const inv of newInvoices) {
          if (!inv.id || dedupe.has(inv.id)) continue;
          nextItems.push({
            id: `${inv.id}-${Date.now()}`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber || inv.id,
            createdAt: inv.createdAt,
            isRead: false,
          });
        }

        if (!nextItems.length) return prev;
        return [...nextItems, ...prev].slice(0, 25);
      });

      if (
        browserNotificationSupported &&
        browserNotificationPermission === "granted" &&
        typeof window !== "undefined"
      ) {
        for (const inv of newInvoices.slice(0, 3)) {
          const invoiceNumber = inv.invoiceNumber || inv.id;
          const n = new window.Notification("New invoice created", {
            body: `Invoice ${invoiceNumber} is now available.`,
            tag: `invoice-${inv.id}`,
          });
          n.onclick = () => {
            window.focus();
            setActiveTab("policies");
            n.close();
          };
        }
      }
    }

    knownInvoiceIdsRef.current = currentIds;
  }, [browserNotificationPermission, browserNotificationSupported, dashboardInitialized, invoices]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        pollInvoicesForNotifications();
      }
    }, 20000);
    return () => window.clearInterval(interval);
  }, [pollInvoicesForNotifications]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!notificationPanelRef.current) return;
      if (!notificationPanelRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    const unreadCount = invoiceNotifications.filter((n) => !n.isRead).length;
    if (unreadCount <= prevUnreadNotificationCountRef.current) {
      prevUnreadNotificationCountRef.current = unreadCount;
      return;
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = audioContext.createGain();
      gain.gain.value = 0.0001;
      gain.connect(audioContext.destination);

      const osc = audioContext.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 820;
      osc.connect(gain);

      const start = audioContext.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.start(start);
      osc.stop(start + 0.22);
      window.setTimeout(() => {
        audioContext.close().catch(() => undefined);
      }, 350);
    } catch {
      // Ignore sound failures due to autoplay/browser restrictions.
    }

    prevUnreadNotificationCountRef.current = unreadCount;
  }, [invoiceNotifications]);

  useEffect(() => {
    const greetingSessionKey = "transporter_bot_greeting_seen";
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(greetingSessionKey)) return;

    const playGreetingTone = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.0001;
        gainNode.connect(audioContext.destination);

        const createNote = (freq: number, start: number, duration: number) => {
          const osc = audioContext.createOscillator();
          osc.type = "sine";
          osc.frequency.value = freq;
          osc.connect(gainNode);
          osc.start(start);
          osc.stop(start + duration);
        };

        const start = audioContext.currentTime;
        gainNode.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        createNote(740, start, 0.12);
        createNote(920, start + 0.14, 0.12);

        window.setTimeout(() => {
          audioContext.close().catch(() => undefined);
        }, 500);
      } catch {
        // Ignore audio errors (autoplay restrictions/browser support).
      }
    };

    playGreetingTone();
    setBotGreetingVisible(true);
    window.sessionStorage.setItem(greetingSessionKey, "1");
    botGreetingTimerRef.current = window.setTimeout(() => {
      setBotGreetingVisible(false);
    }, 6500);

    return () => {
      if (botGreetingTimerRef.current !== null) {
        window.clearTimeout(botGreetingTimerRef.current);
      }
    };
  }, []);

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

  const now = new Date();

  const rangeStart = useMemo(() => {
    const d = new Date();
    if (rangeKey === "7D") {
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const months = rangeKey === "1M" ? 1 : rangeKey === "3M" ? 3 : rangeKey === "6M" ? 6 : 12;
    d.setMonth(d.getMonth() - (months - 1));
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [rangeKey]);

  const rangeMs = now.getTime() - rangeStart.getTime();
  const prevRangeStart = new Date(rangeStart.getTime() - rangeMs);
  const prevRangeEnd = new Date(rangeStart.getTime() - 1);

  const isInRange = (value?: string | Date, from?: Date, to?: Date) => {
    if (!value || !from || !to) return false;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    return d >= from && d <= to;
  };

  const currentClaims = useMemo(
    () => claims.filter((c) => isInRange(c.createdAt, rangeStart, now)),
    [claims, rangeStart, now],
  );

  const previousClaims = useMemo(
    () => claims.filter((c) => isInRange(c.createdAt, prevRangeStart, prevRangeEnd)),
    [claims, prevRangeStart, prevRangeEnd],
  );

  const currentInvoices = useMemo(
    () => invoices.filter((i) => isInRange(i.createdAt, rangeStart, now)),
    [invoices, rangeStart, now],
  );

  const previousInvoices = useMemo(
    () => invoices.filter((i) => isInRange(i.createdAt, prevRangeStart, prevRangeEnd)),
    [invoices, prevRangeStart, prevRangeEnd],
  );

  const deltaPct = (current: number, previous: number): number | null => {
    if (previous === 0) return current === 0 ? 0 : null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const totalFormsDelta = deltaPct(currentInvoices.length, previousInvoices.length);
  const currentBusinessValue = useMemo(
    () => Number(currentInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0).toFixed(2)),
    [currentInvoices],
  );
  const previousBusinessValue = useMemo(
    () => Number(previousInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0).toFixed(2)),
    [previousInvoices],
  );
  const totalBusinessDelta = deltaPct(currentBusinessValue, previousBusinessValue);

  const totalClaimsDelta = deltaPct(currentClaims.length, previousClaims.length);
  const activeClaimsDelta = deltaPct(
    currentClaims.filter((c) => c.status !== "REJECTED").length,
    previousClaims.filter((c) => c.status !== "REJECTED").length,
  );
  const approvedClaimsDelta = deltaPct(
    currentClaims.filter((c) => c.status === "APPROVED").length,
    previousClaims.filter((c) => c.status === "APPROVED").length,
  );
  const pendingClaimsDelta = deltaPct(
    currentClaims.filter((c) => c.status === "PENDING").length,
    previousClaims.filter((c) => c.status === "PENDING").length,
  );

  const totalCreditsDisplay = useMemo(
    () =>
      Number(
        statement
          .filter((tx) => tx.direction === "CREDIT")
          .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
          .toFixed(2),
      ),
    [statement],
  );
  const totalDebitsDisplay = useMemo(
    () =>
      Number(
        statement
          .filter((tx) => tx.direction === "DEBIT")
          .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
          .toFixed(2),
      ),
    [statement],
  );
  const invoiceDebitTotal = useMemo(
    () =>
      statement
        .filter((s) => s.type === "INVOICE_DEBIT")
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [statement],
  );
  const invoiceRefundTotal = useMemo(
    () =>
      statement
        .filter((s) => s.type === "INVOICE_REFUND")
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [statement],
  );

  const currentSpentBalance = useMemo(
    () =>
      Number(
        statement
          .filter((tx) => tx.direction === "DEBIT" && isInRange(tx.createdAt, rangeStart, now))
          .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
          .toFixed(2),
      ),
    [statement, rangeStart, now],
  );
  const previousSpentBalance = useMemo(
    () =>
      Number(
        statement
          .filter((tx) => tx.direction === "DEBIT" && isInRange(tx.createdAt, prevRangeStart, prevRangeEnd))
          .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
          .toFixed(2),
      ),
    [statement, prevRangeStart, prevRangeEnd],
  );
  const spentBalanceDelta = deltaPct(currentSpentBalance, previousSpentBalance);

  const businessTrendData = useMemo(() => {
    const monthCount =
      rangeKey === "1M" ? 1 : rangeKey === "3M" ? 3 : rangeKey === "6M" ? 6 : rangeKey === "1Y" ? 12 : 6;
    const labels: string[] = [];
    const values: number[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);

      labels.push(d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }));
      const bucket = invoices.filter((inv) =>
        isInRange(inv.createdAt, d, new Date(next.getTime() - 1)),
      );
      const monthValue = bucket.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
      values.push(Number(monthValue.toFixed(2)));
    }

    return {
      labels,
      values,
      monthCount,
      totalValue: Number(values.reduce((sum, value) => sum + value, 0).toFixed(2)),
    };
  }, [invoices, rangeKey]);

  const policyDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of currentInvoices) {
      const label = getProductLabel(inv) || "Unknown";
      map.set(label, (map.get(label) || 0) + 1);
    }
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return entries.map(([label, count]) => ({
      label,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
  }, [currentInvoices]);

  const pieCreatedBreakdown = useMemo(() => {
    const sourceInvoices = currentInvoices;
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getDay();
    const diffToMonday = (day + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const daily = sourceInvoices.filter((inv) => isInRange(inv.createdAt, startOfToday, now)).length;
    const weekly = sourceInvoices.filter((inv) => isInRange(inv.createdAt, startOfWeek, now)).length;
    const monthly = sourceInvoices.filter((inv) => isInRange(inv.createdAt, startOfMonth, now)).length;

    const rows = [
      { label: "Daily", value: daily },
      { label: "Weekly", value: weekly },
      { label: "Monthly", value: monthly },
    ];
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows.map((row) => ({
      ...row,
      percent: total > 0 ? Number(((row.value / total) * 100).toFixed(1)) : 0,
    }));
  }, [currentInvoices, now]);

  const pieBusinessBreakdown = useMemo(() => {
    const sourceInvoices = currentInvoices;
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getDay();
    const diffToMonday = (day + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sumAmount = (from: Date) =>
      sourceInvoices
        .filter((inv) => isInRange(inv.createdAt, from, now))
        .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

    const daily = Number(sumAmount(startOfToday).toFixed(2));
    const weekly = Number(sumAmount(startOfWeek).toFixed(2));
    const monthly = Number(sumAmount(startOfMonth).toFixed(2));

    const rows = [
      { label: "Daily", value: daily },
      { label: "Weekly", value: weekly },
      { label: "Monthly", value: monthly },
    ];
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows.map((row) => ({
      ...row,
      percent: total > 0 ? Number(((row.value / total) * 100).toFixed(1)) : 0,
    }));
  }, [currentInvoices, now]);

  const pieProductBreakdown = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const inv of currentInvoices) {
      const label = getProductLabel(inv) || "Others";
      byProduct.set(label, (byProduct.get(label) || 0) + (Number(inv.amount) || 0));
    }
    const rows = Array.from(byProduct.entries())
      .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows.map((row) => ({
      ...row,
      percent: total > 0 ? Number(((row.value / total) * 100).toFixed(1)) : 0,
    }));
  }, [currentInvoices]);

  const usedBalanceFallback = Number(Math.max(0, invoiceDebitTotal - invoiceRefundTotal).toFixed(2));
  const usedBalanceValue = Number(wallet?.usedBalance ?? usedBalanceFallback ?? 0);
  const totalBalanceValue = Number(wallet?.totalBalance ?? (Number(wallet?.availableBalance || 0) + usedBalanceValue));

  const filteredStatement = useMemo(() => {
    const q = walletSearch.trim().toLowerCase();
    return statement
      .filter((tx) => {
        if (walletTxnFilter === "CREDITS" && tx.direction !== "CREDIT") return false;
        if (walletTxnFilter === "DEBITS" && tx.direction !== "DEBIT") return false;
        if (!q) return true;
        const hay = `${tx.narration || ""} ${tx.type || ""} ${tx.referenceId || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
  }, [statement, walletSearch, walletTxnFilter]);

  const navItems: Array<{ key: DashboardTab; label: string }> = [
    { key: "overview", label: "Overview" },
    ...(hasWalletAccess ? [{ key: "wallet" as DashboardTab, label: "Wallet" }] : []),
    { key: "claims", label: "My Claims" },
    { key: "policies", label: "My Policies" },
  ];
  const unreadInvoiceNotificationCount = invoiceNotifications.filter((n) => !n.isRead).length;

  const markAllInvoiceNotificationsAsRead = () => {
    setInvoiceNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <ProtectedRoute allowedIdentities={["TRANSPORTER"]}>
      <div className="min-h-screen bg-[#eef2f7] text-slate-900">
        <div className="flex min-h-screen">
          <aside className="sticky top-0 hidden h-screen w-[280px] border-r border-[#1b3158] bg-gradient-to-b from-[#071a35] to-[#041227] text-slate-100 lg:flex lg:flex-col">
            <div className="border-b border-white/10 px-6 py-8">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-white">Mandi</span>
                <span className="bg-gradient-to-r from-[#6d1cff] to-[#9d33ff] bg-clip-text text-transparent">Plus</span>
              </h1>
              <p className="mt-1 text-sm text-slate-300">Transporter Dashboard</p>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeTab === item.key
                      ? "bg-[#1155b8] text-white shadow-lg shadow-[#1155b8]/30"
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

          <main className="min-w-0 flex-1 bg-[#eef2f7]">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
              <div className="mx-auto w-full max-w-[1560px] space-y-3 px-3 py-3 sm:px-4 sm:py-4">
                <div className="flex items-start justify-between gap-2 lg:items-center">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(true)}
                      className="mt-1 grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 lg:hidden"
                      aria-label="Open menu"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                    <div>
                      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                        Welcome, {user?.name || "User"}
                      </h2>
                      <p className="text-sm text-slate-600 sm:text-base">Here&apos;s your insurance overview for today</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 bg-[#dbeafe] text-sm font-bold text-[#1155b8] lg:hidden">
                      {(user?.name || "NK").slice(0, 2).toUpperCase()}
                    </button>

                    <div className="hidden items-center justify-end gap-3 lg:flex">
                      <button className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 bg-slate-100 text-slate-600">{"\u2315"}</button>
                      <div className="relative" ref={notificationPanelRef}>
                        <button
                          type="button"
                          onClick={() => setNotificationOpen((prev) => !prev)}
                          className="relative grid h-11 w-11 place-items-center rounded-full border border-slate-300 bg-slate-100 text-slate-600"
                          aria-label="Open invoice notifications"
                          title="Invoice notifications"
                        >
                          {"\u23F0"}
                          {unreadInvoiceNotificationCount > 0 && (
                            <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                              {unreadInvoiceNotificationCount > 9 ? "9+" : unreadInvoiceNotificationCount}
                            </span>
                          )}
                        </button>
                        {notificationOpen && (
                          <div className="absolute right-0 top-14 z-50 w-[360px] max-w-[85vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                              <p className="text-sm font-bold text-slate-900">Invoice Notifications</p>
                              <button
                                type="button"
                                onClick={markAllInvoiceNotificationsAsRead}
                                className="text-xs font-semibold text-[#1155b8] hover:underline"
                              >
                                Mark all read
                              </button>
                            </div>
                            <div className="max-h-[320px] overflow-y-auto">
                              {invoiceNotifications.length === 0 ? (
                                <p className="px-4 py-6 text-sm text-slate-500">No new invoice notifications yet.</p>
                              ) : (
                                invoiceNotifications.map((n) => (
                                  <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => {
                                      setInvoiceNotifications((prev) =>
                                        prev.map((item) =>
                                          item.id === n.id ? { ...item, isRead: true } : item,
                                        ),
                                      );
                                      setActiveTab("policies");
                                      setNotificationOpen(false);
                                    }}
                                    className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                                      n.isRead ? "bg-white" : "bg-blue-50/70"
                                    }`}
                                  >
                                    <p className="text-sm font-semibold text-slate-900">
                                      New invoice created: {n.invoiceNumber}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">
                                      {n.createdAt ? formatDateTime(n.createdAt) : "Just now"}
                                    </p>
                                  </button>
                                ))
                              )}
                            </div>
                            {invoiceNotifications.length > 0 && (
                              <div className="flex justify-end border-t border-slate-200 px-4 py-2">
                                <button
                                  type="button"
                                  onClick={() => setInvoiceNotifications([])}
                                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                                >
                                  Clear all
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {hasWalletAccess && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("wallet")}
                          className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-1.5 text-right shadow-sm transition hover:border-[#1155b8] hover:bg-white"
                          title="Open wallet"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Wallet</p>
                          <p className="text-xl font-extrabold text-slate-900">{formatCurrency(wallet?.availableBalance ?? 0)}</p>
                        </button>
                      )}
                      <button
                        onClick={() => setSupportOpen(true)}
                        className="grid h-11 w-11 place-items-center rounded-full bg-[#1155b8] text-white shadow-md transition hover:bg-[#0e4da7]"
                        aria-label="Open support"
                        title="Support"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M4.5 11.5a7.5 7.5 0 1 1 15 0"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M5.5 10.5h1.25A2.25 2.25 0 0 1 9 12.75v3A2.25 2.25 0 0 1 6.75 18H5.5A1.5 1.5 0 0 1 4 16.5V12a1.5 1.5 0 0 1 1.5-1.5Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M18.5 10.5h-1.25A2.25 2.25 0 0 0 15 12.75v3A2.25 2.25 0 0 0 17.25 18h1.25A1.5 1.5 0 0 0 20 16.5V12a1.5 1.5 0 0 0-1.5-1.5Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M9.5 19.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 bg-[#dbeafe] text-sm font-bold text-[#1155b8]">
                        {(user?.name || "NK").slice(0, 2).toUpperCase()}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 lg:hidden">
                  {hasWalletAccess && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("wallet")}
                      className="flex-1 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-left shadow-sm transition hover:border-[#1155b8] hover:bg-white"
                      title="Open wallet"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Wallet</p>
                      <p className="text-lg font-extrabold text-slate-900">{formatCurrency(wallet?.availableBalance ?? 0)}</p>
                    </button>
                  )}
                  <button
                    onClick={() => setSupportOpen(true)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1155b8] text-white shadow-md transition hover:bg-[#0e4da7]"
                    aria-label="Open support"
                    title="Support"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M4.5 11.5a7.5 7.5 0 1 1 15 0"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5.5 10.5h1.25A2.25 2.25 0 0 1 9 12.75v3A2.25 2.25 0 0 1 6.75 18H5.5A1.5 1.5 0 0 1 4 16.5V12a1.5 1.5 0 0 1 1.5-1.5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M18.5 10.5h-1.25A2.25 2.25 0 0 0 15 12.75v3A2.25 2.25 0 0 0 17.25 18h1.25A1.5 1.5 0 0 0 20 16.5V12a1.5 1.5 0 0 0-1.5-1.5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M9.5 19.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {browserNotificationSupported &&
                  browserNotificationPermission === "default" &&
                  showBrowserNotificationPrompt && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                      <p className="text-sm font-medium text-blue-900">
                        Enable browser notifications to get instant alerts for new invoices.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={requestBrowserNotificationPermission}
                          className="rounded-lg bg-[#1155b8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0e4da7]"
                        >
                          Enable notifications
                        </button>
                        <button
                          type="button"
                          onClick={dismissBrowserNotificationPrompt}
                          className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100"
                        >
                          Not now
                        </button>
                      </div>
                    </div>
                  )}

              </div>
            </header>

            {mobileMenuOpen && (
              <>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="fixed inset-0 z-30 bg-black/40 lg:hidden"
                  aria-label="Close menu"
                />
                <aside className="fixed left-0 top-0 z-40 flex h-screen w-[280px] max-w-[84vw] flex-col border-r border-[#1b3158] bg-gradient-to-b from-[#071a35] to-[#041227] text-slate-100 lg:hidden">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-5">
                    <div>
                      <h1 className="text-2xl font-extrabold tracking-tight">
                        <span className="text-white">Mandi</span>
                        <span className="bg-gradient-to-r from-[#6d1cff] to-[#9d33ff] bg-clip-text text-transparent">Plus</span>
                      </h1>
                      <p className="mt-1 text-xs text-slate-300">Transporter Dashboard</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-md px-2 py-1 text-slate-300 hover:bg-white/10"
                      aria-label="Close menu"
                    >
                      X
                    </button>
                  </div>
                  <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
                    {navItems.map((item) => (
                      <button
                        key={`drawer-${item.key}`}
                        onClick={() => {
                          setActiveTab(item.key);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                          activeTab === item.key
                            ? "bg-[#1155b8] text-white shadow-lg shadow-[#1155b8]/30"
                            : "text-slate-200 hover:bg-white/10"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </nav>
                  <div className="p-4">
                    <button
                      onClick={logout}
                      className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Logout
                    </button>
                  </div>
                </aside>
              </>
            )}

            <div className="mx-auto w-full max-w-[1560px] space-y-5 px-3 py-4 sm:px-4 sm:py-5">
              {activeTab === "overview" && (
                <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
                  <div className="flex justify-start sm:justify-end">
                    <div className="rounded-2xl border border-slate-300 bg-white p-1">
                      <div className="flex flex-wrap items-center gap-1 text-sm">
                        {RANGE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setRangeKey(opt)}
                            className={`rounded-xl px-3 py-1.5 ${rangeKey === opt ? "bg-[#1155b8] font-semibold text-white" : "text-slate-600"}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total Invoices" value={currentInvoices.length} accent="blue" delta={totalFormsDelta} />
                    <StatCard label="Total Business" value={currentBusinessValue} accent="green" delta={totalBusinessDelta} valueFormatter={formatCurrency} />
                    <StatCard label="Total Claims" value={currentClaims.length} accent="green" delta={totalClaimsDelta} />
                    <StatCard label="Total Spent Balance" value={usedBalanceValue} accent="orange" delta={spentBalanceDelta} valueFormatter={formatCurrency} />
                  </section>

                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Analytics</h3>
                        <p className="text-base text-slate-600 sm:text-lg">Performance insights and trends</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h4 className="text-xl font-bold text-slate-900 sm:text-2xl">Monthly Business Trend</h4>
                            <p className="text-sm text-slate-500 sm:text-base">Business value from invoice amount ({businessTrendData.monthCount} months)</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-sm text-slate-500">Business Value ({rangeKey})</p>
                            <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{formatCurrency(businessTrendData.totalValue)}</p>
                          </div>
                        </div>
                        <MonthlyBusinessTrendChart labels={businessTrendData.labels} values={businessTrendData.values} />
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h4 className="text-xl font-bold text-slate-900 sm:text-2xl">Policy Distribution</h4>
                            <p className="text-sm text-slate-500 sm:text-base">Breakdown by insurance type</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-sm text-slate-500">Active Policies ({rangeKey})</p>
                            <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{currentInvoices.length}</p>
                          </div>
                        </div>
                        <PolicyDonutChart items={policyDistribution} />
                      </div>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Pie Chart Analytics</h3>
                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <DonutAnalyticsCard
                          title="Invoice Created (Daily/Weekly/Monthly)"
                          subtitle="Hover to view absolute values and share percentage"
                          items={pieCreatedBreakdown}
                        />
                        <DonutAnalyticsCard
                          title="Invoice Business Value (Daily/Weekly/Monthly)"
                          subtitle="Based on invoice amount values"
                          items={pieBusinessBreakdown}
                          valueFormatter={(value) => formatCurrency(value)}
                        />
                        <DonutAnalyticsCard
                          title="Product Category Business Distribution"
                          subtitle={`For selected range (${rangeKey})`}
                          items={pieProductBreakdown}
                          valueFormatter={(value) => formatCurrency(value)}
                        />
                      </div>
                    </div>
                  </section>
                </section>
              )}

              {hasWalletAccess && activeTab === "wallet" && (
                <section className="space-y-4 rounded-3xl bg-[#ede7ff] p-4 lg:p-5">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
                    <div className="rounded-3xl bg-[#1555b7] p-5 text-white shadow-lg">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Available Balance</p>
                      <p className="mt-1 text-3xl font-extrabold sm:text-4xl">{formatCurrency(wallet?.availableBalance ?? 0)}</p>
                      <p className="mt-1 text-sm text-blue-100">
                        Last updated: {wallet?.updatedAt ? formatDate(wallet.updatedAt) : "-"}
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-white/10 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-100">Used Balance</p>
                          <p className="mt-1 text-2xl font-bold">{formatCurrency(usedBalanceValue)}</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-100">Total Balance</p>
                          <p className="mt-1 text-2xl font-bold">{formatCurrency(totalBalanceValue)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Total Credits</p>
                        <p className="mt-1 text-3xl font-extrabold text-[#0f2547]">{formatCurrency(totalCreditsDisplay)}</p>
                      </div>
                      <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Total Debits</p>
                        <p className="mt-1 text-3xl font-extrabold text-[#0f2547]">{formatCurrency(totalDebitsDisplay)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 md:px-5">
                      <div>
                        <h4 className="text-2xl font-bold text-slate-900">Transaction History</h4>
                        <p className="text-sm text-slate-600">{filteredStatement.length} transactions found</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          <span>{"⌕"}</span>
                          <input
                            value={walletSearch}
                            onChange={(e) => setWalletSearch(e.target.value)}
                            placeholder="Search transactions..."
                            className="h-6 w-36 bg-transparent outline-none placeholder:text-slate-400 sm:w-44"
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
                          className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {exportingStatement ? "Exporting..." : "Export"}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 md:px-5">
                      <button
                        onClick={() => setWalletTxnFilter("ALL")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${walletTxnFilter === "ALL" ? "bg-[#1155b8] text-white" : "bg-slate-100 text-slate-700"}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setWalletTxnFilter("CREDITS")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${walletTxnFilter === "CREDITS" ? "bg-[#1155b8] text-white" : "bg-slate-100 text-slate-700"}`}
                      >
                        Credits
                      </button>
                      <button
                        onClick={() => setWalletTxnFilter("DEBITS")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${walletTxnFilter === "DEBITS" ? "bg-[#1155b8] text-white" : "bg-slate-100 text-slate-700"}`}
                      >
                        Debits
                      </button>
                    </div>

                    <div className="max-h-[420px] overflow-auto">
                      {filteredStatement.length === 0 ? (
                        <div className="px-5 py-12 text-center text-sm text-slate-500">No transactions found</div>
                      ) : (
                        filteredStatement.map((tx) => {
                          const isCredit = tx.direction === "CREDIT";
                          return (
                            <div key={tx.id} className="flex flex-col items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row md:px-5">
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-full text-sm ${isCredit ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                  {isCredit ? "↗" : "↘"}
                                </div>
                                <div>
                                  <p className="text-base font-semibold text-slate-900">{tx.narration || tx.type || "Wallet transaction"}</p>
                                  {tx.remark ? (
                                    <p className="mt-1 text-xs text-slate-500">{tx.remark}</p>
                                  ) : null}
                                  {tx.attachmentUrl ? (
                                    <a
                                      href={tx.attachmentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline"
                                    >
                                      View image
                                    </a>
                                  ) : null}
                                  <p className="text-xs text-slate-500">{formatDateTime(tx.createdAt)}</p>
                                </div>
                              </div>

                              <div className="text-left sm:text-right">
                                <p className={`text-xl font-extrabold sm:text-2xl ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                                  {isCredit ? "+" : "-"}{formatCurrency(Number(tx.amount || 0)).replace(/₹/g, "")}
                                </p>
                                <p className="text-xs text-slate-500">{isCredit ? "Credit" : "Debit"}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "claims" && (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-2xl font-bold text-slate-900">My Claims</h3>
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
                            getTransporterDashboardClaims().catch(() => []),
                          ]);
                          const refreshedClaimsMap = new Map<string, ClaimRequest>();
                          for (const c of refreshedOwnClaims) refreshedClaimsMap.set(c.id, c);
                          for (const c of refreshedCustomerClaims) refreshedClaimsMap.set(c.id, c);
                          const refreshedClaims = Array.from(refreshedClaimsMap.values()).sort((a, b) => {
                            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return tb - ta;
                          });
                          setClaims(refreshedClaims);
                        } catch (err: any) {
                          const msg = err?.message || err?.response?.data?.message || "Failed to create claim request.";
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
                        className="h-10 w-full sm:w-80 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#1155b8] focus:ring-2 focus:ring-[#1155b8]/20"
                      />
                      <button
                        type="submit"
                        disabled={creatingClaim || !newClaimTruckNo.trim()}
                        className="h-10 rounded-xl bg-[#1155b8] px-4 text-sm font-semibold text-white hover:bg-[#0e4da7] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatingClaim ? "Creating..." : "Create Claim Request"}
                      </button>
                    </form>
                  </div>

                  {claimActionMessage && (
                    <p className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                      {claimActionMessage}
                    </p>
                  )}

                  {claims.length === 0 ? (
                    <div className="grid min-h-[420px] place-items-center">
                      <div className="text-center">
                        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-xl text-slate-500">{"\uD83D\uDCC4"}</div>
                        <h4 className="text-2xl font-bold text-slate-900">My Claims</h4>
                        <p className="mt-2 text-base text-slate-500">No claims found yet</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b text-slate-600">
                            <th className="px-3 py-3 font-semibold">Invoice Number</th>
                            <th className="px-3 py-3 font-semibold">Date</th>
                            <th className="px-3 py-3 font-semibold">Vehicle</th>
                            <th className="px-3 py-3 font-semibold">Status</th>
                            <th className="px-3 py-3 font-semibold">Claim PDF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claims.map((claim) => (
                            <tr key={claim.id} className="border-b last:border-none">
                              <td className="px-3 py-3.5">{claim.invoice?.invoiceNumber || "-"}</td>
                              <td className="px-3 py-3.5">{formatDate(claim.createdAt)}</td>
                              <td className="px-3 py-3.5">{claim.invoice?.vehicleNumber || "-"}</td>
                              <td className="px-3 py-3.5">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{claim.status}</span>
                              </td>
                              <td className="px-3 py-3.5">
                                {claim.claimFormUrl ? (
                                  <a href={claim.claimFormUrl} target="_blank" className="text-[#1155b8] hover:underline">Open PDF</a>
                                ) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {activeTab === "policies" && (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-2xl font-bold text-slate-900">My Policies</h3>
                    <button
                      onClick={() => {
                        setBotView("createNew");
                        setBotStage("question");
                        setBotOpen(true);
                      }}
                      className="h-10 rounded-xl bg-[#1155b8] px-4 text-sm font-semibold text-white shadow-sm"
                    >
                      Create New
                    </button>
                  </div>

                  {invoices.length === 0 ? (
                    <div className="grid min-h-[420px] place-items-center">
                      <div className="text-center">
                        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-xl text-slate-500">{"\uD83D\uDEE1"}</div>
                        <h4 className="text-2xl font-bold text-slate-900">My Policies</h4>
                        <p className="mt-2 text-base text-slate-500">Policy management coming soon</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b text-slate-600">
                            <th className="px-3 py-3 font-semibold">Invoice Number</th>
                            <th className="px-3 py-3 font-semibold">Date</th>
                            <th className="px-3 py-3 font-semibold">Product</th>
                            <th className="px-3 py-3 font-semibold">Vehicle</th>
                            <th className="px-3 py-3 font-semibold">Amount</th>
                            <th className="px-3 py-3 font-semibold">Premium Amount</th>
                            <th className="px-3 py-3 font-semibold">PDF</th>
                            <th className="px-3 py-3 font-semibold">Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="border-b last:border-none">
                              <td className="px-3 py-3.5 font-semibold text-slate-900">{inv.invoiceNumber}</td>
                              <td className="px-3 py-3.5">{formatDate(inv.createdAt)}</td>
                              <td className="px-3 py-3.5">{getProductLabel(inv)}</td>
                              <td className="px-3 py-3.5">{inv.vehicleNumber || inv.truckNumber || "-"}</td>
                              <td className="px-3 py-3.5">{formatCurrency(Number(inv.amount || 0))}</td>
                              <td className="px-3 py-3.5">{formatCurrency(getPremiumAmount(inv))}</td>
                              <td className="px-3 py-3.5">
                                {inv.pdfUrl || inv.pdfURL ? (
                                  <a href={inv.pdfUrl || inv.pdfURL} target="_blank" className="text-[#1155b8] hover:underline">View PDF</a>
                                 ) : (
                                  <span className="text-slate-400">Generating...</span>
                                )}
                              </td>
                              <td className="px-3 py-3.5">
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
                                  className="rounded-lg border border-[#1155b8] px-3 py-1 text-[#1155b8] transition hover:bg-[#1155b8] hover:text-white"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                  <p className="text-sm text-slate-600">+91 99001 86757</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Email</p>
                  <p className="text-sm text-slate-600">support@mandiplus.com</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">WhatsApp</p>
                  <a
                    href="https://wa.me/919900186757"
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
          <div className="fixed bottom-24 left-3 right-3 z-40 w-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:left-auto sm:right-5 sm:w-[380px] sm:max-w-[calc(100vw-24px)]">
            <div className="flex items-center justify-between bg-[#1155b8] px-4 py-3 text-white">
              <div>
                <p className="text-2xl font-bold leading-none">MandiPlus Assistant</p>
                <p className="mt-1 text-sm text-blue-100">Your live dashboard helper</p>
              </div>
              <button
                onClick={() => setBotOpen(false)}
                className="rounded-md px-2 py-1 text-blue-100 hover:bg-white/10"
              >
                X
              </button>
            </div>
            {botStage === "question" ? (
              <div className="max-h-[62vh] overflow-y-auto bg-[#f8f6f3] p-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-800">Hi! What do you want to do right now?</p>
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
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Know Vehicle
                    </button>
                    <button
                      onClick={() => {
                        setBotView("createNew");
                        setBotStage("view");
                      }}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
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
                className="h-[60vh] w-full"
              />
            )}
          </div>
        )}

        {botGreetingVisible && !botOpen && (
          <div className="fixed bottom-24 right-3 z-40 w-[min(340px,calc(100vw-24px))] rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl sm:right-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700">
                <span className="text-sm font-bold">AI</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">MandiPlus Assistant</p>
                <p className="mt-1 text-sm text-slate-700">Hi, I am here to help you. Tap to explore quick actions.</p>
              </div>
              <button
                onClick={() => setBotGreetingVisible(false)}
                className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Dismiss assistant greeting"
                type="button"
              >
                X
              </button>
            </div>
            <button
              onClick={() => {
                setBotGreetingVisible(false);
                setBotStage("question");
                setBotOpen(true);
              }}
              className="mt-3 w-full rounded-xl bg-[#1155b8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0e4da7]"
              type="button"
            >
              Open Assistant
            </button>
          </div>
        )}

        <div className="fixed bottom-4 right-4 z-40 sm:bottom-5 sm:right-5">
          <button
            onClick={() => {
              setBotStage("question");
              setBotOpen((prev) => !prev);
            }}
            className={`relative grid h-14 w-14 place-items-center rounded-full text-white transition sm:h-16 sm:w-16 ${
              botOpen
                ? "scale-[0.98] bg-[#0e4da7]"
                : "bg-[#1155b8] hover:bg-[#0e4da7]"
            }`}
            style={{
              boxShadow:
                "0 14px 28px rgba(17,85,184,0.38), inset 0 1px 0 rgba(255,255,255,0.22)",
            }}
            aria-label="Open assistant"
            title="Assistant"
            type="button"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(17,85,184,0.22) 0%, rgba(17,85,184,0.12) 45%, rgba(17,85,184,0.05) 68%, rgba(17,85,184,0) 78%)",
              }}
            />
            <svg
              viewBox="0 0 24 24"
              className="relative h-7 w-7 sm:h-8 sm:w-8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 4.75c-4.28 0-7.75 3.11-7.75 6.95 0 2.09 1.03 3.97 2.66 5.25-.1 1.02-.54 2.02-1.28 2.74-.19.19-.07.52.2.55 1.66.15 3.1-.46 4.17-1.37.63.16 1.3.25 2 .25 4.28 0 7.75-3.11 7.75-6.95S16.28 4.75 12 4.75Z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function StatCard({
  label,
  value,
  accent,
  delta,
  valueFormatter,
}: {
  label: string;
  value: number;
  accent: "blue" | "green" | "orange";
  delta?: number | null;
  valueFormatter?: (value: number) => string;
}) {
  const styles = {
    blue: "border-[#bfd4f8] bg-[#f9fbff]",
    green: "border-[#ccead7] bg-[#f8fdf9]",
    orange: "border-[#f3dccf] bg-[#fffaf8]",
  } as const;

  const deltaLabel =
    delta === null || delta === undefined
      ? "No previous period"
      : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% from previous`;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${styles[accent]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
        {valueFormatter ? valueFormatter(value) : value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{deltaLabel}</p>
    </div>
  );
}

function MonthlyBusinessTrendChart({
  labels,
  values,
}: {
  labels: string[];
  values: number[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 640;
  const height = 260;
  const left = 46;
  const right = 16;
  const top = 18;
  const bottom = 44;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const maxValue = Math.max(...values, 1);
  const stepX = values.length > 1 ? innerW / (values.length - 1) : innerW;

  const formatAxis = (value: number) => {
    if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return `${Math.round(value)}`;
  };

  const points = values.map((value, i) => {
    const x = left + i * stepX;
    const y = top + innerH - (value / maxValue) * innerH;
    return { x, y, value };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const activeIndex = hoveredIndex;
  const findClosestIndex = (svgX: number) => {
    if (!points.length) return null;
    let idx = 0;
    let minDiff = Math.abs(points[0].x - svgX);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        idx = i;
      }
    }
    return idx;
  };

  return (
    <div className="overflow-x-auto rounded-2xl bg-slate-50 p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[640px] w-full"
        onMouseMove={(e) => {
          const bounds = e.currentTarget.getBoundingClientRect();
          const relativeX = e.clientX - bounds.left;
          const svgX = (relativeX / bounds.width) * width;
          setHoveredIndex(findClosestIndex(svgX));
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {yTicks.map((tick) => {
          const y = top + innerH - tick * innerH;
          const value = maxValue * tick;
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="#d8dee8" strokeDasharray="4 4" />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {formatAxis(value)}
              </text>
            </g>
          );
        })}

        {points.map((point, i) => (
          <line
            key={`v-${i}`}
            x1={point.x}
            y1={top}
            x2={point.x}
            y2={top + innerH}
            stroke="#eef2f7"
          />
        ))}

        <polyline fill="none" stroke="#1d4ed8" strokeWidth="3" points={polyline} />

        {activeIndex !== null && points[activeIndex] && (
          <>
            <line
              x1={points[activeIndex].x}
              y1={top}
              x2={points[activeIndex].x}
              y2={top + innerH}
              stroke="#94a3b8"
              strokeDasharray="4 4"
            />
            <g>
              <rect
                x={Math.max(left, Math.min(points[activeIndex].x - 86, width - right - 172))}
                y={Math.max(top, points[activeIndex].y - 60)}
                rx="10"
                ry="10"
                width="172"
                height="48"
                fill="#ffffff"
                stroke="#cbd5e1"
              />
              <text
                x={Math.max(left + 10, Math.min(points[activeIndex].x - 76, width - right - 162))}
                y={Math.max(top + 16, points[activeIndex].y - 44)}
                fontSize="12"
                fontWeight="700"
                fill="#0f172a"
              >
                {labels[activeIndex]}
              </text>
              <text
                x={Math.max(left + 10, Math.min(points[activeIndex].x - 76, width - right - 162))}
                y={Math.max(top + 34, points[activeIndex].y - 26)}
                fontSize="12"
                fill="#0f172a"
              >
                {`Value: ${formatCurrency(points[activeIndex].value)}`}
              </text>
            </g>
          </>
        )}

        {points.map((point, i) => (
          <g key={`p-${i}`}>
            <circle cx={point.x} cy={point.y} r="8" fill="transparent" />
            <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#1d4ed8" strokeWidth="2.5" />
          </g>
        ))}

        {labels.map((label, i) => {
          const x = left + i * stepX;
          return (
            <text key={`x-${label}-${i}`} x={x} y={height - 14} textAnchor="middle" fontSize="11" fill="#64748b">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function DonutAnalyticsCard({
  title,
  subtitle,
  items,
  valueFormatter,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; percent: number }>;
  valueFormatter?: (value: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartId = useId().replace(/:/g, "");
  const palette = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#0891b2"];
  const usableItems = items.length > 0 ? items : [{ label: "No Data", value: 1, percent: 100 }];
  const total = usableItems.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
  const segments = usableItems.map((item, idx) => ({
    ...item,
    color: palette[idx % palette.length],
    ratio: Math.max(0, item.value) / total,
  }));

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 86;
  let angleAcc = -Math.PI / 2;
  const slicePaths = segments.map((segment) => {
    const start = angleAcc;
    const sweep = segment.ratio * Math.PI * 2;
    const end = start + sweep;
    angleAcc = end;

    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { path, segment };
  });
  const singleFullSlice =
    segments.length === 1 && Math.abs(segments[0].ratio - 1) < 0.0001;

  const active = hoveredIndex !== null ? segments[hoveredIndex] : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="text-2xl font-bold leading-none text-slate-900">{title}</h4>
      <p className="mt-2 text-base text-slate-600">{subtitle}</p>

      <div className="mt-4 grid grid-cols-1 items-center gap-5 md:grid-cols-[230px_1fr]">
        <div className="relative mx-auto h-[220px] w-[220px]">
          {active && (
            <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow">
              <p className="font-semibold text-slate-900">{active.label}</p>
              <p className="text-slate-700">
                {valueFormatter ? valueFormatter(active.value) : active.value} ({active.percent}%)
              </p>
            </div>
          )}
          <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
            <defs>
              <radialGradient id={`sphereShine-${chartId}`} cx="32%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
              </radialGradient>
            </defs>
            {singleFullSlice ? (
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={segments[0].color}
                stroke="#ffffff"
                strokeWidth={hoveredIndex === 0 ? 3 : 1.5}
                onMouseEnter={() => setHoveredIndex(0)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ) : (
              slicePaths.map((slice, idx) => (
                <path
                  key={`${slice.segment.label}-${idx}`}
                  d={slice.path}
                  fill={slice.segment.color}
                  stroke="#ffffff"
                  strokeWidth={hoveredIndex === idx ? 3 : 1.5}
                  opacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.45}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))
            )}
            <circle cx={cx} cy={cy} r={r} fill={`url(#sphereShine-${chartId})`} pointerEvents="none" />
          </svg>
        </div>

        <div className="space-y-3">
          {usableItems.map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className={`flex items-center justify-between rounded-2xl px-4 py-3 transition ${
                hoveredIndex === idx ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50"
              }`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: palette[idx % palette.length] }} />
                <span className="text-lg text-slate-800">{item.label}</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">
                  {valueFormatter ? valueFormatter(item.value) : item.value}
                </p>
                <p className="text-sm text-slate-500">{item.percent}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PolicyDonutChart({ items }: { items: Array<{ label: string; count: number; percent: number }> }) {
  if (!items.length) {
    return <div className="grid h-52 place-items-center rounded-2xl bg-slate-50 text-sm text-slate-500">No policy distribution data</div>;
  }

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartId = useId().replace(/:/g, "");
  const palette = ["#1555b7", "#0ea334", "#d86c3f", "#12aebb", "#6b7280"];
  const total = items.reduce((sum, item) => sum + Math.max(0, item.count), 0) || 1;
  const segments = items.map((item, idx) => ({
    ...item,
    color: palette[idx % palette.length],
    ratio: Math.max(0, item.count) / total,
  }));

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  let angleAcc = -Math.PI / 2;
  const paths = segments.map((segment) => {
    const start = angleAcc;
    const sweep = segment.ratio * Math.PI * 2;
    const end = start + sweep;
    angleAcc = end;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = sweep > Math.PI ? 1 : 0;
    return {
      segment,
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
    };
  });
  const singleFullSlice =
    segments.length === 1 && Math.abs(segments[0].ratio - 1) < 0.0001;

  return (
    <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[200px_1fr]">
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          <defs>
            <radialGradient id={`policySphere-${chartId}`} cx="32%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
            </radialGradient>
          </defs>
          {singleFullSlice ? (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={segments[0].color}
              stroke="#ffffff"
              strokeWidth={hoveredIndex === 0 ? 3 : 1.5}
              onMouseEnter={() => setHoveredIndex(0)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ) : (
            paths.map((slice, idx) => (
              <path
                key={`${slice.segment.label}-${idx}`}
                d={slice.path}
                fill={slice.segment.color}
                stroke="#ffffff"
                strokeWidth={hoveredIndex === idx ? 3 : 1.5}
                opacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.45}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))
          )}
          <circle cx={cx} cy={cy} r={r} fill={`url(#policySphere-${chartId})`} pointerEvents="none" />
        </svg>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={`flex items-center justify-between gap-3 rounded-xl px-2 py-1 ${
              hoveredIndex === idx ? "bg-blue-50" : ""
            }`}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: palette[idx % palette.length] }} />
              <span className="text-sm text-slate-700">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-20 rounded-full bg-slate-200">
                <div className="h-2 rounded-full" style={{ width: `${item.percent}%`, backgroundColor: palette[idx % palette.length] }} />
              </div>
              <span className="text-xs font-semibold text-slate-700">{item.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}







