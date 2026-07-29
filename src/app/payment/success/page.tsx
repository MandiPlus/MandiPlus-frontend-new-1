"use client";

import {
  ArrowLeft,
  Download,
  LoaderCircle,
  MessageCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getCustomerDashboardInvoices } from "@/features/customer/api";
import {
  clearCustomerInvoicePaymentAttempt,
} from "@/features/customer-app/payment-attempt";
import {
  getInvoicePdfUrl,
  invoiceVehicle,
  type CustomerInvoice,
} from "@/features/customer-app/utils";

import styles from "./payment-success.module.css";

const PDF_POLL_INTERVAL_MS = 1_500;

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const invoiceId = params.get("invoiceId") || "";
  const fallbackInvoiceNumber = params.get("invoiceNumber") || "";
  const fallbackVehicle = params.get("vehicle") || "";
  const [invoice, setInvoice] = useState<CustomerInvoice | null>(null);
  const [loadedPdfUrl, setLoadedPdfUrl] = useState("");
  const [hasLoadedInvoiceList, setHasLoadedInvoiceList] = useState(false);
  const [loadError, setLoadError] = useState("");

  const refreshInvoice = useCallback(async () => {
    if (!invoiceId) return false;
    try {
      const invoices = (await getCustomerDashboardInvoices()) as CustomerInvoice[];
      const latestInvoice =
        invoices.find((candidate) => String(candidate.id) === invoiceId) || null;
      if (latestInvoice) {
        setInvoice(latestInvoice);
        setLoadError("");
      }
      setHasLoadedInvoiceList(true);
      return Boolean(latestInvoice && getInvoicePdfUrl(latestInvoice));
    } catch {
      setHasLoadedInvoiceList(true);
      setLoadError(
        "Invoice details refresh nahi ho paaye. Hum dobara check kar rahe hain.",
      );
      return false;
    }
  }, [invoiceId]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      const pdfReady = await refreshInvoice();
      if (cancelled || pdfReady) return;
      timer = window.setTimeout(poll, PDF_POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [refreshInvoice]);

  const pdfUrl = useMemo(
    () => (invoice ? getInvoicePdfUrl(invoice) : ""),
    [invoice],
  );
  const invoiceNumber =
    String(invoice?.invoiceNumber || fallbackInvoiceNumber).trim() ||
    "Invoice generated";
  const vehicle =
    invoice && invoiceVehicle(invoice) !== "Vehicle not added"
      ? invoiceVehicle(invoice)
      : fallbackVehicle;

  const shareInvoice = async () => {
    if (!pdfUrl) return;
    const shareData = {
      title: invoiceNumber,
      text: `${invoiceNumber}${vehicle ? ` · ${vehicle}` : ""} — MandiPlus`,
      url: pdfUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
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

  const goHome = () => {
    clearCustomerInvoicePaymentAttempt();
    router.replace("/home");
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={goHome}
            aria-label="Back"
          >
            <ArrowLeft size={28} strokeWidth={2.5} />
          </button>
          <h1 className={styles.title}>Invoice generated</h1>
        </header>

        <section className={styles.insuranceBanner}>
          <strong>Insurance ban rha hai</strong>
        </section>

        <section className={styles.invoiceCard}>
          <header className={styles.invoiceHeading}>
            <strong>{vehicle || invoiceNumber}</strong>
          </header>

          <div className={styles.pdfFrame}>
            {pdfUrl ? (
              <iframe
                key={pdfUrl}
                src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                title={`Invoice PDF ${invoiceNumber}`}
                onLoad={() => setLoadedPdfUrl(pdfUrl)}
              />
            ) : null}
            {!pdfUrl || loadedPdfUrl !== pdfUrl ? (
              <div
                className={styles.pdfLoader}
                role="status"
                aria-live="polite"
              >
                <LoaderCircle size={34} />
                <strong>Invoice PDF tayyar ho raha hai...</strong>
                <span>
                  PDF available hote hi yahin automatically dikh jayega.
                </span>
              </div>
            ) : null}
          </div>

          {loadError ? (
            <p className={styles.statusMessage}>{loadError}</p>
          ) : !invoice && hasLoadedInvoiceList ? (
            <p className={styles.statusMessage}>
              Invoice sync ho raha hai. Page khula rakhein.
            </p>
          ) : null}
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={() => void shareInvoice()}
            aria-disabled={!pdfUrl}
            disabled={!pdfUrl}
          >
            <MessageCircle size={23} />
            Send
          </button>
          <a
            className={styles.action}
            href={pdfUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            download
            aria-disabled={!pdfUrl}
          >
            <Download size={23} />
            Download
          </a>
        </div>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
