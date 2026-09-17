"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Send, Trash2 } from "lucide-react";
import {
  AdminUlipApiTrace,
  AdminUlipTestApi,
  adminApi,
} from "@/features/admin/api/admin.api";

const fieldClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500";
const labelClass = "grid gap-1.5 text-xs font-medium text-slate-600";
const codeClass =
  "overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-950 p-3 font-mono text-[12px] leading-5 text-slate-100";

const API_LABELS: Record<AdminUlipTestApi, string> = {
  VAHAN_04: "VAHAN/04 · Vehicle RC details (JSON)",
  VAHAN_01: "VAHAN/01 · Vehicle RC details (XML)",
};

// Starting points for ULIP's production-access test cases; every field stays editable.
const PRESETS: { title: string; api: AdminUlipTestApi; vehicleNumber: string }[] = [
  { title: "TC-01 · Registered goods vehicle", api: "VAHAN_04", vehicleNumber: "RJ11GC6350" },
  { title: "TC-02 · Registered goods vehicle", api: "VAHAN_01", vehicleNumber: "RJ11GC6350" },
  { title: "TC-03 · Vehicle not on VAHAN", api: "VAHAN_04", vehicleNumber: "RJ99ZZ9999" },
  { title: "TC-04 · Vehicle not on VAHAN", api: "VAHAN_01", vehicleNumber: "RJ99ZZ9999" },
  { title: "TC-05 · Malformed vehicle number", api: "VAHAN_04", vehicleNumber: "RJ11-GC" },
];

type Run = {
  id: number;
  title: string;
  trace: AdminUlipApiTrace;
};

const pretty = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);

/** Finds the XML string VAHAN/01 wraps inside its JSON envelope. */
const findXml = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value.trim().startsWith("<") ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findXml(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    return findXml(Object.values(value as Record<string, unknown>));
  }
  return null;
};

const indentXml = (xml: string) => {
  let depth = 0;
  return xml
    .replace(/>\s*</g, ">\n<")
    .split("\n")
    .map((line) => {
      if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
      const padded = `${"  ".repeat(depth)}${line}`;
      if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/<\/[^>]+>$/.test(line)) depth += 1;
      return padded;
    })
    .join("\n");
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  });

function statusTone(status: number | null) {
  if (status === null) return "bg-rose-100 text-rose-800";
  if (status >= 200 && status < 300) return "bg-emerald-100 text-emerald-800";
  return "bg-amber-100 text-amber-800";
}

export default function UlipApiTestPage() {
  const [title, setTitle] = useState(PRESETS[0].title);
  const [api, setApi] = useState<AdminUlipTestApi>(PRESETS[0].api);
  const [vehicleNumber, setVehicleNumber] = useState(PRESETS[0].vehicleNumber);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!vehicleNumber.trim()) {
      setError("Enter a vehicle number.");
      return;
    }
    setSending(true);
    setError("");
    const response = await adminApi.runUlipApiTest({ api, vehicleNumber });
    setSending(false);
    if (!response.success || !response.data) {
      setError(response.message || "The ULIP test call failed.");
      return;
    }
    const trace = response.data;
    setRuns((current) => [
      { id: (current[0]?.id ?? 0) + 1, title: title.trim(), trace },
      ...current,
    ]);
  };

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-950">ULIP API test</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sends one request to DPIIT ULIP from the MandiPlus server and shows the request
            and the response exactly as exchanged. The bearer token is shortened.
          </p>
        </header>

        <form
          onSubmit={send}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={`${preset.api}-${preset.title}`}
                type="button"
                onClick={() => {
                  setTitle(preset.title);
                  setApi(preset.api);
                  setVehicleNumber(preset.vehicleNumber);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:border-slate-400"
              >
                {preset.title} · {preset.api}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_1.4fr_0.8fr_auto] md:items-end">
            <label className={labelClass}>
              Test case
              <input
                className={fieldClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What this case checks"
              />
            </label>
            <label className={labelClass}>
              API
              <select
                className={fieldClass}
                value={api}
                onChange={(event) => setApi(event.target.value as AdminUlipTestApi)}
              >
                {(Object.keys(API_LABELS) as AdminUlipTestApi[]).map((key) => (
                  <option key={key} value={key}>
                    {API_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Vehicle number
              <input
                className={`${fieldClass} font-mono uppercase`}
                value={vehicleNumber}
                onChange={(event) => setVehicleNumber(event.target.value)}
                maxLength={20}
              />
            </label>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {sending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send request
            </button>
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </form>

        {runs.map((run) => {
          const { trace } = run;
          const xml = trace.api === "VAHAN_01" ? findXml(trace.response.body) : null;
          return (
            <section
              key={run.id}
              className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    {run.title ? `${run.title} · ${trace.api}` : trace.api}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {formatTime(trace.startedAt)} IST · {trace.durationMs} ms
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                    ULIP {trace.environment}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(trace.response.status)}`}
                  >
                    {trace.response.status === null
                      ? "No response"
                      : `HTTP ${trace.response.status} ${trace.response.statusText}`.trim()}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove this result"
                    onClick={() =>
                      setRuns((current) => current.filter((item) => item.id !== run.id))
                    }
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid content-start gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Input request
                  </h3>
                  <pre className={codeClass}>
                    {`${trace.request.method} ${trace.request.url}\n\n${Object.entries(
                      trace.request.headers,
                    )
                      .map(([key, value]) => `${key}: ${value}`)
                      .join("\n")}\n\n${pretty(trace.request.body)}`}
                  </pre>
                </div>
                <div className="grid content-start gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Output response
                  </h3>
                  <pre className={codeClass}>
                    {trace.response.error
                      ? trace.response.error
                      : `${trace.response.contentType ? `Content-Type: ${trace.response.contentType}\n\n` : ""}${pretty(trace.response.body)}`}
                  </pre>
                  {xml ? (
                    <>
                      <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Response XML, indented
                      </h3>
                      <pre className={codeClass}>{indentXml(xml)}</pre>
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
