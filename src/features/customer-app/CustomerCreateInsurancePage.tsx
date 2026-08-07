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
import { INDIA_STATES } from "./indiaStates";

const PARTY_UI_LABELS = {
  shipper: "Loading vala",
  shipperAddress: "Loading vala address",
  consignee: "Unloading vala",
  consigneeAddress: "Unloading vala address",
  consigneeMobile: "Unloading vala mobile",
} as const;

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
  isTenderCoconutProduct,
  isPomegranateProduct,
  roundCustomerInvoiceMoney,
  type CustomerAppPricing,
  type CustomerInvoiceDraft,
  type CustomerLiveTranscriptionToken,
  type InvoiceVoiceTargetField,
} from "./api";
import { CustomerAppShell } from "./CustomerAppShell";
import { canonicalizeCommodityLabel } from "./commodity-normalization";
import { CustomerQuestionnaireVoiceSession } from "./customer-live-transcription";
import listeningFaceAnimation from "./listening-face.json";
import {
  clearCustomerInvoicePaymentAttempt,
  customerInvoicePaymentFingerprint,
  readCustomerInvoicePaymentAttempt,
  writeCustomerInvoicePaymentAttempt,
  type CustomerInvoicePaymentAttempt,
  type CustomerInvoicePaymentReference,
} from "./payment-attempt";
import { money, readableError } from "./utils";
import styles from "./customer-app.module.css";

type Stage = "capture" | "review" | "creating";
type ExtractionState = "idle" | "optimizing" | "reading" | "ready" | "failed";
type MissingDetailKey =
  | "supplierName"
  | "buyerName"
  | "buyerAddress"
  | "quantity"
  | "rate"
  | "totalAmount"
  | "vehicleNumber"
  | "vehicleTonnage"
  | "insuredPartyPhone";
type RecordingPurpose = MissingDetailKey;
type VoiceAnswerState = "processing" | "saved" | "failed";
type VoicePhase =
  | "idle"
  | "prompt"
  | "requesting"
  | "recording"
  | "processing"
  | "failed";
type CachedLiveTranscriptionToken = CustomerLiveTranscriptionToken & {
  expiresAt: number;
};
type QuestionLabelMap = Partial<
  Record<"en" | "hi" | "kn" | "mr" | "ta" | "te", string>
> & { en: string };

type EagerExtraction = {
  key: string;
  promise: Promise<PromiseSettledResult<Record<string, unknown>>[]>;
};

const DEFAULT_TENDER_COCONUT_PRICING: CustomerAppPricing["tenderCoconut"] = {
  pricingVersion: 1,
  amount25Ton: 130000,
  amount30Ton: 140000,
  updatedAt: null,
};
const LIVE_TRANSCRIPTION_TOKEN_MIN_TTL_MS = 5000;
const QUESTIONNAIRE_PRE_SPEECH_CHUNK_COUNT = 15;

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
    case "rate":
    case "totalAmount":
      return 800;
    case "supplierName":
    case "buyerName":
    case "vehicleNumber":
      return 1000;
    case "buyerAddress":
      return 1400;
    case "insuredPartyPhone":
      return 1100;
    default:
      return 1000;
  }
}

const TENDER_TONNAGE_CHOICES = [
  { value: "25", label: "25 ton", compactLabel: "25t" },
  { value: "30", label: "30 ton", compactLabel: "30t" },
] as const;

const POMEGRANATE_QUESTION_LABELS: Partial<
  Record<MissingDetailKey, QuestionLabelMap>
> = {
  buyerAddress: {
    en: "Mal kidhar ja raha hai?",
    hi: "माल किधर जा रहा है?",
    mr: "माल कुठे जात आहे?",
    kn: "ಮಾಲ್ ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತಿದೆ?",
    ta: "சரக்கு எங்கே போகிறது?",
    te: "సరుకు ఎక్కడికి వెళ్తోంది?",
  },
  buyerName: {
    en: "Kiske paas ja raha hai?",
    hi: "किसके पास जा रहा है?",
    mr: "कोणाकडे जात आहे?",
    kn: "ಯಾರ ಬಳಿಗೆ ಹೋಗುತ್ತಿದೆ?",
    ta: "யாரிடம் போகிறது?",
    te: "ఎవరి దగ్గరికి వెళ్తోంది?",
  },
  quantity: {
    en: "Anar ke kitne dabbe hain?",
    hi: "अनार के कितने डब्बे हैं?",
    mr: "डाळिंबाचे किती डबे आहेत?",
    kn: "ಅನಾರ್‌ನ ಎಷ್ಟು ಡಬ್ಬಗಳಿವೆ?",
    ta: "மாதுளை எத்தனை பெட்டிகள்?",
    te: "దానిమ్మ ఎన్ని పెట్టెలు?",
  },
  rate: {
    en: "Ek dabbe ka kitna rate hai?",
    hi: "एक डब्बे का कितना रेट है?",
    mr: "एका डब्याचा किती रेट आहे?",
    kn: "ಒಂದು ಡಬ್ಬದ ರೇಟ್ ಎಷ್ಟು?",
    ta: "ஒரு பெட்டியின் விலை என்ன?",
    te: "ఒక పెట్టె రేటు ఎంత?",
  },
  vehicleNumber: {
    en: "Gaadi number kya hai?",
    hi: "गाड़ी नंबर क्या है?",
    mr: "गाडी नंबर काय आहे?",
    kn: "ವಾಹನ ನಂಬರ್ ಏನು?",
    ta: "வாகன எண் என்ன?",
    te: "వాహన నంబర్ ఏమిటి?",
  },
};

const MISSING_QUESTIONS: Record<
  MissingDetailKey,
  { label: string; audio: string; target?: InvoiceVoiceTargetField }
> = {
  supplierName: {
    label: "Aapka vyapari kaun hai?",
    audio: "/customer-app/voices/tender-coconut-supplier-name.mp3",
    target: "supplier_name",
  },
  buyerName: {
    label: "Buyer ka naam",
    audio: "/customer-app/voices/tender-coconut-buyer-name.mp3",
    target: "buyer_name",
  },
  buyerAddress: {
    label: "Buyer ka address",
    audio: "/customer-app/voices/tender-coconut-buyer-address.mp3",
    target: "buyer_address",
  },
  quantity: {
    label: "Kitne dane hain?",
    audio: "/customer-app/voices/tender-coconut-quantity.mp3",
    target: "quantity",
  },
  rate: {
    label: "Rate kya hai?",
    audio: "/customer-app/voices/pomegranate-rate.mp3",
    target: "rate",
  },
  totalAmount: {
    label: "Kitne lakh ka maal hai?",
    audio: "/customer-app/voices/tender-coconut-total-amount.mp3",
    target: "total_amount",
  },
  vehicleNumber: {
    label: "Gaadi number kya hai?",
    audio: "/customer-app/voices/pomegranate-vehicle-number.mp3",
    target: "vehicle_number",
  },
  vehicleTonnage: {
    label: "Gaadi kitne ton ki hai?",
    audio: "/customer-app/voices/tender-coconut-vehicle-tonnage.mp3",
  },
  insuredPartyPhone: {
    label: "Buyer mobile",
    audio: "/customer-app/voices/tender-coconut-buyer-mobile.mp3",
    target: "insured_party_phone",
  },
};

const POMEGRANATE_QUESTION_AUDIO: Partial<
  Record<MissingDetailKey, string>
