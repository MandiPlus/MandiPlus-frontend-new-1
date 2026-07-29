"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Home,
  LoaderCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { CustomerAppShell } from "@/features/customer-app/CustomerAppShell";
import styles from "@/features/customer-app/customer-app.module.css";
import {
  getInvoicePdfUrl,
  invoiceProduct,
  invoiceVehicle,
  type CustomerInvoice,
} from "@/features/customer-app/utils";
import { getCustomerInvoiceById } from "@/features/customer/api";

const MAX_INVOICE_REFRESHES = 8;

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const invoiceId = params.get("invoiceId") || "";
  const paidFromWallet = params.get("source") === "wallet";
  const [invoice, setInvoice] = useState<CustomerInvoice | null>(null);
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [notice, setNotice] = useState(
    invoiceId ? "" : "Invoice reference nahi mila.",
  );

  useEffect(() => {
    if (!invoiceId) return;

    let active = true;
    let timer: number | undefined;

    const loadInvoice = async (attempt: number) => {
      try {
        const nextInvoice = (await getCustomerInvoiceById(
          invoiceId,
        )) as CustomerInvoice;
        if (!active) return;
        setInvoice(nextInvoice);
        setNotice("");
        const hasPdf = Boolean(getInvoicePdfUrl(nextInvoice));
        setLoading(!hasPdf && attempt < MAX_INVOICE_REFRESHES);

        if (!hasPdf && attempt < MAX_INVOICE_REFRESHES) {
          timer = window.setTimeout(() => void loadInvoice(attempt + 1), 1500);
        }
      } catch {
        if (!active) return;
        if (attempt < MAX_INVOICE_REFRESHES) {
          timer = window.setTimeout(() => void loadInvoice(attempt + 1), 1500);
          return;
        }
        setLoading(false);
        setNotice(
          "Payment ho gaya, lekin invoice abhi load nahi hua. Payments mein dobara dekhein.",
        );
      }
    };

    void loadInvoice(0);
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [invoiceId]);

  const pdfUrl = invoice ? getInvoicePdfUrl(invoice) : "";

  return (
    <CustomerAppShell activeTab="create" showBottomNav={false}>
      <header className={styles.secondaryHeader}>
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={() => router.replace("/home")}
          aria-label="Back to home"
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>Invoice generated</h1>
        <span />
      </header>

      <main className={styles.paymentSuccessBody}>
        <section className={styles.paymentSuccessStatus}>
          <CheckCircle2 size={27} strokeWidth={2.4} />
          <div>
            <strong>
              {paidFromWallet
                ? "Wallet se payment ho gaya"
                : "Payment successful"}
            </strong>
            <span>Insurance ban raha hai</span>
          </div>
        </section>

        <section className={styles.paymentInvoicePanel}>
          <div className={styles.paymentInvoiceHeading}>
            <FileText size={22} />
            <div>
              <strong>
                {invoice ? invoiceVehicle(invoice) : "Invoice load ho raha hai"}
              </strong>
              <span>
                {invoice
                  ? `${invoiceProduct(invoice)} · ${invoice.invoiceNumber}`
                  : "Please wait"}
              </span>
            </div>
          </div>

          <div className={styles.paymentInvoiceFrame}>
            {pdfUrl ? (
              <iframe src={pdfUrl} title="Generated invoice" />
            ) : loading ? (
              <div className={styles.paymentInvoiceLoading}>
                <LoaderCircle
                  className={styles.paymentInvoiceLoadingSpinner}
                  size={28}
                />
                <strong>Invoice taiyar ho raha hai</strong>
                <span>Yeh screen automatically update hogi.</span>
              </div>
            ) : (
              <div className={styles.paymentInvoiceLoading}>
                <FileText size={30} />
                <strong>Invoice PDF taiyar ho raha hai</strong>
                <span>{notice || "Payments mein thodi der mein milega."}</span>
              </div>
            )}
          </div>
        </section>

        {notice && invoice ? (
          <p className={styles.paymentSuccessNotice}>{notice}</p>
        ) : null}
      </main>

      <div className={styles.paymentSuccessActions}>
        {pdfUrl ? (
          <>
            <a href={pdfUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              Invoice dekhein
            </a>
            <a href={pdfUrl} download>
              <Download size={18} />
              Download
            </a>
          </>
        ) : (
          <a href="/pay?tab=paid">
            <FileText size={18} />
            Invoices dekhein
          </a>
        )}
        <a href="/home" className={styles.paymentSuccessHome}>
          <Home size={19} />
          Go to Home
        </a>
      </div>
    </CustomerAppShell>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
