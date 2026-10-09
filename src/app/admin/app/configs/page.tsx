"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import {
  AdminAppSettings,
  AdminVehicleLoadRule,
  AdminVehicleLoadWeighingMethod,
  adminApi,
} from "@/features/admin/api/admin.api";
import { itemsData } from "@/features/insurance/productCatalog";
import {
  type CommodityPremiumRatesConfig,
  DEFAULT_COMMODITY_PREMIUM_RATES,
  PREMIUM_RATE_COMMODITIES,
  PREMIUM_RATE_COMMODITY_LABELS,
} from "@/features/pricing/commodityPremiumRates";

const fieldClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500";
const labelClass = "grid gap-1.5 text-xs font-medium text-slate-600";
const cardClass = "grid gap-4 rounded-lg border border-slate-200 bg-white p-5";

// Editable here rather than in code. Adding a truck size to this list is the
// only app change a new tonnage needs — the customer app renders whatever
// tiers the backend returns.
const TONNAGES = [20, 25, 30] as const;

type LoadRuleDraft = {
  commodity: string;
  method: AdminVehicleLoadWeighingMethod;
  kgPerUnit: string;
};

const toLoadRuleDraft = (rule: AdminVehicleLoadRule): LoadRuleDraft => ({
  commodity: rule.commodity,
  method: rule.method,
  kgPerUnit:
    rule.kgPerUnit === null || rule.kgPerUnit === undefined
      ? ""
      : String(rule.kgPerUnit),
});

type PremiumRateRow = { code: string; label: string };

const FALLBACK_PREMIUM_RATE_ROWS: PremiumRateRow[] = PREMIUM_RATE_COMMODITIES.map(
  (code) => ({ code, label: PREMIUM_RATE_COMMODITY_LABELS[code] }),
);

// The launch card, used until the backend answers.
const DEFAULT_PREMIUM_RATES_CONFIG: CommodityPremiumRatesConfig = {
  rates: DEFAULT_COMMODITY_PREMIUM_RATES,
  explicit: { TOMATO: 399, POMEGRANATE: 250, PINEAPPLE: 250, TENDER_COCONUT: 200, OTHER: 250 },
  isDefault: true,
  updatedAt: null,
};

/** One draft per commodity: its own rate, or "" when it follows OTHER. */
const toRateDrafts = (
  config: CommodityPremiumRatesConfig,
  rows: PremiumRateRow[],
): Record<string, string> => {
  // An older backend sends only the effective rates of its five commodities.
  const explicit: Record<string, number | undefined> =
    config.explicit || config.rates;
  return Object.fromEntries(
    rows.map(({ code }) => [
      code,
      explicit[code] === undefined ? "" : String(explicit[code]),
    ]),
  );
};