> = {
  buyerAddress: "/customer-app/voices/pomegranate-destination.mp3",
  buyerName: "/customer-app/voices/pomegranate-consignee.mp3",
  quantity: "/customer-app/voices/pomegranate-quantity.mp3",
  rate: "/customer-app/voices/pomegranate-rate.mp3",
  vehicleNumber: "/customer-app/voices/pomegranate-vehicle-number.mp3",
};

/** Fixed supplier-path questions for every anar invoice — identity ignored. */
const POMEGRANATE_MISSING_DETAIL_KEYS: MissingDetailKey[] = [
  "buyerAddress",
  "buyerName",
  "quantity",
  "rate",
  "vehicleNumber",
];

function resolveLocalizedMissingLabel(
  labels: QuestionLabelMap,
  language: unknown,
) {
  const code = String(language || "en").toLowerCase() as keyof QuestionLabelMap;
  return labels[code] || labels.en;
}

function resolveMissingQuestion(
  key: MissingDetailKey,
  product: string,
  language: unknown,
) {
  const base = MISSING_QUESTIONS[key];
  if (!isPomegranateProduct(product)) return base;
  const labels = POMEGRANATE_QUESTION_LABELS[key];
  const audio = POMEGRANATE_QUESTION_AUDIO[key];
  // Never fall back to tender-coconut prompts for anar.
  return {
    ...base,
    label: labels ? resolveLocalizedMissingLabel(labels, language) : base.label,
    audio: audio || "",
  };
}

const today = () => new Date().toISOString().slice(0, 10);

const QUESTIONNAIRE_AUDIO_CONSTRAINTS = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
} satisfies MediaTrackConstraints;

