"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  MagnifyingGlassPlusIcon,
  MicrophoneIcon,
  PaperClipIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { useAdmin } from "@/features/admin/context/AdminContext";
import {
  AdminLedgerUser,
  AdminQuickDetail,
  AdminQuickDetailAutofillResult,
  adminApi,
} from "@/features/admin/api/admin.api";
import {
  getHsnForProduct,
  itemsData,
} from "@/features/insurance/productCatalog";
import { getVehicleRecentInvoiceStatus } from "@/features/insurance/api";

type InvoiceKind = "cash" | "commission";

type QuickInvoiceForm = {
  invoiceKind: InvoiceKind;
  insuredUserId: string;
  supplierUserId: string;
  buyerUserId: string;
  invoiceDate: string;
  supplierName: string;
  supplierAddress: string;
  placeOfSupply: string;
  billToName: string;
  billToAddress: string;
  shipToName: string;
  shipToAddress: string;
  productName: string;
  hsnCode: string;
  quantity: string;
  rate: string;
  vehicleNumber: string;
  ownerName: string;
  insuredPartyPhone: string;
  driverPhone: string;
  driverSecondaryPhone: string;
};

const INDIAN_PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;
const fieldClass =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const fileFieldClass = `${fieldClass} cursor-pointer p-0 text-slate-500 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-slate-200 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-200`;
const labelClass =
  "block text-xs font-bold uppercase tracking-wide text-slate-600";

const emptyForm = (): QuickInvoiceForm => ({
  invoiceKind: "cash",
  insuredUserId: "",
  supplierUserId: "",
  buyerUserId: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  supplierName: "",
  supplierAddress: "",
  placeOfSupply: "",
  billToName: "",
  billToAddress: "",
  shipToName: "",
  shipToAddress: "",
  productName: "",
  hsnCode: "",
  quantity: "",
  rate: "",
  vehicleNumber: "",
  ownerName: "",
  insuredPartyPhone: "",
  driverPhone: "",
  driverSecondaryPhone: "",
});

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(value?: string | null) {
  const cleaned = String(value || "").replace(/\D/g, "");
  if (cleaned.length === 10)
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  if (cleaned.length === 12 && cleaned.startsWith("91"))
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  return value || "-";
}

