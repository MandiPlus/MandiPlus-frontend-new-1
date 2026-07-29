"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  LockKeyhole,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { createCustomerWebPaymentCheckout } from "@/features/customer/api";
import { CustomerAppShell } from "./CustomerAppShell";
import { useCustomerAppData } from "./useCustomerAppData";
import {
  getInsuranceUrl,
  getInvoicePdfUrl,
  invoiceDate,
  invoicePayableAmount,
  invoiceProduct,
  invoiceVehicle,
  isCheckoutReady,
  isPaidInvoice,
  isPayableInvoice,
  money,
  readableError,
  type CustomerInvoice,
} from "./utils";
import styles from "./customer-app.module.css";

type PaperTab = "pending" | "policy" | "paid" | "all";
type DocumentKind = "insurance" | "invoice";

export default function CustomerPapersPage({
  defaultTab = "pending",
}: {
  defaultTab?: PaperTab;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const data = useCustomerAppData();
  const queryTab = normalizeTab(params.get("tab"));
  const [tab, setTab] = useState<PaperTab>(queryTab || defaultTab);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(() => dateInput(-30));
  const [to, setTo] = useState(() => dateInput(0));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [paying, setPaying] = useState(false);
  const [documentView, setDocumentView] = useState<{
    invoice: CustomerInvoice;
    kind: DocumentKind;
  } | null>(null);

  useEffect(() => {
    if (queryTab) setTab(queryTab);
  }, [queryTab]);

  const walletBalance = data.wallet?.walletId
    ? Number(data.wallet.availableBalance || 0)
    : 0;

  const pending = useMemo(
    () => data.invoices.filter(isPayableInvoice),
    [data.invoices],
  );
  const checkoutReady = useMemo(
    () => pending.filter(isCheckoutReady),
    [pending],
  );
  const paid = useMemo(
    () => data.invoices.filter(isPaidInvoice),
    [data.invoices],
  );
  const dueTotal = checkoutReady.reduce(
    (total, invoice) => total + invoicePayableAmount(invoice),
    0,
  );

  const source =
    tab === "pending"
      ? pending
      : tab === "policy"
        ? data.invoices
        : tab === "paid"
          ? paid
          : data.invoices;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const start = from ? new Date(`${from}T00:00:00`).getTime() : 0;
    const end = to
      ? new Date(`${to}T23:59:59`).getTime()
      : Number.MAX_SAFE_INTEGER;
    return source.filter((invoice) => {
      const rawDate = invoice.invoiceDate || invoice.createdAt;
      const timestamp = rawDate ? new Date(rawDate).getTime() : end;
      if (
        Number.isFinite(timestamp) &&
        (timestamp < start || timestamp > end)
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        invoice.invoiceNumber,
        invoiceVehicle(invoice),
        invoiceProduct(invoice),
        invoice.supplierName,
        invoice.billToName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [from, search, source, to]);

  const groups = useMemo(() => groupByDisplayDate(rows), [rows]);
  const selectedReady = checkoutReady.filter((invoice) =>
    selected.has(invoice.id),
  );

  const toggleAll = (scope: CustomerInvoice[]) => {
    const visibleReady = scope.filter(isCheckoutReady);
    const allSelected =
      visibleReady.length > 0 &&
      visibleReady.every((invoice) => selected.has(invoice.id));
    setSelected((current) => {
      const next = new Set(current);
      visibleReady.forEach((invoice) =>
        allSelected ? next.delete(invoice.id) : next.add(invoice.id),
      );
      return next;
    });
  };

  const pay = async () => {
    if (!data.invoicesLoaded || data.invoiceError) {
      setNotice("Latest payment details could not be verified. Please retry.");
      return;
    }
    const invoices = selectedReady.length ? selectedReady : checkoutReady;
    if (!invoices.length || paying) {
      setNotice(
        pending.length
          ? "These invoices are awaiting approval. Payment will open after verification."
          : "There is no payment due right now.",
      );
      return;
    }
    setPaying(true);
    setNotice("");
    try {
      const checkout = await createCustomerWebPaymentCheckout(
        invoices.map((invoice) => invoice.id),
        invoices.reduce(
          (total, invoice) => total + invoicePayableAmount(invoice),
          0,
        ),
      );
      if (!checkout.redirectUrl)
        throw new Error("PhonePe checkout URL was not returned.");
      window.location.assign(checkout.redirectUrl);
    } catch (error) {
      const message = readableError(
        error,
        "Could not start PhonePe. Please retry.",
      );
      if (/all selected invoices are already paid/i.test(message)) {
        const query = new URLSearchParams({ source: "wallet" });
        invoices.forEach((invoice) => {
          query.append("invoiceId", invoice.id);
          query.append("invoiceNumber", invoice.invoiceNumber || "");
          query.append("vehicle", invoiceVehicle(invoice));
        });
        router.replace(`/payment/success?${query.toString()}`);
        return;
      }
      setNotice(message);
    } finally {
      setPaying(false);
    }
  };

  const openDocument = (invoice: CustomerInvoice) => {
    const policyUrl = getInsuranceUrl(invoice);
    const invoiceUrl = getInvoicePdfUrl(invoice);
    if (tab === "policy" && isPayableInvoice(invoice)) {
      setTab("pending");
      setSelected(new Set([invoice.id]));
      setNotice("Premium pay karne ke baad insurance policy unlock hogi.");
      return;
    }
    const kind: DocumentKind =
      tab === "policy" || !invoiceUrl ? "insurance" : "invoice";
    const url = kind === "insurance" ? policyUrl : invoiceUrl;
    if (!url) {
      setNotice("This document is still being prepared.");
      return;
    }
    setDocumentView({ invoice, kind });
  };

  if (documentView) {
    return (
      <CustomerDocumentPage
        invoice={documentView.invoice}
        kind={documentView.kind}
        partnerActive={data.partnerActive}
        onBack={() => setDocumentView(null)}
        onKindChange={(kind) =>
          setDocumentView((current) => (current ? { ...current, kind } : null))
        }
      />
    );
  }

  return (
    <CustomerAppShell
      activeTab="pay"
      partnerActive={data.partnerActive}
      showBottomNav={false}
    >
      <header
        className={`${styles.secondaryHeader} ${
          tab !== "policy" ? styles.paymentPageHeader : ""
        }`}
      >
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={() => router.push("/home")}
          aria-label="Back to home"
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>
          {tab === "policy" ? "Insurance dekho!" : "Payments"}
        </h1>
        {tab !== "policy" ? (
          <button
            type="button"
            className={styles.paymentWalletButton}
            onClick={() => router.push("/customer/wallet")}
            aria-label={`Open wallet. Balance ${walletBalance} rupees`}
          >
            <WalletCards size={19} strokeWidth={2.2} />
            <span>{money(walletBalance)}</span>
          </button>
        ) : (
          <span />
        )}
      </header>

      <main className={styles.pageBody}>
        <label className={styles.searchBox}>
          <Search size={22} color="#7b8176" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search insurance, invoice, supplier, vehicle"
          />
        </label>

        <section className={styles.summaryCard}>
          <div className={styles.dateGrid}>
            <div className={styles.dateField}>
              <label htmlFor="papers-from">From</label>
              <span className={styles.dateReadable}>
                {readableFilterDate(from)}
                <CalendarDays size={17} />
              </span>
              <input
                id="papers-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className={styles.dateField}>
              <label htmlFor="papers-to">To</label>
              <span className={styles.dateReadable}>
                {readableFilterDate(to, true)}
                <CalendarDays size={17} />
              </span>
              <input
                id="papers-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.dueRow}>
            <div>
              <div className={styles.dueLabel}>Due amount</div>
              <div className={styles.dueAmount}>
                {!data.invoicesLoaded ? "—" : money(dueTotal)}
              </div>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={
                paying || !data.invoicesLoaded || Boolean(data.invoiceError)
              }
              onClick={() => void pay()}
            >
              {paying ? <RefreshCw size={18} className="animate-spin" /> : null}
              Pay karein
            </button>
          </div>
        </section>

        {data.invoiceError ? (
          <div className={styles.notice}>{data.invoiceError}</div>
        ) : notice ? (
          <div className={styles.notice}>{notice}</div>
        ) : null}

        {!data.invoicesLoaded && data.loading ? (
          <div className={styles.emptyState}>
            {tab === "policy"
              ? "Insurance load ho rahe hain…"
              : "Payments load ho rahe hain…"}
          </div>
        ) : !data.invoicesLoaded ? (
          <div className={styles.emptyState}>
            Payment details load nahi ho paaye. Please retry.
          </div>
        ) : groups.length ? (
          groups.map(([date, invoices]) => (
            <section key={date}>
              <div className={styles.sectionHeading}>
                <span>{date}</span>
                {invoices.some(isCheckoutReady) &&
                (tab === "pending" || tab === "policy") ? (
                  <button
                    type="button"
                    className={styles.selectAll}
                    onClick={() => toggleAll(invoices)}
                  >
                    <span
                      className={`${styles.checkbox} ${
                        invoices.filter(isCheckoutReady).length > 0 &&
                        invoices
                          .filter(isCheckoutReady)
                          .every((invoice) => selected.has(invoice.id))
                          ? styles.checkboxChecked
                          : ""
                      }`}
                    >
                      <Check size={14} />
                    </span>
                    Sab chunein
                  </button>
                ) : null}
              </div>
              <div className={styles.documentList}>
                {invoices.map((invoice) => {
                  const selectable =
                    (tab === "pending" || tab === "policy") &&
                    isCheckoutReady(invoice);
                  const locked = tab === "policy" && isPayableInvoice(invoice);
                  return (
                    <button
                      key={invoice.id}
                      type="button"
                      className={`${styles.documentCard} ${
                        selected.has(invoice.id)
                          ? styles.documentCardSelected
                          : ""
                      }`}
                      onClick={() => {
                        if (selectable) {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(invoice.id)) {
                              next.delete(invoice.id);
                            } else {
                              next.add(invoice.id);
                            }
                            return next;
                          });
                        } else {
                          openDocument(invoice);
                        }
                      }}
                    >
                      <span
                        className={`${styles.documentIcon} ${
                          locked ? styles.documentIconLocked : ""
                        }`}
                      >
                        {locked ? (
                          <LockKeyhole size={23} strokeWidth={2.1} />
                        ) : (
                          <ShieldCheck size={24} strokeWidth={2.1} />
                        )}
                      </span>
                      <span style={{ minWidth: 0, textAlign: "left" }}>
                        <span className={styles.documentTitle}>
                          {invoiceVehicle(invoice)}
                        </span>
                        <span className={styles.documentMeta}>
                          {invoiceProduct(invoice)}
                        </span>
                        <span className={styles.documentMeta}>
                          {invoice.invoiceNumber}
                        </span>
                      </span>
                      {locked ? (
                        <span className={styles.documentDue}>
                          <strong>
                            {money(invoicePayableAmount(invoice))}
                          </strong>
                          <small>Due amount</small>
                        </span>
                      ) : selectable ? (
                        <span
                          className={`${styles.checkbox} ${
                            selected.has(invoice.id)
                              ? styles.checkboxChecked
                              : ""
                          }`}
                        >
                          <Check size={14} />
                        </span>
                      ) : (
                        <ChevronRight size={22} color="#7b8176" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className={styles.emptyState}>
            <div>
              <ShieldCheck size={34} style={{ margin: "0 auto 10px" }} />
              Is range mein koi record nahi mila.
            </div>
          </div>
        )}
      </main>
    </CustomerAppShell>
  );
}

function normalizeTab(value: string | null): PaperTab | null {
  return value === "pending" ||
    value === "policy" ||
    value === "paid" ||
    value === "all"
    ? value
    : null;
}

function dateInput(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function readableFilterDate(value: string, todayLabel = false): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const now = new Date();
  const isToday =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();
  if (todayLabel && isToday) return "Today";
  return `${parsed.getDate()} ${parsed.toLocaleDateString("en-IN", {
    month: "long",
  })}`;
}

function groupByDisplayDate(
  invoices: CustomerInvoice[],
): Array<[string, CustomerInvoice[]]> {
  const groups = new Map<string, CustomerInvoice[]>();
  invoices.forEach((invoice) => {
    const key = invoiceDate(invoice) || "Older";
    const current = groups.get(key) || [];
    current.push(invoice);
    groups.set(key, current);
  });
  return [...groups.entries()];
}

function CustomerDocumentPage({
  invoice,
  kind,
  partnerActive,
  onBack,
  onKindChange,
}: {
  invoice: CustomerInvoice;
  kind: DocumentKind;
  partnerActive: boolean;
  onBack: () => void;
  onKindChange: (kind: DocumentKind) => void;
}) {
  const insuranceUrl = getInsuranceUrl(invoice);
  const invoiceUrl = getInvoicePdfUrl(invoice);
  const documentUrl = kind === "insurance" ? insuranceUrl : invoiceUrl;
  const canSwitch =
    kind === "insurance" ? Boolean(invoiceUrl) : Boolean(insuranceUrl);
  const relatedLabel =
    kind === "insurance" ? "Bill dekhein" : "Insurance dekhein";
  const title = kind === "insurance" ? "Insurance document" : "Document";
  const documentName =
    kind === "insurance"
      ? invoiceVehicle(invoice)
      : invoice.invoiceNumber || invoiceVehicle(invoice);

  const share = async () => {
    const shareData = {
      title,
      text: `${documentName} — MandiPlus`,
      url: documentUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        `${shareData.text}\n${shareData.url}`,
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <CustomerAppShell
      activeTab="pay"
      partnerActive={partnerActive}
      showBottomNav={false}
    >
      <header className={styles.secondaryHeader}>
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={onBack}
          aria-label="Back to insurance list"
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>{title}</h1>
        <span />
      </header>

      <main className={styles.documentViewerBody}>
        <section className={styles.documentViewerInfo}>
          <strong>{documentName}</strong>
          {canSwitch ? (
            <button
              type="button"
              onClick={() =>
                onKindChange(kind === "insurance" ? "invoice" : "insurance")
              }
            >
              {relatedLabel}
            </button>
          ) : null}
        </section>

        <section className={styles.documentViewerFrame}>
          {documentUrl ? (
            <iframe
              key={documentUrl}
              src={`${documentUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={`${title} ${documentName}`}
              loading="lazy"
            />
          ) : (
            <div className={styles.emptyState}>
              Document taiyar ho raha hai.
            </div>
          )}
        </section>
      </main>

      <div className={styles.documentActionBar}>
        <button type="button" onClick={() => void share()}>
          <Share2 size={19} />
          PDF bhejein
        </button>
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
        >
          <Download size={19} />
          Download karein
        </a>
      </div>
    </CustomerAppShell>
  );
}
