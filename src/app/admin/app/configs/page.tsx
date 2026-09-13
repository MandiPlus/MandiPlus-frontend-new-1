"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Save } from "lucide-react";
import { AdminAppSettings, adminApi } from "@/features/admin/api/admin.api";

const fieldClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500";
const labelClass = "grid gap-1.5 text-xs font-medium text-slate-600";
const cardClass = "grid gap-4 rounded-lg border border-slate-200 bg-white p-5";

// Editable here rather than in code. Adding a truck size to this list is the
// only app change a new tonnage needs — the customer app renders whatever
// tiers the backend returns.
const TONNAGES = [20, 25, 30] as const;

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
          Pricing the customer app reads at runtime. These settings are
          platform-wide and apply to new invoices immediately — no app release
          needed.
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

      {settings?.tenderCoconut.updatedAt ? (
        <p className="text-xs text-slate-500">
          Logistics pricing last updated{" "}
          {new Date(settings.tenderCoconut.updatedAt).toLocaleString("en-IN")}.
        </p>
      ) : null}
    </div>
  );
}
