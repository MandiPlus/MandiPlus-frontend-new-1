"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { FileSpreadsheet, Paperclip, Sparkles, X } from "lucide-react";
import { FALLBACK_INDIA_STATES } from "@/features/reference";
import {
  LEAD_SOURCES,
  extractLeads,
  ingestLeads,
  previewIngest,
  type ExtractionResult,
  type IngestLeadItem,
  type IngestPayload,
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

const ACCEPT =
  ".pdf,.xlsx,.xlsm,.xls,.csv,.tsv,.txt,.png,.jpg,.jpeg,.webp,application/pdf,image/*";

/** The shape the commodities table already uses: TENDER_COCONUT, PINEAPPLE. */
function toCommodityCode(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * Where a list becomes leads. Nothing is written until the preview has been
 * seen, because the interesting part of an import is what it would collide
 * with, not what it would create.
 *
 * A file takes one extra hop: it is read into candidate rows first, and those
 * rows then go through exactly the same preview and import a paste does. The
 * model only proposes structure; every phone still passes our own normaliser.
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
  const [state, setState] = useState("");
  const [mandi, setMandi] = useState("");
  const [commodity, setCommodity] = useState("");
  const [otherCommodity, setOtherCommodity] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState("SCRAPED_DATA");
  const [assignMode, setAssignMode] = useState<"AUTO" | "MANUAL" | "UNASSIGNED">(
    "AUTO",
  );
  const [assignees, setAssignees] = useState<string[]>([]);
  const [preview, setPreview] = useState<IngestPreview | null>(null);
  const [extracted, setExtracted] = useState<ExtractionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stateLabel =
    FALLBACK_INDIA_STATES.find((s) => s.value === state)?.label ?? "";
  const customCode = toCommodityCode(otherCommodity);
  const commodityCode =
    commodity === "OTHER" ? customCode || "OTHER" : commodity;

  const defaults = () => ({
    defaultRegion: stateLabel || undefined,
    defaultMandi: mandi || undefined,
    defaultCommodityCode: commodityCode || undefined,
    defaultRole: role || undefined,
  });

  const payload = (): IngestPayload => ({
    batchLabel:
      batchLabel.trim() ||
      `${stateLabel || "Leads"} - ${new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
    // Rows read from a file carry their own region/commodity per lead, which a
    // round trip through the text box would flatten away. Only one is ever sent.
    ...(extracted
      ? { leads: extracted.leads as IngestLeadItem[] }
      : { rawText }),
    source,
    assignMode,
    assigneeUserIds: assignMode === "MANUAL" ? assignees : undefined,
    ...defaults(),
  });

  const readFiles = async (files: File[]) => {
    if (!files.length) return;
    setReading(true);
    setPreview(null);
    try {
      const result = await extractLeads(files, defaults());
      setExtracted(result);
      setRawText(result.rawText);
      if (!batchLabel.trim() && files[0]) {
        setBatchLabel(files[0].name.replace(/\.[^.]+$/, "").slice(0, 80));
      }
      result.warnings.forEach((warning) => toast.warn(warning));
      if (result.leads.length) {
        toast.success(`Read ${result.leads.length} contacts`);
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ?? "Could not read that file",
      );
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runPreview = async () => {
    if (!extracted && !rawText.trim()) {
      toast.error("Paste a list or attach a file first");
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

  /**
   * Every row the import will actually act on. Gating on new leads alone meant
   * a list of people who are already on Mandiplus, or already leads, left the
   * Import button dead with no explanation - the import was refused for rows
   * it would have handled perfectly well. A merge enriches the lead we hold,
   * and an existing customer is worth recording as one.
   */
  const willImport = preview
    ? preview.willCreate + preview.willMerge + preview.alreadyCustomers
    : 0;

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
      // Lead with the total. "0 added · 1 already customers" reads as a
      // failure when the import did exactly what was asked of it.
      const handled =
        result.inserted + result.merged + (result.matchedCustomers ?? 0);
      const detail = [
        result.inserted ? `${result.inserted} new` : null,
        result.merged ? `${result.merged} merged into existing leads` : null,
        result.matchedCustomers
          ? `${result.matchedCustomers} already on Mandiplus`
          : null,
        split || null,
      ]
        .filter(Boolean)
        .join(" · ");
      toast.success(
        `Imported ${handled}${detail ? ` — ${detail}` : ""}`,
      );
      setRawText("");
      setExtracted(null);
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFiles(Array.from(e.dataTransfer.files).slice(0, 5));
          }}
          className={`rounded-2xl border transition-colors ${
            dragging
              ? "border-[#4309ac] bg-[#4309ac]/5"
              : "border-gray-200 bg-white"
          }`}
        >
          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              // Typing takes over from the file: the text is now the source.
              setExtracted(null);
              setPreview(null);
            }}
            rows={8}
            placeholder={
              "Paste one lead per line, for example:\nJasmat Road Lines — 8949247849, 8949253624\nMateshwari Cargo — 9694949458\n\n…or drop a PDF, Excel sheet, CSV, or a photo of the list here."
            }
            className="w-full resize-y bg-transparent p-4 font-mono text-xs focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-3 py-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) =>
                void readFiles(Array.from(e.target.files ?? []).slice(0, 5))
              }
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={reading}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-700 disabled:opacity-40"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {reading ? "Reading the file…" : "Attach PDF, Excel, CSV, photo"}
            </button>
            {extracted && (
              <button
                type="button"
                onClick={() => {
                  setExtracted(null);
                  setRawText("");
                  setPreview(null);
                }}
                className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-xs text-gray-400 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {extracted && (
          <div className="mt-3 rounded-2xl border border-[#4309ac]/20 bg-[#4309ac]/[0.03] p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#4309ac]">
              <Sparkles className="h-3.5 w-3.5" />
              Read {extracted.meta.kept} contacts from{" "}
              {extracted.meta.files.map((f) => f.name).join(", ")}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-500">
              {extracted.meta.files.map((file) => (
                <li key={file.name} className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3 w-3 shrink-0 text-gray-400" />
                  {file.name} — {file.detail}
                </li>
              ))}
              {extracted.meta.mapping.map((line) => (
                <li key={line} className="pl-4.5">
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-gray-400">
              Edit the box above to take over by hand — that replaces what was
              read.
            </p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <input
            className={field}
            placeholder="Batch name"
            value={batchLabel}
            onChange={(e) => setBatchLabel(e.target.value)}
          />
          <select
            aria-label="State"
            className={field}
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">State</option>
            {FALLBACK_INDIA_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
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

        {commodity === "OTHER" && (
          <div className="mt-3">
            <input
              className={field}
              placeholder="Which commodity? e.g. Papaya"
              value={otherCommodity}
              onChange={(e) => setOtherCommodity(e.target.value)}
            />
            {customCode && (
              <p className="mt-1 pl-4 text-[11px] text-gray-400">
                Saved as{" "}
                <span className="font-mono text-gray-600">{customCode}</span> —
                reuse the same spelling so these leads stay filterable together.
              </p>
            )}
          </div>
        )}

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
            disabled={busy || reading || (!extracted && !rawText.trim())}
            className="h-11 flex-1 rounded-full border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-40"
          >
            {busy && !preview ? "Reading…" : "Check the list"}
          </button>
          <button
            type="button"
            onClick={runImport}
            disabled={busy || !preview || willImport === 0}
            className="h-11 flex-1 rounded-full text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}
          >
            {preview ? `Import ${willImport}` : "Import"}
          </button>
        </div>
      </div>

      <div className="xl:col-span-7">
        {!preview && (
          <p className="hidden rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 xl:block">
            Paste a list or drop a file, then press “Check the list” — what it
            would create, merge or skip appears here before anything is written.
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
              {(preview.rows ?? []).map((row, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 py-2"
                >
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
