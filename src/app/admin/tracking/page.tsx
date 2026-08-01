"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { useAdmin } from "@/features/admin/context/AdminContext";
import { adminApi, InsuranceForm } from "@/features/admin/api/admin.api";
import {
  CheckConsentPayload,
  CreateTripPayload,
  DriverConsentRegistrationRow,
  RegisterDriverForVehiclePayload,
  TrackingInvoiceDraft,
  TraqoConsentRow,
  TruckTrackingResponse,
  checkDriverConsent,
  clearInvoiceDriverDraft,
  createTrackingTrip,
  getTruckTracking,
  listDriverRegistrations,
  listInvoiceDriverDrafts,
  listTrips,
  listCreatedConsents,
  lookupDriverOperator,
  registerDriverForVehicle,
  resendDriverConsentSms,
} from "@/features/admin/api/tracking.api";

function toTenDigitPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function consentApproved(consent: string | null) {
  if (!consent) return false;
  const value = consent.toLowerCase();
  return (
    value.includes("allow") ||
    value.includes("approve") ||
    value.includes("granted") ||
    value.includes("accepted") ||
    value === "true" ||
    value === "yes"
  );
}

function pickString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function joinAddressParts(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return String(value || "").trim();
}

function toInvoiceDraft(form: InsuranceForm): TrackingInvoiceDraft | null {
  const primaryDriverPhone = toTenDigitPhone(form.driverPhone || "");
  const secondaryDriverPhone = toTenDigitPhone(form.driverSecondaryPhone || "");
  const driverPhone = primaryDriverPhone || secondaryDriverPhone;
  if (driverPhone.length !== 10) return null;

  return {
    id: form.id || form._id,
    invoiceNumber: form.invoiceNumber || "",
    supplierName: form.supplierName || null,
    driverPhone,
    driverSecondaryPhone: primaryDriverPhone
      ? secondaryDriverPhone || null
      : null,
    driverOperator: form.driverConsentOperator || null,
    vehicleNumber: form.truckNumber || form.vehicleNumber || null,
    sourceName: joinAddressParts(form.supplierAddress),
    destinationName:
      joinAddressParts(form.shipToAddress) ||
      joinAddressParts(form.billToAddress),
    consentStatus: form.driverConsentStatus || null,
    createdAt: form.createdAt || form.invoiceDate || form.date,
  };
}

async function geocodeWithGoogle(address: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const query = address.trim();

  if (!apiKey || !query) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      query,
    )}&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };

    if (payload.status !== "OK" || !payload.results?.length) return null;
    const location = payload.results[0]?.geometry?.location;
    if (
      typeof location?.lat !== "number" ||
      typeof location?.lng !== "number"
    ) {
      return null;
    }

    return `${location.lat},${location.lng}`;
  } catch {
    return null;
  }
}

