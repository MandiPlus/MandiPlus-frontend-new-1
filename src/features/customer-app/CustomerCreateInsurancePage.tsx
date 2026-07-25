"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  Mic,
  Phone,
  Send,
  Trash2,
  Truck,
  Users,
} from "lucide-react";

import { useAuth } from "@/features/auth/context/AuthContext";
import { createCustomerWebPaymentCheckout } from "@/features/customer/api";
import {
  createCustomerInvoice,
  extractCustomerInvoice,
  extractCustomerInvoiceText,
  type CustomerInvoiceDraft,
} from "./api";
import { CustomerAppShell } from "./CustomerAppShell";
import { money, readableError } from "./utils";
import styles from "./customer-app.module.css";

type Stage = "capture" | "extracting" | "review" | "creating";

const today = () => new Date().toISOString().slice(0, 10);

function emptyDraft(user: Record<string, unknown> | null): CustomerInvoiceDraft {
  const userName = String(user?.name || user?.fullName || "");
  const userPhone = String(user?.phone || user?.mobile || user?.phoneNumber || "");
  const product = Array.isArray(user?.products)
    ? String(user.products[0] || "")
    : String(user?.commodity || user?.product || "");
  return {
    invoiceDate: today(),
    mode: "Cash",
    supplierName: "",
    supplierAddress: "",
    buyerName: userName,
    buyerAddress: "",
    placeOfSupply: String(user?.state || ""),
    product,
    quantity: "",
    rate: "",
    vehicleNumber: "",
    driverPhone: "",
    insuredPartyPhone: userPhone,
    ownerName: "",
    note: "",
  };
}

