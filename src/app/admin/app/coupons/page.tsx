"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Copy, LoaderCircle, Plus, Save } from "lucide-react";
import {
  AdminWalletCoupon,
  AdminWalletPack,
  adminApi,
} from "@/features/admin/api/admin.api";

type PackDraft = AdminWalletPack & {
  creditText: string;
  priceText: string;
};

const fieldClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500";
const labelClass = "grid gap-1.5 text-xs font-medium text-slate-600";

function packDraft(pack: AdminWalletPack): PackDraft {
  return {
    ...pack,
    creditText: String(pack.creditAmount),
    priceText: String(pack.priceAmount),
  };
}

function isoDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function displayDate(value: string | null) {
  if (!value) return "No limit";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function discountLabel(coupon: AdminWalletCoupon) {
  return coupon.discountType === "PERCENTAGE"
    ? `${coupon.discountValue}%`
    : `₹${coupon.discountValue.toLocaleString("en-IN")}`;
}

export default function WalletOffersPage() {
  const [packs, setPacks] = useState<PackDraft[]>([]);
  const [coupons, setCoupons] = useState<AdminWalletCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingPack, setSavingPack] = useState("");
  const [showNewPack, setShowNewPack] = useState(false);
  const [newPack, setNewPack] = useState({
    code: "",
    label: "",
    creditAmount: "",
    priceAmount: "",
    badge: "",
  });
  const [campaignName, setCampaignName] = useState("");
  const [codeMode, setCodeMode] = useState<"ONE" | "BATCH">("ONE");
  const [code, setCode] = useState("");
  const [count, setCount] = useState("1");
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE">(
    "FIXED",
  );
  const [discountValue, setDiscountValue] = useState("");
  const [usageMode, setUsageMode] = useState<"SINGLE_USE" | "MULTI_USE">(
    "SINGLE_USE",
  );
  const [maxClaims, setMaxClaims] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [eligiblePacks, setEligiblePacks] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  useEffect(() => {
    let active = true;
    void adminApi.getWalletOffers().then((response) => {
      if (!active) return;
      if (!response.success || !response.data) {
        setError(response.message || "Wallet offers could not be loaded.");
      } else {
        setPacks(response.data.packs.map(packDraft));
        setCoupons(response.data.coupons);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const activePacks = useMemo(
    () => packs.filter((pack) => pack.isActive),
    [packs],
  );

  const updatePack = (
    id: string,
    key: keyof PackDraft,
    value: string | boolean,
  ) => {
    setPacks((current) =>
      current.map((pack) =>
        pack.id === id ? { ...pack, [key]: value } : pack,
      ),
    );
  };

  const savePack = async (pack: PackDraft) => {
    setSavingPack(pack.id);
    setError("");
    const response = await adminApi.updateWalletPack(pack.id, {
      label: pack.label.trim(),
      creditAmount: Number(pack.creditText),
      priceAmount: Number(pack.priceText),
      badge: pack.badge?.trim() || null,
      isActive: pack.isActive,
    });
    setSavingPack("");
    if (!response.success || !response.data) {
      setError(response.message || "Pack could not be saved.");
      return;
    }
    setPacks((current) =>
      current.map((item) =>
        item.id === pack.id ? packDraft(response.data!) : item,
      ),
    );
  };

  const createPack = async (event: FormEvent) => {
    event.preventDefault();
    setSavingPack("new");
    setError("");
    const response = await adminApi.createWalletPack({
      code: newPack.code.trim(),
      label: newPack.label.trim(),
      creditAmount: Number(newPack.creditAmount),
      priceAmount: Number(newPack.priceAmount),
      badge: newPack.badge.trim() || null,
      sortOrder: packs.length * 10 + 10,
      isActive: true,
    });
    setSavingPack("");
    if (!response.success || !response.data) {
      setError(response.message || "Pack could not be created.");
      return;
    }
    setPacks((current) => [...current, packDraft(response.data!)]);
    setNewPack({
      code: "",
      label: "",
      creditAmount: "",
      priceAmount: "",
      badge: "",
    });
    setShowNewPack(false);
  };

  const generateCoupons = async (event: FormEvent) => {
    event.preventDefault();
    setGenerating(true);
    setError("");
    const response = await adminApi.generateWalletCoupons({
      name: campaignName.trim(),
      prefix: codeMode === "BATCH" ? code.trim() : "MANDI",
      code: codeMode === "ONE" ? code.trim() || undefined : undefined,
      count: codeMode === "ONE" ? 1 : Number(count),
      discountType,
      discountValue: Number(discountValue),
      usageMode,
      maxRedemptions:
        usageMode === "MULTI_USE" && maxClaims ? Number(maxClaims) : null,
      perUserLimit:
        usageMode === "MULTI_USE" && perUserLimit
          ? Number(perUserLimit)
          : usageMode === "SINGLE_USE"
            ? 1
            : null,
      eligiblePackCodes: eligiblePacks,
      validFrom: isoDate(validFrom),
      validUntil: isoDate(validUntil),
      isActive: true,
    });
    setGenerating(false);
    if (!response.success || !response.data?.coupons) {
      setError(response.message || "Coupons could not be generated.");
      return;
    }
    setCoupons((current) => [...response.data!.coupons, ...current]);
    setCampaignName("");
    setCode("");
    setDiscountValue("");
  };

  const toggleCoupon = async (coupon: AdminWalletCoupon) => {
    setError("");
    const response = await adminApi.updateWalletCoupon(coupon.id, {
      isActive: !coupon.isActive,
    });
    if (!response.success || !response.data) {
      setError(response.message || "Coupon could not be updated.");
      return;
    }
    setCoupons((current) =>
      current.map((item) =>
        item.id === coupon.id ? { ...item, ...response.data! } : item,
      ),
    );
  };

  const copyCoupon = async (couponCode: string) => {
    await navigator.clipboard.writeText(couponCode);
    setCopiedCode(couponCode);
    window.setTimeout(() => setCopiedCode(""), 1200);
  };

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              Wallet offers
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {activePacks.length} active packs · {coupons.length} coupons
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewPack((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <Plus size={16} />
            Add pack
          </button>
        </header>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Credit packs</h2>
          </div>

          {showNewPack ? (
            <form
              onSubmit={createPack}
              className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-6"
            >
              {[
                ["code", "Code", "limit_5_cr"],
                ["label", "Name", "5 Cr"],
                ["creditAmount", "Credit limit", "50000000"],
                ["priceAmount", "Price", "100000"],
                ["badge", "Badge", "Popular"],
              ].map(([key, label, placeholder]) => (
                <label key={key} className={labelClass}>
                  {label}
                  <input
                    required={key !== "badge"}
                    type={
                      key === "creditAmount" || key === "priceAmount"
                        ? "number"
                        : "text"
                    }
                    value={newPack[key as keyof typeof newPack]}
                    onChange={(event) =>
                      setNewPack((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    className={fieldClass}
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={savingPack === "new"}
                className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingPack === "new" ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Create
              </button>
            </form>
          ) : null}

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <LoaderCircle className="animate-spin text-slate-400" size={22} />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_.8fr_auto_auto] lg:items-end"
                >
                  <label className={labelClass}>
                    Name
                    <input
                      value={pack.label}
                      onChange={(event) =>
                        updatePack(pack.id, "label", event.target.value)
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Credit limit
                    <input
                      type="number"
                      value={pack.creditText}
                      onChange={(event) =>
                        updatePack(pack.id, "creditText", event.target.value)
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Price
                    <input
                      type="number"
                      value={pack.priceText}
                      onChange={(event) =>
                        updatePack(pack.id, "priceText", event.target.value)
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Badge
                    <input
                      value={pack.badge || ""}
                      onChange={(event) =>
                        updatePack(pack.id, "badge", event.target.value)
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={pack.isActive}
                      onChange={(event) =>
                        updatePack(pack.id, "isActive", event.target.checked)
                      }
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => void savePack(pack)}
                    disabled={savingPack === pack.id}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingPack === pack.id ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    Save
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={generateCoupons}
            className="h-fit rounded-xl border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Generate coupons</h2>
            </div>
            <div className="grid gap-4 p-5">
              <label className={labelClass}>
                Campaign name
                <input
                  required
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="Diwali offer"
                  className={fieldClass}
                />
              </label>

              <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1 text-sm">
                {[
                  ["ONE", "One code"],
                  ["BATCH", "Code batch"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCodeMode(value as "ONE" | "BATCH")}
                    className={`h-9 rounded ${
                      codeMode === value
                        ? "bg-white font-semibold shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  {codeMode === "ONE" ? "Coupon code" : "Prefix"}
                  <input
                    required
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.toUpperCase())
                    }
                    placeholder={codeMode === "ONE" ? "MANDI500" : "DIWALI"}
                    className={fieldClass}
                  />
                </label>
                {codeMode === "BATCH" ? (
                  <label className={labelClass}>
                    Quantity
                    <input
                      required
                      type="number"
                      min="1"
                      max="500"
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                ) : (
                  <div />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  Discount
                  <select
                    value={discountType}
                    onChange={(event) =>
                      setDiscountType(
                        event.target.value as "FIXED" | "PERCENTAGE",
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="FIXED">Fixed ₹</option>
                    <option value="PERCENTAGE">Percentage</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Value
                  <input
                    required
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Usage
                <select
                  value={usageMode}
                  onChange={(event) =>
                    setUsageMode(
                      event.target.value as "SINGLE_USE" | "MULTI_USE",
                    )
                  }
                  className={fieldClass}
                >
                  <option value="SINGLE_USE">One-time code</option>
                  <option value="MULTI_USE">Reusable / all users</option>
                </select>
              </label>

              {usageMode === "MULTI_USE" ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    Total claims
                    <input
                      type="number"
                      min="1"
                      value={maxClaims}
                      onChange={(event) => setMaxClaims(event.target.value)}
                      placeholder="Unlimited"
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Per user
                    <input
                      type="number"
                      min="1"
                      value={perUserLimit}
                      onChange={(event) => setPerUserLimit(event.target.value)}
                      placeholder="Unlimited"
                      className={fieldClass}
                    />
                  </label>
                </div>
              ) : null}

              <fieldset className="grid gap-2">
                <legend className="text-xs font-medium text-slate-600">
                  Valid packs
                </legend>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={eligiblePacks.length === 0}
                    onChange={() => setEligiblePacks([])}
                  />
                  All packs
                </label>
                <div className="flex flex-wrap gap-2">
                  {activePacks.map((pack) => (
                    <label
                      key={pack.code}
                      className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={eligiblePacks.includes(pack.code)}
                        onChange={(event) =>
                          setEligiblePacks((current) =>
                            event.target.checked
                              ? [...current, pack.code]
                              : current.filter((codeValue) => codeValue !== pack.code),
                          )
                        }
                      />
                      {pack.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  Starts
                  <input
                    type="datetime-local"
                    value={validFrom}
                    onChange={(event) => setValidFrom(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  Ends
                  <input
                    type="datetime-local"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={generating}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {generating ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : null}
                Generate
              </button>
            </div>
          </form>

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Coupon codes</h2>
            </div>
            <div className="max-h-[760px] overflow-auto">
              {coupons.length ? (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Code</th>
                      <th className="px-4 py-3">Offer</th>
                      <th className="px-4 py-3">Usage</th>
                      <th className="px-4 py-3">Validity</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {coupons.map((coupon) => (
                      <tr key={coupon.id}>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => void copyCoupon(coupon.code)}
                            className="inline-flex items-center gap-2 font-mono font-semibold"
                          >
                            {coupon.code}
                            {copiedCode === coupon.code ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} className="text-slate-400" />
                            )}
                          </button>
                          <div className="mt-1 text-xs text-slate-500">
                            {coupon.name}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold">
                          {discountLabel(coupon)} off
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {coupon.usageMode === "SINGLE_USE"
                            ? "One-time"
                            : coupon.maxRedemptions
                              ? `${coupon.redeemedCount}/${coupon.maxRedemptions}`
                              : `${coupon.redeemedCount} claimed`}
                          {coupon.reservedCount ? (
                            <div className="text-xs text-amber-700">
                              {coupon.reservedCount} in checkout
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {displayDate(coupon.validFrom)}
                          <div>to {displayDate(coupon.validUntil)}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void toggleCoupon(coupon)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              coupon.isActive
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {coupon.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                  No coupons yet
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