const COMMODITY_OPTIONS = [
  ["Tender Coconut", "🥥"],
  ["Kiwi", "🥝"],
  ["Mango", "🥭"],
  ["Banana", "🍌"],
  ["Apple", "🍎"],
  ["Papaya (Papita)", "🧡"],
  ["Anar", "🍎"],
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
    user?.phone ||
      user?.mobile ||
      user?.mobileNumber ||
      user?.phoneNumber ||
      "",
  );
  const identity = String(
    user?.identity || user?.role || user?.userType || "",
  )
    .trim()
    .toUpperCase();
  const product = Array.isArray(user?.products)
    ? String(user.products[0] || "")
    : String(user?.commodity || user?.product || "");
  // Anar is always the supplier shipper flow — never prefill consignee as self
  // (that would skip "Kiske paas"). Coconut buyers can still default to self.
  const isPomegranate = isPomegranateProduct(product);
  const buyerName =
    !isPomegranate && identity === "BUYER" ? userName : "";
  const insuredPartyPhone =
    !isPomegranate && identity === "BUYER" ? userPhone : "";
  return {
    invoiceDate: today(),
    mode: "Cash",
    supplierName: "",
    supplierAddress: "",
    buyerName,
    buyerAddress: "",
    placeOfSupply: humanStateLabel(user?.state),
    product,
    quantity: "",
    rate: "",
    totalAmount: "",
    vehicleNumber: "",
    vehicleTonnage: "",
    includeLogistics: true,
    driverPhone: "",
    insuredPartyPhone,
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);
  const questionnaireVoiceSessionRef =
    useRef<CustomerQuestionnaireVoiceSession | null>(null);
  const liveTranscriptionTokenRef =
    useRef<CachedLiveTranscriptionToken | null>(null);
  const liveTranscriptionTokenPromiseRef =
    useRef<Promise<CachedLiveTranscriptionToken | null> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingPurposeRef = useRef<RecordingPurpose | null>(null);
  const recordingInvoiceIndexRef = useRef(0);
  const recordingProductRef = useRef("");
  const activeFileIndexRef = useRef(0);
  const questionnaireCaptureGenerationRef = useRef(0);
  const questionGenerationRef = useRef<Record<string, number>>({});
  const paymentAttemptRef = useRef<CustomerInvoicePaymentAttempt | null>(null);
  const paymentStatusCheckingRef = useRef(false);
  const paymentStatusGenerationRef = useRef(0);
  const placeOfSupplyAutoSyncedRef = useRef<string | null>(null);

  const [stage, setStage] = useState<Stage>("capture");
  const [extractionState, setExtractionState] =
    useState<ExtractionState>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<CustomerInvoiceDraft>(() =>
    emptyDraft(user),
  );
  const draftRef = useRef(draft);
  const [batchDrafts, setBatchDrafts] = useState<CustomerInvoiceDraft[]>([]);
  const batchDraftsRef = useRef(batchDrafts);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [zoomedFileIndex, setZoomedFileIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [paymentRetryPromptOpen, setPaymentRetryPromptOpen] = useState(false);
  const [paymentStatusChecking, setPaymentStatusChecking] = useState(false);
  const [pricing, setPricing] =
    useState<CustomerAppPricing["tenderCoconut"]>(
      DEFAULT_TENDER_COCONUT_PRICING,
    );
  const [recordingPurpose, setRecordingPurpose] =
    useState<RecordingPurpose | null>(null);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [listeningDotCount, setListeningDotCount] = useState(0);
  const [missingKeys, setMissingKeys] = useState<MissingDetailKey[]>([]);
  const [missingIndex, setMissingIndex] = useState(0);
  const [missingOpen, setMissingOpen] = useState(false);
  const [questionnaireSession, setQuestionnaireSession] = useState(0);
  const [voiceAnswers, setVoiceAnswers] = useState<
    Record<string, VoiceAnswerState>
  >({});
  const [amountBreakdownOpen, setAmountBreakdownOpen] = useState(true);

  draftRef.current = draft;
  batchDraftsRef.current = batchDrafts;
  activeFileIndexRef.current = activeFileIndex;

  const isTenderCoconut = isTenderCoconutProduct(draft.product);
  const amountBreakdown = useMemo(
    () => resolveInvoiceAmountBreakdown(draft, pricing),
    [draft, pricing],
  );
  const total = amountBreakdown.totalAmount;
  const paymentDrafts = useMemo(() => {
    if (!batchDrafts.length) return [draft];
    return batchDrafts.map((batchDraft, index) =>
      index === activeFileIndex ? draft : batchDraft,
    );
  }, [activeFileIndex, batchDrafts, draft]);
  const payablePremium = useMemo(
    () =>
      Number(
        paymentDrafts
          .reduce(
            (sum, paymentDraft) =>
              sum + customerInvoicePremium(paymentDraft, pricing),
            0,
          )
          .toFixed(2),
      ),
    [paymentDrafts, pricing],
  );
  const pendingVoiceAnswers = Object.values(voiceAnswers).filter(
    (state) => state === "processing",
  ).length;
  const firstIncompleteInvoiceIndex = paymentDrafts.findIndex((item) =>
    Boolean(validateDraft(item)),
  );
  const validationIssue =
    firstIncompleteInvoiceIndex >= 0
      ? validateDraft(paymentDrafts[firstIncompleteInvoiceIndex])
      : "";
  const activeMissingKey = missingOpen ? missingKeys[missingIndex] : undefined;
  const activeQuestion = activeMissingKey
    ? resolveMissingQuestion(
        activeMissingKey,
        draft.product || batchDrafts[activeFileIndex]?.product || "",
        user?.preferredLanguage,
      )
    : null;
  const isFinalizingReview =
    stage === "review" && !missingOpen && pendingVoiceAnswers > 0;

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
    if (
      voicePhase !== "recording" &&
      voicePhase !== "prompt" &&
      voicePhase !== "processing"
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      setListeningDotCount((current) => (current + 1) % 4);
    }, 420);
    return () => window.clearInterval(interval);
  }, [voicePhase]);

  useEffect(() => {
    if (!activeQuestion?.target) return;
    void requestLiveTranscriptionToken();
  }, [activeQuestion?.target, requestLiveTranscriptionToken]);

  const checkReturningPayment = useCallback(async () => {
    const userId = String(user?.id || "");
    const attempt =
      readCustomerInvoicePaymentAttempt() || paymentAttemptRef.current;
    if (!attempt || !userId) return;
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
          customerInvoiceSuccessUrl({
            invoices: paymentAttemptReferences(attempt),
          }),
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

  const restartInsuranceCapture = useCallback(() => {
    questionnaireCaptureGenerationRef.current += 1;
    paymentStatusGenerationRef.current += 1;
    paymentStatusCheckingRef.current = false;
    paymentAttemptRef.current = null;
    clearCustomerInvoicePaymentAttempt();
    eagerExtractionRef.current = null;
    setPaymentStatusChecking(false);
    setPaymentRetryPromptOpen(false);
    setFiles([]);
    const nextDraft = emptyDraft(user);
    batchDraftsRef.current = [];
    setBatchDrafts([]);
    setActiveFileIndex(0);
    setDraft(nextDraft);
    setExtractionState("idle");
    setNotice("");
    setSourceOpen(false);
    setMissingKeys([]);
    setMissingIndex(0);
    setMissingOpen(false);
    setVoiceAnswers({});
    setStage("capture");
  }, [user]);

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
    if (!batchDraftsRef.current.length) return;
    setBatchDrafts((current) => {
      if (!current[activeFileIndex] || current[activeFileIndex] === draft) {
        return current;
      }
      const next = [...current];
      next[activeFileIndex] = draft;
      batchDraftsRef.current = next;
      return next;
    });
  }, [activeFileIndex, draft]);

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
    const restoredDrafts =
      attempt.drafts?.length ? attempt.drafts : [attempt.draft];
    batchDraftsRef.current = restoredDrafts;
    setBatchDrafts(restoredDrafts);
    setActiveFileIndex(0);
    setDraft(restoredDrafts[0]);
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
    let active = true;
    void Promise.allSettled([getCustomerAppPricing()]).then(
      ([pricingResult]) => {
        if (!active) return;
        if (
          pricingResult.status === "fulfilled" &&
          pricingResult.value?.tenderCoconut
        ) {
          setPricing(pricingResult.value.tenderCoconut);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const next = files.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    );
    setPreviewUrls(next);
    return () => next.forEach((url) => url && URL.revokeObjectURL(url));
  }, [files]);
  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      stopQuestionnaireVoiceSession();
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      questionAudioRef.current?.pause();
    },
    [stopQuestionnaireVoiceSession],
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
    const previousDrafts = batchDraftsRef.current;
    const promise = Promise.allSettled(
      nextFiles.map((file, index) =>
        extractCustomerInvoice(
          [file],
          previousDrafts[index]?.product || draftRef.current.product,
        ),
      ),
    );
    eagerExtractionRef.current = { key, promise };
    setExtractionState("reading");
    void promise
      .then((results) => {
        if (eagerExtractionRef.current?.key === key) {
          setExtractionState(
            results.some((result) => result.status === "fulfilled")
              ? "ready"
              : "failed",
          );
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
      // Prefill can set rate from total÷qty. Editing quantity or rate should
      // refresh the invoice total, but never rewrite quantity/rate just to
      // keep an old total locked.
      if (field === "quantity" || field === "rate") {
        const quantity = Number(next.quantity);
        const rate = Number(next.rate);
        if (quantity > 0 && rate > 0) {
          next.totalAmount = String(
            roundCustomerInvoiceMoney(quantity * rate),
          );
        }
      }
      if (field === "supplierAddress") {
        const derivedPlace = resolvePlaceOfSupplyFromSupplierAddress(
          value,
          String(current.placeOfSupply || ""),
        );
        if (derivedPlace) {
          next.placeOfSupply = derivedPlace;
          placeOfSupplyAutoSyncedRef.current = derivedPlace;
        }
      }
      if (field === "placeOfSupply") {
        placeOfSupplyAutoSyncedRef.current = null;
      }
      return next;
    });
  };

  const setLogisticsIncluded = (includeLogistics: boolean) => {
    setDraft((current) => ({ ...current, includeLogistics }));
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
      const task = queueDocumentExtraction(nextFiles);
      if (task) {
        const extractionKey = fileSetKey(nextFiles);
        void task.then((results) => {
          if (eagerExtractionRef.current?.key !== extractionKey) return;
          setStage("review");
          applyExtractionResults(results);
        });
      }
    } catch {
      const nextFiles = [...files, ...selected].slice(0, 8);
      setFiles(nextFiles);
      const task = queueDocumentExtraction(nextFiles);
      if (task) {
        const extractionKey = fileSetKey(nextFiles);
        void task.then((results) => {
          if (eagerExtractionRef.current?.key !== extractionKey) return;
          setStage("review");
          applyExtractionResults(results);
        });
      }
    }
  };

  const removeFirstFile = () => {
    const nextFiles = files.slice(1);
    const nextDrafts = paymentDrafts.slice(1);
    setFiles(nextFiles);
    batchDraftsRef.current = nextDrafts;
    setBatchDrafts(nextDrafts);
    setActiveFileIndex(0);
    if (nextDrafts[0]) setDraft(nextDrafts[0]);
    setNotice("");
    queueDocumentExtraction(nextFiles);
    if (!nextFiles.length) setExtractionState("idle");
  };

  const openMissingDetails = (nextDraft: CustomerInvoiceDraft) => {
    const preparedDraft = withPomegranateProfileDefaults(nextDraft, user);
    if (preparedDraft !== nextDraft) {
      setDraft(preparedDraft);
      setBatchDrafts((current) => {
        if (!current.length) return current;
        const next = [...current];
        next[activeFileIndex] = preparedDraft;
        batchDraftsRef.current = next;
        return next;
      });
    }
    const nextKeys = getMissingDetailKeys(preparedDraft, user);
    questionAudioRef.current?.pause();
    stopQuestionnaireVoiceSession();
    setVoicePhase("idle");
    setListeningDotCount(0);
    setMissingKeys(nextKeys);
    setMissingIndex(0);
    setMissingOpen(nextKeys.length > 0);
    if (nextKeys.length) {
      setQuestionnaireSession((current) => current + 1);
    }
  };

  const applyExtractionResults = (
    results: PromiseSettledResult<Record<string, unknown>>[],
  ) => {
    const previousDrafts = batchDraftsRef.current;
    const nextDrafts = results.map((result, index) => {
      const baseDraft =
        previousDrafts[index] ||
        (index === activeFileIndex
          ? draftRef.current
          : freshBatchDraft(draftRef.current));
      return result.status === "fulfilled"
        ? applyExtraction(baseDraft, result.value)
        : baseDraft;
    });
    if (!nextDrafts.length) {
      setExtractionState("failed");
      setNotice(
        "Details scan nahi ho paaye. Aap manually details bhar sakte hain.",
      );
      return;
    }
    const firstFailedIndex = results.findIndex(
      (result) => result.status === "rejected",
    );
    batchDraftsRef.current = nextDrafts;
    setBatchDrafts(nextDrafts);
    setActiveFileIndex(0);
    setDraft(nextDrafts[0]);
    openMissingDetails(nextDrafts[0]);
    setNotice(
      firstFailedIndex >= 0
        ? `Invoice ${firstFailedIndex + 1} scan nahi ho paaya. Details manually add karein.`
        : "",
    );
    setExtractionState(
      firstFailedIndex === 0 && results.length === 1 ? "failed" : "ready",
    );
  };

  const advanceMissingDetails = () => {
    setVoicePhase("idle");
    if (missingIndex >= missingKeys.length - 1) {
      setMissingOpen(false);
      return;
    }
    setMissingIndex((current) => current + 1);
  };

  const processQuestionVoice = (
    key: MissingDetailKey,
    audio: File,
    invoiceIndex: number,
    product: string,
  ): Promise<boolean> => {
    const target = resolveMissingQuestion(
      key,
      product,
      user?.preferredLanguage,
    ).target;
    if (!target) return Promise.resolve(false);
    const answerKey = questionnaireAnswerKey(invoiceIndex, key);
    const captureGeneration = questionnaireCaptureGenerationRef.current;
    const generation =
      (questionGenerationRef.current[answerKey] || 0) + 1;
    questionGenerationRef.current[answerKey] = generation;
    setVoiceAnswers((current) => ({
      ...current,
      [answerKey]: "processing",
    }));
    return extractCustomerInvoiceVoice(
      audio,
      product || "Tender Coconut",
      target,
    )
      .then((response) => {
        if (
          questionnaireCaptureGenerationRef.current !== captureGeneration ||
          questionGenerationRef.current[answerKey] !== generation
        ) {
          return false;
        }
        const value = missingVoiceValue(response, key);
        if (!isMissingDetailAnswered(key, value)) {
          throw new Error("Voice answer was empty or invalid.");
        }
        applyQuestionnaireAnswerToInvoice(invoiceIndex, key, value);
        setVoiceAnswers((current) => ({
          ...current,
          [answerKey]: "saved",
        }));
        return true;
      })
      .catch(() => {
        if (
          questionnaireCaptureGenerationRef.current !== captureGeneration ||
          questionGenerationRef.current[answerKey] !== generation
        ) {
          return false;
        }
        setVoiceAnswers((current) => ({
          ...current,
          [answerKey]: "failed",
        }));
        if (activeFileIndexRef.current === invoiceIndex) {
          setNotice(
            `${resolveMissingQuestion(key, product, user?.preferredLanguage).label} samajh nahi aaya. Dobara boliye.`,
          );
        }
        return false;
      });
  };

  const applyQuestionnaireAnswerToInvoice = (
    invoiceIndex: number,
    key: MissingDetailKey,
    value: string,
  ) => {
    if (!batchDraftsRef.current.length) {
      if (invoiceIndex !== 0) return;
      setDraft((current) => applyMissingVoiceValue(current, key, value));
      return;
    }
    const currentDraft =
      activeFileIndexRef.current === invoiceIndex
        ? draftRef.current
        : batchDraftsRef.current[invoiceIndex];
    if (!currentDraft) return;
    const nextDraft = applyMissingVoiceValue(currentDraft, key, value);
    const nextDrafts = [...batchDraftsRef.current];
    nextDrafts[invoiceIndex] = nextDraft;
    batchDraftsRef.current = nextDrafts;
    setBatchDrafts(nextDrafts);
    if (activeFileIndexRef.current === invoiceIndex) {
      draftRef.current = nextDraft;
      setDraft(nextDraft);
    }
  };

  const startRecording = async (
    purpose: RecordingPurpose,
    preparedStream?: Promise<MediaStream>,
    onSpeechStart?: () => void,
  ): Promise<boolean> => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setNotice("Voice input is browser mein available nahi hai.");
      return false;
    }
    if (recorderRef.current?.state === "recording") {
      void preparedStream?.then((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
      return false;
    }
    recordingInvoiceIndexRef.current = activeFileIndexRef.current;
    recordingProductRef.current = draftRef.current.product;
    setNotice("");
    setVoicePhase("requesting");
    try {
      const stream =
        (await preparedStream) ||
        (await navigator.mediaDevices.getUserMedia({
          audio: QUESTIONNAIRE_AUDIO_CONSTRAINTS,
        }));
      const mimeType = preferredAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType
          ? { mimeType, audioBitsPerSecond: 64000 }
          : { audioBitsPerSecond: 64000 },
      );
      const chunks: Blob[] = [];
      let speechConfirmed = false;
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      recordingPurposeRef.current = purpose;
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        chunks.push(event.data);
        if (!speechConfirmed) {
          while (chunks.length > QUESTIONNAIRE_PRE_SPEECH_CHUNK_COUNT) {
            chunks.shift();
          }
        }
      };
      recorder.onerror = () => {
        stopQuestionnaireVoiceSession();
        setVoicePhase("failed");
        setNotice("Voice save nahi hui. Ek baar phir boliye.");
      };
      recorder.onstop = () => {
        stopQuestionnaireVoiceSession();
        const stoppedPurpose = recordingPurposeRef.current;
        const stoppedInvoiceIndex = recordingInvoiceIndexRef.current;
        const stoppedProduct = recordingProductRef.current;
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
        recordingProductRef.current = "";

        if (!stoppedPurpose || blob.size === 0 || duration < 250) {
          setVoicePhase("failed");
          setNotice("Voice save nahi hui. Ek baar phir boliye.");
          return;
        }
        // Optimistic handoff: advance (or close) as soon as speech is captured.
        // Gemini extraction runs in parallel so the trader is never parked on
        // "saving…" between questions — same pattern as the mobile questionnaire.
        advanceMissingDetails();
        void processQuestionVoice(
          stoppedPurpose,
          audio,
          stoppedInvoiceIndex,
          stoppedProduct,
        );
      };
      stopQuestionnaireVoiceSession();
      const voiceSession = new CustomerQuestionnaireVoiceSession({
        silenceMillis: missingVoiceEndSilenceMillis(purpose),
        getCredential: consumeLiveTranscriptionToken,
        onSpeechStart: () => {
          speechConfirmed = true;
          onSpeechStart?.();
        },
        onTurnEnd: () => {
          const activeRecorder = recorderRef.current;
          if (activeRecorder && activeRecorder.state !== "inactive") {
            activeRecorder.stop();
          }
        },
      });
      questionnaireVoiceSessionRef.current = voiceSession;
      setListeningDotCount(0);
      recorder.start(100);
      setRecordingPurpose(purpose);
      setVoicePhase("recording");
      await voiceSession.start(stream);
      return true;
    } catch {
      stopQuestionnaireVoiceSession();
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      recorderStreamRef.current = null;
      recorderRef.current = null;
      recordingPurposeRef.current = null;
      setRecordingPurpose(null);
      setVoicePhase("failed");
      recordingProductRef.current = "";
      setNotice("Microphone permission allow karke dobara try karein.");
      return false;
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
    if (!recordingPurpose) {
      questionAudioRef.current?.pause();
      void startRecording(purpose);
    }
  };

  useEffect(() => {
    if (!missingOpen || !activeMissingKey || !activeQuestion) return;
    let active = true;
    let preparedStreamConsumed = false;
    let listeningStarted = false;
    setVoicePhase("prompt");
    const audio = questionAudioRef.current || new Audio();
    questionAudioRef.current = audio;
    audio.src = activeQuestion.audio;
    audio.preload = "auto";
    audio.currentTime = 0;
    let preparedStreamPromise: Promise<MediaStream> | null = null;
    if (activeQuestion.target && typeof MediaRecorder !== "undefined") {
      try {
        preparedStreamPromise = navigator.mediaDevices.getUserMedia({
          audio: QUESTIONNAIRE_AUDIO_CONSTRAINTS,
        });
      } catch {
        // startRecording will surface the browser/permission error at handoff.
      }
    }
    void preparedStreamPromise
      ?.then((stream) => {
        if (!active && !preparedStreamConsumed) {
          stream.getTracks().forEach((track) => track.stop());
        }
      })
      .catch(() => undefined);

    const startListeningAfterPrompt = () => {
      if (!active || !activeQuestion.target || listeningStarted) return;
      listeningStarted = true;
      preparedStreamConsumed = true;
      void startRecording(
        activeMissingKey,
        preparedStreamPromise || undefined,
      );
    };

    const finishPrompt = () => {
      if (!active) return;
      if (activeQuestion.target) {
        startListeningAfterPrompt();
        return;
      }
      setVoicePhase("idle");
    };
    audio.onended = finishPrompt;
    audio.onerror = finishPrompt;

    void (async () => {
      for (const delay of [0, 120, 320]) {
        if (!active) return;
        if (delay) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }
        try {
          await audio.play();
          return;
        } catch {
          audio.currentTime = 0;
        }
      }
      if (!active) return;
      // Prompt couldn't play — still open the mic so the trader can answer.
      if (activeQuestion.target) {
        setNotice("Question audio play nahi hua. Apna jawab boliye.");
        startListeningAfterPrompt();
        return;
      }
      setVoicePhase("idle");
      setNotice("Question audio play nahi hua.");
    })();

    return () => {
      active = false;
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      if (!preparedStreamConsumed) {
        void preparedStreamPromise
          ?.then((stream) =>
            stream.getTracks().forEach((track) => track.stop()),
          )
          .catch(() => undefined);
      }
    };
    // Each question should play exactly once when its index becomes active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMissingKey, missingOpen, questionnaireSession]);

  const submitAndPay = async () => {
    const invalidDraftIndex = paymentDrafts.findIndex((item) =>
      Boolean(validateDraft(item)),
    );
    if (invalidDraftIndex >= 0) {
      const invalidDraft = paymentDrafts[invalidDraftIndex];
      setActiveFileIndex(invalidDraftIndex);
      setDraft(invalidDraft);
      setNotice(
        paymentDrafts.length > 1
          ? `Invoice ${invalidDraftIndex + 1}: ${validateDraft(invalidDraft)}`
          : validateDraft(invalidDraft),
      );
      openMissingDetails(invalidDraft);
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
    const userId = String(user.id);
    paymentStatusGenerationRef.current += 1;
    paymentStatusCheckingRef.current = false;
    setPaymentStatusChecking(false);
    setStage("creating");
    setNotice("");
    setPaymentRetryPromptOpen(false);
    try {
      const fingerprint = JSON.stringify(
        paymentDrafts.map((item) =>
          customerInvoicePaymentFingerprint(item, pricing),
        ),
      );
      const previousAttempt =
        paymentAttemptRef.current || readCustomerInvoicePaymentAttempt();
      const previousReferences = previousAttempt
        ? paymentAttemptReferences(previousAttempt)
        : [];
      const canReuseCreatedInvoices =
        previousAttempt !== null &&
        previousAttempt.userId === userId &&
        previousAttempt.fingerprint === fingerprint;
      type CreatedCustomerInvoice = Awaited<
        ReturnType<typeof createCustomerInvoice>
      >;
      const createdInvoiceByIndex = new Map<number, CreatedCustomerInvoice>();
      const referenceByIndex = new Map<
        number,
        CustomerInvoicePaymentReference
      >();

      if (canReuseCreatedInvoices) {
        previousReferences.forEach((reference, position) => {
          const draftIndex = Number.isInteger(reference.draftIndex)
            ? Number(reference.draftIndex)
            : position;
          if (
            draftIndex < 0 ||
            draftIndex >= paymentDrafts.length ||
            referenceByIndex.has(draftIndex)
          ) {
            return;
          }
          referenceByIndex.set(draftIndex, {
            ...reference,
            draftIndex,
          });
        });
      }

      const missingDraftIndexes = paymentDrafts
        .map((_, index) => index)
        .filter((index) => !referenceByIndex.has(index));
      if (missingDraftIndexes.some((index) => !files[index])) {
        throw new Error("Har invoice ki weighment slip dobara upload karein.");
      }

      const creationResults = await Promise.allSettled(
        missingDraftIndexes.map((index) =>
          createCustomerInvoice(
            userId,
            paymentDrafts[index],
            [files[index]],
            pricing,
          ),
        ),
      );
      const creationErrors: Array<{ index: number; error: unknown }> = [];
      creationResults.forEach((result, position) => {
        const draftIndex = missingDraftIndexes[position];
        if (result.status === "rejected") {
          creationErrors.push({ index: draftIndex, error: result.reason });
          return;
        }
        const createdInvoice = result.value;
        if (!createdInvoice?.id) {
          creationErrors.push({
            index: draftIndex,
            error: new Error("Invoice was created without an ID."),
          });
          return;
        }
        createdInvoiceByIndex.set(draftIndex, createdInvoice);
        referenceByIndex.set(draftIndex, {
          id: String(createdInvoice.id),
          invoiceNumber: String(createdInvoice.invoiceNumber || ""),
          vehicleNumber: String(
            createdInvoice.vehicleNumber ||
              createdInvoice.truckNumber ||
              paymentDrafts[draftIndex].vehicleNumber,
          ),
          draftIndex,
        });
      });

      const invoiceReferences = [...referenceByIndex.entries()]
        .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
        .map(([, reference]) => reference);
      const resumableAttempt: CustomerInvoicePaymentAttempt | null =
        invoiceReferences.length
          ? {
              version: 2,
              userId,
              invoiceId: invoiceReferences[0].id,
              invoiceReferences,
              merchantOrderId: null,
              phase: "draft",
              fingerprint,
              draft: paymentDrafts[0],
              drafts: paymentDrafts,
              createdAt: Date.now(),
            }
          : null;
      if (resumableAttempt) {
        writeCustomerInvoicePaymentAttempt(resumableAttempt);
        paymentAttemptRef.current = resumableAttempt;
      }

      if (
        creationErrors.length ||
        invoiceReferences.length !== paymentDrafts.length
      ) {
        const firstFailure = creationErrors[0];
        const failureMessage = firstFailure
          ? readableError(firstFailure.error, "Invoice create nahi ho saka.")
          : "Invoice create nahi ho saka.";
        const failedInvoiceNumber = firstFailure
          ? firstFailure.index + 1
          : referenceByIndex.size + 1;
        throw new Error(
          `Invoice ${failedInvoiceNumber}: ${failureMessage} Dobara Pay karein; bane hue invoices repeat nahi honge.`,
        );
      }

      const createdInvoiceAttempt: CustomerInvoicePaymentAttempt = {
        ...(resumableAttempt as CustomerInvoicePaymentAttempt),
        invoiceReferences,
      };
      const unpaidInvoiceReferences = invoiceReferences.filter((reference) => {
        const draftIndex = Number(reference.draftIndex);
        const createdInvoice = createdInvoiceByIndex.get(draftIndex);
        return (
          !createdInvoice ||
          String(createdInvoice.paymentStatus || "").toUpperCase() !== "PAID"
        );
      });
      if (!unpaidInvoiceReferences.length) {
        clearCustomerInvoicePaymentAttempt();
        paymentAttemptRef.current = null;
        router.replace(
          customerInvoiceSuccessUrl({
            invoices: invoiceReferences,
            source: "wallet",
          }),
        );
        return;
      }

      const unpaidInvoiceIds = new Set(
        unpaidInvoiceReferences.map((reference) => reference.id),
      );
      const unpaidPremium = invoiceReferences.reduce((sum, reference) => {
        const draftIndex = Number(reference.draftIndex);
        return unpaidInvoiceIds.has(reference.id) &&
          Number.isInteger(draftIndex) &&
          paymentDrafts[draftIndex]
          ? sum + customerInvoicePremium(paymentDrafts[draftIndex], pricing)
          : sum;
      }, 0);
      const checkout = await createCustomerWebPaymentCheckout(
        unpaidInvoiceReferences.map((reference) => reference.id),
        createdInvoiceByIndex.size === paymentDrafts.length
          ? Number(unpaidPremium.toFixed(2))
          : undefined,
      );
      if (!checkout.redirectUrl) {
        throw new Error("PhonePe checkout URL was not returned.");
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
      const paymentError = readableError(error, "");
      const attemptedPayment =
        paymentAttemptRef.current || readCustomerInvoicePaymentAttempt();
      const attemptedInvoiceId =
        attemptedPayment?.invoiceId;
      const attemptedReferences = attemptedPayment
        ? paymentAttemptReferences(attemptedPayment)
        : [];
      if (
        attemptedInvoiceId &&
        /all selected invoices are already paid/i.test(paymentError)
      ) {
        clearCustomerInvoicePaymentAttempt();
        paymentAttemptRef.current = null;
        router.replace(
          customerInvoiceSuccessUrl({
            invoices: attemptedReferences.length
              ? attemptedReferences
              : [{ id: attemptedInvoiceId }],
            source: "wallet",
          }),
        );
        return;
      }
      setNotice(
        readableError(
          paymentError,
          "Insurance create ya payment start nahi ho saka. Dobara try karein.",
        ),
      );
      setStage("review");
    }
  };

  const selectReviewDraft = (index: number) => {
    const nextDraft = paymentDrafts[index];
    if (!nextDraft || index === activeFileIndex) return;
    setActiveFileIndex(index);
    setDraft(nextDraft);
    setNotice("");
    openMissingDetails(nextDraft);
  };

  const retryIncompleteInvoice = () => {
    if (firstIncompleteInvoiceIndex < 0) {
      void submitAndPay();
      return;
    }
    const incompleteDraft = paymentDrafts[firstIncompleteInvoiceIndex];
    if (!incompleteDraft) return;
    if (firstIncompleteInvoiceIndex !== activeFileIndex) {
      setActiveFileIndex(firstIncompleteInvoiceIndex);
      setDraft(incompleteDraft);
    }
    setNotice(
      paymentDrafts.length > 1
        ? `Invoice ${firstIncompleteInvoiceIndex + 1}: ${validateDraft(incompleteDraft)}`
        : validateDraft(incompleteDraft),
    );
    openMissingDetails(incompleteDraft);
  };

  if (stage === "capture") {
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
                {previewUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrls[0]}
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
                {extractionState === "optimizing" ||
                extractionState === "reading" ? (
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
                    disabled={
                      extractionState === "optimizing" ||
                      extractionState === "reading"
                    }
                  >
                    <ImagePlus size={17} />
                    Photo badlein
                  </button>
                  <button
                    type="button"
                    onClick={removeFirstFile}
                    disabled={
                      extractionState === "optimizing" ||
                      extractionState === "reading"
                    }
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
          onClick={restartInsuranceCapture}
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

        {files.length > 1 ? (
          <div className={styles.reviewFileStrip} aria-label="Uploaded invoices">
            {files.map((file, index) => (
              <div
                className={`${styles.reviewFileThumb} ${
                  index === activeFileIndex
                    ? styles.reviewFileThumbActive
                    : ""
                }`}
                key={`${file.name}-${index}`}
                role="tab"
                tabIndex={0}
                aria-selected={index === activeFileIndex}
                aria-label={`Review invoice ${index + 1}`}
                onClick={() => selectReviewDraft(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectReviewDraft(index);
                  }
                }}
              >
                {previewUrls[index] ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrls[index]}
                      alt={`Invoice ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setZoomedFileIndex(index);
                      }}
                      aria-label={`Zoom invoice ${index + 1}`}
                    >
                      <ZoomIn size={14} />
                    </button>
                  </>
                ) : (
                  <span>
                    <FileText size={25} />
                  </span>
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
                <ChevronDown size={18} aria-hidden="true" />
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
                  <span>
                    <FileText size={27} />
                  </span>
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
              label={PARTY_UI_LABELS.shipper}
              value={draft.supplierName}
              onChange={(value) => update("supplierName", value)}
            />
            <CompactInput
              label={PARTY_UI_LABELS.consignee}
              value={draft.buyerName}
              onChange={(value) => update("buyerName", value)}
            />
            <CompactInput
              label={PARTY_UI_LABELS.shipperAddress}
              value={draft.supplierAddress}
              multiline
              onChange={(value) => update("supplierAddress", value)}
            />
            <CompactInput
              label={PARTY_UI_LABELS.consigneeAddress}
              value={draft.buyerAddress}
              multiline
              onChange={(value) => update("buyerAddress", value)}
            />
          </DetailSection>

          <DetailSection title="Goods & vehicle" icon={<Truck size={20} />}>
            <div
              className={`${styles.dealStrip} ${
                !String(draft.quantity || "").trim() ||
                !String(draft.rate || "").trim()
                  ? styles.dealStripIncomplete
                  : styles.dealStripComplete
              }`}
            >
              <div className={styles.dealStripRow}>
                <label
                  className={`${styles.dealStripCell} ${
                    !String(draft.quantity || "").trim()
                      ? styles.dealStripCellEmpty
                      : ""
                  }`}
                >
                  <span>Quantity</span>
                  <input
                    inputMode="decimal"
                    value={draft.quantity}
                    placeholder="Likhein"
                    onChange={(event) =>
                      update("quantity", event.target.value)
                    }
                  />
                </label>
                <div className={styles.dealStripDivider} aria-hidden="true" />
                <label
                  className={`${styles.dealStripCell} ${
                    !String(draft.rate || "").trim()
                      ? styles.dealStripCellEmpty
                      : ""
                  }`}
                >
                  <span>Rate</span>
                  <input
                    inputMode="decimal"
                    value={draft.rate}
                    placeholder="Likhein"
                    onChange={(event) => update("rate", event.target.value)}
                  />
                </label>
              </div>
              {!String(draft.quantity || "").trim() ||
              !String(draft.rate || "").trim() ? (
                <p className={styles.dealStripHint}>
                  Quantity aur rate dono bharo
                </p>
              ) : null}
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
              <div className={styles.inlineTonnageField}>
                <span>Tonnage</span>
                <div className={styles.inlineTonnage}>
                  {TENDER_TONNAGE_CHOICES.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={
                        draft.vehicleTonnage === choice.value
                          ? styles.tonnageButtonActive
                          : ""
                      }
                      onClick={() => update("vehicleTonnage", choice.value)}
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
              label={PARTY_UI_LABELS.consigneeMobile}
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
              {amountBreakdown.configuredLogisticsAmount > 0 ? (
                <div className={styles.amountBreakdownRow}>
                  <span className={styles.amountBreakdownLogisticsLabel}>
                    <span>
                      Logistics cost
                      {draft.vehicleTonnage === "25" ||
                      draft.vehicleTonnage === "30"
                        ? ` (${draft.vehicleTonnage} ton)`
                        : ""}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.includeLogistics !== false}
                      aria-label="Include logistics cost in total"
                      className={styles.amountBreakdownLogisticsToggle}
                      onClick={() =>
                        setLogisticsIncluded(draft.includeLogistics === false)
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={styles.amountBreakdownSwitch}
                        data-checked={draft.includeLogistics !== false}
                      />
                    </button>
                  </span>
                  <strong
                    className={
                      draft.includeLogistics !== false
                        ? ""
                        : styles.amountBreakdownRemovedValue
                    }
                  >
                    {money(amountBreakdown.configuredLogisticsAmount)}
                  </strong>
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

        {notice ? <div className={styles.notice}>{notice}</div> : null}
      </main>

      <div className={styles.stickyPay}>
        <button
          type="button"
          className={styles.wideButton}
          onClick={retryIncompleteInvoice}
          disabled={
            stage === "creating" ||
            paymentStatusChecking ||
            extractionState === "reading" ||
            pendingVoiceAnswers > 0
          }
        >
          {stage === "creating" ||
          paymentStatusChecking ||
          extractionState === "reading" ||
          pendingVoiceAnswers > 0 ? (
            <LoaderCircle className="animate-spin" size={19} />
          ) : null}
          {paymentStatusChecking
            ? "Payment check ho raha hai"
            : extractionState === "reading"
              ? "Parchi padh rahe hain"
              : pendingVoiceAnswers > 0
                ? "Details save ho rahi hain"
                : validationIssue
                  ? "Dobara try karein"
                  : `Pay ${payableMoney(payablePremium)}`}
        </button>
      </div>

      {zoomedFileIndex !== null && previewUrls[zoomedFileIndex] ? (
        <div
          className={styles.invoicePreviewModal}
          role="dialog"
          aria-modal="true"
        >
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

      {missingOpen && activeMissingKey && activeQuestion ? (
        <div className={styles.missingDetailsModal}>
          <div
            className={styles.missingDetailsBackdrop}
            aria-hidden="true"
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
              {activeQuestion.label}
            </h3>

            {activeMissingKey === "vehicleTonnage" ? (
              <div className={styles.missingTonnageChoices}>
                {TENDER_TONNAGE_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => {
                      questionAudioRef.current?.pause();
                      update("vehicleTonnage", choice.value);
                      advanceMissingDetails();
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
                    onClick={() => handleVoicePress(activeMissingKey)}
                    disabled={
                      voicePhase === "requesting" ||
                      voicePhase === "prompt" ||
                      voicePhase === "processing"
                    }
                    aria-label={
                      voicePhase === "recording"
                        ? "Answer complete"
                        : voicePhase === "processing"
                          ? "Saving answer"
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
                ) : voicePhase === "processing" ? (
                  <p className={styles.missingVoiceLabel}>
                    {`saving${".".repeat(listeningDotCount)}`}
                  </p>
                ) : voicePhase === "prompt" ? (
                  <p className={styles.missingVoiceLabel}>
                    {`playing${".".repeat(listeningDotCount)}`}
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
  multiline = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
  multiline?: boolean;
  inputMode?: "text" | "decimal" | "numeric" | "tel";
}) {
  const multilineRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = multilineRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${input.scrollHeight}px`;
  }, [multiline, value]);

  return (
    <label
      className={`${styles.compactField} ${
        full ? styles.detailGridFull : ""
      } ${multiline ? styles.compactFieldMultiline : ""}`}
    >
      <span>{label}</span>
      {multiline ? (
        <textarea
          ref={multilineRef}
          rows={1}
          value={value}
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          value={value}
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function applyExtraction(
  current: CustomerInvoiceDraft,
  response: Record<string, unknown>,
): CustomerInvoiceDraft {
  const raw = extractionDraft(response);
  const extractedSupplierName = plausiblePartyName(
    raw.seller_name || raw.supplier_name,
  );
  const quantity = numberText(raw.quantity);
  const extractedTotal = numberText(raw.total_amount || raw.amount);
  const rate =
    numberText(raw.rate) ||
    (quantity && extractedTotal
      ? String(round(Number(extractedTotal) / Number(quantity)))
      : "");
  const nextProduct =
    canonicalizeCommodityLabel(
      text(raw.commodity || raw.product_name || raw.product),
    ) || current.product;
  const nextSupplierAddress =
    text(raw.supplier_address) || current.supplierAddress;
  const isPomegranate = isPomegranateProduct(nextProduct);

  return {
    ...current,
    supplierName: extractedSupplierName || current.supplierName,
    supplierAddress: nextSupplierAddress,
    buyerName:
      text(raw.buyer_name || raw.billToName || raw.shipToName) ||
      current.buyerName,
    // Anar destination is asked by voice ("mal kidhar") — OCR addresses
    // like "District: Mumbai" were skipping that question entirely.
    buyerAddress: isPomegranate
      ? ""
      : text(
          raw.buyer_address ||
            raw.buyerAddress ||
            raw.billToAddress ||
            raw.shipToAddress,
        ) || current.buyerAddress,
    placeOfSupply: humanStateLabel(
      resolvePlaceOfSupplyFromSupplierAddress(
        nextSupplierAddress,
        text(raw.place_of_supply) || current.placeOfSupply,
      ),
    ),
    product: nextProduct,
    quantity: quantity || current.quantity,
    rate: rate || current.rate,
    totalAmount: extractedTotal || current.totalAmount,
    vehicleNumber:
      text(raw.vehicle_number || raw.truck_number)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") || current.vehicleNumber,
    // The 25/30 ton choice is a logistics tier, not the weighbridge weight.
    // A vision model must not infer it from gross/net kilograms on the slip.
    vehicleTonnage: current.vehicleTonnage,
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
  if (key === "quantity" || key === "rate") {
    const quantity = Number(next.quantity);
    const rate = Number(next.rate);
    if (quantity > 0 && rate > 0) {
      next.totalAmount = String(roundCustomerInvoiceMoney(quantity * rate));
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
    case "rate":
      return numberText(raw.rate);
    case "totalAmount": {
      const spokenAmount = Number(raw.total_amount || raw.amount || 0);
      return numberText(
        spokenAmount > 0 && spokenAmount < 1000
          ? spokenAmount * 100000
          : spokenAmount,
      );
    }
    case "vehicleNumber":
      return text(raw.vehicle_number).replace(/\s+/g, "").toUpperCase();
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

function withPomegranateProfileDefaults(
  draft: CustomerInvoiceDraft,
  user: Record<string, unknown> | null | undefined,
) {
  if (!isPomegranateProduct(draft.product)) return draft;
  // Anar users are always treated as suppliers for the voice flow —
  // ignore profile identity (misclicks / misinterpretation).
  const userName = String(user?.name || user?.fullName || "").trim();
  const userPhone = phone(
    String(
      user?.phone ||
        user?.mobile ||
        user?.mobileNumber ||
        user?.phoneNumber ||
        "",
    ),
  );
  const userAddress = String(user?.address || user?.mandiName || "").trim();
  const next = { ...draft };

  // Always ask "Mal kidhar ja raha hai?" — never trust OCR/profile destination.
  next.buyerAddress = "";

  if (!next.supplierName.trim() && userName) next.supplierName = userName;
  if (!next.supplierAddress.trim() && userAddress) {
    next.supplierAddress = userAddress;
  }
  next.placeOfSupply = humanStateLabel(
    resolvePlaceOfSupplyFromSupplierAddress(
      next.supplierAddress,
      next.placeOfSupply,
    ) ||
      user?.state ||
      "India",
  );
  if (
    userName &&
    next.buyerName.trim().toLowerCase() === userName.toLowerCase()
  ) {
    next.buyerName = "";
  }
  if (!phone(next.insuredPartyPhone) && userPhone) {
    next.insuredPartyPhone = userPhone;
  }
  return next;
}

function humanStateLabel(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "India") return "India";
  const match = INDIA_STATES.find(
    (item) =>
      item.value === raw ||
      item.label.toLowerCase() === raw.toLowerCase() ||
      item.value.replace(/_/g, " ").toLowerCase() === raw.toLowerCase(),
  );
  return match?.label || raw;
}

function placeOfSupplyFromAddress(address: string) {
  const haystack = String(address || "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!haystack) return "";

  const districtMatch = haystack.match(
    /\b(?:dist\.?|district|zilla|zila)\s*[:=\-.]?\s*([a-z][a-z.]+(?:\s+[a-z][a-z.]+)?)/i,
  );
  if (districtMatch?.[1]) {
    return titleCasePlace(districtMatch[1].replace(/\./g, " "));
  }

  let bestLabel = "";
  let bestLength = 0;
  for (const state of INDIA_STATES) {
    const candidates = [
      state.label.toLowerCase(),
      state.value.replace(/_/g, " ").toLowerCase(),
    ];
    for (const candidate of candidates) {
      if (!candidate || candidate.length < 3) continue;
      if (haystack.includes(candidate) && candidate.length > bestLength) {
        bestLabel = state.label;
        bestLength = candidate.length;
      }
    }
  }
  return bestLabel;
}

function resolvePlaceOfSupplyFromSupplierAddress(
  supplierAddress: string,
  currentPlaceOfSupply = "",
) {
  const address = String(supplierAddress || "").trim();
  if (!address) return "";

  const derived = placeOfSupplyFromAddress(address);
  if (derived) return derived;

  const current = String(currentPlaceOfSupply || "").trim();
  if (!current) return "";

  const haystack = address.toLowerCase().replace(/[_/]+/g, " ");
  const needle = current.toLowerCase().replace(/[_/]+/g, " ").trim();
  if (needle.length >= 3 && haystack.includes(needle)) {
    return titleCasePlace(current);
  }
  return "";
}

function titleCasePlace(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getMissingDetailKeys(
  draft: CustomerInvoiceDraft,
  _user?: Record<string, unknown> | null,
) {
  if (!String(draft.product || "").trim()) return [];

  const isTenderCoconut = isTenderCoconutProduct(draft.product);
  const isPomegranate = isPomegranateProduct(draft.product);
  const ordered: MissingDetailKey[] = isPomegranate
    ? POMEGRANATE_MISSING_DETAIL_KEYS
    : [
        "supplierName",
        "buyerName",
        "buyerAddress",
        "quantity",
        "totalAmount",
        "insuredPartyPhone",
        ...(isTenderCoconut ? (["vehicleTonnage"] as const) : []),
      ];
  return ordered.filter(
    (key) => !isMissingDetailAnswered(key, String(draft[key] || "")),
  );
}

function isMissingDetailAnswered(key: MissingDetailKey, value: string) {
  const clean = value.trim();
  if (key === "supplierName" || key === "buyerName") {
    return plausiblePartyName(clean).length > 0;
  }
  if (key === "insuredPartyPhone") return /^[6-9]\d{9}$/.test(phone(clean));
  if (key === "quantity" || key === "rate" || key === "totalAmount") {
    return Number(clean) > 0;
  }
  if (key === "vehicleTonnage") {
    return clean === "25" || clean === "30";
  }
  return Boolean(clean);
}

function validateDraft(draft: CustomerInvoiceDraft) {
  if (!draft.supplierName.trim())
    return `${PARTY_UI_LABELS.shipper} ka naam add karein.`;
  if (!draft.supplierAddress.trim())
    return `${PARTY_UI_LABELS.shipperAddress} add karein.`;
  if (!draft.buyerName.trim())
    return `${PARTY_UI_LABELS.consignee} ka naam add karein.`;
  if (!draft.buyerAddress.trim())
    return `${PARTY_UI_LABELS.consigneeAddress} add karein.`;
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
    return `${PARTY_UI_LABELS.consignee} ka 10 digit mobile number add karein.`;
  }
  if (
    draft.driverPhone.trim() &&
    !/^[6-9]\d{9}$/.test(phone(draft.driverPhone))
  ) {
    return "Driver ka sahi 10 digit mobile number add karein.";
  }
  return "";
}

function freshBatchDraft(template: CustomerInvoiceDraft) {
  return {
    ...template,
    supplierName: "",
    supplierAddress: "",
    quantity: "",
    rate: "",
    totalAmount: "",
    vehicleNumber: "",
    vehicleTonnage: "",
    driverPhone: "",
    ownerName: "",
    note: "",
    invoiceDate: today(),
  };
}

function questionnaireAnswerKey(
  invoiceIndex: number,
  key: MissingDetailKey,
) {
  return `${invoiceIndex}:${key}`;
}

function customerInvoiceSuccessUrl({
  invoices,
  source,
}: {
  invoices: CustomerInvoicePaymentReference[];
  source?: "wallet";
}) {
  const params = new URLSearchParams();
  invoices.forEach((invoice) => {
    if (!invoice.id) return;
    params.append("invoiceId", invoice.id);
    params.append("invoiceNumber", invoice.invoiceNumber || "");
    params.append("vehicle", invoice.vehicleNumber || "");
  });
  if (source) params.set("source", source);
  return `/payment/success?${params.toString()}`;
}

function paymentAttemptReferences(
  attempt: CustomerInvoicePaymentAttempt,
): CustomerInvoicePaymentReference[] {
  if (attempt.invoiceReferences?.length) {
    return attempt.invoiceReferences;
  }
  return attempt.invoiceId ? [{ id: attempt.invoiceId }] : [];
}

function customerInvoicePremium(
  draft: CustomerInvoiceDraft,
  pricing: CustomerAppPricing["tenderCoconut"],
) {
  return Number(
    (resolveInvoiceAmountBreakdown(draft, pricing).totalAmount * 0.002).toFixed(
      2,
    ),
  );
}

function resolveInvoiceAmountBreakdown(
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
  const configuredLogistics = isTenderCoconutProduct(draft.product)
    ? draft.vehicleTonnage === "25"
      ? Number(pricing.amount25Ton || 0)
      : draft.vehicleTonnage === "30"
        ? Number(pricing.amount30Ton || 0)
        : 0
    : 0;
  const logistics =
    draft.includeLogistics !== false ? configuredLogistics : 0;
  return {
    invoiceAmount: Number(goodsAmount.toFixed(2)),
    configuredLogisticsAmount: Number(configuredLogistics.toFixed(2)),
    logisticsAmount: Number(logistics.toFixed(2)),
    totalAmount: Number((goodsAmount + logistics).toFixed(2)),
  };
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

function plausiblePartyName(value: unknown) {
  const clean = text(value);
  const letterCount = (clean.match(/\p{L}/gu) || []).length;
  return letterCount >= 2 ? clean : "";
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
