"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import {
  LEAD_SOURCES,
  ingestLeads,
  previewIngest,
  type IngestPreview,
  type IngestVerdict,
  type LeadCommodity,
  type LeadTeamMember,
} from "../api";

const ACCENT = "#4309ac";

const VERDICT_META: Record<
  IngestVerdict,
  { label: string; className: string }
> = {
  NEW: { label: "New", className: "text-emerald-700" },
  EXISTING_LEAD: { label: "Already a lead", className: "text-amber-700" },
  EXISTING_CUSTOMER: { label: "On MandiPlus", className: "text-blue-700" },
  DUPLICATE_IN_PASTE: { label: "Duplicate", className: "text-gray-500" },
  INVALID: { label: "No number", className: "text-red-600" },
};

/**
 * Where a list becomes leads. Nothing is written until the preview has been
 * seen, because the interesting part of an import is what it would collide
 * with, not what it would create.
 */
export default function IngestPanel({
  team,
  commodities,
  onImported,
}: {
  team: LeadTeamMember[];
  commodities: LeadCommodity[];
  onImported: () => void;
}) {
  const [rawText, setRawText] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [region, setRegion] = useState("");
  const [mandi, setMandi] = useState("");
  const [commodity, setCommodity] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState("SCRAPED_DATA");
  const [assignMode, setAssignMode] = useState<"AUTO" | "MANUAL" | "UNASSIGNED">(
    "AUTO",
  );
  const [assignees, setAssignees] = useState<string[]>([]);
  const [preview, setPreview] = useState<IngestPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const payload = () => ({
    batchLabel:
      batchLabel.trim() ||
      `${region || "Leads"} - ${new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
    rawText,
    source,
    assignMode,
    assigneeUserIds: assignMode === "MANUAL" ? assignees : undefined,
    defaultRegion: region || undefined,
    defaultMandi: mandi || undefined,
    defaultCommodityCode: commodity || undefined,
    defaultRole: role || undefined,
  });

  const runPreview = async () => {
    if (!rawText.trim()) {
      toast.error("Paste the list first");
      return;
    }
    setBusy(true);
    try {
      setPreview(await previewIngest(payload()));
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Could not read that list");
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (assignMode === "MANUAL" && assignees.length === 0) {
      toast.error("Pick who gets these leads");
      return;
    }
    setBusy(true);
    try {
      const result = await ingestLeads(payload());
      const split = Object.entries(result.assignments ?? {})
        .map(([id, n]) => `${team.find((m) => m.id === id)?.name ?? "?"} ${n}`)
        .join(" · ");
      toast.success(
        `${result.inserted} added` +
          (result.merged ? ` · ${result.merged} merged` : "") +
          (result.matchedCustomers
            ? ` · ${result.matchedCustomers} already customers`
            : "") +
          (split ? ` · ${split}` : ""),
      );
      setRawText("");
      setPreview(null);
      onImported();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "h-10 w-full rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30";

  return (
    <section className="grid gap-5 py-5 xl:grid-cols-12">
      <div className="xl:col-span-5">
      <textarea
        value={rawText}
        onChange={(e) => {
          setRawText(e.target.value);
          setPreview(null);
        }}
        rows={8}
        placeholder={"Paste one lead per line, for example:\nJasmat Road Lines — 8949247849, 8949253624\nMateshwari Cargo — 9694949458"}
        className="w-full rounded-2xl border border-gray-200 p-4 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#4309ac]/30"
      />

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input
          className={field}
          placeholder="Batch name"
          value={batchLabel}
          onChange={(e) => setBatchLabel(e.target.value)}
        />
        <input
          className={field}
          placeholder="City / region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
        <input
          className={field}
          placeholder="Mandi"
          value={mandi}
          onChange={(e) => setMandi(e.target.value)}
        />
        <select
          aria-label="Commodity"
          className={field}
          value={commodity}
          onChange={(e) => setCommodity(e.target.value)}
        >
          <option value="">Commodity</option>
          {commodities.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Role"
          className={field}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">Role</option>
          <option value="BUYER">Buyer</option>
          <option value="SUPPLIER">Supplier</option>
          <option value="TRANSPORTER">Transporter</option>
        </select>
        <select
          aria-label="Source"
          className={field}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-gray-400">Assign to</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["AUTO", "Split evenly"],
              ["MANUAL", "Chosen people"],
              ["UNASSIGNED", "Leave unassigned"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setAssignMode(mode)}
              className={`h-10 rounded-full border px-4 text-sm font-medium ${
                assignMode === mode
                  ? "border-transparent text-white"
                  : "border-gray-200 text-gray-700"
              }`}
              style={
                assignMode === mode ? { backgroundColor: ACCENT } : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
        {assignMode === "MANUAL" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {team.map((member) => {
              const on = assignees.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() =>
                    setAssignees((prev) =>
                      on
                        ? prev.filter((id) => id !== member.id)
                        : [...prev, member.id],
                    )
                  }
                  className={`h-9 rounded-full border px-3 text-xs font-medium ${
                    on
                      ? "border-transparent text-white"
                      : "border-gray-200 text-gray-700"
                  }`}
                  style={on ? { backgroundColor: ACCENT } : undefined}
                >
                  {member.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={runPreview}
          disabled={busy || !rawText.trim()}
          className="h-11 flex-1 rounded-full border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-40"
        >
          {busy && !preview ? "Reading…" : "Check the list"}
        </button>
        <button
          type="button"
          onClick={runImport}
          disabled={busy || !preview || preview.willCreate === 0}
          className="h-11 flex-1 rounded-full text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
        >
          {preview ? `Import ${preview.willCreate}` : "Import"}
        </button>
      </div>
      </div>

      <div className="xl:col-span-7">
      {!preview && (
        <p className="hidden rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 xl:block">
          Paste a list and press “Check the list” — what it would create, merge
          or skip appears here before anything is written.
        </p>
      )}
      {preview && (
        <div className="xl:mt-0">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-emerald-700">
              {preview.willCreate} new
            </span>
            {preview.willMerge > 0 && (
              <span className="text-amber-700">
                {preview.willMerge} already leads
              </span>
            )}
            {preview.alreadyCustomers > 0 && (
              <span className="text-blue-700">
                {preview.alreadyCustomers} already on MandiPlus
              </span>
            )}
            {preview.duplicatesInPaste > 0 && (
              <span className="text-gray-500">
                {preview.duplicatesInPaste} duplicated in the list
              </span>
            )}
            {preview.invalid > 0 && (
              <span className="text-red-600">{preview.invalid} unusable</span>
            )}
          </div>

          <div className="mt-3 max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {preview.rows.map((row, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{row.name}</p>
                  <p className="truncate text-xs tabular-nums text-gray-400">
                    {row.phones.join(" · ").replace(/\+91/g, "") || "—"}
                    {row.detail ? ` · ${row.detail}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium ${VERDICT_META[row.verdict].className}`}
                >
                  {VERDICT_META[row.verdict].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
