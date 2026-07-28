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
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  Mic,
  Phone,
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
  extractCustomerInvoiceVoice,
  getCustomerAppPricing,
  getCustomerTenderCoconutPrefill,
  isTenderCoconutProduct,
  type CustomerAppPricing,
  type CustomerInvoiceDraft,
  type TenderCoconutPrefill,
} from "./api";
import { CustomerAppShell } from "./CustomerAppShell";
import { money, readableError } from "./utils";
import styles from "./customer-app.module.css";

type Stage = "capture" | "extracting" | "review" | "creating";
type MissingDetailKey =
  | "supplierName"
  | "buyerName"
  | "buyerAddress"
  | "quantity"
  | "totalAmount"
  | "vehicleTonnage"
  | "insuredPartyPhone";
type VoicePhase =
  | "idle"
  | "prompt"
  | "requesting"
  | "recording"
  | "failed";
type MissingQuestion = {
  label: string;
  audio: string;
  targetField?: string;
};

const TENDER_MISSING_QUESTIONS: Record<MissingDetailKey, MissingQuestion> = {
  supplierName: {
    label: "Aapka vyapari kaun hai?",
    audio: "/customer-app/voices/tender-coconut-supplier-name.mp3",
    targetField: "supplier_name",
  },
  buyerName: {
    label: "Buyer ka naam",
    audio: "/customer-app/voices/tender-coconut-buyer-name.mp3",
    targetField: "buyer_name",
  },
  buyerAddress: {
    label: "Buyer ka address",
    audio: "/customer-app/voices/tender-coconut-buyer-address.mp3",
    targetField: "buyer_address",
  },
  quantity: {
    label: "Kitne dane hain?",
    audio: "/customer-app/voices/tender-coconut-quantity.mp3",
    targetField: "quantity",
  },
  totalAmount: {
    label: "Kitne lakh ka maal hai?",
    audio: "/customer-app/voices/tender-coconut-total-amount.mp3",
    targetField: "total_amount",
  },
  vehicleTonnage: {
    label: "Gaadi kitne ton ki hai?",
    audio: "/customer-app/voices/tender-coconut-vehicle-tonnage.mp3",
  },
  insuredPartyPhone: {
    label: "Buyer mobile",
    audio: "/customer-app/voices/tender-coconut-buyer-mobile.mp3",
    targetField: "insured_party_phone",
  },
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyDraft(user: Record<string, unknown> | null): CustomerInvoiceDraft {
  const userName = String(user?.name || user?.fullName || "");
  const userPhone = String(
    user?.mobileNumber ||
      user?.phone ||
      user?.mobile ||
      user?.phoneNumber ||
      "",
  );
  const primaryCommodityCode = String(
    user?.primaryCommodityCode || "",
  ).toUpperCase();
  const product =
    primaryCommodityCode === "TENDER_COCONUT"
      ? "Tender Coconut"
      : Array.isArray(user?.products)
        ? String(user.products[0] || "")
        : String(user?.commodity || user?.product || "");
  return {
    invoiceDate: today(),
    mode: "Cash",
    supplierName: "",
    supplierAddress: "",
    buyerName: userName,
    buyerAddress: userProfileAddress(user),
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
  const [stage, setStage] = useState<Stage>("capture");
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<CustomerInvoiceDraft>(() =>
    emptyDraft(user),
  );
  const draftRef = useRef(draft);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [pricing, setPricing] = useState<
    CustomerAppPricing["tenderCoconut"] | null
  >(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [amountBreakdownOpen, setAmountBreakdownOpen] = useState(false);
  const [missingDetailKeys, setMissingDetailKeys] = useState<
    MissingDetailKey[]
  >([]);
  const [missingDetailIndex, setMissingDetailIndex] = useState(0);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [pendingVoiceAnswers, setPendingVoiceAnswers] = useState(0);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const questionGenerationRef = useRef(0);
  const startQuestionRecordingRef = useRef<() => void>(() => {});
  const tenderPrefillRequestRef = useRef<{
    userId: string;
    request: Promise<TenderCoconutPrefill | null>;
  } | null>(null);

  draftRef.current = draft;

  const isTenderCoconut = isTenderCoconutProduct(draft.product);
  const amountBreakdown = useMemo(() => {
    const invoiceAmount =
      Number(draft.totalAmount || 0) ||
      Number(draft.quantity || 0) * Number(draft.rate || 0);
    const logisticsAmount =
      isTenderCoconut && pricing
        ? draft.vehicleTonnage === "25"
          ? Number(pricing.amount25Ton || 0)
          : draft.vehicleTonnage === "30"
            ? Number(pricing.amount30Ton || 0)
            : 0
        : 0;
    return {
      invoiceAmount: Number(invoiceAmount.toFixed(2)),
      logisticsAmount: Number(logisticsAmount.toFixed(2)),
      totalAmount: Number((invoiceAmount + logisticsAmount).toFixed(2)),
    };
  }, [
    draft.quantity,
    draft.rate,
    draft.totalAmount,
    draft.vehicleTonnage,
    isTenderCoconut,
    pricing,
  ]);
  const total = amountBreakdown.totalAmount;
  const premium = Number((total * 0.002).toFixed(2));

  const loadTenderCoconutPrefill = useCallback(() => {
    const userId = String(user?.id || "");
    if (!userId) return Promise.resolve<TenderCoconutPrefill | null>(null);
    if (tenderPrefillRequestRef.current?.userId === userId) {
      return tenderPrefillRequestRef.current.request;
    }
    const request = getCustomerTenderCoconutPrefill().catch(() => null);
    tenderPrefillRequestRef.current = { userId, request };
    return request;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const defaults = emptyDraft(user);
    setDraft((current) => ({
      ...current,
      buyerName: current.buyerName || defaults.buyerName,
      buyerAddress: current.buyerAddress || defaults.buyerAddress,
      insuredPartyPhone:
        current.insuredPartyPhone || defaults.insuredPartyPhone,
      placeOfSupply: current.placeOfSupply || defaults.placeOfSupply,
      product: current.product || defaults.product,
    }));
  }, [user]);

  useEffect(() => {
    if (!user || !isTenderCoconut) return;
    let active = true;
    void loadTenderCoconutPrefill().then((prefill) => {
      if (!active || !prefill) return;
      setDraft((current) => applyBuyerIdentityPrefill(current, prefill, user));
    });
    return () => {
      active = false;
    };
  }, [isTenderCoconut, loadTenderCoconutPrefill, user]);

  useEffect(() => {
    if (!isTenderCoconut) {
      setPricing(null);
      setPricingError("");
      setPricingLoading(false);
      return;
    }

    let active = true;
    setPricingLoading(true);
    setPricingError("");
    void getCustomerAppPricing()
      .then((response) => {
        if (!active) return;
        setPricing(response.tenderCoconut);
      })
      .catch(() => {
        if (!active) return;
        setPricing(null);
        setPricingError("Amount load nahi hua. Dobara try karein.");
      })
      .finally(() => {
        if (active) setPricingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isTenderCoconut]);

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
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "rate") {
        const quantity = Number(next.quantity);
        const rate = Number(value);
        if (quantity > 0 && rate > 0) {
          next.totalAmount = String(round(quantity * rate));
        }
      }
      if (field === "quantity" || field === "totalAmount") {
        const quantity = Number(next.quantity);
        const totalAmount = Number(next.totalAmount);
        if (quantity > 0 && totalAmount > 0) {
          next.rate = String(round(totalAmount / quantity));
        }
      }
      return next;
    });
  };

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files || []).filter(
      (file) =>
        file.type.startsWith("image/") ||
        file.type === "application/pdf",
    );
    if (!next.length) return;
    primeQuestionAudio();
    const selectedFiles = [...files, ...next].slice(0, 8);
    setFiles(selectedFiles);
    setSourceOpen(false);
    setNotice("");
    event.target.value = "";
    void extract(selectedFiles);
  };

  const openMissingDetails = (nextDraft: CustomerInvoiceDraft) => {
    const keys = getTenderMissingDetailKeys(nextDraft);
    setMissingDetailKeys(keys);
    setMissingDetailIndex(0);
    setVoicePhase("idle");
  };

  async function extract(selectedFiles: File[] = files) {
    if (!selectedFiles.length) {
      setNotice("Weighment slip dalein.");
      return;
    }
    setStage("extracting");
    setNotice("");
    try {
      const response = await extractCustomerInvoice(selectedFiles);
      let nextDraft = applyExtraction(draftRef.current, response);
      if (isTenderCoconutProduct(nextDraft.product)) {
        const prefill = await loadTenderCoconutPrefill();
        nextDraft = applyBuyerIdentityPrefill(nextDraft, prefill, user);
      }
      setDraft(nextDraft);
      setStage("review");
      openMissingDetails(nextDraft);
    } catch (error) {
      setNotice(
        readableError(
          error,
          "Details scan nahi ho paaye. Aap manually details bhar sakte hain.",
        ),
      );
      setStage("review");
      let fallbackDraft = draftRef.current;
      if (isTenderCoconutProduct(fallbackDraft.product)) {
        const prefill = await loadTenderCoconutPrefill();
        fallbackDraft = applyBuyerIdentityPrefill(
          fallbackDraft,
          prefill,
          user,
        );
        setDraft(fallbackDraft);
      }
      openMissingDetails(fallbackDraft);
    }
  }

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
      if (isTenderCoconut && !pricing) {
        throw new Error("Amount load nahi hua. Dobara try karein.");
      }
      const invoice = await createCustomerInvoice(
        user.id,
        draft,
        files,
        pricing || undefined,
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

  const activeMissingDetailKey =
    missingDetailKeys[missingDetailIndex] || null;
  const activeMissingQuestion = activeMissingDetailKey
    ? TENDER_MISSING_QUESTIONS[activeMissingDetailKey]
    : null;
  const isFinalizingReview =
    stage === "review" &&
    !activeMissingDetailKey &&
    (pendingVoiceAnswers > 0 || (isTenderCoconut && pricingLoading));

  const stopQuestionAudio = () => {
    const audio = questionAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  };

  function primeQuestionAudio() {
    const audio = questionAudioRef.current || new Audio();
    questionAudioRef.current = audio;
    audio.src = TENDER_MISSING_QUESTIONS.supplierName.audio;
    audio.preload = "auto";
    audio.muted = true;
    void audio.play().catch(() => {});
    requestAnimationFrame(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    });
  }

  const releaseMicrophone = useCallback(() => {
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
  }, []);

  const closeMissingDetails = useCallback(() => {
    questionGenerationRef.current += 1;
    discardRecordingRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    mediaRecorderRef.current = null;
    const audio = questionAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    releaseMicrophone();
    setMissingDetailKeys([]);
    setMissingDetailIndex(0);
    setVoicePhase("idle");
  }, [releaseMicrophone]);

  const advanceMissingDetail = useCallback(
    (completedKey: MissingDetailKey) => {
      const completedIndex = missingDetailKeys.indexOf(completedKey);
      if (
        completedIndex < 0 ||
        completedIndex >= missingDetailKeys.length - 1
      ) {
        closeMissingDetails();
        return;
      }
      setMissingDetailIndex(completedIndex + 1);
      setVoicePhase("idle");
    },
    [closeMissingDetails, missingDetailKeys],
  );

  const processVoiceAnswer = useCallback(
    async (
      key: MissingDetailKey,
      audioFile: File,
      durationMillis: number,
    ) => {
      const question = TENDER_MISSING_QUESTIONS[key];
      if (!question.targetField) return;
      setPendingVoiceAnswers((count) => count + 1);
      try {
        const response = await extractCustomerInvoiceVoice(
          audioFile,
          durationMillis,
          draft.product || "Tender Coconut",
          question.targetField,
        );
        setDraft((current) => applyMissingVoiceAnswer(current, key, response));
      } catch (error) {
        setNotice(
          readableError(
            error,
            `${question.label} samajh nahi aaya. Review mein manually add karein.`,
          ),
        );
      } finally {
        setPendingVoiceAnswers((count) => Math.max(0, count - 1));
      }
    },
    [draft.product],
  );

  const startQuestionRecording = useCallback(async () => {
    const key = activeMissingDetailKey;
    const question = activeMissingQuestion;
    if (
      !key ||
      !question?.targetField ||
      voicePhase === "requesting" ||
      voicePhase === "recording"
    ) {
      return;
    }

    stopQuestionAudio();
    setVoicePhase("requesting");
    setNotice("");
    discardRecordingRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("VOICE_NOT_SUPPORTED");
      }
      let stream = microphoneStreamRef.current;
      if (!stream || !stream.getAudioTracks().some((track) => track.readyState === "live")) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        microphoneStreamRef.current = stream;
      }

      const mimeType = preferredRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setVoicePhase("failed");
        setNotice("Mic se recording nahi ho paayi. Dobara tap karein.");
      };
      recorder.onstop = () => {
        mediaRecorderRef.current = null;
        if (discardRecordingRef.current) {
          recordingChunksRef.current = [];
          return;
        }
        const durationMillis = Math.max(
          0,
          Math.round(performance.now() - recordingStartedAtRef.current),
        );
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type });
        recordingChunksRef.current = [];
        if (!blob.size) {
          setVoicePhase("failed");
          setNotice("Awaaz record nahi hui. Mic dobara tap karein.");
          return;
        }
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const audioFile = new File(
          [blob],
          `invoice-${key}-answer-${Date.now()}.${extension}`,
          { type },
        );
        advanceMissingDetail(key);
        void processVoiceAnswer(key, audioFile, durationMillis);
      };
      recordingStartedAtRef.current = performance.now();
      recorder.start(180);
      setVoicePhase("recording");
    } catch (error) {
      setVoicePhase("failed");
      setNotice(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Mic permission allow karke mic dobara tap karein."
          : "Is browser mein voice recording start nahi hui. Mic dobara tap karein.",
      );
    }
  }, [
    activeMissingDetailKey,
    activeMissingQuestion,
    advanceMissingDetail,
    processVoiceAnswer,
    voicePhase,
  ]);
  startQuestionRecordingRef.current = () => {
    void startQuestionRecording();
  };

  const stopQuestionRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const handleVoiceControl = () => {
    if (voicePhase === "recording") {
      stopQuestionRecording();
      return;
    }
    void startQuestionRecording();
  };

  useEffect(() => {
    if (!activeMissingDetailKey || !activeMissingQuestion) return;
    const generation = questionGenerationRef.current + 1;
    questionGenerationRef.current = generation;
    setVoicePhase("prompt");
    setNotice("");
    const audio = questionAudioRef.current || new Audio();
    questionAudioRef.current = audio;
    audio.src = activeMissingQuestion.audio;
    audio.preload = "auto";
    audio.muted = false;
    audio.volume = 1;
    audio.onended = () => {
      if (questionGenerationRef.current !== generation) return;
      if (activeMissingQuestion.targetField) {
        startQuestionRecordingRef.current();
      } else {
        setVoicePhase("idle");
      }
    };
    audio.onerror = () => {
      if (questionGenerationRef.current !== generation) return;
      if (activeMissingQuestion.targetField) {
        startQuestionRecordingRef.current();
      } else {
        setVoicePhase("idle");
      }
    };
    audio.load();
    void playQuestionAudioWithRetry(audio, generation, questionGenerationRef)
      .then((played) => {
        if (
          played ||
          questionGenerationRef.current !== generation
        ) {
          return;
        }
        setNotice("Question audio play nahi hua. Mic tap karke jawab boliye.");
        setVoicePhase("failed");
      });
    return () => {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
    };
  }, [activeMissingDetailKey, activeMissingQuestion]);

  useEffect(
    () => () => {
      discardRecordingRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseMicrophone();
      questionAudioRef.current?.pause();
    },
    [releaseMicrophone],
  );

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
                {stage === "extracting" ? (
                  <div className={styles.captureReadingOverlay} role="status">
                    <LoaderCircle className="animate-spin" size={28} />
                    <strong>Parchi padh rahe hain</strong>
                    <span>Details apne aap bhar jayengi</span>
                  </div>
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
              <span aria-hidden="true">{isTenderCoconut ? "🥥" : "🍅"}</span>
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
              label="Goods value"
              inputMode="decimal"
              value={draft.totalAmount}
              full
              onChange={(value) => update("totalAmount", value)}
            />
            <CompactInput
              label="Vehicle number"
              value={draft.vehicleNumber}
              full
              onChange={(value) => update("vehicleNumber", value.toUpperCase())}
            />
            {isTenderCoconut ? (
              <div className={`${styles.tonnageField} ${styles.detailGridFull}`}>
                <span>Vehicle tonnage</span>
                <div>
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
                      {tonnage} ton
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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

        <section className={styles.amountBreakdownCard}>
          <button
            type="button"
            className={styles.amountBreakdownTrigger}
            onClick={() => setAmountBreakdownOpen((current) => !current)}
            aria-expanded={amountBreakdownOpen}
            aria-controls="invoice-amount-breakdown"
          >
            <span>Total amount</span>
            <span className={styles.amountBreakdownTriggerValue}>
              <strong>{money(total)}</strong>
              <ChevronDown
                size={19}
                className={
                  amountBreakdownOpen ? styles.amountBreakdownChevronOpen : ""
                }
              />
            </span>
          </button>
          {amountBreakdownOpen ? (
            <div
              id="invoice-amount-breakdown"
              className={styles.amountBreakdownBody}
            >
              <div className={styles.amountBreakdownRow}>
                <span>Invoice amount</span>
                <strong>{money(amountBreakdown.invoiceAmount)}</strong>
              </div>
              {amountBreakdown.logisticsAmount > 0 ? (
                <div className={styles.amountBreakdownRow}>
                  <span>
                    Logistics cost
                    {draft.vehicleTonnage
                      ? ` (${draft.vehicleTonnage} ton)`
                      : ""}
                  </span>
                  <strong>{money(amountBreakdown.logisticsAmount)}</strong>
                </div>
              ) : null}
              <div
                className={`${styles.amountBreakdownRow} ${styles.amountBreakdownFinal}`}
              >
                <span>Total amount</span>
                <strong>{money(total)}</strong>
              </div>
            </div>
          ) : null}
        </section>

        {notice || pricingError ? (
          <div className={styles.notice}>{notice || pricingError}</div>
        ) : null}
      </main>

      <div className={styles.stickyPay}>
        <button
          type="button"
          className={styles.wideButton}
          onClick={() => void submitAndPay()}
          disabled={
            stage === "creating" ||
            pendingVoiceAnswers > 0 ||
            (isTenderCoconut && (pricingLoading || !pricing))
          }
        >
          {stage === "creating" ? (
            <LoaderCircle className="animate-spin" size={19} />
          ) : null}
          {pendingVoiceAnswers > 0
            ? "Details save ho rahi hain"
            : isTenderCoconut && pricingLoading
              ? "Amount load ho raha hai"
              : `Pay ${payableMoney(premium)}`}
        </button>
      </div>

      {isFinalizingReview ? (
        <div
          className={styles.finalizingReviewOverlay}
          role="status"
          aria-live="polite"
          aria-label="Details taiyar ho rahi hain"
        >
          <div className={styles.finalizingReviewStatus}>
            <LoaderCircle size={34} strokeWidth={2.2} aria-hidden="true" />
            <strong>Details taiyar ho rahi hain</strong>
          </div>
        </div>
      ) : null}

      {activeMissingDetailKey && activeMissingQuestion ? (
        <div className={styles.missingDetailsModal}>
          <button
            type="button"
            className={styles.missingDetailsBackdrop}
            onClick={closeMissingDetails}
            aria-label="Close missing details"
          />
          <section
            className={styles.missingDetailsSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="missing-detail-question"
          >
            <header className={styles.missingDetailsHeader}>
              <div>
                <h2>Details bataiye</h2>
                <p>
                  {missingDetailIndex + 1} of {missingDetailKeys.length}
                  {pendingVoiceAnswers > 0
                    ? ` · ${pendingVoiceAnswers} save ho raha hai`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeMissingDetails}
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </header>

            <h3
              id="missing-detail-question"
              className={styles.missingDetailsQuestion}
            >
              {activeMissingQuestion.label}
            </h3>

            {activeMissingDetailKey === "vehicleTonnage" ? (
              <div className={styles.missingTonnageChoices}>
                {(["25", "30"] as const).map((tonnage) => (
                  <button
                    key={tonnage}
                    type="button"
                    onClick={() => {
                      stopQuestionAudio();
                      update("vehicleTonnage", tonnage);
                      advanceMissingDetail("vehicleTonnage");
                    }}
                  >
                    {tonnage} ton
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.missingVoiceArea}>
                <div className={styles.missingVoiceControl}>
                  {voicePhase === "recording" ? (
                    <>
                      <span className={styles.voiceRadar} />
                      <span
                        className={`${styles.voiceRadar} ${styles.voiceRadarDelayed}`}
                      />
                    </>
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.missingVoiceButton} ${
                      voicePhase === "recording"
                        ? styles.missingVoiceButtonRecording
                        : ""
                    }`}
                    onClick={handleVoiceControl}
                    disabled={voicePhase === "requesting"}
                    aria-label={
                      voicePhase === "recording"
                        ? "Answer complete"
                        : "Start voice answer"
                    }
                  >
                    {voicePhase === "recording" ? (
                      <Check size={34} strokeWidth={3} />
                    ) : (
                      <Mic size={33} strokeWidth={2.6} />
                    )}
                  </button>
                </div>
                <p className={styles.missingVoiceLabel}>
                  {voicePhase === "recording"
                    ? "Ho gaya toh mic dabaiye"
                    : voicePhase === "requesting"
                      ? "Mic shuru ho raha hai..."
                      : voicePhase === "prompt"
                        ? "Suniye..."
                        : voicePhase === "failed"
                          ? "Mic dobara dabaiye"
                          : "Mic tayyar hai"}
                </p>
              </div>
            )}
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

function userProfileAddress(user: Record<string, unknown> | null) {
  const candidates = [
    user?.destinationShopAddress,
    user?.officeAddress,
    user?.destinationAddress,
    user?.loadingPoint,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const address = candidate
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", ");
      if (address) return address;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function applyBuyerIdentityPrefill(
  current: CustomerInvoiceDraft,
  prefill: TenderCoconutPrefill | null,
  user: Record<string, unknown> | null,
): CustomerInvoiceDraft {
  const account = emptyDraft(user);
  const defaults = prefill?.defaults;
  return {
    ...current,
    buyerName:
      String(defaults?.buyerName || "").trim() ||
      account.buyerName ||
      current.buyerName,
    buyerAddress:
      String(defaults?.buyerAddress || "").trim() ||
      userProfileAddress(user) ||
      current.buyerAddress,
    insuredPartyPhone:
      phone(defaults?.insuredPartyPhone) ||
      phone(account.insuredPartyPhone) ||
      current.insuredPartyPhone,
    placeOfSupply:
      current.placeOfSupply ||
      String(defaults?.placeOfSupply || "").trim() ||
      account.placeOfSupply,
  };
}

function applyExtraction(
  current: CustomerInvoiceDraft,
  response: Record<string, unknown>,
): CustomerInvoiceDraft {
  const raw = extractionDraft(response);
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
    totalAmount: numberText(total) || current.totalAmount,
    vehicleNumber:
      text(raw.vehicle_number || raw.truck_number)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") || current.vehicleNumber,
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

function getTenderMissingDetailKeys(
  draft: CustomerInvoiceDraft,
): MissingDetailKey[] {
  if (!isTenderCoconutProduct(draft.product)) return [];
  // These four values belong to the current consignment, so confirm them even
  // when OCR produced a plausible value. Buyer identity belongs to the signed-
  // in account and is only requested when profile/history could not fill it.
  const transactionFields = new Set<MissingDetailKey>([
    "supplierName",
    "quantity",
    "totalAmount",
    "vehicleTonnage",
  ]);
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
      transactionFields.has(key) ||
      !isMissingDetailAnswered(key, draft[key]),
  );
}

function isMissingDetailAnswered(key: MissingDetailKey, value: string) {
  const clean = String(value || "").trim();
  if (key === "insuredPartyPhone") {
    return /^[6-9]\d{9}$/.test(phone(clean));
  }
  if (key === "quantity" || key === "totalAmount") {
    return Number(clean) > 0;
  }
  if (key === "vehicleTonnage") return clean === "25" || clean === "30";
  return Boolean(clean);
}

function applyMissingVoiceAnswer(
  current: CustomerInvoiceDraft,
  key: MissingDetailKey,
  response: Record<string, unknown>,
): CustomerInvoiceDraft {
  const raw = extractionDraft(response);
  let value = "";
  switch (key) {
    case "supplierName":
      value = text(raw.seller_name || raw.supplier_name);
      break;
    case "buyerName":
      value = text(raw.buyer_name);
      break;
    case "buyerAddress":
      value = text(raw.buyer_address);
      break;
    case "quantity":
      value = numberText(raw.quantity);
      break;
    case "totalAmount":
      {
        const spokenAmount = Number(raw.total_amount || raw.amount || 0);
        value = numberText(
          spokenAmount > 0 && spokenAmount < 1000
            ? spokenAmount * 100000
            : spokenAmount,
        );
      }
      break;
    case "insuredPartyPhone":
      value = phone(raw.insured_party_phone || raw.buyer_phone);
      break;
    case "vehicleTonnage":
      value = text(raw.vehicle_tonnage).match(/\b(25|30)\b/)?.[1] || "";
      break;
  }
  if (!isMissingDetailAnswered(key, value)) return current;
  const next = { ...current, [key]: value };
  const quantity = Number(next.quantity);
  const totalAmount = Number(next.totalAmount);
  if (quantity > 0 && totalAmount > 0) {
    next.rate = String(round(totalAmount / quantity));
  }
  return next;
}

function extractionDraft(response: Record<string, unknown>) {
  let payload = response;
  for (let depth = 0; depth < 3; depth += 1) {
    if (payload.draft && typeof payload.draft === "object") break;
    const nested = payload.data;
    if (!nested || typeof nested !== "object") break;
    payload = nested as Record<string, unknown>;
  }
  return payload.draft && typeof payload.draft === "object"
    ? (payload.draft as Record<string, unknown>)
    : payload;
}

function preferredRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function playQuestionAudioWithRetry(
  audio: HTMLAudioElement,
  generation: number,
  generationRef: { current: number },
) {
  const retryDelays = [0, 160, 320];
  for (const delay of retryDelays) {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (generationRef.current !== generation) return true;
    try {
      audio.currentTime = 0;
      await audio.play();
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (generationRef.current !== generation || !audio.paused) return true;
    } catch {
      // Retry after the browser settles its media activation state.
    }
  }
  return false;
}

function validateDraft(draft: CustomerInvoiceDraft) {
  if (!draft.supplierName.trim()) return "Supplier ka naam add karein.";
  if (!draft.buyerName.trim()) return "Buyer ka naam add karein.";
  if (!draft.product.trim()) return "Commodity add karein.";
  if (!(Number(draft.quantity) > 0)) return "Sahi quantity add karein.";
  if (
    !(Number(draft.rate) > 0) &&
    !(Number(draft.totalAmount) > 0)
  ) {
    return "Sahi maal value add karein.";
  }
  if (!draft.vehicleNumber.trim()) return "Vehicle number add karein.";
  if (
    isTenderCoconutProduct(draft.product) &&
    draft.vehicleTonnage !== "25" &&
    draft.vehicleTonnage !== "30"
  ) {
    return "Vehicle tonnage chunein.";
  }
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

function payableMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}
