"use client";

import {
  useCallback,
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
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  Mic,
  Phone,
  Send,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/features/auth/context/AuthContext";
import { createCustomerWebPaymentCheckout } from "@/features/customer/api";
import {
  createCustomerInvoice,
  extractCustomerInvoice,
  extractCustomerInvoiceText,
  extractCustomerInvoiceVoice,
  getCustomerAppPricing,
  getCustomerInvoiceProfile,
  isTenderCoconutProduct,
  type CustomerAppPricing,
  type CustomerInvoiceDraft,
  type InvoiceVoiceTargetField,
} from "./api";
import { CustomerAppShell } from "./CustomerAppShell";
import { money, readableError } from "./utils";
import styles from "./customer-app.module.css";

type Stage = "capture" | "review" | "creating";
type ExtractionState = "idle" | "optimizing" | "reading" | "ready" | "failed";
type MissingDetailKey =
  | "supplierName"
  | "buyerName"
  | "buyerAddress"
  | "quantity"
  | "totalAmount"
  | "vehicleTonnage"
  | "insuredPartyPhone";
type RecordingPurpose = "quick" | MissingDetailKey;
type VoiceAnswerState = "processing" | "saved" | "failed";

type EagerExtraction = {
  key: string;
  promise: Promise<Record<string, unknown>>;
};

const DEFAULT_TENDER_COCONUT_PRICING: CustomerAppPricing["tenderCoconut"] = {
  pricingVersion: 1,
  amount25Ton: 130000,
  amount30Ton: 140000,
  updatedAt: null,
};

const MISSING_QUESTIONS: Record<
  MissingDetailKey,
  { label: string; target?: InvoiceVoiceTargetField }
> = {
  supplierName: {
    label: "Aapka vyapari kaun hai?",
    target: "supplier_name",
  },
  buyerName: { label: "Buyer ka naam", target: "buyer_name" },
  buyerAddress: { label: "Buyer ka address", target: "buyer_address" },
  quantity: { label: "Kitne dane hain?", target: "quantity" },
  totalAmount: { label: "Kitne lakh ka maal hai?", target: "total_amount" },
  vehicleTonnage: { label: "Gaadi kitne ton ki hai?" },
  insuredPartyPhone: {
    label: "Buyer mobile",
    target: "insured_party_phone",
  },
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyDraft(user: Record<string, unknown> | null): CustomerInvoiceDraft {
  const userName = String(user?.name || user?.fullName || "");
  const userPhone = String(
    user?.phone ||
      user?.mobile ||
      user?.mobileNumber ||
      user?.phoneNumber ||
      "",
  );
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
    totalAmount: "",
    vehicleNumber: "",
    vehicleTonnage: "",
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
  const eagerExtractionRef = useRef<EagerExtraction | null>(null);
  const quickVoiceTaskRef = useRef<Promise<Record<string, unknown>> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingPurposeRef = useRef<RecordingPurpose | null>(null);
  const questionGenerationRef = useRef<
    Partial<Record<MissingDetailKey, number>>
  >({});

  const [stage, setStage] = useState<Stage>("capture");
  const [extractionState, setExtractionState] =
    useState<ExtractionState>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<CustomerInvoiceDraft>(() =>
    emptyDraft(user),
  );
  const [quickText, setQuickText] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [pricing, setPricing] =
    useState<CustomerAppPricing["tenderCoconut"]>(
      DEFAULT_TENDER_COCONUT_PRICING,
    );
  const [recordingPurpose, setRecordingPurpose] =
    useState<RecordingPurpose | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [missingKeys, setMissingKeys] = useState<MissingDetailKey[]>([]);
  const [missingIndex, setMissingIndex] = useState(0);
  const [missingOpen, setMissingOpen] = useState(false);
  const [voiceAnswers, setVoiceAnswers] = useState<
    Partial<Record<MissingDetailKey, VoiceAnswerState>>
  >({});

  const isTenderCoconut = isTenderCoconutProduct(draft.product);
  const total = useMemo(
    () => resolveInvoiceAmount(draft, pricing),
    [draft, pricing],
  );
  const premium = Number((total * 0.002).toFixed(2));
  const pendingVoiceAnswers = Object.values(voiceAnswers).filter(
    (state) => state === "processing",
  ).length;
  const validationIssue = validateDraft(draft);
  const activeMissingKey = missingOpen ? missingKeys[missingIndex] : undefined;
  const activeQuestion = activeMissingKey
    ? MISSING_QUESTIONS[activeMissingKey]
    : null;

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
    let active = true;
    void Promise.allSettled([
      getCustomerAppPricing(),
      getCustomerInvoiceProfile(),
    ]).then(([pricingResult, profileResult]) => {
      if (!active) return;
      if (
        pricingResult.status === "fulfilled" &&
        pricingResult.value?.tenderCoconut
      ) {
        setPricing(pricingResult.value.tenderCoconut);
      }
      if (profileResult.status === "fulfilled" && profileResult.value) {
        const profile = profileResult.value;
        setDraft((current) =>
          applyProfileDefaults(current, profile),
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!files[0] || !files[0].type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }
    const next = URL.createObjectURL(files[0]);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [files]);

  useEffect(() => {
    if (!recordingPurpose) {
      setRecordingSeconds(0);
      return;
    }
    const updateDuration = () => {
      setRecordingSeconds(
        Math.max(
          0,
          Math.floor((Date.now() - recordingStartedAtRef.current) / 1000),
        ),
      );
    };
    updateDuration();
    const interval = window.setInterval(updateDuration, 250);
    return () => window.clearInterval(interval);
  }, [recordingPurpose]);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const queueDocumentExtraction = useCallback((nextFiles: File[]) => {
    if (!nextFiles.length) {
      eagerExtractionRef.current = null;
      return null;
    }
    const key = fileSetKey(nextFiles);
    if (eagerExtractionRef.current?.key === key) {
      return eagerExtractionRef.current.promise;
    }
    const promise = extractCustomerInvoice(nextFiles);
    eagerExtractionRef.current = { key, promise };
    setExtractionState("reading");
    void promise
      .then(() => {
        if (eagerExtractionRef.current?.key === key) {
          setExtractionState("ready");
        }
      })
      .catch(() => {
        if (eagerExtractionRef.current?.key === key) {
          setExtractionState("failed");
        }
      });
    return promise;
  }, []);

  const update = (field: keyof CustomerInvoiceDraft, value: string) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "quantity" || field === "rate") {
        next.totalAmount = "";
      }
      return next;
    });
  };

  const selectFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter(
      (file) =>
        file.type.startsWith("image/") || file.type === "application/pdf",
    );
    event.target.value = "";
    if (!selected.length) return;

    setSourceOpen(false);
    setNotice("");
    setExtractionState("optimizing");
    try {
      const optimized = await Promise.all(
        selected.map((file) => optimizeImageForOcr(file)),
      );
      const nextFiles = [...files, ...optimized].slice(0, 8);
      setFiles(nextFiles);
      queueDocumentExtraction(nextFiles);
    } catch {
      const nextFiles = [...files, ...selected].slice(0, 8);
      setFiles(nextFiles);
      queueDocumentExtraction(nextFiles);
    }
  };

  const removeFirstFile = () => {
    const nextFiles = files.slice(1);
    setFiles(nextFiles);
    setNotice("");
    queueDocumentExtraction(nextFiles);
    if (!nextFiles.length) setExtractionState("idle");
  };

  const openMissingDetails = (nextDraft: CustomerInvoiceDraft) => {
    const nextKeys = getMissingDetailKeys(nextDraft);
    setMissingKeys(nextKeys);
    setMissingIndex(0);
    setMissingOpen(nextKeys.length > 0);
  };

  const applyExtractionResults = (
    results: PromiseSettledResult<Record<string, unknown>>[],
  ) => {
    const successful = results
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<Record<string, unknown>> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
    if (!successful.length) {
      setExtractionState("failed");
      setNotice(
        "Details scan nahi ho paaye. Aap manually details bhar sakte hain.",
      );
      setDraft((current) => {
        openMissingDetails(current);
        return current;
      });
      return;
    }
    setDraft((current) => {
      const next = successful.reduce<CustomerInvoiceDraft>(
        (working, response) => applyExtraction(working, response),
        current,
      );
      openMissingDetails(next);
      return next;
    });
    setExtractionState("ready");
  };

  const extract = async () => {
    if (
      !files.length &&
      !quickText.trim() &&
      !quickVoiceTaskRef.current
    ) {
      setNotice("Weighment slip dalein ya insurance details batayein.");
      return;
    }
    if (recordingPurpose) {
      setNotice("Pehle voice answer save karein.");
      return;
    }

    setStage("review");
    setNotice("");
    const tasks: Array<Promise<Record<string, unknown>>> = [];
    if (files.length) {
      tasks.push(
        eagerExtractionRef.current?.key === fileSetKey(files)
          ? eagerExtractionRef.current.promise
          : queueDocumentExtraction(files)!,
      );
    }
    if (quickText.trim()) {
      tasks.push(extractCustomerInvoiceText(quickText.trim(), draft.product));
    }
    if (quickVoiceTaskRef.current) tasks.push(quickVoiceTaskRef.current);
    if (!tasks.length) {
      openMissingDetails(draft);
      return;
    }
    setExtractionState("reading");
    const results = await Promise.allSettled(tasks);
    applyExtractionResults(results);
  };

  const advanceMissingDetails = () => {
    if (missingIndex >= missingKeys.length - 1) {
      setMissingOpen(false);
      return;
    }
    setMissingIndex((current) => current + 1);
  };

  const processQuestionVoice = (
    key: MissingDetailKey,
    audio: File,
  ) => {
    const target = MISSING_QUESTIONS[key].target;
    if (!target) return;
    const generation = (questionGenerationRef.current[key] || 0) + 1;
    questionGenerationRef.current[key] = generation;
    setVoiceAnswers((current) => ({ ...current, [key]: "processing" }));
    void extractCustomerInvoiceVoice(audio, draft.product || "Tender Coconut", target)
      .then((response) => {
        if (questionGenerationRef.current[key] !== generation) return;
        const value = missingVoiceValue(response, key);
        if (!isMissingDetailAnswered(key, value)) {
          throw new Error("Voice answer was empty or invalid.");
        }
        setDraft((current) => applyMissingVoiceValue(current, key, value));
        setVoiceAnswers((current) => ({ ...current, [key]: "saved" }));
      })
      .catch(() => {
        if (questionGenerationRef.current[key] !== generation) return;
        setVoiceAnswers((current) => ({ ...current, [key]: "failed" }));
        setNotice(
          `${MISSING_QUESTIONS[key].label} samajh nahi aaya. Dobara boliye.`,
        );
      });
  };

  const startRecording = async (purpose: RecordingPurpose) => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setNotice("Voice input is browser mein available nahi hai.");
      return;
    }
    if (recorderRef.current?.state === "recording") return;
    setNotice("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mimeType = preferredAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType
          ? { mimeType, audioBitsPerSecond: 64000 }
          : { audioBitsPerSecond: 64000 },
      );
      const chunks: Blob[] = [];
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      recordingPurposeRef.current = purpose;
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setNotice("Voice save nahi hui. Ek baar phir boliye.");
      };
      recorder.onstop = () => {
        const stoppedPurpose = recordingPurposeRef.current;
        const duration = Date.now() - recordingStartedAtRef.current;
        const finalType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: finalType });
        const audio = new File(
          [blob],
          `invoice-voice-${Date.now()}.${audioExtension(finalType)}`,
          { type: finalType },
        );
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        recorderRef.current = null;
        recordingPurposeRef.current = null;
        setRecordingPurpose(null);

        if (!stoppedPurpose || blob.size === 0 || duration < 250) {
          setNotice("Voice save nahi hui. Ek baar phir boliye.");
          return;
        }
        if (stoppedPurpose === "quick") {
          quickVoiceTaskRef.current = extractCustomerInvoiceVoice(
            audio,
            draft.product,
          );
          void quickVoiceTaskRef.current.catch(() => undefined);
          setNotice("Voice save ho gayi.");
          return;
        }
        advanceMissingDetails();
        processQuestionVoice(stoppedPurpose, audio);
      };
      recorder.start();
      setRecordingPurpose(purpose);
    } catch {
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      recorderStreamRef.current = null;
      recorderRef.current = null;
      recordingPurposeRef.current = null;
      setRecordingPurpose(null);
      setNotice("Microphone permission allow karke dobara try karein.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const handleVoicePress = (purpose: RecordingPurpose) => {
    if (recordingPurpose === purpose) {
      stopRecording();
      return;
    }
    if (!recordingPurpose) void startRecording(purpose);
  };

  const submitAndPay = async () => {
    const validation = validateDraft(draft);
    if (validation) {
      setNotice(validation);
      openMissingDetails(draft);
      return;
    }
    if (!user?.id) {
      setNotice("Your session is missing. Please sign in again.");
      return;
    }
    if (pendingVoiceAnswers) {
      setNotice("Details save ho rahi hain.");
      return;
    }
    setStage("creating");
    setNotice("");
    try {
      const invoice = await createCustomerInvoice(
        user.id,
        draft,
        files,
        pricing,
      );
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

  if (stage === "capture") {
    const quickRecording = recordingPurpose === "quick";
    return (
      <CustomerAppShell activeTab="create" showBottomNav={false}>
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
                  <img
                    src={previewUrl}
                    alt=""
                    decoding="async"
                    className={styles.capturePreviewImage}
                  />
                ) : (
                  <div className={styles.captureFilePreview}>
                    <FolderOpen size={34} />
                    <span>{files[0].name}</span>
                  </div>
                )}
                {files.length > 1 ? (
                  <span className={styles.captureCount}>
                    1/{files.length}
                  </span>
                ) : null}
                <div className={styles.capturePreviewActions}>
                  <button type="button" onClick={() => setSourceOpen(true)}>
                    <ImagePlus size={17} />
                    Photo badlein
                  </button>
                  <button type="button" onClick={removeFirstFile}>
                    <Trash2 size={17} />
                    Delete
                  </button>
                </div>
                {extractionState === "optimizing" ||
                extractionState === "reading" ? (
                  <div className={styles.eagerReadingBadge}>
                    <LoaderCircle className="animate-spin" size={15} />
                    Parchi padh rahe hain
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                className={styles.captureZone}
                onClick={() => setSourceOpen(true)}
                disabled={extractionState === "optimizing"}
              >
                <span className={styles.captureIcon}>
                  {extractionState === "optimizing" ? (
                    <LoaderCircle className="animate-spin" size={36} />
                  ) : (
                    <ImagePlus size={36} />
                  )}
                </span>
                <span className={styles.captureTitle}>
                  Weighment slip dalein
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
            onChange={(event) => void selectFiles(event)}
          />
          <input
            ref={uploadRef}
            hidden
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(event) => void selectFiles(event)}
          />

          {notice ? <div className={styles.notice}>{notice}</div> : null}

          <div className={styles.quickComposer}>
            <div className={styles.quickComposerAccessory}>
              <button
                type="button"
                className={`${styles.quickMic} ${
                  quickRecording ? styles.quickMicRecording : ""
                }`}
                onClick={() => handleVoicePress("quick")}
                aria-label={quickRecording ? "Voice answer done" : "Voice input"}
              >
                {quickRecording ? <Check size={22} /> : <Mic size={22} />}
              </button>
              {quickRecording ? (
                <span className={styles.recordingTime}>
                  {formatRecordingTime(recordingSeconds)}
                </span>
              ) : null}
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
                  (!files.length &&
                    !quickText.trim() &&
                    !quickVoiceTaskRef.current) ||
                  extractionState === "optimizing" ||
                  Boolean(recordingPurpose)
                }
                aria-label="Details bhejein"
              >
                <Send size={17} />
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
                <span>
                  <Camera size={25} />
                </span>
                Photo kheenchein
              </button>
              <button
                type="button"
                className={styles.sourceOption}
                onClick={() => uploadRef.current?.click()}
              >
                <span>
                  <FolderOpen size={25} />
                </span>
                Gallery
              </button>
            </div>
          </div>
        ) : null}
      </CustomerAppShell>
    );
  }

  return (
    <CustomerAppShell activeTab="create" showBottomNav={false}>
      <header className={styles.secondaryHeader}>
        <button
          type="button"
          className={styles.secondaryBack}
          onClick={() => setStage("capture")}
          aria-label="Back to upload"
          disabled={stage === "creating"}
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>Details check karein</h1>
        <span />
      </header>

      <main className={`${styles.pageBody} ${styles.reviewBody}`}>
        {extractionState === "reading" ? (
          <div className={styles.inlineExtractionNotice}>
            <LoaderCircle className="animate-spin" size={16} />
            Parchi padh rahe hain…
          </div>
        ) : null}

        <section className={styles.reviewTopCard}>
          <div className={styles.reviewProductRow}>
            <div className={styles.reviewProduct}>
              <input
                aria-label="Commodity"
                value={draft.product}
                onChange={(event) => update("product", event.target.value)}
              />
              <ChevronDown size={18} />
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
              label={isTenderCoconut ? "Vyapari" : "Supplier"}
              value={draft.supplierName}
              onChange={(value) => update("supplierName", value)}
            />
            <CompactInput
              label="Buyer"
              value={draft.buyerName}
              onChange={(value) => update("buyerName", value)}
            />
            <CompactInput
              label={isTenderCoconut ? "Vyapari address" : "Supplier address"}
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
            <div className={`${styles.inlineCalculatedTotal} ${styles.detailGridFull}`}>
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <CompactInput
              label="Vehicle number"
              value={draft.vehicleNumber}
              onChange={(value) =>
                update(
                  "vehicleNumber",
                  value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                )
              }
            />
            {isTenderCoconut ? (
              <div className={styles.inlineTonnage}>
                {(["25", "30"] as const).map((tonnage) => (
                  <button
                    key={tonnage}
                    type="button"
                    className={
                      draft.vehicleTonnage === tonnage
                        ? styles.tonnageButtonActive
                        : ""
                    }
                    onClick={() => update("vehicleTonnage", tonnage)}
                  >
                    {tonnage}t
                  </button>
                ))}
              </div>
            ) : null}
          </DetailSection>

          <DetailSection title="Contact" icon={<Phone size={20} />}>
            <CompactInput
              label="Buyer mobile"
              inputMode="tel"
              value={draft.insuredPartyPhone}
              onChange={(value) =>
                update("insuredPartyPhone", phoneInput(value))
              }
            />
            <CompactInput
              label="Driver mobile"
              inputMode="tel"
              value={draft.driverPhone}
              onChange={(value) => update("driverPhone", phoneInput(value))}
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
          disabled={
            stage === "creating" ||
            extractionState === "reading" ||
            pendingVoiceAnswers > 0
          }
        >
          {stage === "creating" ||
          extractionState === "reading" ||
          pendingVoiceAnswers > 0 ? (
            <LoaderCircle className="animate-spin" size={19} />
          ) : null}
          {extractionState === "reading"
            ? "Parchi padh rahe hain"
            : pendingVoiceAnswers > 0
              ? "Details save ho rahi hain"
              : validationIssue
                ? "Details poori karein"
                : `Pay ${payableMoney(premium)}`}
        </button>
      </div>

      {missingOpen && activeMissingKey && activeQuestion ? (
        <div className={styles.missingDetailsModal}>
          <button
            type="button"
            className={styles.missingDetailsBackdrop}
            onClick={() => setMissingOpen(false)}
            aria-label="Close details"
          />
          <section className={styles.missingDetailsSheet}>
            <div className={styles.missingDetailsHeader}>
              <div>
                <h2>Details bataiye</h2>
                <p>
                  {missingIndex + 1} of {missingKeys.length}
                  {pendingVoiceAnswers
                    ? ` · ${pendingVoiceAnswers} save ho raha hai`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMissingOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <h3>{activeQuestion.label}</h3>

            {activeMissingKey === "vehicleTonnage" ? (
              <div className={styles.missingChoiceRow}>
                {(["25", "30"] as const).map((tonnage) => (
                  <button
                    key={tonnage}
                    type="button"
                    className={
                      draft.vehicleTonnage === tonnage
                        ? styles.missingChoiceSelected
                        : ""
                    }
                    onClick={() => update("vehicleTonnage", tonnage)}
                  >
                    {tonnage} ton
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.missingVoiceArea}>
                <button
                  type="button"
                  className={`${styles.missingVoiceButton} ${
                    recordingPurpose === activeMissingKey
                      ? styles.missingVoiceButtonRecording
                      : ""
                  }`}
                  onClick={() => handleVoicePress(activeMissingKey)}
                  aria-label={
                    recordingPurpose === activeMissingKey
                      ? "Voice answer done"
                      : "Speak answer"
                  }
                >
                  {recordingPurpose === activeMissingKey ? (
                    <Check size={31} />
                  ) : (
                    <Mic size={31} />
                  )}
                </button>
                <div className={styles.voiceWaveform} aria-hidden="true">
                  {Array.from({ length: 18 }, (_, index) => (
                    <span
                      key={index}
                      style={{
                        height:
                          recordingPurpose === activeMissingKey
                            ? `${12 + ((index * 17) % 30)}px`
                            : "4px",
                      }}
                    />
                  ))}
                </div>
                <strong>
                  {recordingPurpose === activeMissingKey
                    ? "Ho gaya? Tap karein"
                    : "Boliye"}
                </strong>
                {recordingPurpose === activeMissingKey ? (
                  <span>{formatRecordingTime(recordingSeconds)}</span>
                ) : null}
              </div>
            )}

            {recordingPurpose !== activeMissingKey ? (
              <div className={styles.missingActions}>
                {missingIndex > 0 ? (
                  <button
                    type="button"
                    className={styles.missingBack}
                    onClick={() =>
                      setMissingIndex((current) => Math.max(0, current - 1))
                    }
                  >
                    <ChevronLeft size={20} />
                    Back
                  </button>
                ) : (
                  <span />
                )}
                {isMissingDetailAnswered(
                  activeMissingKey,
                  String(draft[activeMissingKey] || ""),
                ) ? (
                  <button
                    type="button"
                    className={styles.missingNext}
                    onClick={advanceMissingDetails}
                  >
                    {missingIndex === missingKeys.length - 1 ? "Done" : "Next"}
                    {missingIndex < missingKeys.length - 1 ? (
                      <ChevronRight size={20} />
                    ) : null}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
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

function applyProfileDefaults(
  current: CustomerInvoiceDraft,
  profile: Record<string, unknown>,
): CustomerInvoiceDraft {
  return {
    ...current,
    supplierName:
      current.supplierName ||
      text(profile.supplierName || profile.supplier_name),
    supplierAddress:
      current.supplierAddress ||
      text(profile.supplierAddress || profile.supplier_address),
    buyerName:
      current.buyerName || text(profile.buyerName || profile.buyer_name),
    buyerAddress:
      current.buyerAddress ||
      text(
        profile.buyerAddress ||
          profile.shipToAddress ||
          profile.buyer_address,
      ),
    placeOfSupply:
      current.placeOfSupply ||
      text(profile.placeOfSupply || profile.place_of_supply),
    product:
      current.product ||
      text(profile.lastProductName || profile.productName || profile.commodity),
    vehicleNumber:
      current.vehicleNumber ||
      text(profile.vehicleNumber || profile.vehicle_number)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
    vehicleTonnage:
      current.vehicleTonnage ||
      tonnage(profile.vehicleTonnage || profile.vehicle_tonnage),
    driverPhone:
      current.driverPhone || phone(profile.driverPhone || profile.driver_phone),
    insuredPartyPhone:
      current.insuredPartyPhone ||
      phone(profile.insuredPartyPhone || profile.insured_party_phone),
  };
}

function applyExtraction(
  current: CustomerInvoiceDraft,
  response: Record<string, unknown>,
): CustomerInvoiceDraft {
  const raw = extractionDraft(response);
  const quantity = numberText(raw.quantity);
  const extractedTotal = numberText(raw.total_amount || raw.amount);
  const rate =
    numberText(raw.rate) ||
    (quantity && extractedTotal
      ? String(round(Number(extractedTotal) / Number(quantity)))
      : "");

  return {
    ...current,
    supplierName:
      text(raw.seller_name || raw.supplier_name) || current.supplierName,
    supplierAddress:
      text(raw.supplier_address) || current.supplierAddress,
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
    totalAmount: extractedTotal || current.totalAmount,
    vehicleNumber:
      text(raw.vehicle_number || raw.truck_number)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") || current.vehicleNumber,
    vehicleTonnage:
      tonnage(raw.vehicle_tonnage) || current.vehicleTonnage,
    driverPhone: phone(raw.driver_phone) || current.driverPhone,
    insuredPartyPhone:
      phone(raw.insured_party_phone || raw.buyer_phone) ||
      current.insuredPartyPhone,
    ownerName:
      text(raw.owner_name || raw.transporter_name) || current.ownerName,
    invoiceDate: normalizeDate(raw.invoice_date) || current.invoiceDate,
    note: text(raw.notes) || current.note,
  };
}

function applyMissingVoiceValue(
  current: CustomerInvoiceDraft,
  key: MissingDetailKey,
  value: string,
) {
  const next = { ...current, [key]: value };
  if (key === "quantity" || key === "totalAmount") {
    const quantity = Number(next.quantity);
    const total = Number(next.totalAmount);
    if (quantity > 0 && total > 0) {
      next.rate = String(round(total / quantity));
    }
  }
  return next;
}

function missingVoiceValue(
  response: Record<string, unknown>,
  key: MissingDetailKey,
) {
  const raw = extractionDraft(response);
  switch (key) {
    case "supplierName":
      return text(raw.seller_name || raw.supplier_name);
    case "buyerName":
      return text(raw.buyer_name);
    case "buyerAddress":
      return text(raw.buyer_address);
    case "quantity":
      return numberText(raw.quantity);
    case "totalAmount":
      return numberText(raw.total_amount);
    case "vehicleTonnage":
      return tonnage(raw.vehicle_tonnage);
    case "insuredPartyPhone":
      return phone(raw.insured_party_phone || raw.buyer_phone);
  }
}

function extractionDraft(response: Record<string, unknown>) {
  let payload = response;
  for (let depth = 0; depth < 4; depth += 1) {
    if (payload.draft && typeof payload.draft === "object") {
      return payload.draft as Record<string, unknown>;
    }
    if (!payload.data || typeof payload.data !== "object") break;
    payload = payload.data as Record<string, unknown>;
  }
  return payload;
}

function getMissingDetailKeys(draft: CustomerInvoiceDraft) {
  if (!isTenderCoconutProduct(draft.product)) return [];
  const ordered: MissingDetailKey[] = [
    "supplierName",
    "buyerName",
    "buyerAddress",
    "quantity",
    "totalAmount",
    "vehicleTonnage",
    "insuredPartyPhone",
  ];
  return ordered.filter(
    (key) =>
      !isMissingDetailAnswered(key, String(draft[key] || "")),
  );
}

function isMissingDetailAnswered(key: MissingDetailKey, value: string) {
  const clean = value.trim();
  if (key === "insuredPartyPhone") return /^[6-9]\d{9}$/.test(phone(clean));
  if (key === "quantity" || key === "totalAmount") {
    return Number(clean) > 0;
  }
  if (key === "vehicleTonnage") return clean === "25" || clean === "30";
  return Boolean(clean);
}

function validateDraft(draft: CustomerInvoiceDraft) {
  const supplier = isTenderCoconutProduct(draft.product)
    ? "Vyapari"
    : "Supplier";
  if (!draft.supplierName.trim()) return `${supplier} ka naam add karein.`;
  if (!draft.supplierAddress.trim()) return `${supplier} address add karein.`;
  if (!draft.placeOfSupply.trim()) return "Place of supply add karein.";
  if (!draft.buyerName.trim()) return "Buyer ka naam add karein.";
  if (!draft.buyerAddress.trim()) return "Buyer address add karein.";
  if (!draft.product.trim()) return "Commodity add karein.";
  if (!(Number(draft.quantity) > 0)) return "Sahi quantity add karein.";
  if (!(Number(draft.rate) > 0)) return "Sahi rate add karein.";
  if (!draft.vehicleNumber.trim()) return "Vehicle number add karein.";
  if (
    isTenderCoconutProduct(draft.product) &&
    draft.vehicleTonnage !== "25" &&
    draft.vehicleTonnage !== "30"
  ) {
    return "Vehicle tonnage chunein.";
  }
  if (!/^[6-9]\d{9}$/.test(phone(draft.insuredPartyPhone))) {
    return "Buyer ka 10 digit mobile number add karein.";
  }
  if (
    draft.driverPhone.trim() &&
    !/^[6-9]\d{9}$/.test(phone(draft.driverPhone))
  ) {
    return "Driver ka sahi 10 digit mobile number add karein.";
  }
  return "";
}

function resolveInvoiceAmount(
  draft: CustomerInvoiceDraft,
  pricing: CustomerAppPricing["tenderCoconut"],
) {
  const extractedTotal = Number(draft.totalAmount || 0);
  const calculated = Number(draft.quantity || 0) * Number(draft.rate || 0);
  const goodsAmount =
    Number.isFinite(extractedTotal) && extractedTotal > 0
      ? extractedTotal
      : Number.isFinite(calculated)
        ? calculated
        : 0;
  const logistics = isTenderCoconutProduct(draft.product)
    ? draft.vehicleTonnage === "25"
      ? Number(pricing.amount25Ton || 0)
      : draft.vehicleTonnage === "30"
        ? Number(pricing.amount30Ton || 0)
        : 0
    : 0;
  return Number((goodsAmount + logistics).toFixed(2));
}

async function optimizeImageForOcr(file: File) {
  if (!file.type.startsWith("image/") || typeof createImageBitmap === "undefined") {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 1_600_000) {
      bitmap.close();
      return file;
    }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.76),
    );
    if (!blob) return file;
    return new File([blob], jpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

function preferredAudioMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function audioExtension(type: string) {
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

function fileSetKey(files: File[]) {
  return files
    .map((file) => `${file.name}:${file.size}:${file.lastModified}`)
    .join("|");
}

function jpegName(name: string) {
  return `${name.replace(/\.[^.]+$/, "") || "invoice"}.jpg`;
}

function formatRecordingTime(seconds: number) {
  return `0:${String(Math.min(59, seconds)).padStart(2, "0")}`;
}

function text(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return text(record.address || record.line1 || record.name);
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

function phoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function tonnage(value: unknown) {
  return String(value || "").match(/\b(25|30)\b/)?.[1] || "";
}

function normalizeDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function payableMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}