export default function CustomerCreateInsurancePage() {
  const router = useRouter();
  const { user } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<CustomerInvoiceDraft>(() =>
    emptyDraft(user),
  );
  const [quickText, setQuickText] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [notice, setNotice] = useState("");

  const total = useMemo(
    () => Number(draft.quantity || 0) * Number(draft.rate || 0),
    [draft.quantity, draft.rate],
  );
  const premium = Math.max(1, Math.round(total * 0.002));

  useEffect(() => {
    if (!user) return;
    const defaults = emptyDraft(user);
    setDraft((current) => ({
      ...current,
      buyerName: current.buyerName || defaults.buyerName,
      insuredPartyPhone:
        current.insuredPartyPhone || defaults.insuredPartyPhone,
      placeOfSupply: current.placeOfSupply || defaults.placeOfSupply,
      product: current.product || defaults.product,
    }));
  }, [user]);

  useEffect(() => {
    if (!files[0] || !files[0].type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }
    const next = URL.createObjectURL(files[0]);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [files]);

  const update = (field: keyof CustomerInvoiceDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files || []).filter(
      (file) =>
        file.type.startsWith("image/") ||
        file.type === "application/pdf",
    );
    if (!next.length) return;
    setFiles((current) => [...current, ...next].slice(0, 8));
    setSourceOpen(false);
    setNotice("");
    event.target.value = "";
  };

  const extract = async () => {
    if (!files.length && !quickText.trim()) {
      setNotice("Weighment slip dalein ya insurance details batayein.");
      return;
    }
    setStage("extracting");
    setNotice("");
    try {
      const response = files.length
        ? await extractCustomerInvoice(files)
        : await extractCustomerInvoiceText(quickText.trim(), draft.product);
      setDraft((current) => applyExtraction(current, response));
      setStage("review");
    } catch (error) {
      setNotice(
        readableError(
          error,
          "Details scan nahi ho paaye. Aap manually details bhar sakte hain.",
        ),
      );
      setStage("review");
    }
  };

  const submitAndPay = async () => {
    const validation = validateDraft(draft);
    if (validation) {
      setNotice(validation);
      return;
    }
    if (!user?.id) {
      setNotice("Your session is missing. Please sign in again.");
      return;
    }
    setStage("creating");
    setNotice("");
    try {
      const invoice = await createCustomerInvoice(user.id, draft, files);
      if (!invoice?.id) throw new Error("Invoice was created without an ID.");
      const checkout = await createCustomerWebPaymentCheckout([invoice.id]);
      if (!checkout.redirectUrl) {
        router.replace("/pay");
        return;
      }
      window.location.assign(checkout.redirectUrl);
    } catch (error) {
      setNotice(
        readableError(
          error,
          "Insurance create ya payment start nahi ho saka. Dobara try karein.",
        ),
      );
      setStage("review");
    }
  };

  const startVoice = () => {
    const browser = window as typeof window & {
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (event: {
          results: ArrayLike<{ 0: { transcript: string } }>;
        }) => void;
        onerror: () => void;
        start: () => void;
      };
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (event: {
          results: ArrayLike<{ 0: { transcript: string } }>;
        }) => void;
        onerror: () => void;
        start: () => void;
      };
    };
    const Recognition =
      browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("Voice input is browser mein available nahi hai.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setQuickText((current) =>
        [current.trim(), transcript.trim()].filter(Boolean).join(" "),
      );
    };
    recognition.onerror = () => {
      setNotice("Voice sun nahi paaye. Dobara try karein.");
    };
    recognition.start();
  };

  if (stage === "capture" || stage === "extracting") {
    return (
      <CustomerAppShell
        activeTab="create"
        showBottomNav={false}
      >
        <header className={styles.secondaryHeader}>
          <button
            type="button"
            className={styles.secondaryBack}
            onClick={() => router.push("/home")}
            aria-label="Back to home"
          >
            <ArrowLeft size={24} strokeWidth={2.4} />
          </button>
          <h1 className={styles.secondaryHeading}>Insurance banao</h1>
          <span />
        </header>

        <main className={styles.quickCreateBody}>
          <div className={styles.captureStage}>
            {files.length ? (
              <div className={styles.capturePreview}>
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className={styles.capturePreviewImage} />
                ) : (
                  <div className={styles.captureFilePreview}>
                    <FolderOpen size={34} />
                    <span>{files[0].name}</span>
                  </div>
                )}
                {files.length > 1 ? (
                  <span className={styles.captureCount}>1/{files.length}</span>
                ) : null}
                <div className={styles.capturePreviewActions}>
                  <button
                    type="button"
                    onClick={() => setSourceOpen(true)}
                    disabled={stage === "extracting"}
                  >
                    <ImagePlus size={17} />
                    Photo badlein
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.slice(1))}
                    disabled={stage === "extracting"}
                  >
                    <Trash2 size={17} />
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.captureZone}
                onClick={() => setSourceOpen(true)}
                disabled={stage === "extracting"}
              >
                <span className={styles.captureIcon}>
                  {stage === "extracting" ? (
                    <LoaderCircle className="animate-spin" size={36} />
                  ) : (
                    <ImagePlus size={36} />
                  )}
                </span>
                <span className={styles.captureTitle}>
                  {stage === "extracting"
                    ? "Parchi padh rahe hain"
                    : "Weighment slip dalein"}
                </span>
              </button>
            )}
          </div>
          <input
            ref={cameraRef}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={selectFiles}
          />
          <input
            ref={uploadRef}
            hidden
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={selectFiles}
          />

          {notice ? <div className={styles.notice}>{notice}</div> : null}

          <div className={styles.quickComposer}>
            <div className={styles.quickComposerAccessory}>
              <button
                type="button"
                className={styles.quickMic}
                onClick={startVoice}
                disabled={stage === "extracting"}
                aria-label="Voice input"
              >
                <Mic size={22} />
              </button>
            </div>
            <div className={styles.quickComposerRow}>
              <textarea
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
                placeholder="Insurance details batayein..."
                maxLength={700}
              />
              <button
                type="button"
                className={styles.quickSend}
                onClick={() => void extract()}
                disabled={
                  (!files.length && !quickText.trim()) ||
                  stage === "extracting"
                }
                aria-label="Details bhejein"
              >
                {stage === "extracting" ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Send size={17} />
                )}
              </button>
            </div>
          </div>
        </main>

        {sourceOpen ? (
          <div className={styles.sourceModal}>
            <button
              type="button"
              className={styles.sourceBackdrop}
              onClick={() => setSourceOpen(false)}
              aria-label="Close"
            />
            <div className={styles.sourceSheet}>
              <div className={styles.sourceHandle} />
              <button
                type="button"
                className={styles.sourceOption}
                onClick={() => cameraRef.current?.click()}
              >
                <span><Camera size={25} /></span>
                Photo kheenchein
              </button>
              <button
                type="button"
                className={styles.sourceOption}
                onClick={() => uploadRef.current?.click()}
              >
                <span><FolderOpen size={25} /></span>
                Gallery
              </button>
            </div>
          </div>
        ) : null}
      </CustomerAppShell>
    );
  }

  return (
    <CustomerAppShell
      activeTab="create"
      showBottomNav={false}
    >
      <header className={styles.secondaryHeader}>
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={() => setStage("capture")}
          aria-label="Back to upload"
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>Details check karein</h1>
        <span />
      </header>

      <main className={`${styles.pageBody} ${styles.reviewBody}`}>
        <section className={styles.reviewTopCard}>
          <div className={styles.reviewProductRow}>
            <div className={styles.reviewProduct}>
              <span aria-hidden="true">🍅</span>
              <input
                aria-label="Commodity"
                value={draft.product}
                onChange={(event) => update("product", event.target.value)}
              />
              <ChevronDown size={18} />
            </div>
            <div>
              <div className={styles.reviewTotalLabel}>Total</div>
              <div className={styles.reviewTotal}>{money(total)}</div>
            </div>
          </div>
          <div className={styles.reviewModeRow}>
            {(["Cash", "Commission"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`${styles.modeButton} ${
                  draft.mode === mode ? styles.modeButtonActive : ""
                }`}
                onClick={() => update("mode", mode)}
              >
                {mode}
              </button>
            ))}
            <label className={styles.reviewDate}>
              <input
                type="date"
                aria-label="Invoice date"
                value={draft.invoiceDate}
                onChange={(event) => update("invoiceDate", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={styles.detailCard}>
          <DetailSection title="Party" icon={<Users size={20} />}>
            <CompactInput
              label="Supplier"
              value={draft.supplierName}
              onChange={(value) => update("supplierName", value)}
            />
            <CompactInput
              label="Buyer"
              value={draft.buyerName}
              onChange={(value) => update("buyerName", value)}
            />
            <CompactInput
              label="Supplier address"
              value={draft.supplierAddress}
              onChange={(value) => update("supplierAddress", value)}
            />
            <CompactInput
              label="Buyer address"
              value={draft.buyerAddress}
              onChange={(value) => update("buyerAddress", value)}
            />
            <CompactInput
              label="Place of supply"
              value={draft.placeOfSupply}
              full
              onChange={(value) => update("placeOfSupply", value)}
            />
          </DetailSection>

          <DetailSection title="Goods & vehicle" icon={<Truck size={20} />}>
            <CompactInput
              label="Quantity"
              inputMode="decimal"
              value={draft.quantity}
              onChange={(value) => update("quantity", value)}
            />
            <CompactInput
              label="Rate"
              inputMode="decimal"
              value={draft.rate}
              onChange={(value) => update("rate", value)}
            />
            <CompactInput
              label="Vehicle number"
              value={draft.vehicleNumber}
              full
              onChange={(value) => update("vehicleNumber", value.toUpperCase())}
            />
          </DetailSection>

          <DetailSection title="Contact" icon={<Phone size={20} />}>
            <CompactInput
              label="Buyer mobile"
              inputMode="tel"
              value={draft.insuredPartyPhone}
              onChange={(value) => update("insuredPartyPhone", value)}
            />
            <CompactInput
              label="Driver mobile"
              inputMode="tel"
              value={draft.driverPhone}
              onChange={(value) => update("driverPhone", value)}
            />
          </DetailSection>
        </section>

        {notice ? <div className={styles.notice}>{notice}</div> : null}
      </main>

      <div className={styles.stickyPay}>
        <button
          type="button"
          className={styles.wideButton}
          onClick={() => void submitAndPay()}
          disabled={stage === "creating"}
        >
          {stage === "creating" ? (
            <LoaderCircle className="animate-spin" size={19} />
          ) : null}
          Pay {money(premium)}
        </button>
      </div>
    </CustomerAppShell>
  );
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.detailSection}>
      <div className={styles.detailHeading}>
        {icon}
        {title}
      </div>
      <div className={styles.detailGrid}>{children}</div>
    </div>
  );
}

