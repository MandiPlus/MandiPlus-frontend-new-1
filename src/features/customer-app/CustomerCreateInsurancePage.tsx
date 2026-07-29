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
  CalendarDays,
  Camera,
  ChevronDown,
  FileText,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  MicOff,
  Phone,
  RefreshCw,
  Trash2,
  Truck,
  Users,
  X,
  ZoomIn,
} from "lucide-react";
import Lottie from "lottie-react";

import { useAuth } from "@/features/auth/context/AuthContext";
import {
  createCustomerWebPaymentCheckout,
  getCustomerPaymentCheckoutStatus,
} from "@/features/customer/api";
import {
  createCustomerInvoice,
  extractCustomerInvoice,
  extractCustomerInvoiceVoice,
  getCustomerAppPricing,
  getCustomerLiveTranscriptionToken,
  getCustomerTenderCoconutPrefill,
  isTenderCoconutProduct,
  matchingCustomerInvoiceRate,
  roundCustomerInvoiceMoney,
  type CustomerAppPricing,
  type CustomerInvoiceDraft,
  type CustomerLiveTranscriptionToken,
  type TenderCoconutPrefill,
} from "./api";
import { CustomerAppShell } from "./CustomerAppShell";
import { CustomerQuestionnaireVoiceSession } from "./customer-live-transcription";
import listeningFaceAnimation from "./listening-face.json";
import {
  clearCustomerInvoicePaymentAttempt,
  customerInvoicePaymentFingerprint,
  readCustomerInvoicePaymentAttempt,
  writeCustomerInvoicePaymentAttempt,
  type CustomerInvoicePaymentAttempt,
} from "./payment-attempt";
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
type CachedLiveTranscriptionToken = CustomerLiveTranscriptionToken & {
  expiresAt: number;
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

const TENDER_LOGISTICS_CHOICES = [
  { value: "25", label: "25 ton", compactLabel: "25t" },
  { value: "30", label: "30 ton", compactLabel: "30t" },
  { value: "NONE", label: "No logistics", compactLabel: "Remove" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);
const LIVE_TRANSCRIPTION_TOKEN_MIN_TTL_MS = 5000;

function questionnaireSpeechLocale(language: unknown) {
  const locales: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    kn: "kn-IN",
    mr: "mr-IN",
    ta: "ta-IN",
    te: "te-IN",
  };
  return locales[String(language || "hi").toLowerCase()] || "hi-IN";
}

function missingVoiceEndSilenceMillis(key: MissingDetailKey) {
  switch (key) {
    case "quantity":
    case "totalAmount":
      return 350;
    case "supplierName":
    case "buyerName":
      return 450;
    case "buyerAddress":
      return 700;
    case "insuredPartyPhone":
      return 850;
    default:
      return 450;
  }
}

const QUESTIONNAIRE_TONNAGE_CHOICES = [
  { value: "25", label: "25 ton" },
  { value: "30", label: "30 ton" },
] as const;

const COMMODITY_OPTIONS = [
  ["Tender Coconut", "🥥"],
  ["Kiwi", "🥝"],
  ["Mango", "🥭"],
  ["Banana", "🍌"],
  ["Papaya (Papita)", "🧡"],
  ["Pomegranate (Anar)", "🍎"],
  ["Oranges", "🍊"],
  ["Kinnow", "🍊"],
  ["Guava (Amrood)", "🍐"],
  ["Muskmelon (Kastoori Tarbooj)", "🍈"],
  ["Watermelon (Tarbooj)", "🍉"],
  ["Pista", "🌰"],
  ["Tomato", "🍅"],
  ["Onion", "🧅"],
  ["Potato", "🥔"],
  ["Ginger (Fresh)", "🫚"],
  ["Sweet Potato", "🍠"],
  ["Mosambi (Sweet Lime)", "🍋"],
  ["Grapes", "🍇"],
] as const;

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
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [zoomedFileIndex, setZoomedFileIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [paymentRetryPromptOpen, setPaymentRetryPromptOpen] = useState(false);
  const [paymentStatusChecking, setPaymentStatusChecking] = useState(false);
  const paymentAttemptRef = useRef<CustomerInvoicePaymentAttempt | null>(null);
  const paymentStatusCheckingRef = useRef(false);
  const paymentStatusGenerationRef = useRef(0);
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
  const [listeningDotCount, setListeningDotCount] = useState(0);
  const [pendingVoiceAnswers, setPendingVoiceAnswers] = useState(0);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const questionnaireVoiceSessionRef =
    useRef<CustomerQuestionnaireVoiceSession | null>(null);
  const liveTranscriptionTokenRef =
    useRef<CachedLiveTranscriptionToken | null>(null);
  const liveTranscriptionTokenPromiseRef =
    useRef<Promise<CachedLiveTranscriptionToken | null> | null>(null);
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
      rate: matchingCustomerInvoiceRate(
        Number((invoiceAmount + logisticsAmount).toFixed(2)),
        Number(draft.quantity || 0),
      ),
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

  const checkReturningPayment = useCallback(async () => {
    const userId = String(user?.id || "");
    const attempt =
      readCustomerInvoicePaymentAttempt() || paymentAttemptRef.current;
    if (!attempt || !userId) return;
    if (Number(attempt.version) !== 2) {
      clearCustomerInvoicePaymentAttempt();
      paymentAttemptRef.current = null;
      return;
    }
    if (attempt.userId !== userId) {
      clearCustomerInvoicePaymentAttempt();
      paymentAttemptRef.current = null;
      return;
    }
    paymentAttemptRef.current = attempt;
    setStage("review");
    if (attempt.phase === "retry") {
      paymentStatusCheckingRef.current = false;
      setPaymentStatusChecking(false);
      setPaymentRetryPromptOpen(true);
      return;
    }
    if (attempt.phase !== "redirecting" || !attempt.merchantOrderId) {
      paymentStatusCheckingRef.current = false;
      setPaymentStatusChecking(false);
      return;
    }
    if (paymentStatusCheckingRef.current) return;

    const generation = paymentStatusGenerationRef.current + 1;
    paymentStatusGenerationRef.current = generation;
    paymentStatusCheckingRef.current = true;
    setPaymentStatusChecking(true);
    try {
      const status = await getCustomerPaymentCheckoutStatus(
        attempt.merchantOrderId,
      );
      if (paymentStatusGenerationRef.current !== generation) return;
      if (status.paid) {
        clearCustomerInvoicePaymentAttempt();
        paymentAttemptRef.current = null;
        setPaymentRetryPromptOpen(false);
        router.replace(
          `/payment/success?invoiceId=${encodeURIComponent(attempt.invoiceId)}`,
        );
        return;
      }
      const retryAttempt: CustomerInvoicePaymentAttempt = {
        ...attempt,
        phase: "retry",
      };
      writeCustomerInvoicePaymentAttempt(retryAttempt);
      paymentAttemptRef.current = retryAttempt;
      setNotice("");
      setPaymentRetryPromptOpen(true);
    } catch {
      if (paymentStatusGenerationRef.current !== generation) return;
      const retryAttempt: CustomerInvoicePaymentAttempt = {
        ...attempt,
        phase: "retry",
      };
      writeCustomerInvoicePaymentAttempt(retryAttempt);
      paymentAttemptRef.current = retryAttempt;
      setNotice("");
      setPaymentRetryPromptOpen(true);
    } finally {
      if (paymentStatusGenerationRef.current === generation) {
        paymentStatusCheckingRef.current = false;
        setPaymentStatusChecking(false);
      }
    }
  }, [router, user?.id]);

  const closePaymentRetryPrompt = useCallback(() => {
    paymentStatusGenerationRef.current += 1;
    paymentStatusCheckingRef.current = false;
    setPaymentStatusChecking(false);
    setPaymentRetryPromptOpen(false);
    setStage("review");
  }, []);

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
    const userId = String(user?.id || "");
    if (!userId) return;

    const attempt = readCustomerInvoicePaymentAttempt();
    if (!attempt) return;
    if (attempt.userId !== userId) {
      clearCustomerInvoicePaymentAttempt();
      return;
    }

    paymentAttemptRef.current = attempt;
    setDraft(attempt.draft);
    setStage("review");
    void checkReturningPayment();
  }, [checkReturningPayment, user?.id]);

  useEffect(() => {
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void checkReturningPayment();
      }
    };
    const checkOnPageShow = () => {
      void checkReturningPayment();
    };

    window.addEventListener("pageshow", checkOnPageShow);
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      window.removeEventListener("pageshow", checkOnPageShow);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [checkReturningPayment]);

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
    const next = files.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    );
    setPreviewUrls(next);
    return () => next.forEach((url) => url && URL.revokeObjectURL(url));
  }, [files]);

  const update = (field: keyof CustomerInvoiceDraft, value: string) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      const quantity = Number(next.quantity);
      const logisticsAmount =
        isTenderCoconutProduct(next.product) && pricing
          ? next.vehicleTonnage === "25"
            ? Number(pricing.amount25Ton || 0)
            : next.vehicleTonnage === "30"
              ? Number(pricing.amount30Ton || 0)
              : 0
          : 0;
      if (field === "rate") {
        const rate = Number(value);
        if (quantity > 0 && rate > 0) {
          const finalAmount = roundCustomerInvoiceMoney(quantity * rate);
          next.totalAmount = String(
            Math.max(
              0,
              roundCustomerInvoiceMoney(finalAmount - logisticsAmount),
            ),
          );
        }
      }
      if (
        field === "quantity" ||
        field === "totalAmount" ||
        field === "vehicleTonnage" ||
        field === "product"
      ) {
        const finalAmount = roundCustomerInvoiceMoney(
          Number(next.totalAmount || 0) + logisticsAmount,
        );
        const matchingRate = matchingCustomerInvoiceRate(
          finalAmount,
          quantity,
        );
        if (matchingRate) {
          next.rate = matchingRate;
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
    const userId = String(user.id);
    paymentStatusGenerationRef.current += 1;
    paymentStatusCheckingRef.current = false;
    setPaymentStatusChecking(false);
    setStage("creating");
    setNotice("");
    setPaymentRetryPromptOpen(false);
    try {
      if (isTenderCoconut && !pricing) {
        throw new Error("Amount load nahi hua. Dobara try karein.");
      }
      const fingerprint = customerInvoicePaymentFingerprint(draft, pricing);
      const previousAttempt =
        paymentAttemptRef.current || readCustomerInvoicePaymentAttempt();
      const canReuseCreatedInvoice =
        previousAttempt !== null &&
        Number(previousAttempt.version) === 2 &&
        previousAttempt.userId === userId &&
        previousAttempt.fingerprint === fingerprint;
      let invoiceId = canReuseCreatedInvoice
        ? previousAttempt.invoiceId
        : "";

      if (!invoiceId) {
        const invoice = await createCustomerInvoice(
          userId,
          draft,
          files,
          pricing || undefined,
        );
        if (!invoice?.id) throw new Error("Invoice was created without an ID.");
        invoiceId = invoice.id;
      }

      const createdInvoiceAttempt: CustomerInvoicePaymentAttempt = {
        version: 2,
        userId,
        invoiceId,
        merchantOrderId: null,
        phase: "draft",
        fingerprint,
        draft,
        createdAt: Date.now(),
      };
      writeCustomerInvoicePaymentAttempt(createdInvoiceAttempt);
      paymentAttemptRef.current = createdInvoiceAttempt;

      const checkout = await createCustomerWebPaymentCheckout(
        [invoiceId],
        premium,
      );
      if (!checkout.redirectUrl) {
        router.replace("/pay");
        return;
      }
      const merchantOrderId =
        checkout.merchantOrderId || checkout.merchantTransactionId;
      const attempt: CustomerInvoicePaymentAttempt = {
        ...createdInvoiceAttempt,
        merchantOrderId,
        phase: "redirecting",
        createdAt: Date.now(),
      };
      writeCustomerInvoicePaymentAttempt(attempt);
      paymentAttemptRef.current = attempt;
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

  const requestLiveTranscriptionToken = useCallback(() => {
    const cached = liveTranscriptionTokenRef.current;
    if (
      cached &&
      cached.expiresAt - Date.now() > LIVE_TRANSCRIPTION_TOKEN_MIN_TTL_MS
    ) {
      return Promise.resolve(cached);
    }
    if (liveTranscriptionTokenPromiseRef.current) {
      return liveTranscriptionTokenPromiseRef.current;
    }

    const request = getCustomerLiveTranscriptionToken(
      questionnaireSpeechLocale(user?.preferredLanguage),
    )
      .then((credential) => {
        if (!credential?.token || !credential.websocketUrl) return null;
        const prepared: CachedLiveTranscriptionToken = {
          ...credential,
          expiresAt:
            Date.now() +
            Math.max(1, credential.expiresInSeconds || 60) * 1000,
        };
        liveTranscriptionTokenRef.current = prepared;
        return prepared;
      })
      .catch(() => null)
      .finally(() => {
        liveTranscriptionTokenPromiseRef.current = null;
      });
    liveTranscriptionTokenPromiseRef.current = request;
    return request;
  }, [user?.preferredLanguage]);

  const consumeLiveTranscriptionToken = useCallback(async () => {
    const credential = await requestLiveTranscriptionToken();
    if (credential && liveTranscriptionTokenRef.current === credential) {
      liveTranscriptionTokenRef.current = null;
    }
    return credential;
  }, [requestLiveTranscriptionToken]);

  const stopQuestionnaireVoiceSession = useCallback(() => {
    const session = questionnaireVoiceSessionRef.current;
    questionnaireVoiceSessionRef.current = null;
    if (session) void session.stop();
  }, []);

  useEffect(() => {
    if (voicePhase !== "recording") return;
    const interval = window.setInterval(() => {
      setListeningDotCount((current) => (current + 1) % 4);
    }, 420);
    return () => window.clearInterval(interval);
  }, [voicePhase]);

  useEffect(() => {
    if (!activeMissingQuestion?.targetField) return;
    void requestLiveTranscriptionToken();
  }, [activeMissingQuestion?.targetField, requestLiveTranscriptionToken]);

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
    stopQuestionnaireVoiceSession();
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
  }, [stopQuestionnaireVoiceSession]);

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

  const restartInsuranceCapture = useCallback(() => {
    paymentStatusGenerationRef.current += 1;
    paymentStatusCheckingRef.current = false;
    paymentAttemptRef.current = null;
    clearCustomerInvoicePaymentAttempt();
    closeMissingDetails();
    setPaymentStatusChecking(false);
    setPaymentRetryPromptOpen(false);
    setFiles([]);
    setDraft(emptyDraft(user));
    setNotice("");
    setSourceOpen(false);
    setAmountBreakdownOpen(false);
    setPendingVoiceAnswers(0);
    setStage("capture");
  }, [closeMissingDetails, user]);

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
        stopQuestionnaireVoiceSession();
        setVoicePhase("failed");
        setNotice("Mic se recording nahi ho paayi. Dobara tap karein.");
      };
      recorder.onstop = () => {
        stopQuestionnaireVoiceSession();
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
      stopQuestionnaireVoiceSession();
      const voiceSession = new CustomerQuestionnaireVoiceSession({
        silenceMillis: missingVoiceEndSilenceMillis(key),
        getCredential: consumeLiveTranscriptionToken,
        onTurnEnd: () => {
          const activeRecorder = mediaRecorderRef.current;
          if (activeRecorder && activeRecorder.state !== "inactive") {
            activeRecorder.stop();
          }
        },
      });
      questionnaireVoiceSessionRef.current = voiceSession;
      recordingStartedAtRef.current = performance.now();
      setListeningDotCount(0);
      recorder.start(100);
      setVoicePhase("recording");
      void voiceSession.start(stream);
    } catch (error) {
      stopQuestionnaireVoiceSession();
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
    consumeLiveTranscriptionToken,
    processVoiceAnswer,
    stopQuestionnaireVoiceSession,
    voicePhase,
  ]);
  startQuestionRecordingRef.current = () => {
    void startQuestionRecording();
  };

  const stopQuestionRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

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
    let automaticStartTimeout: number | null = null;
    const scheduleAutomaticVoiceStart = () => {
      automaticStartTimeout = window.setTimeout(() => {
        if (questionGenerationRef.current !== generation) return;
        startQuestionRecordingRef.current();
      }, 120);
    };
    audio.onended = () => {
      if (questionGenerationRef.current !== generation) return;
      if (activeMissingQuestion.targetField) {
        scheduleAutomaticVoiceStart();
      } else {
        setVoicePhase("idle");
      }
    };
    audio.onerror = () => {
      if (questionGenerationRef.current !== generation) return;
      if (activeMissingQuestion.targetField) {
        scheduleAutomaticVoiceStart();
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
        if (activeMissingQuestion.targetField) {
          scheduleAutomaticVoiceStart();
        } else {
          setVoicePhase("idle");
        }
      });
    return () => {
      if (automaticStartTimeout !== null) {
        window.clearTimeout(automaticStartTimeout);
      }
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
                {previewUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrls[0]} alt="" className={styles.capturePreviewImage} />
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
          onClick={restartInsuranceCapture}
          aria-label="Back to upload"
        >
          <ArrowLeft size={24} strokeWidth={2.4} />
        </button>
        <h1 className={styles.secondaryHeading}>Details check karein</h1>
        <span />
      </header>

      <main className={`${styles.pageBody} ${styles.reviewBody}`}>
        {files.length > 1 ? (
          <div className={styles.reviewFileStrip} aria-label="Uploaded invoices">
            {files.map((file, index) => (
              <div className={styles.reviewFileThumb} key={`${file.name}-${index}`}>
                {previewUrls[index] ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrls[index]} alt={`Invoice ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() => setZoomedFileIndex(index)}
                      aria-label={`Zoom invoice ${index + 1}`}
                    >
                      <ZoomIn size={14} />
                    </button>
                  </>
                ) : (
                  <span><FileText size={25} /></span>
                )}
                <small>{index + 1}</small>
              </div>
            ))}
          </div>
        ) : null}

        <section className={styles.reviewTopCard}>
          <div className={styles.reviewProductRow}>
            <div className={styles.reviewProduct}>
              <label className={styles.reviewCommoditySelect}>
                <span className={styles.reviewCommodityValue}>
                  {draft.product || "Commodity chunein"}
                </span>
                <ChevronDown size={18} aria-hidden="true" />
                <select
                  aria-label="Commodity"
                  value={draft.product}
                  onChange={(event) => update("product", event.target.value)}
                >
                  {!draft.product ? (
                    <option value="">Commodity chunein</option>
                  ) : null}
                  {draft.product &&
                  !COMMODITY_OPTIONS.some(([name]) => name === draft.product) ? (
                    <option value={draft.product}>{draft.product}</option>
                  ) : null}
                  {COMMODITY_OPTIONS.map(([name]) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {files.length === 1 ? (
              <div className={styles.singleReviewFile}>
                {previewUrls[0] ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrls[0]} alt="Uploaded invoice" />
                    <button
                      type="button"
                      onClick={() => setZoomedFileIndex(0)}
                      aria-label="Zoom uploaded invoice"
                    >
                      <ZoomIn size={14} />
                    </button>
                  </>
                ) : (
                  <span><FileText size={27} /></span>
                )}
              </div>
            ) : null}
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
              <span>{shortDate(draft.invoiceDate)}</span>
              <CalendarDays size={16} aria-hidden="true" />
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
              value={amountBreakdown.rate || draft.rate}
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
              onChange={(value) => update("vehicleNumber", value.toUpperCase())}
            />
            {isTenderCoconut ? (
              <div className={styles.tonnageField}>
                <span>Tonnage</span>
                <div>
                  {TENDER_LOGISTICS_CHOICES.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={
                        draft.vehicleTonnage === choice.value
                          ? styles.tonnageButtonActive
                          : ""
                      }
                      onClick={() =>
                        update(
                          "vehicleTonnage",
                          draft.vehicleTonnage === choice.value &&
                            choice.value !== "NONE"
                            ? "NONE"
                            : choice.value,
                        )
                      }
                    >
                      {choice.compactLabel}
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
                    {draft.vehicleTonnage === "25" ||
                    draft.vehicleTonnage === "30"
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
            paymentStatusChecking ||
            pendingVoiceAnswers > 0 ||
            (isTenderCoconut && (pricingLoading || !pricing))
          }
        >
          {stage === "creating" || paymentStatusChecking ? (
            <LoaderCircle className="animate-spin" size={19} />
          ) : null}
          {paymentStatusChecking
            ? "Payment check ho raha hai"
            : pendingVoiceAnswers > 0
            ? "Details save ho rahi hain"
            : isTenderCoconut && pricingLoading
              ? "Amount load ho raha hai"
              : `Pay ${payableMoney(premium)}`}
        </button>
      </div>

      {zoomedFileIndex !== null && previewUrls[zoomedFileIndex] ? (
        <div className={styles.invoicePreviewModal} role="dialog" aria-modal="true">
          <button
            type="button"
            className={styles.invoicePreviewBackdrop}
            onClick={() => setZoomedFileIndex(null)}
            aria-label="Close invoice preview"
          />
          <button
            type="button"
            className={styles.invoicePreviewClose}
            onClick={() => setZoomedFileIndex(null)}
            aria-label="Close invoice preview"
          >
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrls[zoomedFileIndex]}
            alt={`Invoice ${zoomedFileIndex + 1}`}
            className={styles.invoicePreviewFullImage}
          />
        </div>
      ) : null}

      {paymentRetryPromptOpen ? (
        <div className={styles.paymentRetryModal}>
          <button
            type="button"
            className={styles.paymentRetryBackdrop}
            onClick={closePaymentRetryPrompt}
            aria-label="Close payment message"
          />
          <section
            className={styles.paymentRetryCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-retry-title"
          >
            <span className={styles.paymentRetryIcon} aria-hidden="true">
              <RefreshCw size={26} />
            </span>
            <h2 id="payment-retry-title">Dobara try karein</h2>
            <button
              type="button"
              className={styles.paymentRetryButton}
              onClick={closePaymentRetryPrompt}
            >
              Theek hai
            </button>
          </section>
        </div>
      ) : null}

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
            <h3
              id="missing-detail-question"
              className={styles.missingDetailsQuestion}
            >
              {activeMissingQuestion.label}
            </h3>

            {activeMissingDetailKey === "vehicleTonnage" ? (
              <div className={styles.missingTonnageChoices}>
                {QUESTIONNAIRE_TONNAGE_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    className={
                      choice.value === "NONE"
                        ? styles.missingTonnageRemove
                        : ""
                    }
                    onClick={() => {
                      stopQuestionAudio();
                      update("vehicleTonnage", choice.value);
                      advanceMissingDetail("vehicleTonnage");
                    }}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.missingVoiceArea}>
                <div
                  className={`${styles.missingVoiceControl} ${
                    voicePhase === "recording"
                      ? ""
                      : styles.missingVoiceControlPrompt
                  }`}
                >
                  <button
                    type="button"
                    className={`${styles.missingVoiceButton} ${
                      voicePhase === "recording"
                        ? styles.missingVoiceButtonRecording
                        : styles.missingVoiceButtonPrompt
                    }`}
                    onClick={handleVoiceControl}
                    disabled={
                      voicePhase === "requesting" || voicePhase === "prompt"
                    }
                    aria-label={
                      voicePhase === "recording"
                        ? "Voice answer done"
                        : "Speak answer"
                    }
                  >
                    {voicePhase === "recording" ? (
                      <Lottie
                        animationData={listeningFaceAnimation}
                        autoplay
                        loop
                        className={styles.missingListeningAnimation}
                        rendererSettings={{
                          preserveAspectRatio: "xMidYMid meet",
                        }}
                      />
                    ) : (
                      <span className={styles.missingMutedMic}>
                        <MicOff size={42} strokeWidth={2.35} />
                      </span>
                    )}
                  </button>
                </div>
                {voicePhase === "recording" ? (
                  <p className={styles.missingVoiceLabel}>
                    {`listening${".".repeat(listeningDotCount)}`}
                  </p>
                ) : null}
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
    "insuredPartyPhone",
    "vehicleTonnage",
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
  if (key === "vehicleTonnage") {
    return clean === "25" || clean === "30" || clean === "NONE";
  }
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
  const playTimeoutMillis = 900;
  for (const delay of retryDelays) {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (generationRef.current !== generation) return true;
    let playTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      audio.currentTime = 0;
      await Promise.race([
        audio.play(),
        new Promise<never>((_, reject) => {
          playTimeout = setTimeout(
            () => reject(new Error("QUESTION_AUDIO_PLAY_TIMEOUT")),
            playTimeoutMillis,
          );
        }),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (generationRef.current !== generation || !audio.paused) return true;
    } catch {
      audio.pause();
      // Retry after the browser settles its media activation state.
    } finally {
      if (playTimeout) clearTimeout(playTimeout);
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
    draft.vehicleTonnage !== "30" &&
    draft.vehicleTonnage !== "NONE"
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

function shortDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
  });
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
