"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { Plus } from "lucide-react";
import { addLead, type LeadCommodity } from "../api";

const STATES = [
  "Karnataka",
  "Andhra Pradesh",
  "Telangana",
  "Tamil Nadu",
  "Maharashtra",
  "Delhi NCR",
  "Rajasthan",
  "Uttar Pradesh",
  "Madhya Pradesh",
  "Gujarat",
  "West Bengal",
  "Bihar",
  "Punjab",
  "Haryana",
  "Kerala",
  "Odisha",
  "Assam",
];

/**
 * A lead, typed in between calls.
 *
 * Four fields on purpose: a caller who meets a trader has a name and a number
 * and little else, and anything longer stops being something they will
 * actually do. The number goes through the same dedupe as an import, so
 * adding someone we already hold merges into that lead rather than creating a
 * second copy of them.
 */
export default function AddLeadForm({
  commodities,
  onAdded,
}: {
  commodities: LeadCommodity[];
  onAdded?: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [commodityCode, setCommodityCode] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const phoneLooksRight = digits.length === 10 || digits.length === 12;
  const canSave = name.trim().length > 0 && phoneLooksRight && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await addLead({
        name: name.trim(),
        phone: phone.trim(),
        commodityCode: commodityCode || undefined,
        region: region || undefined,
      });
      if (result.merged > 0) {
        toast.info("We already had that number - added to the existing lead");
      } else if (result.matchedCustomers > 0) {
        // They are already a customer, so the lead lives under On Mandiplus
        // rather than the calling list. Say so, or it looks like nothing
        // happened.
        toast.success(
          `${name.trim()} added - already on Mandiplus, find them under "On Mandiplus"`,
        );
      } else {
        toast.success(`${name.trim()} added to your leads`);
      }
      setName("");
      setPhone("");
      setCommodityCode("");
      setRegion("");
      onAdded?.();
    } catch (err) {
      const message =
        axios.isAxiosError(err) &&
        (err.response?.data as { message?: string } | undefined)?.message;
      toast.error(message || "Could not add that lead");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "h-11 w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30";

  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-base font-semibold text-gray-900">Add a lead</h2>
      <p className="mt-0.5 text-sm text-gray-500">
        Goes straight into your own list.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="lead-name"
            className="mb-1 block text-xs font-medium text-gray-500"
          >
            Name
          </label>
          <input
            id="lead-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shop or trader name"
            className={field}
          />
        </div>

        <div>
          <label
            htmlFor="lead-phone"
            className="mb-1 block text-xs font-medium text-gray-500"
          >
            Mobile number
          </label>
          <input
            id="lead-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="10-digit number"
            className={`${field} tabular-nums`}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {phone.length > 0 && !phoneLooksRight && (
            <p className="mt-1 text-xs text-amber-600">
              That needs to be a 10-digit mobile number
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="lead-commodity"
            className="mb-1 block text-xs font-medium text-gray-500"
          >
            Commodity
          </label>
          <select
            id="lead-commodity"
            value={commodityCode}
            onChange={(e) => setCommodityCode(e.target.value)}
            className={field}
          >
            <option value="">Not sure yet</option>
            {commodities.map((c) => (
              <option key={c.code} value={c.code}>
                {`${c.emoji ?? ""} ${c.label}`.trim()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="lead-state"
            className="mb-1 block text-xs font-medium text-gray-500"
          >
            State <span className="text-gray-400">(optional)</span>
          </label>
          <select
            id="lead-state"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className={field}
          >
            <option value="">Not sure yet</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: "#4309ac" }}
        >
          <Plus className="size-4" />
          {saving ? "Adding…" : "Add lead"}
        </button>
      </div>
    </div>
  );
}
