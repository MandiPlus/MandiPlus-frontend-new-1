"use client";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CustomerAppShell } from "@/features/customer-app/CustomerAppShell";
import styles from "@/features/customer-app/customer-app.module.css";
import {
  createCustomerWalletTopupWebCheckout,
  getCustomerDashboardInvoices,
  getCustomerWalletPacks,
  getMyWalletStatement,
  getMyWalletSummary,
  quoteCustomerWalletCoupon,
  type WalletCouponQuote,
  type WalletCreditPack,
  type WalletStatementItem,
  type WalletSummary,
} from "./api";

type WalletView = "home" | "add" | "transactions";
type WalletOwnership = "loading" | "owned" | "unowned" | "error";

const fallbackWalletPacks: WalletCreditPack[] = [
  {
    id: "limit_50_lakh",
    code: "limit_50_lakh",
    label: "50 Lakhs",
    creditAmount: 5_000_000,
    priceAmount: 10_000,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "limit_1_cr",
    code: "limit_1_cr",
    label: "1 Cr",
    creditAmount: 10_000_000,
    priceAmount: 20_000,
    badge: "Popular",
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "limit_2_cr",
    code: "limit_2_cr",
    label: "2 Cr",
    creditAmount: 20_000_000,
    priceAmount: 40_000,
    sortOrder: 3,
    isActive: true,
  },
];

const defaultWalletPackId = "limit_1_cr";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
  }).format(new Date(value));

const errorText = (error: unknown, fallback: string) => {
  const payload = (
    error as {
      response?: { data?: { message?: string | string[] } };
      message?: string;
    }
  )?.response?.data?.message;
  if (Array.isArray(payload)) return payload.join(", ");
  return payload || (error as Error)?.message || fallback;
};

const transactionTitle = (
  item: WalletStatementItem,
  invoiceVehicles: Record<string, string>,
) => {
  const type = String(item.type || "").toUpperCase();
  if (type === "INVOICE_DEBIT" || type === "INVOICE_REFUND") {
    const vehicleNumber =
      item.invoiceVehicleNumber ||
      invoiceVehicles[String(item.referenceId || "")];
    if (vehicleNumber) return compactVehicleNumber(vehicleNumber);
  }
  return item.narration || item.remark || item.type.replaceAll("_", " ");
};

