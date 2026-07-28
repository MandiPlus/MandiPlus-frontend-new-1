"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Copy, LoaderCircle, Plus, Save, Ticket } from "lucide-react";
import {
  AdminWalletCoupon,
  AdminWalletPack,
  adminApi,
} from "@/features/admin/api/admin.api";

type PackDraft = AdminWalletPack & {
  creditAmountText: string;
  priceAmountText: string;
  sortOrderText: string;
};

const emptyPack = {
  code: "",
  label: "",
  creditAmount: "",
  priceAmount: "",
  badge: "",
  sortOrder: "40",
};

const inputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "grid gap-1.5 text-xs font-medium text-slate-600";

function toDraft(pack: AdminWalletPack): PackDraft {
  return {
    ...pack,
    creditAmountText: String(pack.creditAmount),
    priceAmountText: String(pack.priceAmount),
    sortOrderText: String(pack.sortOrder),
  };
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDate(value: string | null): string {
  if (!value) return "No limit";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDiscount(coupon: AdminWalletCoupon): string {
  return coupon.discountType === "PERCENTAGE"
    ? `${coupon.discountValue}%`
    : `₹${coupon.discountValue.toLocaleString("en-IN")}`;
}

export default function WalletCouponsPage() {
  const [packs, setPacks] = useState<PackDraft[]>([]);
  const [coupons, setCoupons] = useState<AdminWalletCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingPackId, setSavingPackId] = useState("");
  const [showNewPack, setShowNewPack] = useState(false);
  const [newPack, setNewPack] = useState(emptyPack);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [prefix, setPrefix] = useState("MANDI");
  const [exactCode, setExactCode] = useState("");
  const [codeMode, setCodeMode] = useState<"ONE" | "BATCH">("ONE");
  const [count, setCount] = useState("1");
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE">(
    "FIXED",
  );
  const [discountValue, setDiscountValue] = useState("");
  const [usageMode, setUsageMode] = useState<"SINGLE_USE" | "MULTI_USE">(
    "SINGLE_USE",
  );
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [eligiblePackCodes, setEligiblePackCodes] = useState<string[]>([]);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");

  useEffect(() => {
    let active = true;
    void adminApi.getWalletOffers().then((response) => {
      if (!active) return;
      if (!response.success || !response.data) {
        setError(response.message || "Wallet offers could not be loaded.");
        setLoading(false);
        return;
      }
      setPacks(response.data.packs.map(toDraft));
      setCoupons(response.data.coupons);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const activePackCount = useMemo(
    () => packs.filter((pack) => pack.isActive).length,
    [packs],
  );

  const updatePackDraft = (
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
    setSavingPackId(pack.id);
    setError("");
    const response = await adminApi.updateWalletPack(pack.id, {
      label: pack.label.trim(),
      creditAmount: Number(pack.creditAmountText),
      priceAmount: Number(pack.priceAmountText),
      badge: pack.badge?.trim() || null,
      sortOrder: Number(pack.sortOrderText),
      isActive: pack.isActive,
    });
    setSavingPackId("");
    if (!response.success || !response.data) {
      setError(response.message || "Pack could not be saved.");
      return;
    }
    setPacks((current) =>
      current.map((item) =>
        item.id === pack.id ? toDraft(response.data!) : item,
      ),
    );
  };

  const createPack = async (event: FormEvent) => {
    event.preventDefault();
    setSavingPackId("new");
    setError("");
    const response = await adminApi.createWalletPack({
      code: newPack.code.trim(),
      label: newPack.label.trim(),
      creditAmount: Number(newPack.creditAmount),
      priceAmount: Number(newPack.priceAmount),
      badge: newPack.badge.trim() || null,
      sortOrder: Number(newPack.sortOrder),
      isActive: true,
    });
    setSavingPackId("");
    if (!response.success || !response.data) {
      setError(response.message || "Pack could not be created.");
      return;
    }
    setPacks((current) =>
      [...current, toDraft(response.data!)].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      ),
    );
    setNewPack(emptyPack);
    setShowNewPack(false);
  };

  const generateCoupons = async (event: FormEvent) => {
    event.preventDefault();
    setGenerating(true);
    setError("");
    const response = await adminApi.generateWalletCoupons({
      name: campaignName.trim(),
      prefix: prefix.trim(),
      code: codeMode === "ONE" ? exactCode.trim() || undefined : undefined,
      count: codeMode === "ONE" ? 1 : Number(count),
      discountType,
      discountValue: Number(discountValue),
      usageMode,
      maxRedemptions:
        usageMode === "SINGLE_USE" || !maxRedemptions
          ? null
          : Number(maxRedemptions),
      perUserLimit: perUserLimit ? Number(perUserLimit) : null,
      eligiblePackCodes,
      validFrom: toIso(validFrom),
      validUntil: toIso(validUntil),
      isActive: true,
    });
    setGenerating(false);
    if (!response.success || !response.data?.coupons) {
      setError(response.message || "Coupons could not be generated.");
      return;
    }
    setCoupons((current) => [...response.data!.coupons, ...current]);
    setCampaignName("");
    setExactCode("");
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
        item.id === coupon.id
          ? {
              ...item,
              ...response.data!,
            }
          : item,
      ),
    );
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(""), 1200);
  };

  return (
    <main className="min-h-full bg-[#f7f8fa] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              Wallet offers
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Packs and coupon codes shown in the customer app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewPack((value) => !value)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Plus size={16} />
            Add pack
          </button>
        </header>

        {error ? (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-950">Credit packs</h2>
              <p className="text-xs text-slate-500">
                {activePackCount} active in the app
              </p>
            </div>
          </div>

          {showNewPack ? (
            <form
              onSubmit={createPack}
              className="grid gap-3 border-b border-slate-200 bg-emerald-50/40 p-5 sm:grid-cols-2 lg:grid-cols-6"
            >
              <label className={labelClass}>
                Code
                <input
                  required
                  value={newPack.code}
                  onChange={(event) =>
                    setNewPack((value) => ({
                      ...value,
                      code: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="limit_5_cr"
                />
              </label>
              <label className={labelClass}>
                Name
                <input
                  required
                  value={newPack.label}
                  onChange={(event) =>
                    setNewPack((value) => ({
                      ...value,
                      label: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="5 Cr"
                />
              </label>
              <label className={labelClass}>
                Credit limit
                <input
                  required
                  type="number"
                  min="1"
                  value={newPack.creditAmount}
                  onChange={(event) =>
                    setNewPack((value) => ({
                      ...value,
                      creditAmount: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Price
                <input
                  required
                  type="number"
                  min="1"
                  value={newPack.priceAmount}
                  onChange={(event) =>
                    setNewPack((value) => ({
                      ...value,
                      priceAmount: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Badge
                <input
                  value={newPack.badge}
                  onChange={(event) =>
                    setNewPack((value) => ({
                      ...value,
                      badge: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Popular"
                />
              </label>
              <button
                type="submit"
                disabled={savingPackId === "new"}
                className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-300"
              >
                {savingPackId === "new" ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Create
              </button>
            </form>
          ) : null}

          {loading ? (
            <div className="flex h-40 items-center justify-center text-slate-400">
              <LoaderCircle className="animate-spin" size={22} />
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
                        updatePackDraft(pack.id, "label", event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Credit limit
                    <input
                      type="number"
                      min="1"
                      value={pack.creditAmountText}
                      onChange={(event) =>
                        updatePackDraft(
                          pack.id,
                          "creditAmountText",
                          event.target.value,
                        )
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Price
                    <input
                      type="number"
                      min="1"
                      value={pack.priceAmountText}
                      onChange={(event) =>
                        updatePackDraft(
                          pack.id,
                          "priceAmountText",
                          event.target.value,
                        )
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Badge
                    <input
                      value={pack.badge || ""}
                      onChange={(event) =>
                        updatePackDraft(pack.id, "badge", event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="flex h-10 items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={pack.isActive}
                      onChange={(event) =>
                        updatePackDraft(
                          pack.id,
                          "isActive",
                          event.target.checked,
                        )
                      }
                      className="h-4 w-4 accent-emerald-700"
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => void savePack(pack)}
                    disabled={savingPackId === pack.id}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    {savingPackId === pack.id ? (
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

        <section className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={generateCoupons}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Ticket size={18} />
              </span>
              <h2 className="font-semibold text-slate-950">Generate coupons</h2>
            </div>
            <div className="grid gap-4 p-5">
              <label className={labelClass}>
                Campaign name
                <input
                  required
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  className={inputClass}
                  placeholder="Diwali offer"
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
                        ? "bg-white font-semibold text-slate-950 shadow-sm"
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
                    required={codeMode === "BATCH"}
                    value={codeMode === "ONE" ? exactCode : prefix}
                    onChange={(event) =>
                      codeMode === "ONE"
                        ? setExactCode(event.target.value.toUpperCase())
                        : setPrefix(event.target.value.toUpperCase())
                    }
                    className={inputClass}
                    placeholder={codeMode === "ONE" ? "DIWALI20" : "DIWALI"}
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
                      className={inputClass}
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
                    className={inputClass}
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
                    max={discountType === "PERCENTAGE" ? "99" : undefined}
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                    className={inputClass}
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
                  className={inputClass}
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
                      value={maxRedemptions}
                      onChange={(event) =>
                        setMaxRedemptions(event.target.value)
                      }
                      className={inputClass}
                      placeholder="Unlimited"
                    />
                  </label>
                  <label className={labelClass}>
                    Per user
                    <input
                      type="number"
                      min="1"
                      value={perUserLimit}
                      onChange={(event) => setPerUserLimit(event.target.value)}
                      className={inputClass}
                      placeholder="Unlimited"
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
                    checked={eligiblePackCodes.length === 0}
                    onChange={() => setEligiblePackCodes([])}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  All packs
                </label>
                <div className="flex flex-wrap gap-2">
                  {packs
                    .filter((pack) => pack.isActive)
                    .map((pack) => (
                      <label
                        key={pack.code}
                        className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={eligiblePackCodes.includes(pack.code)}
                          onChange={(event) =>
                            setEligiblePackCodes((current) =>
                              event.target.checked
                                ? [...current, pack.code]
                                : current.filter((code) => code !== pack.code),
                            )
                          }
                          className="h-4 w-4 accent-emerald-700"
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
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Ends
                  <input
                    type="datetime-local"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
            <div className="border-t border-slate-200 p-4">
              <button
                type="submit"
                disabled={generating}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-300"
              >
                {generating ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Ticket size={16} />
                )}
                Generate
              </button>
            </div>
          </form>

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Coupon codes</h2>
              <p className="text-xs text-slate-500">
                {coupons.length} generated
              </p>
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
                            onClick={() => void copyCode(coupon.code)}
                            className="inline-flex items-center gap-2 font-mono font-semibold text-slate-950"
                          >
                            {coupon.code}
                            {copiedCode === coupon.code ? (
                              <Check size={14} className="text-emerald-700" />
                            ) : (
                              <Copy size={14} className="text-slate-400" />
                            )}
                          </button>
                          <div className="mt-1 text-xs text-slate-500">
                            {coupon.name}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-emerald-700">
                          {formatDiscount(coupon)} off
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div>
                            {coupon.usageMode === "SINGLE_USE"
                              ? "One-time"
                              : coupon.maxRedemptions
                                ? `${coupon.redeemedCount}/${coupon.maxRedemptions}`
                                : `${coupon.redeemedCount} claimed`}
                          </div>
                          {coupon.reservedCount ? (
                            <div className="text-xs text-amber-600">
                              {coupon.reservedCount} in checkout
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          <div>{formatDate(coupon.validFrom)}</div>
                          <div>to {formatDate(coupon.validUntil)}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void toggleCoupon(coupon)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              coupon.isActive
                                ? "bg-emerald-50 text-emerald-700"
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