function CompactInput({
  label,
  value,
  onChange,
  full = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
  inputMode?: "text" | "decimal" | "numeric" | "tel";
}) {
  return (
    <label
      className={`${styles.compactField} ${
        full ? styles.detailGridFull : ""
      }`}
    >
      <span>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function applyExtraction(
  current: CustomerInvoiceDraft,
  response: Record<string, unknown>,
): CustomerInvoiceDraft {
  let payload = response as Record<string, unknown>;
  for (let depth = 0; depth < 3; depth += 1) {
    if (payload.draft && typeof payload.draft === "object") break;
    const nested = payload.data;
    if (!nested || typeof nested !== "object") break;
    payload = nested as Record<string, unknown>;
  }
  const raw =
    payload.draft && typeof payload.draft === "object"
      ? (payload.draft as Record<string, unknown>)
      : payload;
  const quantity = numberText(raw.quantity);
  const total = Number(raw.total_amount || raw.amount || 0);
  const rate =
    numberText(raw.rate) ||
    (quantity && total > 0 ? String(round(total / Number(quantity))) : "");

  return {
    ...current,
    supplierName: text(raw.seller_name || raw.supplier_name) || current.supplierName,
    supplierAddress: text(raw.supplier_address) || current.supplierAddress,
    buyerName:
      text(raw.buyer_name || raw.billToName || raw.shipToName) ||
      current.buyerName,
    buyerAddress:
      text(
        raw.buyer_address ||
          raw.buyerAddress ||
          raw.billToAddress ||
          raw.shipToAddress,
      ) || current.buyerAddress,
    placeOfSupply: text(raw.place_of_supply) || current.placeOfSupply,
    product:
      text(raw.commodity || raw.product_name || raw.product) || current.product,
    quantity: quantity || current.quantity,
    rate: rate || current.rate,
    vehicleNumber:
      text(raw.vehicle_number || raw.truck_number)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") || current.vehicleNumber,
    driverPhone: phone(raw.driver_phone) || current.driverPhone,
    insuredPartyPhone:
      phone(raw.insured_party_phone || raw.buyer_phone) ||
      current.insuredPartyPhone,
    ownerName: text(raw.owner_name || raw.transporter_name),
    invoiceDate: normalizeDate(raw.invoice_date) || current.invoiceDate,
    note: text(raw.notes) || current.note,
  };
}

function validateDraft(draft: CustomerInvoiceDraft) {
  if (!draft.supplierName.trim()) return "Supplier ka naam add karein.";
  if (!draft.buyerName.trim()) return "Buyer ka naam add karein.";
  if (!draft.product.trim()) return "Commodity add karein.";
  if (!(Number(draft.quantity) > 0)) return "Sahi quantity add karein.";
  if (!(Number(draft.rate) > 0)) return "Sahi rate add karein.";
  if (!draft.vehicleNumber.trim()) return "Vehicle number add karein.";
  if (phone(draft.insuredPartyPhone).length < 10) {
    return "Buyer ka 10 digit mobile number add karein.";
  }
  return "";
}

function text(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
  }
  return String(value || "").trim();
}

function numberText(value: unknown) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? String(number) : "";
}

function phone(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function normalizeDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