const compactVehicleNumber = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export default function CustomerWalletPage() {
  const router = useRouter();
  const [view, setView] = useState<WalletView>("home");
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [walletOwnership, setWalletOwnership] =
    useState<WalletOwnership>("loading");
  const [statement, setStatement] = useState<WalletStatementItem[]>([]);
  const [invoiceVehicles, setInvoiceVehicles] = useState<
    Record<string, string>
  >({});
  const [packs, setPacks] = useState<WalletCreditPack[]>(() => [
    ...fallbackWalletPacks,
  ]);
  const [selectedPackId, setSelectedPackId] = useState(defaultWalletPackId);
  const [couponCode, setCouponCode] = useState("");
  const [quote, setQuote] = useState<WalletCouponQuote | null>(null);
  const [couponNotice, setCouponNotice] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState("");

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setWalletOwnership("loading");
    setNotice("");
    const [walletResult, statementResult, packsResult, invoicesResult] =
      await Promise.allSettled([
        getMyWalletSummary(),
        getMyWalletStatement(),
        getCustomerWalletPacks(),
        getCustomerDashboardInvoices(),
      ]);

    if (walletResult.status === "fulfilled") {
      setWallet(walletResult.value);
      setWalletOwnership(
        hasWalletOwnership(walletResult.value) ? "owned" : "unowned",
      );
    } else {
      setWallet(null);
      setWalletOwnership("error");
    }
    if (statementResult.status === "fulfilled") {
      setStatement(statementResult.value);
    }
    if (packsResult.status === "fulfilled") {
      const activePacks = packsResult.value
        .filter((pack) => pack.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      setPacks(activePacks);
      setSelectedPackId((current) =>
        activePacks.some((pack) => pack.id === current)
          ? current
          : activePacks.find((pack) => pack.code === defaultWalletPackId)?.id ||
            activePacks[0]?.id ||
            "",
      );
    }
    if (invoicesResult.status === "fulfilled") {
      const vehicles: Record<string, string> = {};
      invoicesResult.value.forEach((invoice) => {
        const vehicle = String(
          invoice.vehicleNumber || invoice.truckNumber || "",
        ).trim();
        if (!vehicle) return;
        vehicles[invoice.id] = vehicle;
        if (invoice.invoiceNumber) vehicles[invoice.invoiceNumber] = vehicle;
      });
      setInvoiceVehicles(vehicles);
    }
    if (
      walletResult.status === "rejected" &&
      statementResult.status === "rejected" &&
      packsResult.status === "rejected"
    ) {
      setNotice("Wallet abhi load nahi hua. Dobara try karein.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    const normalizedCode = couponCode.trim().toUpperCase();
    if (!normalizedCode) {
      setQuote(null);
      setCouponNotice("");
      return;
    }
    if (!selectedPackId || normalizedCode.length < 3) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextQuote = await quoteCustomerWalletCoupon(
          selectedPackId,
          normalizedCode,
        );
        if (!cancelled) {
          setQuote(nextQuote);
          setCouponNotice(`You save ${money(nextQuote.discountAmount)}`);
        }
      } catch (error) {
        if (!cancelled) {
          setQuote(null);
          setCouponNotice(errorText(error, "Coupon valid nahi hai."));
        }
      }
    }, 550);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [couponCode, selectedPackId]);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) || null,
    [packs, selectedPackId],
  );

  const totalUsed = Number(wallet?.usedBalance || 0);
  const availableBalance = Number(wallet?.availableBalance || 0);
  const totalCredit = Number(wallet?.totalBalance || 0);
  const hasActiveWallet = walletOwnership === "owned";
  const showPackPicker =
    view === "add" || (view === "home" && walletOwnership === "unowned");

  const filteredStatement = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return statement;
    return statement.filter((item) =>
      `${transactionTitle(item, invoiceVehicles)} ${item.type} ${item.amount} ${item.remark || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [invoiceVehicles, search, statement]);

  const goBack = () => {
    if (view === "home") {
      router.push("/home");
      return;
    }
    setView("home");
    setNotice("");
  };

  const startTopup = async () => {
    if (!selectedPack || paying) return;
    setPaying(true);
    setNotice("");
    try {
      const checkout = await createCustomerWalletTopupWebCheckout({
        packId: selectedPack.id,
        couponCode: quote?.code || undefined,
      });
      if (!checkout.redirectUrl) {
        throw new Error("Payment page load nahi hua.");
      }
      window.location.assign(checkout.redirectUrl);
    } catch (error) {
      setNotice(errorText(error, "Payment start nahi hua. Dobara try karein."));
      setPaying(false);
    }
  };

  const heading =
    view === "home"
      ? walletOwnership === "unowned"
        ? "Credit pack chunein"
        : "Mera wallet"
      : view === "add"
        ? "Add money"
        : "All transactions";

  return (
    <CustomerAppShell activeTab="pay" showBottomNav={false}>
      <header className={styles.secondaryHeader}>
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={goBack}
          aria-label="Back"
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>{heading}</h1>
        <span />
      </header>

      {view === "home" && !showPackPicker ? (
        <main className={styles.walletPageBody}>
          {loading || walletOwnership === "loading" ? (
            <div className={`${styles.walletCreditCard} ${styles.skeleton}`}>
              Wallet
            </div>
          ) : hasActiveWallet ? (
            <>
              <section className={styles.walletCreditCard}>
                <h2>MandiPlus Credit</h2>
                <div className={styles.walletBalanceLabel}>Credit balance</div>
                <strong className={styles.walletBalance}>
                  {money(availableBalance)}
                </strong>
                <div className={styles.walletBalanceMeta}>
                  <div>
                    <span>Total credit</span>
                    <strong>{money(totalCredit)}</strong>
                  </div>
                  <i aria-hidden="true" />
                  <div>
                    <span>Used</span>
                    <strong>{money(totalUsed)}</strong>
                  </div>
                </div>
              </section>

              <button
                type="button"
                className={styles.walletActionRow}
                onClick={() => setView("add")}
              >
                <span className={styles.walletActionIcon}>
                  <Plus size={22} />
                </span>
                <strong>Add money</strong>
                <ChevronRight size={22} />
              </button>

              <button
                type="button"
                className={styles.walletActionRow}
                onClick={() => setView("transactions")}
              >
                <span className={styles.walletActionIcon}>
                  <ClipboardList size={21} />
                </span>
                <strong>Transactions dekhein</strong>
                <ChevronRight size={22} />
              </button>
            </>
          ) : null}
          {notice ? <p className={styles.walletError}>{notice}</p> : null}
        </main>
      ) : null}

      {showPackPicker ? (
        <>
          <main className={styles.walletPackBody}>
            <div className={styles.walletPackList}>
              {packs.map((pack) => {
                const selected = pack.id === selectedPackId;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    className={`${styles.walletPackCard} ${
                      selected ? styles.walletPackCardSelected : ""
                    }`}
                    onClick={() => {
                      setSelectedPackId(pack.id);
                      setQuote(null);
                      setCouponNotice("");
                    }}
                  >
                    <span>
                      <small>CREDIT</small>
                      <strong>{pack.label}</strong>
                    </span>
                    {pack.badge ? (
                      <em className={styles.walletPackBadge}>{pack.badge}</em>
                    ) : null}
                    <b>{money(pack.priceAmount)}</b>
                    <i className={styles.walletRadio}>
                      {selected ? <Check size={17} strokeWidth={3} /> : null}
                    </i>
                  </button>
                );
              })}
            </div>

            {!loading && packs.length === 0 ? (
              <div className={styles.emptyState}>
                No credit packs available.
              </div>
            ) : null}

            <section className={styles.walletCouponArea}>
              <p>₹500 off · Use MANDI500</p>
              <input
                value={couponCode}
                onChange={(event) =>
                  setCouponCode(event.target.value.toUpperCase())
                }
                placeholder="Enter coupon"
                autoCapitalize="characters"
                aria-label="Coupon code"
              />
              {couponNotice ? (
                <small className={quote ? styles.walletCouponSuccess : ""}>
                  {couponNotice}
                </small>
              ) : null}
            </section>

            {notice ? <p className={styles.walletError}>{notice}</p> : null}
          </main>

          <div className={styles.walletPayDock}>
            <button
              type="button"
              onClick={() => void startTopup()}
              disabled={!selectedPack || paying}
            >
              {paying ? (
                <LoaderCircle className={styles.walletSpinner} size={22} />
              ) : quote && selectedPack ? (
                <>
                  Pay <s>{money(selectedPack.priceAmount)}</s>{" "}
                  {money(quote.finalPrice)}
                </>
              ) : (
                `Pay ${money(selectedPack?.priceAmount || 0)}`
              )}
              {!paying ? <ChevronRight size={23} /> : null}
            </button>
          </div>
        </>
      ) : null}

      {view === "transactions" ? (
        <main className={styles.walletTransactionBody}>
          <label className={styles.walletSearch}>
            <Search size={21} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by amount, type, or note"
            />
          </label>

          <div className={styles.walletTransactionList}>
            {filteredStatement.map((item) => {
              const isCredit = item.direction === "CREDIT";
              return (
                <article key={item.id} className={styles.walletTransaction}>
                  <span
                    className={`${styles.walletTransactionIcon} ${
                      isCredit ? "" : styles.walletTransactionDebit
                    }`}
                  >
                    {isCredit ? (
                      <ArrowDownLeft size={21} />
                    ) : (
                      <ArrowUpRight size={21} />
                    )}
                  </span>
                  <div>
                    <strong>{transactionTitle(item, invoiceVehicles)}</strong>
                    <small>{shortDate(item.createdAt)}</small>
                  </div>
                  <b className={isCredit ? "" : styles.walletDebitAmount}>
                    {isCredit ? "+" : "-"}
                    {money(item.amount)}
                  </b>
                </article>
              );
            })}
            {!loading && filteredStatement.length === 0 ? (
              <div className={styles.emptyState}>No transactions found.</div>
            ) : null}
          </div>
        </main>
      ) : null}
    </CustomerAppShell>
  );
}

function hasWalletOwnership(wallet: WalletSummary | null) {
  if (!wallet) return false;
  if ("walletId" in wallet) {
    return Boolean(String(wallet.walletId || "").trim());
  }
  return (
    Number(wallet.availableBalance || 0) > 0 ||
    Number(wallet.usedBalance || 0) > 0 ||
    Number(wallet.totalBalance || 0) > 0
  );
}