export default function AdminTrackingPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAdmin();

  const [registerForm, setRegisterForm] =
    useState<RegisterDriverForVehiclePayload>({
      phone_number: "",
      vehicle_number: "",
      name: "",
      operator: "",
    });
  const [operatorLookupHint, setOperatorLookupHint] = useState("");
  const [operatorLookupLoading, setOperatorLookupLoading] = useState(false);
  const [registrations, setRegistrations] = useState<
    DriverConsentRegistrationRow[]
  >([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [consentForm, setConsentForm] = useState<CheckConsentPayload>({
    tel: "",
  });
  const [tripForm, setTripForm] = useState<CreateTripPayload>({
    tel: "",
    truck_number: "",
    srcname: "",
    destname: "",
    src: "",
    dest: "",
    invoice: "",
    eta_hrs: undefined,
    internalTruckId: "",
    internalInvoiceId: "",
  });
  const [trackVehicle, setTrackVehicle] = useState("");

  const [consentState, setConsentState] = useState<string | null>(null);
  const [trackingData, setTrackingData] =
    useState<TruckTrackingResponse | null>(null);
  const [consentsModalOpen, setConsentsModalOpen] = useState(false);
  const [consents, setConsents] = useState<TraqoConsentRow[]>([]);
  const [consentsLoading, setConsentsLoading] = useState(false);
  const [consentsError, setConsentsError] = useState("");
  const [invoiceDrafts, setInvoiceDrafts] = useState<TrackingInvoiceDraft[]>(
    [],
  );
  const [selectedInvoiceDraftId, setSelectedInvoiceDraftId] = useState("");
  const [invoiceDraftsLoading, setInvoiceDraftsLoading] = useState(false);
  const [invoiceDraftsError, setInvoiceDraftsError] = useState("");
  const [clearingInvoiceDraftId, setClearingInvoiceDraftId] = useState("");

  const [busy, setBusy] = useState({
    register: false,
    checkConsent: false,
    resendConsent: false,
    createTrip: false,
    refreshTracking: false,
    geocode: false,
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const inputClass =
    "rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-slate-300";

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [loading, isAuthenticated, router]);

  const isConsentOk = useMemo(
    () => consentApproved(consentState),
    [consentState],
  );

  const setBusyFlag = useCallback((key: keyof typeof busy, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyInvoiceDraft = useCallback((draft: TrackingInvoiceDraft) => {
    const phone = draft.driverPhone;

    setSelectedInvoiceDraftId(draft.id);
    setRegisterForm({
      phone_number: phone,
      vehicle_number: draft.vehicleNumber?.trim() || "",
      name: undefined,
      operator: draft.driverOperator || "",
    });
    setConsentForm({ tel: phone });
    setConsentState(draft.consentStatus || null);
    setTripForm((prev) => ({
      ...prev,
      tel: phone,
      truck_number: draft.vehicleNumber || "",
      srcname: draft.sourceName || "",
      destname: draft.destinationName || "",
      invoice: draft.invoiceNumber,
      internalInvoiceId: draft.id,
    }));
    if (draft.vehicleNumber) setTrackVehicle(draft.vehicleNumber);
  }, []);

  const refreshInvoiceDrafts = useCallback(
    async (shouldAutoApply = false) => {
      setInvoiceDraftsLoading(true);
      setInvoiceDraftsError("");

      const response = await listInvoiceDriverDrafts(20);
      if (!response.success) {
        const [formsResponse, tripsResponse] = await Promise.all([
          adminApi.getInsuranceForms(1, 50),
          listTrips(),
        ]);
        if (!formsResponse.success) {
          setInvoiceDrafts([]);
          setInvoiceDraftsError(
            response.message || "Failed to fetch invoice driver details.",
          );
          setInvoiceDraftsLoading(false);
          return;
        }

        const tripInvoiceIds = new Set(
          (tripsResponse.data || [])
            .map((trip) => trip.invoice?.id)
            .filter((id): id is string => Boolean(id)),
        );
        const fallbackDrafts = (formsResponse.data?.forms || [])
          .filter((form) => !tripInvoiceIds.has(form.id || form._id))
          .map(toInvoiceDraft)
          .filter((draft): draft is TrackingInvoiceDraft => Boolean(draft));

        setInvoiceDrafts(fallbackDrafts);
        setInvoiceDraftsLoading(false);

        if (shouldAutoApply && fallbackDrafts[0]) {
          applyInvoiceDraft(fallbackDrafts[0]);
        }
        if (fallbackDrafts.length === 0) {
          setInvoiceDraftsError("");
        }
        return;
      }

      const drafts = (response.data || []).sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      setInvoiceDrafts(drafts);
      setInvoiceDraftsLoading(false);

      if (shouldAutoApply && drafts[0]) {
        applyInvoiceDraft(drafts[0]);
      }
    },
    [applyInvoiceDraft],
  );

  const handleClearInvoiceDraft = async (
    event: { stopPropagation: () => void },
    draft: TrackingInvoiceDraft,
  ) => {
    event.stopPropagation();

    const confirmed = window.confirm(
      `Remove driver tracking details for ${draft.invoiceNumber}? This keeps the invoice, but removes it from this tracking draft list.`,
    );
    if (!confirmed) return;

    setClearingInvoiceDraftId(draft.id);
    const response = await clearInvoiceDriverDraft(draft.id);
    if (!response.success) {
      toast.error(response.message || "Failed to remove invoice driver details.");
    } else {
      toast.success("Invoice driver details removed.");
      setInvoiceDrafts((prev) => prev.filter((item) => item.id !== draft.id));
      if (selectedInvoiceDraftId === draft.id) {
        setSelectedInvoiceDraftId("");
        setRegisterForm({
          phone_number: "",
          vehicle_number: "",
          name: "",
          operator: "",
        });
        setConsentForm({ tel: "" });
        setConsentState(null);
        setTripForm((prev) => ({
          ...prev,
          tel: "",
          truck_number: "",
          srcname: "",
          destname: "",
          invoice: "",
          internalInvoiceId: "",
        }));
      }
    }
    setClearingInvoiceDraftId("");
  };

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    void refreshInvoiceDrafts(true);
  }, [loading, isAuthenticated, refreshInvoiceDrafts]);

  const refreshTracking = useCallback(async () => {
    if (!trackVehicle.trim()) return;
    setBusyFlag("refreshTracking", true);

    const response = await getTruckTracking(trackVehicle.trim().toUpperCase());
    if (!response.success) {
      setTrackingData(null);
    } else {
      setTrackingData(response.data || null);
    }

    setBusyFlag("refreshTracking", false);
  }, [trackVehicle, setBusyFlag]);

  useEffect(() => {
    if (!autoRefresh || !trackVehicle.trim()) return;
    const timer = setInterval(() => {
      void refreshTracking();
    }, 20000);
    return () => clearInterval(timer);
  }, [autoRefresh, trackVehicle, refreshTracking]);

  const refreshRegistrations = useCallback(async () => {
    setRegistrationsLoading(true);
    const response = await listDriverRegistrations();
    if (response.success) {
      setRegistrations(response.data || []);
    }
    setRegistrationsLoading(false);
  }, []);

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    void refreshRegistrations();
    const timer = setInterval(() => {
      void refreshRegistrations();
    }, 15000);
    return () => clearInterval(timer);
  }, [loading, isAuthenticated, refreshRegistrations]);

  useEffect(() => {
    const phone = toTenDigitPhone(registerForm.phone_number || "");
    if (phone.length !== 10) {
      setOperatorLookupHint("");
      setOperatorLookupLoading(false);
      return;
    }

    let cancelled = false;
    setOperatorLookupLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        const response = await lookupDriverOperator(phone);
        if (cancelled) return;
        setOperatorLookupLoading(false);
        if (!response.success || !response.data) {
          setOperatorLookupHint("");
          return;
        }
        if (response.data.operator) {
          setRegisterForm((prev) => ({
            ...prev,
            operator: response.data!.operator || prev.operator,
          }));
          setOperatorLookupHint(
            `Detected from Traqo: ${response.data.operator}${
              response.data.consentStatus
                ? ` · consent ${response.data.consentStatus}`
                : ""
            }`,
          );
        } else {
          setOperatorLookupHint(
            response.data.message ||
              "Operator will be detected after registration.",
          );
        }
      })();
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [registerForm.phone_number]);

  const handleRegisterDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyFlag("register", true);

    const phone = toTenDigitPhone(registerForm.phone_number);
    if (phone.length !== 10) {
      toast.error("Driver phone number must be 10 digits.");
      setBusyFlag("register", false);
      return;
    }

    const vehicleNumber = registerForm.vehicle_number?.trim().toUpperCase();
    if (!vehicleNumber) {
      toast.error("Vehicle number (or last 4 digits) is required.");
      setBusyFlag("register", false);
      return;
    }

    const response = await registerDriverForVehicle({
      phone_number: phone,
      vehicle_number: vehicleNumber,
      name: registerForm.name?.trim() || undefined,
      operator: registerForm.operator?.trim() || undefined,
    });
    if (!response.success) {
      toast.error(response.message || "Failed to register driver number.");
    } else {
      const resolution = (
        response.data as
          | {
              vehicleResolution?: {
                resolvedVehicleNumber?: string;
                matchedBy?: string;
                invoiceNumber?: string | null;
              };
              message?: string;
            }
          | undefined
      )?.vehicleResolution;
      const resolvedVehicle =
        resolution?.resolvedVehicleNumber || vehicleNumber;
      const matchNote =
        resolution?.matchedBy === "last4"
          ? ` Matched ${resolvedVehicle}${
              resolution.invoiceNumber ? ` → ${resolution.invoiceNumber}` : ""
            }.`
          : "";
      toast.success(
        (response.data as { message?: string } | undefined)?.message ||
          `Driver registered. Consent SMS sent — you'll get a WhatsApp once the driver approves and the trip is auto-created.${matchNote}`,
      );
      setConsentForm({ tel: phone });
      setTripForm((prev) => ({
        ...prev,
        tel: phone,
        truck_number: resolvedVehicle,
      }));
      setRegisterForm((prev) => ({
        ...prev,
        vehicle_number: resolvedVehicle,
      }));
      void refreshRegistrations();
    }

    setBusyFlag("register", false);
  };

  const handleCheckConsent = async () => {
    setBusyFlag("checkConsent", true);

    const tel = toTenDigitPhone(consentForm.tel);
    if (tel.length !== 10) {
      toast.error("Consent check requires a valid 10-digit driver number.");
      setBusyFlag("checkConsent", false);
      return;
    }

    const response = await checkDriverConsent({ tel });
    if (!response.success) {
      toast.error(response.message || "Failed to check consent.");
      setConsentState(null);
    } else {
      const raw = (response.data || {}) as Record<string, unknown>;
      const status = pickString(raw, [
        "consent",
        "status",
        "consentStatus",
        "consent_status",
      ]);
      setConsentState(status || "");
      toast.success(`Consent status: ${status || "Unknown"}`);
      setTripForm((prev) => ({ ...prev, tel }));
    }

    setBusyFlag("checkConsent", false);
  };

  const handleResendConsent = async () => {
    setBusyFlag("resendConsent", true);

    const phone = toTenDigitPhone(consentForm.tel);
    if (phone.length !== 10) {
      toast.error("Resend requires a valid 10-digit driver number.");
      setBusyFlag("resendConsent", false);
      return;
    }

    const response = await resendDriverConsentSms(phone);
    if (!response.success) {
      toast.error(response.message || "Failed to resend consent SMS.");
    } else {
      toast.success("Consent SMS resent successfully.");
    }

    setBusyFlag("resendConsent", false);
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyFlag("createTrip", true);

    const payload: CreateTripPayload = {
      ...tripForm,
      tel: toTenDigitPhone(tripForm.tel || ""),
      truck_number: tripForm.truck_number.trim().toUpperCase(),
      src: tripForm.src?.trim() || undefined,
      dest: tripForm.dest?.trim() || undefined,
      srcname: tripForm.srcname?.trim() || undefined,
      destname: tripForm.destname?.trim() || undefined,
      invoice: tripForm.invoice?.trim() || undefined,
      internalTruckId: tripForm.internalTruckId?.trim() || undefined,
      internalInvoiceId: tripForm.internalInvoiceId?.trim() || undefined,
      eta_hrs: tripForm.eta_hrs || undefined,
    };

    if (!payload.tel || payload.tel.length !== 10) {
      toast.error("Trip creation requires a valid 10-digit driver number.");
      setBusyFlag("createTrip", false);
      return;
    }
    if (!payload.truck_number) {
      toast.error("Truck number is required.");
      setBusyFlag("createTrip", false);
      return;
    }

    // Auto resolve coordinates using Google Geocoding API when names are present.
    if (
      (!payload.src && payload.srcname) ||
      (!payload.dest && payload.destname)
    ) {
      setBusyFlag("geocode", true);
      const [resolvedSrc, resolvedDest] = await Promise.all([
        !payload.src && payload.srcname
          ? geocodeWithGoogle(payload.srcname)
          : Promise.resolve(payload.src || null),
        !payload.dest && payload.destname
          ? geocodeWithGoogle(payload.destname)
          : Promise.resolve(payload.dest || null),
      ]);
      setBusyFlag("geocode", false);

      if (!payload.src && resolvedSrc) {
        payload.src = resolvedSrc;
        setTripForm((prev) => ({ ...prev, src: resolvedSrc }));
      }

      if (!payload.dest && resolvedDest) {
        payload.dest = resolvedDest;
        setTripForm((prev) => ({ ...prev, dest: resolvedDest }));
      }
    }

    if (!payload.src && !payload.srcname) {
      toast.error("Source Name is required to resolve source coordinates.");
      setBusyFlag("createTrip", false);
      return;
    }
    if (!payload.dest && !payload.destname) {
      toast.error(
        "Destination Name is required to resolve destination coordinates.",
      );
      setBusyFlag("createTrip", false);
      return;
    }

    // Always verify latest consent during trip creation attempt.
    const consentResponse = await checkDriverConsent({ tel: payload.tel });
    if (!consentResponse.success) {
      toast.error(
        consentResponse.message ||
          "Unable to verify consent. Trip creation stopped.",
      );
      setBusyFlag("createTrip", false);
      return;
    }

    const consentRawResponse = (consentResponse.data || {}) as Record<
      string,
      unknown
    >;
    const latestConsent = pickString(consentRawResponse, [
      "consent",
      "status",
      "consentStatus",
      "consent_status",
    ]);
    setConsentState(latestConsent || "");

    if (!consentApproved(latestConsent || null)) {
      toast.error(
        `Consent is not approved for ${payload.tel}. Current status: ${
          latestConsent || "UNKNOWN"
        }.`,
      );
      setBusyFlag("createTrip", false);
      return;
    }

    const response = await createTrackingTrip(payload);
    if (!response.success) {
      toast.error(response.message || "Failed to create trip.");
    } else {
      toast.success("Trip created successfully.");
      setTrackVehicle(payload.truck_number);
      setInvoiceDrafts((prev) =>
        prev.filter((draft) => draft.id !== payload.internalInvoiceId),
      );
      if (payload.internalInvoiceId === selectedInvoiceDraftId) {
        setSelectedInvoiceDraftId("");
      }
    }

    setBusyFlag("createTrip", false);
  };

  const handleOpenConsents = async () => {
    setConsentsModalOpen(true);
    setConsentsLoading(true);
    setConsentsError("");

    const response = await listCreatedConsents();
    if (!response.success) {
      setConsents([]);
      setConsentsError(response.message || "Failed to fetch created consents.");
    } else {
      setConsents(response.data || []);
    }

    setConsentsLoading(false);
  };

  const handleTrackConsentVehicle = async (consent: TraqoConsentRow) => {
    const vehicleNumber = consent.name?.trim();
    if (!vehicleNumber) {
      toast.error("Vehicle number is not available for this consent.");
      return;
    }

    setTrackVehicle(vehicleNumber);
    setConsentsModalOpen(false);
    setTrackingData(null);
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="py-8">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#4309ac] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      {consentsModalOpen && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConsentsModalOpen(false)}
          />
          <div className="relative max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Created Consents
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Live list fetched from Traqo number list, including operator
                  details.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleOpenConsents()}
                  disabled={consentsLoading}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  {consentsLoading ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => setConsentsModalOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[calc(85vh-80px)] overflow-auto p-5">
              {consentsLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Loading created consents...
                </div>
              ) : consentsError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {consentsError}
                </div>
              ) : consents.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No consents found from Traqo.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          Phone
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          Operator
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          Updated
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          Location
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          Last 24h
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          Track
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {consents.map((consent) => (
                        <tr
                          key={`${consent.phone_number}-${consent.update_at || ""}`}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {consent.phone_number}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {consent.name || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {consent.operator || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                consentApproved(consent.status)
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {consent.status || "Unknown"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {consent.update_at || "-"}
                          </td>
                          <td className="max-w-sm px-4 py-3 text-slate-700">
                            {consent.location || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {consent.last_24h || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                void handleTrackConsentVehicle(consent)
                              }
                              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Track
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Tracking Setup
            </h1>
            <p className="text-sm text-gray-600">
              Admin flow: register driver number, confirm consent, then create
              trip for vehicle tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleOpenConsents()}
            className="rounded-md border border-[#4309ac]/20 bg-[#4309ac]/10 px-4 py-2 text-sm font-semibold text-[#4309ac]"
          >
            Consents Created
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Invoice Driver Details
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Latest insurance invoice is applied automatically. Source is
              supplier address, destination is buyer address.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshInvoiceDrafts(true)}
            disabled={invoiceDraftsLoading}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {invoiceDraftsLoading ? "Refreshing..." : "Refresh invoices"}
          </button>
        </div>

        {invoiceDraftsError ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {invoiceDraftsError}
          </div>
        ) : invoiceDrafts.length === 0 ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
            {invoiceDraftsLoading
              ? "Loading invoice driver details..."
              : "No recent invoice with driver number found."}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {invoiceDrafts.slice(0, 6).map((draft) => {
              const selected = selectedInvoiceDraftId === draft.id;
              return (
                <div
                  key={draft.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => applyInvoiceDraft(draft)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      applyInvoiceDraft(draft);
                    }
                  }}
                  className={`cursor-pointer rounded-lg border p-3 text-left transition ${
                    selected
                      ? "border-[#4309ac] bg-[#4309ac]/5 shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {draft.invoiceNumber || "Invoice"}
                    </span>
                    <div className="flex items-center gap-2">
                      {selected ? (
                        <span className="rounded-full bg-[#4309ac] px-2 py-0.5 text-[11px] font-semibold text-white">
                          Applied
                        </span>
                      ) : null}
                      <button
                        type="button"
                        title="Remove driver details"
                        aria-label={`Remove driver details for ${draft.invoiceNumber}`}
                        onClick={(event) =>
                          void handleClearInvoiceDraft(event, draft)
                        }
                        disabled={clearingInvoiceDraftId === draft.id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {clearingInvoiceDraftId === draft.id ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <div className="line-clamp-1">
                      Supplier:{" "}
                      <span className="font-medium text-slate-800">
                        {draft.supplierName || "-"}
                      </span>
                    </div>
                    <div>
                      Driver:{" "}
                      <span className="font-semibold text-slate-900">
                        {draft.driverPhone}
                      </span>
                    </div>
                    <div>Provider: {draft.driverOperator || "-"}</div>
                    {draft.driverSecondaryPhone ? (
                      <div>
                        Alt: {draft.driverSecondaryPhone}
                        {draft.driverSecondaryOperator
                          ? ` (${draft.driverSecondaryOperator})`
                          : ""}
                      </div>
                    ) : null}
                    <div>Truck: {draft.vehicleNumber || "-"}</div>
                    <div className="line-clamp-1">
                      Source: {draft.sourceName || "-"}
                    </div>
                    <div className="line-clamp-1">
                      Destination: {draft.destinationName || "-"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <form
          onSubmit={handleRegisterDriver}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-gray-900">
            1. Driver Registration
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Adds driver number + vehicle (full plate or last 4 digits), sends
            consent SMS. Last 4 digits are matched to the latest untracked
            invoice. Once the driver approves, you&apos;ll get a WhatsApp and
            the trip auto-creates — no need to come back here.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <input
              className={inputClass}
              placeholder="Driver Phone (10 digit)"
              value={registerForm.phone_number}
              onChange={(e) =>
                setRegisterForm((prev) => ({
                  ...prev,
                  phone_number: e.target.value,
                }))
              }
            />
            <input
              className={inputClass}
              placeholder="Vehicle number or last 4 digits (e.g. 4521)"
              value={registerForm.vehicle_number}
              onChange={(e) =>
                setRegisterForm((prev) => ({
                  ...prev,
                  vehicle_number: e.target.value,
                }))
              }
            />
            <input
              className={inputClass}
              placeholder="Driver Name (optional)"
              value={registerForm.name || ""}
              onChange={(e) =>
                setRegisterForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <input
              className={inputClass}
              placeholder="Operator (auto-filled from Traqo when known)"
              value={registerForm.operator || ""}
              onChange={(e) =>
                setRegisterForm((prev) => ({
                  ...prev,
                  operator: e.target.value,
                }))
              }
            />
            {operatorLookupLoading ? (
              <p className="text-xs text-gray-500">Looking up operator…</p>
            ) : operatorLookupHint ? (
              <p className="text-xs text-gray-500">{operatorLookupHint}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={busy.register}
            className="mt-4 rounded-md bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy.register ? "Registering..." : "Register Driver"}
          </button>
        </form>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            2. Consent Check
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Consent must be approved before trip creation.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <input
              className={inputClass}
              placeholder="Driver Phone (10 digit)"
              value={consentForm.tel}
              onChange={(e) => setConsentForm({ tel: e.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCheckConsent}
                disabled={busy.checkConsent}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy.checkConsent ? "Checking..." : "Check Consent"}
              </button>
              <button
                type="button"
                onClick={handleResendConsent}
                disabled={busy.resendConsent}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
              >
                {busy.resendConsent ? "Resending..." : "Resend SMS"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Current Consent Status</div>
            <div
              className={`mt-1 inline-flex rounded px-2 py-1 text-xs font-semibold ${
                isConsentOk
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {consentState || "Not checked"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Consent Activity
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Live status of driver/vehicle registrations. Admin also gets a
              WhatsApp when consent is approved and when the trip
              auto-creates — this panel is just a backup view.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshRegistrations()}
            disabled={registrationsLoading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-60"
          >
            {registrationsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {registrations.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No driver registrations yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                  <th className="py-2 pr-4">Driver</th>
                  <th className="py-2 pr-4">Vehicle</th>
                  <th className="py-2 pr-4">Consent</th>
                  <th className="py-2 pr-4">Invoice</th>
                  <th className="py-2 pr-4">Trip</th>
                  <th className="py-2 pr-4">Updated</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => {
                  const consentBadge =
                    reg.consentState === "ALLOWED"
                      ? "bg-emerald-100 text-emerald-700"
                      : reg.consentState === "DENIED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700";
                  const tripLabel = reg.autoTrip
                    ? `Auto-created (${reg.autoTrip.status})`
                    : reg.consentState === "ALLOWED"
                      ? reg.giveUpNotifiedAt
                        ? "No invoice found — create manually"
                        : reg.autoTripError
                          ? "Retrying (last error logged)"
                          : "Waiting for invoice..."
                      : "—";
                  return (
                    <tr key={reg.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-800">
                        {reg.phoneNumber}
                        {reg.driverName ? ` (${reg.driverName})` : ""}
                      </td>
                      <td className="py-2 pr-4 text-gray-800">
                        {reg.vehicleNumber}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${consentBadge}`}
                        >
                          {reg.consentState}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {reg.invoice?.invoiceNumber || "—"}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{tripLabel}</td>
                      <td className="py-2 pr-4 text-gray-400">
                        {new Date(reg.updatedAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form
        onSubmit={handleCreateTrip}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              3. Create Trip
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Admin can submit directly. Consent is validated automatically at
              create time. If coords are blank, backend resolves from source and
              destination names.
            </p>
          </div>
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${
              isConsentOk
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {isConsentOk ? "Consent Approved" : "Consent Required"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            className={inputClass}
            placeholder="Driver Phone"
            value={tripForm.tel}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, tel: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Truck Number (required)"
            value={tripForm.truck_number}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, truck_number: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Source Name "
            value={tripForm.srcname || ""}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, srcname: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Destination Name "
            value={tripForm.destname || ""}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, destname: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Invoice Ref (optional)"
            value={tripForm.invoice || ""}
            onChange={(e) =>
              setTripForm((prev) => ({ ...prev, invoice: e.target.value }))
            }
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy.createTrip || busy.geocode}
            className="rounded-md bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy.geocode
              ? "Fetching Coords..."
              : busy.createTrip
                ? "Creating Trip..."
                : "Create Trip"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Live Tracking
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Fetches current tracking state for a vehicle.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto refresh (20s)
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className={`${inputClass} w-full max-w-md`}
            placeholder="Vehicle Number"
            value={trackVehicle}
            onChange={(e) => setTrackVehicle(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void refreshTracking()}
            disabled={busy.refreshTracking}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy.refreshTracking ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {trackingData ? (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">Vehicle</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.vehicleNumber}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.status}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Trip ID</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.tripId || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Trip Status</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.tripStatus || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Consent Status</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.consentStatus || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ETA</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.eta || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Latitude</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.lat ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Longitude</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.lng ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Last Recorded</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.timeRecorded || "-"}
              </div>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <div className="text-xs text-gray-500">Address</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.address || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Distance Remaining</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.distanceRemained || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Time Remaining</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.location?.timeRemained || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Message</div>
              <div className="text-sm font-semibold text-gray-900">
                {trackingData.message || "-"}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
