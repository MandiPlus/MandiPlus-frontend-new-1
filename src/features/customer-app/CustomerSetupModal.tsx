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
import { updateCustomerUser } from "./api";
import { INDIA_STATES } from "./indiaStates";
import { readableError } from "./utils";
import styles from "./customer-app.module.css";

const languages = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["kn", "ಕನ್ನಡ"],
  ["ta", "தமிழ்"],
  ["te", "తెలుగు"],
] as const;

const roles = [
  ["BUYER", "Buyer", ShoppingCart],
  ["SUPPLIER", "Supplier", Store],
  ["TRANSPORTER", "Transporter", Truck],
] as const;

const commodities = [
  ["TENDER_COCONUT", "Tender Coconut", "🥥"],
  ["MANGO", "Mango", "🥭"],
  ["BANANA", "Banana", "🍌"],
  ["TOMATO", "Tomato", "🍅"],
  ["ONION", "Onion", "🧅"],
  ["POTATO", "Potato", "🥔"],
  ["POMEGRANATE", "Pomegranate", "🍎"],
  ["OTHER", "Others", "➕"],
] as const;

const STEP_COUNT = 5;

export function CustomerSetupModal() {
  const { user, setUser } = useAuth();
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

  const profile = useMemo(() => readProfile(user), [user]);

  useEffect(() => {
    if (!user?.id) return;

    setLanguage(profile.language || "en");
    setName(profile.name);
    setRole(profile.role);
    setSelectedCommodities(profile.commodityCodes);
    setState(profile.state);
    setMandiName(profile.mandiName);

    if (profile.complete) {
      localStorage.removeItem(progressKey(user.id));
      setVisible(false);
      return;
    }

    const savedStep = Number(localStorage.getItem(progressKey(user.id)));
    const resumable = Number.isInteger(savedStep) && savedStep >= 0 && savedStep < STEP_COUNT;
    setStep(resumable ? savedStep : firstIncompleteStep(profile));
    setVisible(true);
    setError("");
  }, [profile, user?.id]);

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
    if (await save({ identity: nextRole })) advance(3);
  };

  const saveCommodities = async () => {
    if (!selectedCommodities.length) {
      setError("Choose at least one commodity");
      return;
    }
    const selected = commodities.filter(([code]) =>
      selectedCommodities.includes(code),
    );
    const labels = selected.map(([, label]) => label);
    const primary = selected[0]?.[0] || "OTHER";
    if (
      await save({
        primaryCommodityCode: primary,
        products: labels,
      })
    ) {
      advance(4);
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
        <div className={styles.setupProgress} aria-label={`Step ${step + 1} of ${STEP_COUNT}`}>
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
              <span>Full name</span>
              <input
                autoFocus
                autoComplete="name"
                value={name}
                placeholder="Enter your name"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <SetupContinue saving={saving} onClick={saveName} />
          </div>
        ) : null}

        {step === 2 ? (
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
                  <span className={styles.setupRowIcon}><Icon size={22} /></span>
                  <strong>{label}</strong>
                  {active ? <Check size={20} /> : <ChevronRight size={18} />}
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 3 ? (
          <div className={styles.setupForm}>
            <div className={styles.setupCommodityGrid}>
              {commodities.map(([code, label, emoji]) => {
                const active = selectedCommodities.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setError("");
                      setSelectedCommodities((current) =>
                        current.includes(code)
                          ? current.filter((item) => item !== code)
                          : [...current, code],
                      );
                    }}
                    className={`${styles.setupCommodityCard} ${
                      active ? styles.setupChoiceActive : ""
                    }`}
                  >
                    <span>{emoji}</span>
                    <strong>{label}</strong>
                    {active ? <Check size={16} /> : null}
                  </button>
                );
              })}
            </div>
            <SetupContinue saving={saving} onClick={saveCommodities} />
          </div>
        ) : null}

        {step === 4 ? (
          <div className={styles.setupForm}>
            <label className={styles.field}>
              <span>Select State</span>
              <select value={state} onChange={(event) => setState(event.target.value)}>
                <option value="">Select State</option>
                {INDIA_STATES.map((item) => (
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
  if (step === 1) return "What is your name?";
  if (step === 2) return "I'm a ...";
  if (step === 3) return "Which commodities do you trade?";
  return "Aapki mandi kahan hai?";
}

function progressKey(userId: string) {
  return `mandiplus:web-onboarding-step:${userId}`;
}

function readProfile(user: Record<string, unknown> | null | undefined) {
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
      return commodities.find(([, label]) => normalize(label) === normalized)?.[0];
    })
    .filter(Boolean) as string[];
  const rawPrimaryCommodityCode = String(
    user?.primaryCommodityCode || "",
  ).toUpperCase();
  const primaryCommodityCode = commodities.some(
    ([code]) => code === rawPrimaryCommodityCode,
  )
    ? rawPrimaryCommodityCode
    : "";
  const commodityCodes = [
    ...new Set([
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
      role &&
      commodityCodes.length &&
      state &&
      mandiName,
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
  if (!profile.role) return 2;
  if (!profile.commodityCodes.length) return 3;
  if (!profile.state || !profile.mandiName) return 4;
  return 0;
}

function isTemporaryName(value: string) {
  return ["MandiPlus User", "Mandi Plus User", "MandiPlus Customer", "Customer"].some(
    (temporary) => temporary.toLowerCase() === value.toLowerCase(),
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeState(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return INDIA_STATES.some((option) => option.value === normalized)
    ? normalized
    : "";
}
