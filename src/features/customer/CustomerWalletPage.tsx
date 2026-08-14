"use client";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Landmark,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  TicketPercent,
  WalletCards,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
  defaultWalletPackCode,
  fallbackWalletPacks,
  reconcileWalletCreditPacks,
} from "./wallet-catalog";

type WalletView = "home" | "add" | "confirm" | "transactions";
type WalletOwnership = "loading" | "owned" | "unowned" | "error";

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
  const [selectedPackId, setSelectedPackId] = useState(defaultWalletPackCode);
  const [quote, setQuote] = useState<WalletCouponQuote | null>(null);
  const [couponNotice, setCouponNotice] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const offersDialogRef = useRef<HTMLElement | null>(null);
  const offersTriggerRef = useRef<HTMLButtonElement | null>(null);
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
      const activePacks = reconcileWalletCreditPacks(
        packsResult.value.packs,
        packsResult.value.catalogVersion,
      );
      setPacks(activePacks);
      setSelectedPackId((current) =>
        activePacks.find(
          (pack) => pack.id === current || pack.code === current,
        )?.id ||
        activePacks.find((pack) => pack.code === defaultWalletPackCode)?.id ||
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
    if (!offersOpen) return;
    const dialog = offersDialogRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const focusableElements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOffersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (!focusable.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleDialogKeys);
    const focusFrame = window.requestAnimationFrame(() => {
      focusableElements()[0]?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeys);
      previouslyFocused?.focus();
    };
  }, [offersOpen]);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) || null,
    [packs, selectedPackId],
  );
  const recommendedPack = useMemo(
    () =>
      packs.find((pack) => pack.code === defaultWalletPackCode) ||
      packs[0] ||
      null,
    [packs],
  );
  const otherPacks = useMemo(
    () =>
      recommendedPack
        ? packs.filter((pack) => pack.id !== recommendedPack.id)
        : packs,
    [packs, recommendedPack],
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
    if (view === "confirm") {
      setView("add");
      setNotice("");
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

  const applySuggestedCoupon = async () => {
    if (!selectedPackId || applyingCoupon) return;
    setApplyingCoupon(true);
    setQuote(null);
    setCouponNotice("");
    try {
      const nextQuote = await quoteCustomerWalletCoupon(
        selectedPackId,
        "MANDI500",
      );
      setQuote(nextQuote);
      setCouponNotice(`You save ${money(nextQuote.discountAmount)}`);
      setOffersOpen(false);
    } catch (error) {
      setCouponNotice(errorText(error, "Coupon valid nahi hai."));
    } finally {
      setApplyingCoupon(false);
    }
  };

  const openPackDetails = (pack: WalletCreditPack) => {
    setSelectedPackId(pack.id);
    setQuote(null);
    setCouponNotice("");
    setNotice("");
    setView("confirm");
  };

  const heading =
    view === "home"
      ? walletOwnership === "unowned"
        ? "Credit pack chunein"
        : "Mera wallet"
      : view === "add"
        ? "Credit pack chunein"
        : view === "confirm"
          ? "Confirm pack"
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
          ) : walletOwnership === "error" ? (
            <section className={styles.walletLoadError} role="alert">
              <span aria-hidden="true">
                <WalletCards size={25} />
              </span>
              <div>
                <strong>Wallet load nahi hua</strong>
                <p>Internet check karke dobara try karein.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadWallet()}
                disabled={loading}
              >
                <RefreshCw size={17} />
                Retry
              </button>
            </section>
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
        <main className={styles.walletPackBody}>
          {recommendedPack ? (
            <section className={styles.walletPackSection}>
              <h2>Recommended</h2>
              <WalletPackCard
                pack={recommendedPack}
                featured
                onClick={() => openPackDetails(recommendedPack)}
              />
            </section>
          ) : null}

          {packs.length ? (
            <section className={styles.walletPackSection}>
              <h2>Other packs</h2>
              <div className={styles.walletPackList}>
                {otherPacks.map((pack) => (
                  <WalletPackCard
                    key={pack.id}
                    pack={pack}
                    onClick={() => openPackDetails(pack)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!loading && packs.length === 0 ? (
            <div className={styles.emptyState}>
              No credit packs available.
            </div>
          ) : null}

          {notice ? <p className={styles.walletError}>{notice}</p> : null}
        </main>
      ) : null}

      {view === "confirm" && selectedPack ? (
        <>
          <main className={styles.walletPackDetailBody}>
            <section className={styles.walletPackReviewCard}>
              <div className={styles.walletPackSummary}>
                <div>
                  <span>Credit</span>
                  <strong>{creditLabel(selectedPack.label)}</strong>
                </div>
                <i aria-hidden="true" />
                <div>
                  <span>Amount</span>
                  <strong>{money(quote?.finalPrice ?? selectedPack.priceAmount)}</strong>
                </div>
              </div>

              <div className={styles.walletBalancePreview}>
                <WalletBalanceRow label="Current credit" value={money(availableBalance)} />
                <i aria-hidden="true" />
                <WalletBalanceRow
                  label="New available credit"
                  value={money(availableBalance + Number(selectedPack.creditAmount || 0))}
                  strong
                />
              </div>
            </section>

            <section className={styles.walletCouponCard}>
              <div className={styles.walletCouponHeader}>
                <h2>Offers &amp; coupons</h2>
                <button
                  ref={offersTriggerRef}
                  type="button"
                  onClick={() => setOffersOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={offersOpen}
                >
                  View all <ChevronRight size={18} />
                </button>
              </div>
              {quote ? (
                <div
                  className={styles.walletCouponApplied}
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 size={21} />
                  <div>
                    <strong>{quote.code} applied</strong>
                    <small>You save {money(quote.discountAmount)}</small>
                  </div>
                </div>
              ) : null}
            </section>

            {selectedPack.priceAmount > 100_000 ? (
              <section className={styles.walletHighValueHint}>
                <Landmark size={21} />
                <p>Available payment methods may depend on your bank.</p>
              </section>
            ) : null}

            {notice ? <p className={styles.walletError}>{notice}</p> : null}
          </main>
          <div className={styles.walletPayDock}>
            {quote ? (
              <div className={styles.walletDiscountSummary}>
                <span>Payable amount</span>
                <p>
                  <s>{money(quote.originalPrice)}</s>
                  <strong>{money(quote.finalPrice)}</strong>
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void startTopup()}
              disabled={!selectedPack || paying}
            >
              {paying ? (
                <LoaderCircle className={styles.walletSpinner} size={22} />
              ) : (
                `Pay ${money(quote?.finalPrice ?? selectedPack.priceAmount)} securely`
              )}
              {!paying ? <ChevronRight size={23} /> : null}
            </button>
            <small>Continue securely with PhonePe</small>
          </div>
          {offersOpen ? (
            <div className={styles.walletOffersOverlay} role="presentation">
              <button
                type="button"
                className={styles.walletOffersBackdrop}
                onClick={() => setOffersOpen(false)}
                aria-label="Close offers"
              />
              <section
                ref={offersDialogRef}
                className={styles.walletOffersSheet}
                role="dialog"
                aria-modal="true"
                aria-labelledby="wallet-offers-title"
                tabIndex={-1}
              >
                <i className={styles.walletOffersHandle} aria-hidden="true" />
                <div className={styles.walletOffersHeader}>
                  <h2 id="wallet-offers-title">Available offers</h2>
                  <button
                    type="button"
                    onClick={() => setOffersOpen(false)}
                    aria-label="Close offers"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className={styles.walletOfferItem}>
                  <span><TicketPercent size={23} /></span>
                  <div>
                    <strong>Save ₹500 on your credit pack</strong>
                    <small>Use code MANDI500</small>
                  </div>
                  <button
                    type="button"
                    disabled={quote?.code === "MANDI500" || applyingCoupon}
                    onClick={() => void applySuggestedCoupon()}
                  >
                    {quote?.code === "MANDI500"
                      ? "Applied"
                      : applyingCoupon
                        ? "Applying…"
                        : "Apply"}
                  </button>
                </div>
                {couponNotice && !quote ? (
                  <p
                    className={styles.walletCouponError}
                    role="alert"
                    aria-live="assertive"
                  >
                    {couponNotice}
                  </p>
                ) : null}
              </section>
            </div>
          ) : null}
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

function WalletPackCard({
  pack,
  featured = false,
  onClick,
}: {
  pack: WalletCreditPack;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.walletPackCard} ${
        featured ? styles.walletPackCardFeatured : ""
      }`}
      onClick={onClick}
      aria-label={`${creditLabel(pack.label)}, ${money(pack.priceAmount)}, view details`}
    >
      <span>
        <small>CREDIT</small>
        <strong>{creditLabel(pack.label)}</strong>
      </span>
      <b>{money(pack.priceAmount)}</b>
      <ChevronRight size={22} />
    </button>
  );
}

function WalletBalanceRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? styles.walletBalancePreviewStrong : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function creditLabel(label: string) {
  const normalized = String(label || "").trim();
  return normalized.startsWith("₹") ? normalized : `₹${normalized}`;
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
