"use client";

import {
  ArrowLeft,
  Check,
  Download,
  LoaderCircle,
  MessageCircle,
  Pencil,
  X,
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
import { updateCustomerInvoice } from "@/features/customer-app/api";
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

type InvoiceEditForm = {
  invoiceDate: string;
  supplierName: string;
  supplierAddress: string;
  placeOfSupply: string;
  buyerName: string;
  buyerAddress: string;
  vehicleNumber: string;
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
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState<InvoiceEditForm>({
    invoiceDate: "",
    supplierName: "",
    supplierAddress: "",
    placeOfSupply: "",
    buyerName: "",
    buyerAddress: "",
    vehicleNumber: "",
  });

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

  const openInvoiceEditor = () => {
    if (!activeInvoice) return;
    setEditForm({
      invoiceDate: String(activeInvoice.invoiceDate || "").slice(0, 10),
      supplierName: String(activeInvoice.supplierName || ""),
      supplierAddress: addressLines(activeInvoice.supplierAddress),
      placeOfSupply: String(activeInvoice.placeOfSupply || ""),
      buyerName: String(
        activeInvoice.billToName || activeInvoice.shipToName || "",
      ),
      buyerAddress: addressLines(
        activeInvoice.billToAddress || activeInvoice.shipToAddress,
      ),
      vehicleNumber: invoiceVehicle(activeInvoice)
        .replace(/unavailable|not added/gi, "")
        .trim(),
    });
    setEditError("");
    setEditOpen(true);
  };

  const saveInvoiceEdits = async () => {
    if (!activeInvoice || editSaving) return;
    if (
      !editForm.supplierName.trim() ||
      !editForm.supplierAddress.trim() ||
      !editForm.buyerName.trim() ||
      !editForm.buyerAddress.trim() ||
      !editForm.placeOfSupply.trim() ||
      !editForm.invoiceDate.trim()
    ) {
      setEditError("Naam, address, place of supply aur date bharo.");
      return;
    }

    setEditSaving(true);
    setEditError("");
    try {
      const productName = Array.isArray(activeInvoice.productName)
        ? activeInvoice.productName[0]
        : String(activeInvoice.productName || "");
      const updated = await updateCustomerInvoice(String(activeInvoice.id), {
        invoiceDate: editForm.invoiceDate.slice(0, 10),
        supplierName: editForm.supplierName,
        supplierAddress: editForm.supplierAddress,
        placeOfSupply: editForm.placeOfSupply,
        buyerName: editForm.buyerName,
        buyerAddress: editForm.buyerAddress,
        vehicleNumber: editForm.vehicleNumber,
        productName,
      });
      setInvoices((current) =>
        current.map((invoice) =>
          String(invoice.id) === String(activeInvoice.id)
            ? { ...invoice, ...updated }
            : invoice,
        ),
      );
      setReferences((current) =>
        current.map((reference) =>
          reference.id === String(activeInvoice.id)
            ? {
                ...reference,
                vehicle:
                  invoiceVehicle(updated as CustomerInvoice) ||
                  reference.vehicle,
                invoiceNumber: String(
                  updated.invoiceNumber || reference.invoiceNumber,
                ),
              }
            : reference,
        ),
      );
      setLoadedPdfUrls((current) => {
        const next = new Set(current);
        const oldUrl = getInvoicePdfUrl(activeInvoice);
        if (oldUrl) next.delete(oldUrl);
        return next;
      });
      setActionMessage("Invoice update ho gaya.");
      setEditOpen(false);
      void refreshInvoices();
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "Invoice update nahi ho paya.",
      );
    } finally {
      setEditSaving(false);
    }
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
            <div className={styles.invoiceHeadingActions}>
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
              {activeInvoice ? (
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={openInvoiceEditor}
                >
                  <Pencil size={15} />
                  Edit
                </button>
              ) : null}
            </div>
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

      {editOpen ? (
        <div className={styles.editBackdrop} role="dialog" aria-modal="true">
          <div className={styles.editSheet}>
            <div className={styles.editHeader}>
              <strong>Invoice edit karein</strong>
              <button
                type="button"
                className={styles.editClose}
                onClick={() => !editSaving && setEditOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className={styles.editHint}>
              Naam, address, date, place of supply change kar sakte ho. Quantity /
              rate / amount locked hain.
            </p>
            <div className={styles.editFields}>
              <label>
                <span>Invoice date</span>
                <input
                  type="date"
                  value={editForm.invoiceDate}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      invoiceDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Loading vala</span>
                <input
                  value={editForm.supplierName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      supplierName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Loading vala address</span>
                <textarea
                  rows={3}
                  value={editForm.supplierAddress}
                  onChange={(event) => {
                    const supplierAddress = event.target.value;
                    setEditForm((current) => {
                      const derived = derivePlaceOfSupplyFromAddress(
                        supplierAddress,
                        current.placeOfSupply,
                      );
                      return {
                        ...current,
                        supplierAddress,
                        ...(derived ? { placeOfSupply: derived } : {}),
                      };
                    });
                  }}
                />
              </label>
              <label>
                <span>Place of supply</span>
                <input
                  value={editForm.placeOfSupply}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      placeOfSupply: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Unloading vala</span>
                <input
                  value={editForm.buyerName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      buyerName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Unloading vala address</span>
                <textarea
                  rows={3}
                  value={editForm.buyerAddress}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      buyerAddress: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Vehicle number</span>
                <input
                  value={editForm.vehicleNumber}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      vehicleNumber: event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, ""),
                    }))
                  }
                />
              </label>
              {editError ? <p className={styles.editError}>{editError}</p> : null}
            </div>
            <div className={styles.editActions}>
              <button
                type="button"
                className={styles.editCancel}
                disabled={editSaving}
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.editSave}
                disabled={editSaving}
                onClick={() => void saveInvoiceEdits()}
              >
                {editSaving ? <LoaderCircle size={18} /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function addressLines(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
  }
  return String(value || "").trim();
}

function derivePlaceOfSupplyFromAddress(
  supplierAddress: string,
  currentPlaceOfSupply = "",
) {
  const address = String(supplierAddress || "").trim();
  if (!address) return "";
  const haystack = address
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const districtMatch = haystack.match(
    /\b(?:dist\.?|district|zilla|zila)\s*[:=\-.]?\s*([a-z][a-z.]+(?:\s+[a-z][a-z.]+)?)/i,
  );
  if (districtMatch?.[1]) {
    return districtMatch[1]
      .replace(/\./g, " ")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  const current = String(currentPlaceOfSupply || "").trim();
  if (!current) return "";
  const needle = current.toLowerCase().replace(/[_/]+/g, " ").trim();
  if (needle.length >= 3 && haystack.includes(needle)) {
    return current
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return "";
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
