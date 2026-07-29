"use client";

import {
  ArrowLeft,
  Check,
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

import {
  getCustomerDashboardInvoices,
  getCustomerPaymentCheckoutStatus,
} from "@/features/customer/api";
import { clearCustomerInvoicePaymentAttempt } from "@/features/customer-app/payment-attempt";
import {
  getInvoicePdfUrl,
  invoiceVehicle,
  type CustomerInvoice,
} from "@/features/customer-app/utils";

import styles from "./payment-success.module.css";

const PDF_POLL_INTERVAL_MS = 1_500;

type InvoiceReference = {
  id: string;
  invoiceNumber: string;
  vehicle: string;
};

type ReadyInvoiceDocument = {
  invoice: CustomerInvoice;
  invoiceNumber: string;
  vehicle: string;
  pdfUrl: string;
};

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const queryKey = params.toString();
  const merchantOrderId = params.get("merchantOrderId") || "";
  const queryReferences = useMemo(
    () => invoiceReferencesFromQuery(new URLSearchParams(queryKey)),
    [queryKey],
  );
  const [references, setReferences] =
    useState<InvoiceReference[]>(queryReferences);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [activeInvoiceId, setActiveInvoiceId] = useState(
    queryReferences[0]?.id || "",
  );
  const [loadedPdfUrls, setLoadedPdfUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const [hasLoadedInvoiceList, setHasLoadedInvoiceList] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    setReferences((current) =>
      mergeInvoiceReferences(queryReferences, current),
    );
  }, [queryReferences]);

  useEffect(() => {
    if (!merchantOrderId) return;
    let cancelled = false;

    void getCustomerPaymentCheckoutStatus(merchantOrderId)
      .then((status) => {
        if (cancelled || !status.paid || !status.invoices?.length) return;
        const confirmedReferences = status.invoices.map((invoice) => ({
          id: String(invoice.id || ""),
          invoiceNumber: String(invoice.invoiceNumber || ""),
          vehicle: String(invoice.vehicleNumber || ""),
        }));
        setReferences((current) =>
          mergeInvoiceReferences(current, confirmedReferences),
        );
      })
      .catch(() => {
        // The pending page has already confirmed this payment. Query references
        // still let the generated-invoice screen recover from a status refresh.
      });

    return () => {
      cancelled = true;
    };
  }, [merchantOrderId]);

  useEffect(() => {
    if (!references.length) return;
    setActiveInvoiceId((current) =>
      references.some((reference) => reference.id === current)
        ? current
        : references[0].id,
    );
  }, [references]);

  const refreshInvoices = useCallback(async () => {
    if (!references.length) return false;
    try {
      const dashboardInvoices =
        (await getCustomerDashboardInvoices()) as CustomerInvoice[];
      const invoiceById = new Map(
        dashboardInvoices.map((invoice) => [String(invoice.id), invoice]),
      );
      const matchedInvoices = references
        .map((reference) => invoiceById.get(reference.id))
        .filter(Boolean) as CustomerInvoice[];
      setInvoices(matchedInvoices);
      setLoadError("");
      setHasLoadedInvoiceList(true);
      return references.every((reference) => {
        const invoice = invoiceById.get(reference.id);
        return Boolean(invoice && getInvoicePdfUrl(invoice));
      });
    } catch {
      setHasLoadedInvoiceList(true);
      setLoadError(
        "Invoice details refresh nahi ho paaye. Hum dobara check kar rahe hain.",
      );
      return false;
    }
  }, [references]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      const allPdfsReady = await refreshInvoices();
      if (cancelled || allPdfsReady) return;
      timer = window.setTimeout(poll, PDF_POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [refreshInvoices]);

  const invoiceById = useMemo(
    () => new Map(invoices.map((invoice) => [String(invoice.id), invoice])),
    [invoices],
  );
  const activeReference =
    references.find((reference) => reference.id === activeInvoiceId) ||
    references[0] ||
    null;
  const activeInvoice = activeReference
    ? invoiceById.get(activeReference.id) || null
    : null;
  const activePdfUrl = activeInvoice ? getInvoicePdfUrl(activeInvoice) : "";
  const activeInvoiceNumber =
    String(
      activeInvoice?.invoiceNumber || activeReference?.invoiceNumber || "",
    ).trim() || "Invoice generated";
  const activeVehicle =
    activeInvoice && invoiceVehicle(activeInvoice) !== "Vehicle not added"
      ? invoiceVehicle(activeInvoice)
      : activeReference?.vehicle || activeInvoiceNumber;
  const documents = useMemo(
    () =>
      references
        .map((reference) => {
          const invoice = invoiceById.get(reference.id);
          if (!invoice) return null;
          const pdfUrl = getInvoicePdfUrl(invoice);
          if (!pdfUrl) return null;
          return {
            invoice,
            invoiceNumber:
              String(invoice.invoiceNumber || reference.invoiceNumber).trim() ||
              "Invoice",
            vehicle:
              invoiceVehicle(invoice) !== "Vehicle not added"
                ? invoiceVehicle(invoice)
                : reference.vehicle,
            pdfUrl,
          };
        })
        .filter(Boolean) as ReadyInvoiceDocument[],
    [invoiceById, references],
  );
  const readyCount = documents.length;
  const isBulk = references.length > 1;
  const allDocumentsReady =
    references.length > 0 && readyCount === references.length;

  const shareInvoices = async () => {
    if (!allDocumentsReady) return;
    setActionMessage("");
    const text = isBulk
      ? [
          `${documents.length} MandiPlus invoices`,
          ...documents.map(
            (document, index) =>
              `${index + 1}. ${document.vehicle || document.invoiceNumber} · ${
                document.invoiceNumber
              }\n${document.pdfUrl}`,
          ),
        ].join("\n\n")
      : `${activeInvoiceNumber}${
          activeVehicle ? ` · ${activeVehicle}` : ""
        } — MandiPlus\n${activePdfUrl}`;
    const shareData = {
      title: isBulk
        ? `${documents.length} invoices generated`
        : activeInvoiceNumber,
      text,
      ...(isBulk ? {} : { url: activePdfUrl }),
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
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const downloadInvoices = async () => {
    if (!allDocumentsReady || downloading) return;
    setActionMessage("");

    if (!isBulk) {
      triggerDownload(activePdfUrl, `${activeInvoiceNumber}.pdf`);
      return;
    }

    setDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      await Promise.all(
        documents.map(async (document, index) => {
          const response = await fetch(document.pdfUrl);
          if (!response.ok) {
            throw new Error(`Invoice ${index + 1} could not be downloaded`);
          }
          zip.file(
            `${String(index + 1).padStart(2, "0")}-${safeFileName(
              document.vehicle || document.invoiceNumber,
            )}.pdf`,
            await response.blob(),
          );
        }),
      );
      const archive = await zip.generateAsync({ type: "blob" });
      const archiveUrl = URL.createObjectURL(archive);
      triggerDownload(archiveUrl, `MandiPlus-${documents.length}-invoices.zip`);
      window.setTimeout(() => URL.revokeObjectURL(archiveUrl), 2_000);
      setActionMessage(`${documents.length} invoices download ho gaye.`);
    } catch {
      setActionMessage(
        "Bulk download nahi ho saka. Invoice select karke dobara try karein.",
      );
    } finally {
      setDownloading(false);
    }
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
          <h1 className={styles.title}>
            {isBulk ? "Invoices generated" : "Invoice generated"}
          </h1>
        </header>

        <section className={styles.insuranceBanner}>
          <strong>
            {isBulk ? "Insurance ban rahe hain" : "Insurance ban rha hai"}
          </strong>
        </section>

        {isBulk ? (
          <section className={styles.invoicePicker}>
            <div className={styles.pickerSummary}>
              <strong>{references.length} invoices</strong>
              <span>
                {readyCount === references.length
                  ? "All ready"
                  : `${readyCount} of ${references.length} ready`}
              </span>
            </div>
            <div
              className={styles.invoiceTabs}
              role="tablist"
              aria-label="Generated invoices"
            >
              {references.map((reference, index) => {
                const invoice = invoiceById.get(reference.id);
                const pdfReady = Boolean(invoice && getInvoicePdfUrl(invoice));
                const vehicle =
                  invoice && invoiceVehicle(invoice) !== "Vehicle not added"
                    ? invoiceVehicle(invoice)
                    : reference.vehicle;
                const invoiceNumber =
                  invoice?.invoiceNumber || reference.invoiceNumber;
                const selected = reference.id === activeReference?.id;
                return (
                  <button
                    key={reference.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={`${styles.invoiceTab} ${
                      selected ? styles.invoiceTabActive : ""
                    }`}
                    onClick={() => setActiveInvoiceId(reference.id)}
                  >
                    <span className={styles.invoiceTabStatus}>
                      {pdfReady ? (
                        <Check size={14} strokeWidth={3} />
                      ) : (
                        <LoaderCircle size={14} />
                      )}
                    </span>
                    <span>
                      <strong>{vehicle || `Invoice ${index + 1}`}</strong>
                      <small>{invoiceNumber || `Invoice ${index + 1}`}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className={styles.invoiceCard}>
          <header className={styles.invoiceHeading}>
            <strong>{activeVehicle}</strong>
            {isBulk ? (
              <span>
                {Math.max(
                  references.findIndex(
                    (reference) => reference.id === activeReference?.id,
                  ) + 1,
                  1,
                )}{" "}
                of {references.length}
              </span>
            ) : null}
          </header>

          <div className={styles.pdfFrame}>
            {activePdfUrl ? (
              <iframe
                key={activePdfUrl}
                src={`${activePdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                title={`Invoice PDF ${activeInvoiceNumber}`}
                onLoad={() =>
                  setLoadedPdfUrls((current) => {
                    const next = new Set(current);
                    next.add(activePdfUrl);
                    return next;
                  })
                }
              />
            ) : null}
            {!activePdfUrl || !loadedPdfUrls.has(activePdfUrl) ? (
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
          ) : !activeInvoice && hasLoadedInvoiceList ? (
            <p className={styles.statusMessage}>
              Invoice sync ho raha hai. Page khula rakhein.
            </p>
          ) : actionMessage ? (
            <p className={styles.statusMessage}>{actionMessage}</p>
          ) : null}
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={() => void shareInvoices()}
            aria-disabled={!allDocumentsReady}
            disabled={!allDocumentsReady}
          >
            <MessageCircle size={23} />
            {isBulk ? "Send all" : "Send"}
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => void downloadInvoices()}
            aria-disabled={!allDocumentsReady || downloading}
            disabled={!allDocumentsReady || downloading}
          >
            {downloading ? (
              <LoaderCircle size={23} className={styles.actionSpinner} />
            ) : (
              <Download size={23} />
            )}
            {isBulk ? "Download all" : "Download"}
          </button>
        </div>
      </div>
    </main>
  );
}

function invoiceReferencesFromQuery(
  params: URLSearchParams,
): InvoiceReference[] {
  const invoiceIds = params.getAll("invoiceId");
  const invoiceNumbers = params.getAll("invoiceNumber");
  const vehicles = params.getAll("vehicle");
  return invoiceIds
    .map((id, index) => ({
      id: String(id || "").trim(),
      invoiceNumber: String(invoiceNumbers[index] || "").trim(),
      vehicle: String(vehicles[index] || "").trim(),
    }))
    .filter((reference) => reference.id);
}

function mergeInvoiceReferences(
  primary: InvoiceReference[],
  secondary: InvoiceReference[],
) {
  const merged = new Map<string, InvoiceReference>();
  [...primary, ...secondary].forEach((reference) => {
    if (!reference.id) return;
    const current = merged.get(reference.id);
    merged.set(reference.id, {
      id: reference.id,
      invoiceNumber:
        current?.invoiceNumber || reference.invoiceNumber || "",
      vehicle: current?.vehicle || reference.vehicle || "",
    });
  });
  return Array.from(merged.values());
}

function safeFileName(value: string) {
  return (
    String(value || "invoice")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "invoice"
  );
}

function triggerDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName(fileName.replace(/\.pdf$/i, "")) + ".pdf";
  if (/\.zip$/i.test(fileName)) {
    anchor.download = fileName;
  }
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
