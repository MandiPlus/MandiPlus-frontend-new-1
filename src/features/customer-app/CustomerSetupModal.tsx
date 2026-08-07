"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  RefreshCw,
  ShoppingCart,
  Store,
  Truck,
} from "lucide-react";

import { useAuth } from "@/features/auth/context/AuthContext";
import {
  getCachedStates,
  useReferenceCommodities,
  useReferenceStates,
} from "@/features/reference";
import {
  nextMandiForStateChange,
  reconcileStateAndMandi,
  statesForCommodities,
} from "@/features/reference/commodityGeography";
import { updateCustomerUser } from "./api";
import { readableError } from "./utils";
import styles from "./customer-app.module.css";

const languages = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["kn", "ಕನ್ನಡ"],
  ["mr", "मराठी"],
  ["ta", "தமிழ்"],
  ["te", "తెలుగు"],
] as const;

const roles = [
  ["SUPPLIER", "Loading vala", Store],
  ["BUYER", "Unloading vala", ShoppingCart],
  ["TRANSPORTER", "Transporter", Truck],
] as const;

const STEP_COUNT = 5;

type OnboardingInfo = {
  nextStep?: number | null;
  missingFields?: string[];
  complete?: boolean;
  commodityCodes?: string[];
};

export function CustomerSetupModal() {
  const { user, setUser } = useAuth();
  const states = useReferenceStates();
  const commodities = useReferenceCommodities();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState("en");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selectedCommodities, setSelectedCommodities] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [mandiName, setMandiName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const profile = useMemo(() => readProfile(user, commodities), [user, commodities]);

  const visibleStates = useMemo(
    () => statesForCommodities(selectedCommodities, states),
    [selectedCommodities, states],
  );

  useEffect(() => {
    if (!user?.id) return;

    setLanguage(profile.language || "en");
    setName(profile.name);
    setRole(profile.role);
    setSelectedCommodities(profile.commodityCodes);
    setState(profile.state);
    setMandiName(profile.mandiName);

    const onboarding = (user as { onboarding?: OnboardingInfo })?.onboarding;
    if (onboarding?.complete || profile.complete) {
      localStorage.removeItem(progressKey(user.id));
      setVisible(false);
      return;
    }

    const savedStep = Number(localStorage.getItem(progressKey(user.id)));
    const resumable =
      Number.isInteger(savedStep) && savedStep >= 0 && savedStep < STEP_COUNT;
    const serverStep =
      onboarding?.nextStep === null ||
      onboarding?.nextStep === 0 ||
      onboarding?.nextStep === 1 ||
      onboarding?.nextStep === 2 ||
      onboarding?.nextStep === 3 ||
      onboarding?.nextStep === 4
        ? onboarding.nextStep
        : null;
    setStep(
      resumable
        ? savedStep
        : serverStep !== null && serverStep !== undefined
          ? serverStep
          : firstIncompleteStep(profile),
    );
    setVisible(true);
    setError("");
  }, [profile, user]);

  useEffect(() => {
    if (!visible || step !== 4) return;
    const reconciled = reconcileStateAndMandi({
      commodityCodes: selectedCommodities,
      allStates: states,
      state,
      mandiName,
    });
    if (reconciled.state !== state) setState(reconciled.state);
    if (reconciled.mandiName !== mandiName) setMandiName(reconciled.mandiName);
    // Only re-run when commodities / catalog / step change — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [selectedCommodities, states, step, visible]);

  if (!visible || !user?.id) return null;

  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateCustomerUser(String(user.id), payload);
      const next = { ...user, ...payload, ...updated };
      setUser(next);
      localStorage.setItem("user", JSON.stringify(next));
      return true;
    } catch (nextError) {
      setError(readableError(nextError, "Details save nahi ho paaye."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const advance = (nextStep: number) => {
    localStorage.setItem(progressKey(user.id), String(nextStep));
    setStep(nextStep);
  };

  const saveLanguage = async (code: string) => {
    setLanguage(code);
    if (await save({ preferredLanguage: code })) advance(1);
  };

  const saveName = async () => {
    const cleaned = name.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      setError("Enter your name");
      return;
    }
    if (await save({ name: cleaned })) advance(2);
  };

  const saveRole = async (nextRole: string) => {
    setRole(nextRole);
    if (await save({ identity: nextRole })) advance(4);
  };

  const saveCommodities = async () => {
    if (!selectedCommodities.length) {
      setError("Choose at least one commodity");
      return;
    }
    const selected = commodities.filter((item) =>
      selectedCommodities.includes(item.code),
    );
    const labels = selected.map((item) => item.label);
    const primary = selected[0]?.code || "OTHER";
    const anarSelected = selectedCommodities.includes("POMEGRANATE");
    const payload: Record<string, unknown> = {
      commodityCodes: selectedCommodities,
      primaryCommodityCode: primary,
      products: labels,
    };
    // Anar traders are always suppliers — skip role confusion and party swaps.
    if (anarSelected) {
      payload.identity = "SUPPLIER";
    }
    if (await save(payload)) {
      if (anarSelected) setRole("SUPPLIER");
      advance(anarSelected ? 4 : 3);
    }
  };

  const saveMandi = async () => {
    const cleanMandiName = mandiName.replace(/\s+/g, " ").trim();
    if (!state) {
      setError("Select state");
      return;
    }
    if (!cleanMandiName) {
      setError("Enter mandi name");
      return;
    }
    if (
      await save({
        state,
        mandiName: cleanMandiName,
      })
    ) {
      localStorage.removeItem(progressKey(user.id));
      setVisible(false);
    }
  };

  return (
    <div
      className={styles.setupBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Complete account setup"
    >
      <section className={styles.setupSheet}>
        <div
          className={styles.setupProgress}
          aria-label={`Step ${step + 1} of ${STEP_COUNT}`}
        >
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span
              key={index}
              className={index <= step ? styles.setupProgressActive : ""}
            />
          ))}
        </div>

        <h2 className={styles.setupTitle}>{stepTitle(step)}</h2>
        {error ? <div className={styles.notice}>{error}</div> : null}

        {step === 0 ? (
          <div className={styles.setupTwoColumnGrid}>
            {languages.map(([code, label]) => {
              const active = language === code;
              return (
                <button
                  key={code}
                  type="button"
                  disabled={saving}
                  onClick={() => void saveLanguage(code)}
                  className={`${styles.setupChoiceCard} ${
                    active ? styles.setupChoiceActive : ""
                  }`}
                >
                  <span>{label}</span>
                  {active ? <Check size={18} /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 1 ? (
          <div className={styles.setupForm}>
            <label className={styles.field}>
              <span>Apna naam</span>
              <input
                autoFocus
                autoComplete="name"
                value={name}
                placeholder="Apna naam likhein"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <SetupContinue saving={saving} onClick={saveName} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className={styles.setupForm}>
            <div className={styles.setupCommodityGrid}>
              {commodities.map((item) => {
                const active = selectedCommodities.includes(item.code);
                return (
                  <button
                    key={item.code}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setError("");
                      setSelectedCommodities((current) =>
                        current.includes(item.code)
                          ? current.filter((code) => code !== item.code)
                          : [...current, item.code],
                      );
                    }}
                    className={`${styles.setupCommodityCard} ${
                      active ? styles.setupChoiceActive : ""
                    }`}
                  >
                    {item.code === "POMEGRANATE" ? (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 32 32"
                        aria-hidden
                      >
                        <path
                          d="M11.5 7.2c1.2-.9 2.6-1.4 4.5-1.4 1.9 0 3.3.5 4.5 1.4 2.1 1.5 3.4 4 3.4 7.1 0 5.4-3.4 10.2-7.9 10.2s-7.9-4.8-7.9-10.2c0-3.1 1.3-5.6 3.4-7.1z"
                          fill="#C0392B"
                        />
                        <circle cx="13.2" cy="15.5" r="1.15" fill="#F5D0C8" />
                        <circle cx="16.4" cy="17.8" r="1.05" fill="#F5D0C8" />
                        <circle cx="18.8" cy="14.6" r="0.95" fill="#F5D0C8" />
                      </svg>
                    ) : (
                      <span>{item.emoji}</span>
                    )}
                    <strong>{item.label}</strong>
                    {active ? <Check size={16} /> : null}
                  </button>
                );
              })}
            </div>
            <SetupContinue saving={saving} onClick={saveCommodities} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className={styles.setupStack}>
            {roles.map(([value, label, Icon]) => {
              const active = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={saving}
                  onClick={() => void saveRole(value)}
                  className={`${styles.setupRowCard} ${
                    active ? styles.setupRowActive : ""
                  }`}
                >
                  <span className={styles.setupRowIcon}>
                    <Icon size={22} />
                  </span>
                  <strong>{label}</strong>
                  {active ? <Check size={20} /> : <ChevronRight size={18} />}
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 4 ? (
          <div className={styles.setupForm}>
            <label className={styles.field}>
              <span>Select State</span>
              <select
                value={state}
                onChange={(event) => {
                  const nextState = event.target.value;
                  setState(nextState);
                  setMandiName((current) =>
                    nextMandiForStateChange(current, nextState),
                  );
                }}
              >
                <option value="">Select State</option>
                {visibleStates.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Mandi name</span>
              <input
                value={mandiName}
                placeholder="Mandi ka naam likhein"
                onChange={(event) => setMandiName(event.target.value)}
              />
              <small>Suggested mandi — aap badal sakte ho</small>
            </label>
            <SetupContinue
              saving={saving}
              label="Complete setup"
              onClick={saveMandi}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SetupContinue({
  saving,
  onClick,
  label = "Next",
}: {
  saving: boolean;
  onClick: () => void | Promise<void>;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={styles.wideButton}
      disabled={saving}
      onClick={() => void onClick()}
    >
      {saving ? <RefreshCw size={18} className="animate-spin" /> : null}
      {label}
    </button>
  );
}

function stepTitle(step: number) {
  if (step === 0) return "Language chunein";
  if (step === 1) return "Apna naam";
  if (step === 2) return "Which commodities do you trade?";
  if (step === 3) return "I'm a ...";
  return "Aapki mandi kahan hai?";
}

function progressKey(userId: string) {
  // v2: commodity comes before role; anar skips role.
  return `mandiplus:web-onboarding-step-v2:${userId}`;
}

function readProfile(
  user: Record<string, unknown> | null | undefined,
  commodities: Array<{ code: string; label: string }>,
) {
  const rawName = String(user?.name || "").trim();
  const name = isTemporaryName(rawName) ? "" : rawName;
  const rawRole = String(user?.identity || "").toUpperCase();
  const role = [...roles.map(([value]) => value), "CUSTOMER"].includes(rawRole)
    ? rawRole
    : "";
  const products = Array.isArray(user?.products)
    ? user.products.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const productCommodityCodes = products
    .map((product) => {
      const normalized = normalize(product);
      const fromCatalog = commodities.find(
        (item) => normalize(item.label) === normalized,
      )?.code;
      if (fromCatalog) return fromCatalog;
      if (
        normalized.includes("pomegranate") ||
        normalized.includes("anar") ||
        normalized.includes("dalimb")
      ) {
        return "POMEGRANATE";
      }
      return "";
    })
    .filter(Boolean) as string[];
  const fromUserCodes = Array.isArray(user?.commodityCodes)
    ? user.commodityCodes
        .map((code) => String(code || "").toUpperCase())
        .filter(Boolean)
    : [];
  const fromOnboarding = Array.isArray(
    (user?.onboarding as OnboardingInfo | undefined)?.commodityCodes,
  )
    ? ((user?.onboarding as OnboardingInfo).commodityCodes || []).map((code) =>
        String(code || "").toUpperCase(),
      )
    : [];
  const rawPrimaryCommodityCode = String(
    user?.primaryCommodityCode || "",
  ).toUpperCase();
  const primaryCommodityCode = commodities.some(
    (item) => item.code === rawPrimaryCommodityCode,
  )
    ? rawPrimaryCommodityCode
    : "";
  const commodityCodes = [
    ...new Set([
      ...fromUserCodes,
      ...fromOnboarding,
      ...(primaryCommodityCode ? [primaryCommodityCode] : []),
      ...productCommodityCodes,
      ...(products.length && !productCommodityCodes.length ? ["OTHER"] : []),
    ]),
  ];
  const mandiName = String(user?.mandiName || "").trim();
  const state = normalizeState(user?.state);
  const language = String(user?.preferredLanguage || "");
  const complete = Boolean(
    language &&
      name &&
      commodityCodes.length &&
      state &&
      mandiName &&
      (role || commodityCodes.includes("POMEGRANATE")),
  );

  return {
    language,
    name,
    role,
    commodityCodes,
    state,
    mandiName,
    complete,
  };
}

function firstIncompleteStep(profile: ReturnType<typeof readProfile>) {
  if (!profile.language) return 0;
  if (!profile.name) return 1;
  if (!profile.commodityCodes.length) return 2;
  if (
    !profile.role &&
    !profile.commodityCodes.includes("POMEGRANATE")
  ) {
    return 3;
  }
  if (!profile.state || !profile.mandiName) return 4;
  return 0;
}

function isTemporaryName(value: string) {
  return [
    "MandiPlus User",
    "Mandi Plus User",
    "MandiPlus Customer",
    "Customer",
  ].some((temporary) => temporary.toLowerCase() === value.toLowerCase());
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeState(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return getCachedStates().some((option) => option.value === normalized)
    ? normalized
    : "";
}