function formatDuration(milliseconds?: number | null) {
  const seconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function normalizePhoneInput(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

function isValidIndianPhone(value: string) {
  return INDIAN_PHONE_REGEX.test(value.trim());
}

function normalizeVehicleText(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeLines(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function userAddressText(user?: Partial<AdminLedgerUser> | null) {
  if (!user) return "";
  const userRecord = user as Partial<AdminLedgerUser> & Record<string, unknown>;
  const fields = [
    "destinationShopAddress",
    "loadingPoint",
    "officeAddress",
    "destinationAddress",
    "route",
    "mandiName",
  ];
  for (const field of fields) {
    const lines = normalizeLines(userRecord[field]);
    if (lines.length > 0) return lines.join("\n");
  }
  return String(user.state || "").replace(/_/g, " ");
}

function userPlaceOfSupply(user?: Partial<AdminLedgerUser> | null) {
  return (
    userAddressText(user).split("\n").find(Boolean) ||
    String(user?.state || "").replace(/_/g, " ")
  );
}

function applyInsuredUser(
  form: QuickInvoiceForm,
  user: AdminLedgerUser | null,
): QuickInvoiceForm {
  const address = userAddressText(user);
  const base = {
    ...form,
    insuredUserId: user?.id || "",
    insuredPartyPhone: user?.mobileNumber || form.insuredPartyPhone,
    placeOfSupply: form.placeOfSupply || userPlaceOfSupply(user),
  };
  if (form.invoiceKind === "cash") {
    return {
      ...base,
      buyerUserId: user?.id || "",
      billToName: user?.name || "",
      billToAddress: address,
      shipToName: user?.name || "",
      shipToAddress: address,
    };
  }
  return {
    ...base,
    supplierUserId: user?.id || "",
    supplierName: user?.name || "",
    supplierAddress: address,
  };
}

function isPresent(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return String(value ?? "").trim() !== "";
}

function normalizeLookup(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    // OCR splits "PINE APPLE" — fold it back before matching Apple.
    .replace(/\bpine apple\b/g, "pineapple")
    .trim();
}

function canonicalProduct(value: unknown, hsn: unknown) {
  const hsnText = String(hsn ?? "").trim();
  const byHsn = itemsData.find((item) => item.hsn === hsnText);
  if (byHsn) return byHsn;

  const wanted = normalizeLookup(value);
  if (!wanted) return null;
  const exact = itemsData.find((item) => normalizeLookup(item.name) === wanted);
  if (exact) return exact;
  return (
    itemsData
      .map((item) => ({ item, candidate: normalizeLookup(item.name) }))
      .filter(({ candidate }) => {
        // "pineapple" contains "apple" — never let one resolve to the other.
        if (candidate === "apple" && wanted.includes("pineapple")) return false;
        if (candidate === "pineapple" && !wanted.includes("pineapple")) {
          return false;
        }
        return (
          candidate.length >= 4 &&
          (candidate.includes(wanted) || wanted.includes(candidate))
        );
      })
      .sort((left, right) => right.candidate.length - left.candidate.length)[0]
      ?.item || null
  );
}

function onboardingProduct(code: unknown) {
  const names: Record<string, string> = {
    TENDER_COCONUT: "Tender Coconut",
    TOMATO: "Tomato",
    MANGO: "Mango",
    BANANA: "Banana",
    ONION: "Onion",
    POTATO: "Potato",
    APPLE: "Apple",
    PINEAPPLE: "Pineapple",
    POMEGRANATE: "Pomegranate (Anar)",
  };
  return canonicalProduct(names[String(code || "")] || String(code || ""), "");
}

function toDateInput(value: unknown) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function mapAutofillDraft(
  raw: Record<string, unknown>,
  users: AdminLedgerUser[],
): Partial<QuickInvoiceForm> {
  const invoiceType = String(raw.invoice_type || raw.notes || "").toUpperCase();
  const invoiceKind: InvoiceKind =
    invoiceType.includes("SUPPLIER") || invoiceType.includes("COMMISSION")
      ? "commission"
      : "cash";
  const product = canonicalProduct(
    raw.commodity || raw.product_name,
    raw.hsn_code,
  );
  const suggestedUserId = String(
    raw.customer_user_id ||
      raw.customerUserId ||
      (invoiceKind === "cash" ? raw.buyer_id : raw.seller_id) ||
      "",
  );
  const insuredUserId = users.some((user) => user.id === suggestedUserId)
    ? suggestedUserId
    : "";
  const buyerUserId = String(raw.buyer_id || "");
  const supplierUserId = String(raw.seller_id || raw.supplier_id || "");

  return {
    invoiceKind,
    ...(insuredUserId ? { insuredUserId } : {}),
    ...(users.some((user) => user.id === buyerUserId) ? { buyerUserId } : {}),
    ...(users.some((user) => user.id === supplierUserId)
      ? { supplierUserId }
      : {}),
    invoiceDate: toDateInput(raw.invoice_date),
    supplierName: String(raw.seller_name || raw.supplier_name || ""),
    supplierAddress: String(raw.supplier_address || ""),
    placeOfSupply: String(raw.place_of_supply || ""),
    billToName: String(raw.buyer_name || ""),
    billToAddress: String(raw.buyer_address || ""),
    shipToName: String(raw.buyer_name || ""),
    shipToAddress: String(raw.buyer_address || ""),
    productName: product?.name || "",
    hsnCode: product?.hsn || String(raw.hsn_code || ""),
    quantity: isPresent(raw.quantity) ? String(raw.quantity) : "",
    rate: isPresent(raw.rate) ? String(raw.rate) : "",
    vehicleNumber: String(raw.vehicle_number || raw.truck_number || ""),
    ownerName: String(raw.owner_name || ""),
    insuredPartyPhone: String(
      raw.insured_party_phone || raw.buyer_phone || raw.seller_phone || "",
    ),
    driverPhone: String(raw.driver_phone || ""),
    driverSecondaryPhone: String(raw.driver_secondary_phone || ""),
  };
}

function productSourceLabel(source: unknown) {
  const value = String(source || "");
  if (value === "customer_quick_detail_selection")
    return "Selected by customer";
  if (
    value === "onboarding_primary_commodity" ||
    value === "onboarding_commodity"
  )
    return "From customer onboarding";
  if (value === "document_extraction") return "Read from uploaded details";
  if (value === "customer_invoice_profile") return "From saved invoice profile";
  if (value.includes("history") || value.includes("learning"))
    return "From verified invoice history";
  if (value) return "Matched to product catalogue";
  return "";
}

export default function AdminQuickDetailDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    isAuthenticated,
    loading: authLoading,
    canAccessSection,
  } = useAdmin();
  const [detail, setDetail] = useState<AdminQuickDetail | null>(null);
  const [verifiedUsers, setVerifiedUsers] = useState<AdminLedgerUser[]>([]);
  const [form, setForm] = useState<QuickInvoiceForm>(() => emptyForm());
  const [weighmentSlips, setWeighmentSlips] = useState<File[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [autofillMessage, setAutofillMessage] = useState("");
  const [persistedAutofill, setPersistedAutofill] =
    useState<AdminQuickDetailAutofillResult | null>(null);
  const [productAutofillSource, setProductAutofillSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submitRequestInFlightRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtyFieldsRef = useRef(new Set<keyof QuickInvoiceForm>());
  const appliedAutofillRef = useRef("");

  const selectedInsuredUser = useMemo(
    () => verifiedUsers.find((user) => user.id === form.insuredUserId) || null,
    [form.insuredUserId, verifiedUsers],
  );
  const invoiceAttachmentUrls = useMemo(
    () =>
      (detail?.media || [])
        .filter((media) => media.kind === "image" || media.kind === "pdf")
        .map((media) => media.url),
    [detail?.media],
  );
  const activeMedia =
    detail?.media?.[activeMediaIndex] || detail?.media?.[0] || null;
  const persistedAutofillStatus = persistedAutofill?.status;

  const updateForm = (patch: Partial<QuickInvoiceForm>, markDirty = true) => {
    if (markDirty) {
      Object.keys(patch).forEach((field) =>
        dirtyFieldsRef.current.add(field as keyof QuickInvoiceForm),
      );
    }
    setForm((current) => ({ ...current, ...patch }));
  };

  const loadPage = useCallback(async () => {
    if (
      !isAuthenticated ||
      !canAccessSection("app-quick-details") ||
      !params?.id
    )
      return;
    setLoading(true);
    setError(null);
    const [detailResponse, usersResponse] = await Promise.all([
      adminApi.getAdminQuickDetail(params.id),
      adminApi.getAdminLedgerUsers(),
    ]);

    if (!detailResponse.success || !detailResponse.data) {
      setError(detailResponse.message || "Failed to load quick detail.");
      setLoading(false);
      return;
    }

    const users =
      usersResponse.success && Array.isArray(usersResponse.data)
        ? usersResponse.data
            .filter(
              (user) =>
                user.isLedgerMasterVerified &&
                !user.isMerged &&
                user.id === user.canonicalUserId,
            )
            .sort((left, right) =>
              String(left.name || "").localeCompare(String(right.name || "")),
            )
        : [];

    const matchedUser =
      users.find((user) => user.id === detailResponse.data?.user?.id) || null;
    const onboardingCommodity =
      detailResponse.data?.user?.products?.length === 1
        ? detailResponse.data.user.products[0]
        : "";
    const primaryProduct =
      canonicalProduct(detailResponse.data?.commodity, "") ||
      onboardingProduct(onboardingCommodity);
    dirtyFieldsRef.current.clear();
    appliedAutofillRef.current = "";
    setProductAutofillSource(
      detailResponse.data?.commodity
        ? "Selected by customer"
        : primaryProduct
          ? "From customer onboarding"
          : "",
    );
    setVerifiedUsers(users);
    setDetail(detailResponse.data);
    setPersistedAutofill(detailResponse.data.autofill || null);
    setForm((current) => ({
      ...applyInsuredUser(current, matchedUser),
      ...(primaryProduct
        ? { productName: primaryProduct.name, hsnCode: primaryProduct.hsn }
        : {}),
    }));
    setLoading(false);
  }, [canAccessSection, isAuthenticated, params?.id]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!persistedAutofill) {
      setAutofillStatus("idle");
      setAutofillMessage(
        "Autofill is prepared in the background after submission.",
      );
      return;
    }

    if (persistedAutofill.status === "completed" && persistedAutofill.draft) {
      const resultKey = `${persistedAutofill.fingerprint || detail?.id || ""}:${persistedAutofill.completedAt || ""}`;
      if (appliedAutofillRef.current !== resultKey) {
        const patch = mapAutofillDraft(persistedAutofill.draft, verifiedUsers);
        const productResolution = persistedAutofill.suggestions
          ?.productResolution as { source?: unknown } | undefined;
        setProductAutofillSource(
          (current) => productSourceLabel(productResolution?.source) || current,
        );
        let appliedCount = 0;
        setForm((current) => {
          const next = { ...current };
          (
            Object.entries(patch) as Array<[keyof QuickInvoiceForm, string]>
          ).forEach(([field, value]) => {
            if (!isPresent(value) || dirtyFieldsRef.current.has(field)) return;
            if (String(next[field] ?? "") !== String(value)) appliedCount += 1;
            (next[field] as string) = value;
          });
          return next;
        });
        appliedAutofillRef.current = resultKey;
        setAutofillMessage(
          persistedAutofill.attachmentsRead > 0
            ? `Saved document result applied${appliedCount ? ` to ${appliedCount} field${appliedCount === 1 ? "" : "s"}` : ""}.`
            : "Saved customer details applied. Review the remaining fields.",
        );
      }
      setAutofillStatus("done");
      return;
    }

    if (persistedAutofill.status === "failed") {
      setAutofillStatus("error");
      setAutofillMessage(
        persistedAutofill.error ||
          "Background autofill could not finish. You can retry or continue manually.",
      );
      return;
    }

    setAutofillStatus("loading");
    setAutofillMessage(
      persistedAutofill.status === "processing"
        ? "Reading the uploaded details in the background…"
        : "Autofill is queued and will appear here automatically.",
    );
  }, [detail?.id, persistedAutofill, verifiedUsers]);

  useEffect(() => {
    if (
      !detail?.id ||
      !persistedAutofillStatus ||
      !["not_started", "pending", "processing"].includes(
        persistedAutofillStatus,
      )
    )
      return;
    let active = true;

    const refreshSavedAutofill = async () => {
      const response = await adminApi.getAdminQuickDetailAutofill(detail.id);
      if (active && response.success && response.data)
        setPersistedAutofill(response.data);
    };

    const timer = window.setInterval(() => void refreshSavedAutofill(), 2500);
    void refreshSavedAutofill();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [detail?.id, persistedAutofillStatus]);

  const retryAutofill = useCallback(async () => {
    if (!detail?.id) return;
    setAutofillStatus("loading");
    setAutofillMessage("Retrying background autofill…");

    const response = await adminApi.autofillAdminQuickDetail(detail.id);
    if (!response.success || !response.data) {
      setAutofillStatus("error");
      setAutofillMessage(
        response.message ||
          "Autofill was unavailable. You can continue manually.",
      );
      return;
    }
    setPersistedAutofill(response.data);
  }, [detail?.id]);

  const handleProductChange = (productName: string) => {
    setProductAutofillSource(productName ? "Selected by admin" : "");
    updateForm({ productName, hsnCode: getHsnForProduct(productName) });
  };

  const handleInvoiceKindChange = (invoiceKind: InvoiceKind) => {
    dirtyFieldsRef.current.add("invoiceKind");
    setForm((current) =>
      applyInsuredUser({ ...current, invoiceKind }, selectedInsuredUser),
    );
  };

  const validateVehicle = async (vehicleNumber: string) => {
    const normalizedVehicle = normalizeVehicleText(vehicleNumber);
    if (!normalizedVehicle) return;
    try {
      const status = await getVehicleRecentInvoiceStatus(normalizedVehicle);
      if (status.hasRecentInvoice) {
        toast.error(
          status.message ||
            "An invoice was already created for this vehicle within the last 24 hours. Please try again after 24 hours.",
        );
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to verify recent vehicle invoice status.",
      );
    }
  };

  const handleSubmit = async () => {
    if (submitRequestInFlightRef.current) return;

    const insuredUser = selectedInsuredUser;
    if (!insuredUser) {
      toast.error("Select a registered verified insured party.");
      return;
    }

    const qty = Number(form.quantity || 0);
    const rate = Number(form.rate || 0);
    const amount = Number((qty * rate).toFixed(2));
    if (!form.supplierName.trim() || !form.billToName.trim()) {
      toast.error("Supplier and bill-to details are required.");
      return;
    }
    if (!form.productName.trim() || qty <= 0 || rate <= 0) {
      toast.error("Fill product, quantity, and rate before creating invoice.");
      return;
    }
    if (!isValidIndianPhone(form.insuredPartyPhone)) {
      toast.error("Insured party phone must be a valid Indian mobile number.");
      return;
    }

    const normalizedDriverPhone = normalizePhoneInput(form.driverPhone);
    const normalizedDriverSecondaryPhone = normalizePhoneInput(
      form.driverSecondaryPhone,
    );
    if (form.driverPhone.trim() && !isValidIndianPhone(form.driverPhone)) {
      toast.error("Driver mobile number must be a valid Indian mobile number.");
      return;
    }
    if (
      form.driverSecondaryPhone.trim() &&
      !isValidIndianPhone(form.driverSecondaryPhone)
    ) {
      toast.error(
        "Alternate driver mobile number must be a valid Indian mobile number.",
      );
      return;
    }
    if (
      normalizedDriverPhone &&
      normalizedDriverSecondaryPhone &&
      normalizedDriverPhone === normalizedDriverSecondaryPhone
    ) {
      toast.error(
        "Alternate driver mobile number must be different from primary driver number.",
      );
      return;
    }

    submitRequestInFlightRef.current = true;
    setSubmitting(true);
    try {
      const response = await adminApi.createAdminInvoice({
        userId: insuredUser.id,
        customerUserId: insuredUser.id,
        buyerUserId:
          form.buyerUserId ||
          (form.invoiceKind === "cash" ? insuredUser.id : undefined),
        supplierUserId:
          form.supplierUserId ||
          (form.invoiceKind === "commission" ? insuredUser.id : undefined),
        invoiceDate: form.invoiceDate,
        invoiceType:
          form.invoiceKind === "cash" ? "BUYER_INVOICE" : "SUPPLIER_INVOICE",
        supplierName: form.supplierName.trim(),
        supplierAddress: normalizeLines(form.supplierAddress),
        placeOfSupply:
          form.placeOfSupply.trim() || userPlaceOfSupply(insuredUser),
        billToName: form.billToName.trim(),
        billToAddress: normalizeLines(form.billToAddress),
        shipToName: form.shipToName.trim(),
        shipToAddress: normalizeLines(form.shipToAddress),
        productName: form.productName.trim(),
        hsnCode: form.hsnCode.trim() || undefined,
        quantity: qty,
        rate,
        amount,
        vehicleNumber: normalizeVehicleText(form.vehicleNumber),
        truckNumber: normalizeVehicleText(form.vehicleNumber),
        ownerName: form.ownerName.trim() || undefined,
        insuredPartyPhone: normalizePhoneInput(form.insuredPartyPhone),
        driverPhone: normalizedDriverPhone || undefined,
        driverSecondaryPhone: normalizedDriverSecondaryPhone || undefined,
        weighmentSlipNote: form.invoiceKind === "cash" ? "cash" : "commission",
        sourceSurface: "ADMIN_QUICK_DETAILS",
        weighmentSlips,
        weighmentSlipUrls: invoiceAttachmentUrls,
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to create invoice");
      }

      toast.success("Invoice created. It will show in insurance forms.");
      router.push("/admin/insurance-forms");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create invoice",
      );
    } finally {
      submitRequestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      !detail ||
      !window.confirm(
        `Delete quick detail from ${detail.user?.name || "this user"}?`,
      )
    )
      return;
    setDeleting(true);
    const response = await adminApi.deleteAdminQuickDetail(detail.id);
    setDeleting(false);
    if (!response.success) {
      toast.error(response.message || "Failed to delete quick detail.");
      return;
    }
    toast.success("Quick detail deleted.");
    router.push("/admin/quick-details");
  };

  if (
    !authLoading &&
    (!isAuthenticated || !canAccessSection("app-quick-details"))
  ) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          You do not have access to Quick Details.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-sm font-bold text-slate-500">
        Loading quick detail
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4">
        <button
          type="button"
          onClick={() => router.push("/admin/quick-details")}
          className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error || "Quick detail not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => router.push("/admin/quick-details")}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Quick Details
            </button>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              Create invoice from quick detail
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Submitted {formatDateTime(detail.createdAt)}
            </p>
          </div>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              User sent details
            </p>
            <p className="mt-2 whitespace-pre-wrap text-base font-semibold leading-7 text-slate-950">
              {detail.details ||
                "No written note. Review the uploaded attachment."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-sm lg:min-w-[360px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div>
              <p className="text-xs font-bold text-slate-500">Customer</p>
              <p className="mt-0.5 font-bold text-slate-900">
                {detail.user?.name || "Unknown user"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Mobile</p>
              <p className="mt-0.5 font-bold text-slate-900">
                {formatPhone(detail.user?.mobileNumber)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Identity</p>
              <p className="mt-0.5 font-bold text-slate-900">
                {detail.user?.identity || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">State</p>
              <p className="mt-0.5 font-bold text-slate-900">
                {String(detail.user?.state || "-").replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Commodity</p>
              <p className="mt-0.5 font-bold text-slate-900">
                {detail.commodity || "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)]">
        <section className="order-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Invoice details
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Review and create the insurance invoice.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
              {form.invoiceKind === "cash" ? "Cash" : "Commission"}
            </span>
          </div>

          <div
            className={`mt-4 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
              autofillStatus === "error"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : autofillStatus === "done"
                  ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <div className="flex min-w-0 items-start gap-2">
              {autofillStatus === "loading" ? (
                <ArrowPathIcon className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : autofillStatus === "done" ? (
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              ) : null}
              <span className="font-semibold">
                {autofillMessage || "Autofill is prepared after submission."}
              </span>
            </div>
            {autofillStatus === "error" ? (
              <button
                type="button"
                onClick={() => void retryAutofill()}
                className="shrink-0 font-bold underline-offset-2 hover:underline"
              >
                Retry
              </button>
            ) : autofillStatus === "done" ? (
              <span className="shrink-0 text-xs font-bold uppercase tracking-wide">
                Saved
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Invoice type
              <select
                value={form.invoiceKind}
                onChange={(event) =>
                  handleInvoiceKindChange(event.target.value as InvoiceKind)
                }
                className={fieldClass}
              >
                <option value="cash">Cash</option>
                <option value="commission">Commission</option>
              </select>
            </label>
            <label className={labelClass}>
              Invoice date
              <input
                type="date"
                value={form.invoiceDate}
                onChange={(event) =>
                  updateForm({ invoiceDate: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Insured party
              <select
                value={form.insuredUserId}
                onChange={(event) => {
                  const user =
                    verifiedUsers.find(
                      (item) => item.id === event.target.value,
                    ) || null;
                  [
                    "insuredUserId",
                    "buyerUserId",
                    "supplierUserId",
                    "insuredPartyPhone",
                    "billToName",
                    "billToAddress",
                    "shipToName",
                    "shipToAddress",
                    "supplierName",
                    "supplierAddress",
                  ].forEach((field) =>
                    dirtyFieldsRef.current.add(field as keyof QuickInvoiceForm),
                  );
                  setForm((current) => applyInsuredUser(current, user));
                }}
                className={fieldClass}
              >
                <option value="">Select registered verified user</option>
                {verifiedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.mobileNumber}{" "}
                    {user.walletType === "UNPAID" ? "(Unpaid)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Driver mobile
              <input
                inputMode="numeric"
                value={form.driverPhone}
                onChange={(event) =>
                  updateForm({ driverPhone: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Alternate driver mobile
              <input
                inputMode="numeric"
                value={form.driverSecondaryPhone}
                onChange={(event) =>
                  updateForm({ driverSecondaryPhone: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Insured party phone
              <input
                value={form.insuredPartyPhone}
                onChange={(event) =>
                  updateForm({ insuredPartyPhone: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Place of supply
              <input
                value={form.placeOfSupply}
                onChange={(event) =>
                  updateForm({ placeOfSupply: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Supplier name
              <input
                value={form.supplierName}
                onChange={(event) =>
                  updateForm({
                    supplierName: event.target.value,
                    supplierUserId: "",
                  })
                }
                className={fieldClass}
              />
              {form.supplierUserId ? (
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold normal-case tracking-normal text-emerald-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Verified supplier
                  match
                </span>
              ) : null}
            </label>
            <label className={labelClass}>
              Bill to name
              <input
                value={form.billToName}
                onChange={(event) =>
                  updateForm({
                    billToName: event.target.value,
                    buyerUserId: "",
                  })
                }
                className={fieldClass}
              />
              {form.buyerUserId ? (
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold normal-case tracking-normal text-emerald-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Verified buyer
                  match
                </span>
              ) : null}
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Supplier address
              <textarea
                value={form.supplierAddress}
                onChange={(event) =>
                  updateForm({ supplierAddress: event.target.value })
                }
                rows={2}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Bill to address
              <textarea
                value={form.billToAddress}
                onChange={(event) =>
                  updateForm({ billToAddress: event.target.value })
                }
                rows={2}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Ship to address
              <textarea
                value={form.shipToAddress}
                onChange={(event) =>
                  updateForm({ shipToAddress: event.target.value })
                }
                rows={2}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Ship to name
              <input
                value={form.shipToName}
                onChange={(event) =>
                  updateForm({ shipToName: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Product
              <select
                value={form.productName}
                onChange={(event) => handleProductChange(event.target.value)}
                className={fieldClass}
              >
                <option value="">Select product</option>
                {itemsData.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
              {productAutofillSource && form.productName ? (
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold normal-case tracking-normal text-emerald-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {productAutofillSource}
                </span>
              ) : null}
            </label>
            <label className={labelClass}>
              HSN
              <input
                value={form.hsnCode}
                onChange={(event) =>
                  updateForm({ hsnCode: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Quantity
              <input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(event) =>
                  updateForm({ quantity: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Rate
              <input
                type="number"
                step="0.01"
                value={form.rate}
                onChange={(event) => updateForm({ rate: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Vehicle number
              <input
                value={form.vehicleNumber}
                onChange={(event) =>
                  updateForm({ vehicleNumber: event.target.value })
                }
                onBlur={(event) => validateVehicle(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Owner name
              <input
                value={form.ownerName}
                onChange={(event) =>
                  updateForm({ ownerName: event.target.value })
                }
                className={fieldClass}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Add another supporting file{" "}
              <span className="normal-case text-slate-400">(optional)</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(event) =>
                  setWeighmentSlips(Array.from(event.target.files || []))
                }
                className={fileFieldClass}
              />
              {invoiceAttachmentUrls.length > 0 ? (
                <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold normal-case tracking-normal text-emerald-700">
                  <CheckCircleIcon className="h-4 w-4" />
                  {invoiceAttachmentUrls.length} user upload
                  {invoiceAttachmentUrls.length === 1 ? "" : "s"} already
                  attached as weighment slip.
                </span>
              ) : null}
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Amount
              </p>
              <p className="text-lg font-black text-slate-950">
                {(
                  (Number(form.quantity) || 0) * (Number(form.rate) || 0)
                ).toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                })}
              </p>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? "Creating invoice..." : "Create invoice"}
            </button>
          </div>
        </section>

        <aside className="order-1 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <PaperClipIcon className="h-5 w-5 text-slate-500" />
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    Uploaded proof
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    {detail.media?.length || 0} attachment
                    {detail.media?.length === 1 ? "" : "s"} · submitted{" "}
                    {formatDateTime(detail.createdAt)}
                  </p>
                </div>
              </div>
              {invoiceAttachmentUrls.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Weighment slip attached
                </span>
              ) : null}
            </div>

            {activeMedia ? (
              <div className="bg-slate-100 p-3">
                <div className="relative flex h-[min(68vh,760px)] min-h-[460px] items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white">
                  {activeMedia.kind === "image" ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeMedia.url}
                        alt={activeMedia.name || "User uploaded invoice detail"}
                        className="h-full w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setShowImageModal(true)}
                        className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-white"
                      >
                        <MagnifyingGlassPlusIcon className="h-4 w-4" />
                        View larger
                      </button>
                    </>
                  ) : activeMedia.kind === "pdf" ? (
                    <iframe
                      src={activeMedia.url}
                      title={activeMedia.name || "Uploaded PDF"}
                      className="h-full w-full"
                    />
                  ) : activeMedia.kind === "audio" ? (
                    <div className="w-full max-w-md p-6 text-center">
                      <MicrophoneIcon className="mx-auto h-10 w-10 text-slate-400" />
                      <p className="mt-3 text-sm font-bold text-slate-900">
                        Voice note
                      </p>
                      {detail.audioDurationMillis ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDuration(detail.audioDurationMillis)}
                        </p>
                      ) : null}
                      <audio
                        controls
                        src={activeMedia.url}
                        className="mt-5 w-full"
                      />
                    </div>
                  ) : (
                    <a
                      href={activeMedia.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-950"
                    >
                      <DocumentTextIcon className="h-6 w-6" />
                      Open {activeMedia.name || "attachment"}
                    </a>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 px-1">
                  <p className="min-w-0 truncate text-xs font-semibold text-slate-600">
                    {activeMedia.name || "Uploaded attachment"}
                  </p>
                  <a
                    href={activeMedia.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-950"
                  >
                    Open original{" "}
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <p className="p-6 text-sm font-bold text-slate-500">
                No attachments provided.
              </p>
            )}

            {(detail.media?.length || 0) > 1 ? (
              <div className="flex gap-2 overflow-x-auto border-t border-slate-100 p-3">
                {detail.media.map((media, index) => (
                  <button
                    key={`${detail.id}-${media.url}-${index}`}
                    type="button"
                    onClick={() => setActiveMediaIndex(index)}
                    className={`h-16 w-20 shrink-0 overflow-hidden rounded-md border bg-white p-1 ${activeMediaIndex === index ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200"}`}
                    aria-label={`View attachment ${index + 1}`}
                  >
                    {media.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={media.url}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : media.kind === "audio" ? (
                      <MicrophoneIcon className="mx-auto h-full w-6 text-slate-500" />
                    ) : (
                      <DocumentTextIcon className="mx-auto h-full w-6 text-slate-500" />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      {showImageModal && activeMedia?.kind === "image" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Uploaded image preview"
        >
          <button
            type="button"
            onClick={() => setShowImageModal(false)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close image preview"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeMedia.url}
            alt={activeMedia.name || "Uploaded image"}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
