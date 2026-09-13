"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import {
  BUSINESS_ACTIVITY,
  BUSINESS_TYPES,
  VERIFICATION_LEVELS,
  addMarketContacts,
  getLeadProfile,
  saveLeadProfile,
  type LeadRecord,
  type MarketContactInput,
} from "../api";

const ACCENT = "#4309ac";

type Draft = Record<string, string>;

/**
 * Opens once someone turns out to be a real buyer. Two jobs: confirm what we
 * think we know, and collect the names they can give us - which is where most
 * good mandi data actually comes from.
 */
export default function BuyerDetailsSheet({
  lead,
  commodities,
  onClose,
  onSaved,
}: {
  lead: LeadRecord;
  commodities: { code: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const [contacts, setContacts] = useState<MarketContactInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLeadProfile(lead.id)
      .then((profile) => {
        setDraft({
          shopName: profile?.shop_name ?? lead.displayName ?? "",
          contactPerson: profile?.contact_person ?? "",
          city: profile?.city ?? lead.region ?? "",
          mandi: profile?.mandi ?? "",
          product: profile?.product ?? lead.commodityCode ?? "",
          businessType: profile?.business_type ?? "",
          businessActivity: profile?.business_activity ?? "",
          dailyVehicles: profile?.daily_vehicles?.toString() ?? "",
          buyingVolume: profile?.buying_volume ?? "",
          alternateMobile: "",
        });
      })
      .catch(() => toast.error("Could not load the details"))
      .finally(() => setLoading(false));
  }, [lead]);

  const set = (key: string, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(draft)) {
        if (value === "" || value === undefined) continue;
        payload[key] =
          key === "dailyVehicles" ? Number(value) : value;
      }
      const { verificationLevel } = await saveLeadProfile(lead.id, payload);

      const ready = contacts.filter((c) => c.name.trim() && c.mobile.trim());
      if (ready.length) {
        const result = await addMarketContacts(lead.id, ready);
        toast.success(
          `${VERIFICATION_LEVELS[verificationLevel]} · ${result.created} contact${result.created === 1 ? "" : "s"} added` +
            (result.duplicates ? ` · ${result.duplicates} already known` : ""),
        );
      } else {
        toast.success(VERIFICATION_LEVELS[verificationLevel]);
      }
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ?? "Could not save the details",
      );
    } finally {
      setSaving(false);
    }
  };

  const field =
    "h-11 w-full rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">Buyer details</h2>
          <p className="truncate text-xs text-gray-400">{lead.displayName}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
        >
          <X className="size-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 p-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-2xl bg-gray-50" />
          ))}
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          <input
            className={field}
            placeholder="Shop name"
            value={draft.shopName ?? ""}
            onChange={(e) => set("shopName", e.target.value)}
          />
          <input
            className={field}
            placeholder="Contact person"
            value={draft.contactPerson ?? ""}
            onChange={(e) => set("contactPerson", e.target.value)}
          />
          <div className="flex gap-3">
            <input
              className={field}
              placeholder="City"
              value={draft.city ?? ""}
              onChange={(e) => set("city", e.target.value)}
            />
            <input
              className={field}
              placeholder="Mandi"
              value={draft.mandi ?? ""}
              onChange={(e) => set("mandi", e.target.value)}
            />
          </div>
          <select
            aria-label="Product"
            className={field}
            value={draft.product ?? ""}
            onChange={(e) => set("product", e.target.value)}
          >
            <option value="">Product</option>
            {commodities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <select
              aria-label="Business type"
              className={field}
              value={draft.businessType ?? ""}
              onChange={(e) => set("businessType", e.target.value)}
            >
              <option value="">Business type</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Business activity"
              className={field}
              value={draft.businessActivity ?? ""}
              onChange={(e) => set("businessActivity", e.target.value)}
            >
              <option value="">Activity</option>
              {BUSINESS_ACTIVITY.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <input
              className={field}
              inputMode="numeric"
              placeholder="Vehicles / day"
              value={draft.dailyVehicles ?? ""}
              onChange={(e) => set("dailyVehicles", e.target.value)}
            />
            <input
              className={field}
              placeholder="Buying volume"
              value={draft.buyingVolume ?? ""}
              onChange={(e) => set("buyingVolume", e.target.value)}
            />
          </div>
          <input
            className={field}
            inputMode="tel"
            placeholder="Another number (optional)"
            value={draft.alternateMobile ?? ""}
            onChange={(e) => set("alternateMobile", e.target.value)}
          />

          <div className="pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Who else buys here?</p>
              <button
                type="button"
                onClick={() =>
                  setContacts((prev) => [...prev, { name: "", mobile: "" }])
                }
                className="flex h-9 items-center gap-1 rounded-full border border-gray-200 px-3 text-sm text-gray-700"
              >
                <Plus className="size-3.5" /> Add
              </button>
            </div>
            {contacts.length === 0 && (
              <p className="text-xs text-gray-400">
                Names they give you go into the database as new leads.
              </p>
            )}
            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className={field}
                    placeholder="Name"
                    value={contact.name}
                    onChange={(e) =>
                      setContacts((prev) =>
                        prev.map((c, i) =>
                          i === index ? { ...c, name: e.target.value } : c,
                        ),
                      )
                    }
                  />
                  <input
                    className={field}
                    inputMode="tel"
                    placeholder="Mobile"
                    value={contact.mobile}
                    onChange={(e) =>
                      setContacts((prev) =>
                        prev.map((c, i) =>
                          i === index ? { ...c, mobile: e.target.value } : c,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remove contact"
                    onClick={() =>
                      setContacts((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-gray-200 text-gray-400"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        className="border-t border-gray-100 px-5 pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          disabled={saving || loading}
          onClick={save}
          className="h-12 w-full rounded-full text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