function rateHint(value: unknown) {
  const rate = Number(value);
  if (!(rate > 0)) return "Enter a rate";
  return `${(rate / 1000).toFixed(3)}% · ₹${(rate * 10).toLocaleString("en-IN")} on ₹10 lakh`;
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function AppConfigsPage() {
  const [settings, setSettings] = useState<AdminAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountActive, setDiscountActive] = useState(true);
  const [savingLogistics, setSavingLogistics] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [loadRules, setLoadRules] = useState<LoadRuleDraft[]>([]);
  const [savingLoadRules, setSavingLoadRules] = useState(false);
  const [premiumRateRows, setPremiumRateRows] = useState<PremiumRateRow[]>(
    FALLBACK_PREMIUM_RATE_ROWS,
  );
  const [premiumRates, setPremiumRates] = useState<Record<string, string>>(
    () => toRateDrafts(DEFAULT_PREMIUM_RATES_CONFIG, FALLBACK_PREMIUM_RATE_ROWS),
  );
  const [savingPremiumRates, setSavingPremiumRates] = useState(false);

  function applyPremiumRates(config: CommodityPremiumRatesConfig) {
    const rows = config.commodities?.length
      ? config.commodities
      : FALLBACK_PREMIUM_RATE_ROWS;
    setPremiumRateRows(rows);
    setPremiumRates(toRateDrafts(config, rows));
  }

  useEffect(() => {
    let active = true;
    void adminApi.getAppSettings().then((response) => {
      if (!active) return;
      if (!response.success || !response.data) {
        setError(response.message || "App settings could not be loaded.");
      } else {
        applySettings(response.data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
    function applySettings(data: AdminAppSettings) {
      setSettings(data);
      const byTonnage: Record<number, string> = {};
      const tiers = data.tenderCoconut.tiers?.length
        ? data.tenderCoconut.tiers
        : [
            { tonnage: 20, amount: data.tenderCoconut.amount20Ton ?? 0 },
            { tonnage: 25, amount: data.tenderCoconut.amount25Ton },
            { tonnage: 30, amount: data.tenderCoconut.amount30Ton },
          ];
      tiers.forEach((tier) => {
        byTonnage[tier.tonnage] = String(tier.amount);
      });
      setAmounts(byTonnage);
      setDiscountPercent(String(data.premiumDiscount.percent));
      setDiscountActive(data.premiumDiscount.active);
      setLoadRules((data.vehicleLoadRules?.commodities || []).map(toLoadRuleDraft));
      applyPremiumRates(data.premiumRates || DEFAULT_PREMIUM_RATES_CONFIG);
    }
  }, []);

  const discountPreview = useMemo(() => {
    const percent = Number(discountPercent);
    if (!discountActive || !Number.isFinite(percent) || percent <= 0) {
      return null;
    }
    const sample = 2000;
    return {
      percent,
      before: sample,
      after: Number((sample * (1 - percent / 100)).toFixed(2)),
    };
  }, [discountActive, discountPercent]);

  const saveLogistics = async (event: FormEvent) => {
    event.preventDefault();
    setSavingLogistics(true);
    setError("");
    setSavedNote("");
    const response = await adminApi.updateTenderCoconutLogistics({
      amount20Ton: Number(amounts[20]),
      amount25Ton: Number(amounts[25]),
      amount30Ton: Number(amounts[30]),
    });
    if (!response.success || !response.data) {
      setError(response.message || "Logistics pricing could not be saved.");
    } else {
      setSettings((current) =>
        current ? { ...current, tenderCoconut: response.data! } : current,
      );
      setSavedNote("Logistics pricing saved.");
    }
    setSavingLogistics(false);
  };

  const otherPremiumRate = Number(premiumRates.OTHER);
  const savePremiumRates = async (event: FormEvent) => {
    event.preventDefault();
    if (!(otherPremiumRate > 0)) {
      setError("All other commodities needs a premium above ₹0 per lakh.");
      return;
    }
    const rates: Record<string, number | null> = {};
    for (const { code, label } of premiumRateRows) {
      const text = String(premiumRates[code] ?? "").trim();
      if (!text) {
        rates[code] = null;
        continue;
      }
      const rate = Number(text);
      if (!Number.isFinite(rate) || rate <= 0) {
        setError(`${label} needs a premium above ₹0 per lakh, or blank to follow All other commodities.`);
        return;
      }
      rates[code] = rate;
    }
    setSavingPremiumRates(true);
    setError("");
    setSavedNote("");
    const response = await adminApi.updateCommodityPremiumRates(rates);
    if (!response.success || !response.data) {
      setError(response.message || "The premium rates could not be saved.");
    } else {
      setSettings((current) =>
        current ? { ...current, premiumRates: response.data! } : current,
      );
      applyPremiumRates(response.data);
      setSavedNote("Premium rates saved. New invoices use them now.");
    }
    setSavingPremiumRates(false);
  };

  const saveDiscount = async (event: FormEvent) => {
    event.preventDefault();
    setSavingDiscount(true);
    setError("");
    setSavedNote("");
    const response = await adminApi.updatePremiumDiscount({
      percent: Number(discountPercent),
      active: discountActive,
    });
    if (!response.success || !response.data) {
      setError(response.message || "The discount could not be saved.");
    } else {
      setSettings((current) =>
        current ? { ...current, premiumDiscount: response.data! } : current,
      );
      setSavedNote("Discount saved.");
    }
    setSavingDiscount(false);
  };

  const updateLoadRule = (index: number, patch: Partial<LoadRuleDraft>) =>
    setLoadRules((current) =>
      current.map((rule, position) =>
        position === index ? { ...rule, ...patch } : rule,
      ),
    );

  const saveLoadRules = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSavedNote("");
    const commodities = loadRules.map((rule) => ({
      commodity: rule.commodity.trim(),
      method: rule.method,
      kgPerUnit: rule.method === "UNIT_WEIGHT" ? Number(rule.kgPerUnit) : null,
    }));
    const incomplete = commodities.find(
      (rule) =>
        !rule.commodity ||
        (rule.method === "UNIT_WEIGHT" && !(Number(rule.kgPerUnit) > 0)),
    );
    if (incomplete) {
      setError(
        incomplete.commodity
          ? `Enter the kg per unit for ${incomplete.commodity}.`
          : "Every row needs a commodity name.",
      );
      return;
    }
    setSavingLoadRules(true);
    const response = await adminApi.updateVehicleLoadRules({ commodities });
    if (!response.success || !response.data) {
      setError(response.message || "The weighing rules could not be saved.");
    } else {
      setSettings((current) =>
        current ? { ...current, vehicleLoadRules: response.data! } : current,
      );
      setLoadRules(response.data.commodities.map(toLoadRuleDraft));
      setSavedNote("Weighing rules saved.");
    }
    setSavingLoadRules(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-600">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading app configuration…
      </div>
    );
  }

  return (
    <div className="grid gap-5 p-6">
      <header className="grid gap-1">
        <h1 className="text-lg font-semibold text-slate-950">App Config</h1>
        <p className="text-sm text-slate-600">
          Settings the customer app and invoice creation read at runtime. They
          are platform-wide and apply to new invoices immediately — no app
          release needed.
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {savedNote ? (
        <p className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check className="h-4 w-4" />
          {savedNote}
        </p>
      ) : null}

      <form onSubmit={savePremiumRates} className={cardClass}>
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold text-slate-950">
            Insurance premium by commodity
          </h2>
          <p className="text-xs text-slate-600">
            ₹ per lakh of invoice value, for every invoice from every surface —
            admin console, customer web and mobile app, and the WhatsApp bot. A
            customer&apos;s own negotiated rate for a commodity (set on the
            Users page) wins over this card. Leave a commodity blank to charge
            it the All other commodities rate. Existing invoices keep the rate
            they were created with.
          </p>
        </div>
        <label className={`${labelClass} max-w-xs`}>
          All other commodities
          <input
            className={fieldClass}
            inputMode="decimal"
            value={premiumRates.OTHER ?? ""}
            onChange={(event) =>
              setPremiumRates((current) => ({
                ...current,
                OTHER: event.target.value,
              }))
            }
          />
          <span className="text-[11px] font-normal text-slate-500">
            {rateHint(premiumRates.OTHER)} · used by every commodity below left blank,
            and by anything not in the list
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {premiumRateRows
            .filter(({ code }) => code !== "OTHER")
            .map(({ code, label }) => {
              const own = String(premiumRates[code] ?? "").trim();
              return (
                <label key={code} className={labelClass}>
                  {label}
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    placeholder={otherPremiumRate > 0 ? String(otherPremiumRate) : ""}
                    value={premiumRates[code] ?? ""}
                    onChange={(event) =>
                      setPremiumRates((current) => ({
                        ...current,
                        [code]: event.target.value,
                      }))
                    }
                  />
                  <span className="text-[11px] font-normal text-slate-500">
                    {own ? rateHint(own) : "Follows All other commodities"}
                  </span>
                </label>
              );
            })}
        </div>
        {settings?.premiumRates?.isDefault ? (
          <p className="text-xs text-slate-600">
            Showing the built-in rates; nothing has been saved here yet.
          </p>
        ) : null}
        <div>
          <button
            type="submit"
            disabled={savingPremiumRates}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingPremiumRates ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save premium rates
          </button>
        </div>
      </form>

      <form onSubmit={saveLogistics} className={cardClass}>
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold text-slate-950">
            Tender Coconut logistics
          </h2>
          <p className="text-xs text-slate-600">
            Charged per vehicle when the customer includes logistics.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {TONNAGES.map((tonnage) => (
            <label key={tonnage} className={labelClass}>
              {tonnage} ton
              <input
                className={fieldClass}
                inputMode="numeric"
                value={amounts[tonnage] ?? ""}
                onChange={(event) =>
                  setAmounts((current) => ({
                    ...current,
                    [tonnage]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div>
          <button
            type="submit"
            disabled={savingLogistics}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingLogistics ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save logistics
          </button>
        </div>
      </form>

      <form onSubmit={saveDiscount} className={cardClass}>
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold text-slate-950">
            Insurance premium discount
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              Mobile app only
            </span>
          </h2>
          <p className="text-xs text-slate-600">
            Applied to the premium at invoice creation, for invoices raised from
            the customer mobile app by customers who pay at checkout. They see
            the full premium struck through and pay the discounted amount.
            Always charged the full premium: invoices raised here in the admin
            console, invoices from the customer web app, and wallet customers,
            whose invoices settle off the insurance service limit and never
            reach a checkout. Applies to every commodity.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[160px_auto] sm:items-end">
          <label className={labelClass}>
            Discount %
            <input
              className={fieldClass}
              inputMode="decimal"
              value={discountPercent}
              onChange={(event) => setDiscountPercent(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={discountActive}
              onChange={(event) => setDiscountActive(event.target.checked)}
            />
            Discount active
          </label>
        </div>
        {discountPreview ? (
          <p className="text-xs text-slate-600">
            Preview — in the mobile app, a {money(discountPreview.before)}{" "}
            premium becomes{" "}
            <span className="line-through">{money(discountPreview.before)}</span>{" "}
            <strong className="text-slate-950">
              {money(discountPreview.after)}
            </strong>{" "}
            ({discountPreview.percent}% off).
          </p>
        ) : (
          <p className="text-xs text-slate-600">
            No discount is applied. Every customer pays the full premium.
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={savingDiscount}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingDiscount ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save discount
          </button>
        </div>
      </form>

      <form onSubmit={saveLoadRules} className={cardClass}>
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold text-slate-950">
            Vehicle overweight check
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              Admin invoices
            </span>
          </h2>
          <p className="text-xs text-slate-600">
            How each commodity&apos;s load is weighed before it is compared with
            the truck&apos;s RC gross vehicle weight plus 5%.{" "}
            <strong className="text-slate-800">Weight per unit</strong>{" "}
            multiplies the invoice quantity by the kg below and adds the RC
            unladen weight.{" "}
            <strong className="text-slate-800">Weighment slip</strong> reads the
            gross weight from the attached kanta parchi. Commodities not listed
            are not weight-checked. An RC that is not active, has expired
            fitness or is blacklisted blocks every invoice.
          </p>
        </div>
        <datalist id="vehicle-load-commodities">
          {itemsData.map((item) => (
            <option key={item.name} value={item.name} />
          ))}
        </datalist>
        <div className="grid gap-3">
          {loadRules.length === 0 ? (
            <p className="text-xs text-slate-500">
              No commodity is weight-checked.
            </p>
          ) : null}
          {loadRules.map((rule, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_140px_40px] sm:items-end"
            >
              <label className={labelClass}>
                Commodity
                <input
                  className={fieldClass}
                  list="vehicle-load-commodities"
                  value={rule.commodity}
                  onChange={(event) =>
                    updateLoadRule(index, { commodity: event.target.value })
                  }
                />
              </label>
              <label className={labelClass}>
                Weighed by
                <select
                  className={fieldClass}
                  value={rule.method}
                  onChange={(event) =>
                    updateLoadRule(index, {
                      method: event.target.value as AdminVehicleLoadWeighingMethod,
                    })
                  }
                >
                  <option value="UNIT_WEIGHT">Weight per unit</option>
                  <option value="WEIGHMENT_SLIP">Weighment slip</option>
                </select>
              </label>
              <label className={labelClass}>
                Kg per unit
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  disabled={rule.method !== "UNIT_WEIGHT"}
                  placeholder={rule.method === "UNIT_WEIGHT" ? "e.g. 25" : "From slip"}
                  value={rule.method === "UNIT_WEIGHT" ? rule.kgPerUnit : ""}
                  onChange={(event) =>
                    updateLoadRule(index, { kgPerUnit: event.target.value })
                  }
                />
              </label>
              <button
                type="button"
                aria-label={`Remove ${rule.commodity || "commodity"}`}
                onClick={() =>
                  setLoadRules((current) =>
                    current.filter((_, position) => position !== index),
                  )
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setLoadRules((current) => [
                ...current,
                { commodity: "", method: "UNIT_WEIGHT", kgPerUnit: "" },
              ])
            }
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Add commodity
          </button>
          <button
            type="submit"
            disabled={savingLoadRules}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingLoadRules ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save weighing rules
          </button>
        </div>
        {settings?.vehicleLoadRules?.isDefault ? (
          <p className="text-xs text-slate-500">
            Showing the built-in defaults. Saving stores them here.
          </p>
        ) : settings?.vehicleLoadRules?.updatedAt ? (
          <p className="text-xs text-slate-500">
            Weighing rules last updated{" "}
            {new Date(settings.vehicleLoadRules.updatedAt).toLocaleString("en-IN")}.
          </p>
        ) : null}
      </form>

      {settings?.tenderCoconut.updatedAt ? (
        <p className="text-xs text-slate-500">
          Logistics pricing last updated{" "}
          {new Date(settings.tenderCoconut.updatedAt).toLocaleString("en-IN")}.
        </p>
      ) : null}
    </div>
  );
}
