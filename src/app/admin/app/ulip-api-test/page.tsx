"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Send, Trash2 } from "lucide-react";
import {
  AdminUlipApiTrace,
  AdminUlipTestApiDefinition,
  adminApi,
} from "@/features/admin/api/admin.api";

const fieldClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500";
const labelClass = "grid gap-1.5 text-xs font-medium text-slate-600";
const codeClass =
  "overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-950 p-3 font-mono text-[12px] leading-5 text-slate-100";

// ULIP's production-access test cases. Inputs that identify a person or a
// shipment (licence, chassis/engine, e-way bill) are left blank on purpose:
// they are typed in at test time and never kept in code.
const PRESETS: { title: string; api: string; input: Record<string, string> }[] = [
  { title: "TC-01 · Registered goods vehicle", api: "VAHAN_04", input: { vehiclenumber: "RJ11GC6350" } },
  { title: "TC-02 · Registered goods vehicle", api: "VAHAN_01", input: { vehiclenumber: "RJ11GC6350" } },
  { title: "TC-03 · Vehicle by chassis number", api: "VAHAN_02", input: {} },
  { title: "TC-04 · Vehicle by engine number", api: "VAHAN_03", input: {} },
  { title: "TC-05 · Vehicle by chassis number", api: "VAHAN_05", input: {} },
  { title: "TC-06 · Vehicle by engine number", api: "VAHAN_06", input: {} },
  { title: "TC-07 · FASTag details", api: "FASTAG_01", input: { vehiclenumber: "RJ11GC6350" } },
  { title: "TC-08 · FASTag toll transactions", api: "FASTAG_02", input: { vehiclenumber: "RJ11GC6350" } },
  { title: "TC-09 · Driver licence with date of birth", api: "SARATHI_01", input: {} },
  { title: "TC-10 · Driver licence", api: "SARATHI_02", input: {} },
  { title: "TC-11 · e-Challans for a truck", api: "ECHALLAN_01", input: { vehicleNumber: "RJ11GC6350" } },
  { title: "TC-12 · Toll plazas in a state", api: "TOLL_01", input: { stateName: "Rajasthan" } },
  { title: "TC-13 · e-Way Bill details", api: "EWAYBILL_01", input: {} },
  { title: "TC-14 · Vehicle not on VAHAN", api: "VAHAN_04", input: { vehiclenumber: "RJ99ZZ9999" } },
  { title: "TC-15 · Malformed vehicle number", api: "VAHAN_04", input: { vehiclenumber: "RJ11-GC" } },
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

// Some staging APIs answer with every record they hold (TOLL_01 sends all
// ~1,200 plazas); rendering that whole would freeze the page and no screenshot
// could hold it.
const PREVIEW_LINES = 200;

const clip = (text: string, expanded: boolean) => {
  const lines = text.split("\n");
  if (expanded || lines.length <= PREVIEW_LINES) {
    return { text, hiddenLines: 0 };
  }
  return { text: lines.slice(0, PREVIEW_LINES).join("\n"), hiddenLines: lines.length - PREVIEW_LINES };
};

const formatBytes = (text: string) => {
  const bytes = new Blob([text]).size;
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  const [definitions, setDefinitions] = useState<AdminUlipTestApiDefinition[]>([]);
  const [title, setTitle] = useState(PRESETS[0].title);
  const [api, setApi] = useState(PRESETS[0].api);
  const [input, setInput] = useState<Record<string, string>>(PRESETS[0].input);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let active = true;
    void adminApi.getUlipTestApis().then((response) => {
      if (!active) return;
      if (response.success && response.data) {
        setDefinitions(response.data);
      } else {
        setError(response.message || "ULIP APIs could not be loaded.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const definition = useMemo(
    () => definitions.find((item) => item.api === api) ?? null,
    [definitions, api],
  );
  const titles = useMemo(
    () => Object.fromEntries(definitions.map((item) => [item.api, item.title])),
    [definitions],
  );

  const applyPreset = (index: number) => {
    const preset = PRESETS[index];
    if (!preset) return;
    setTitle(preset.title);
    setApi(preset.api);
    setInput(preset.input);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!definition) {
      setError("Choose an API.");
      return;
    }
    if (!definition.fields.some((field) => input[field.key]?.trim())) {
      setError(`Enter ${definition.fields[0].label.toLowerCase()}.`);
      return;
    }
    setSending(true);
    setError("");
    const response = await adminApi.runUlipApiTest({ api, input });
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
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.4fr]">
            <label className={labelClass}>
              Load a test case
              <select
                className={fieldClass}
                aria-label="Load a test case"
                value={PRESETS.findIndex((preset) => preset.title === title)}
                onChange={(event) => applyPreset(Number(event.target.value))}
              >
                <option value={-1}>Custom</option>
                {PRESETS.map((preset, index) => (
                  <option key={preset.title} value={index}>
                    {preset.title} · {preset.api}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Test case name
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
                onChange={(event) => {
                  setApi(event.target.value);
                  setInput({});
                }}
              >
                {definitions.map((item) => (
                  <option key={item.api} value={item.api}>
                    {item.api} · {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end">
            {(definition?.fields ?? []).map((field) => (
              <label key={field.key} className={labelClass}>
                {field.label}
                <input
                  className={`${fieldClass} ${field.normalize === "identifier" ? "font-mono uppercase" : ""}`}
                  aria-label={field.label}
                  value={input[field.key] ?? ""}
                  placeholder={field.placeholder}
                  maxLength={64}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={sending || !definition}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-60 md:col-start-4"
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
          const xml = findXml(trace.response.body);
          const responseText = trace.response.error
            ? trace.response.error
            : `${trace.response.contentType ? `Content-Type: ${trace.response.contentType}\n\n` : ""}${pretty(trace.response.body)}`;
          const responseView = clip(responseText, Boolean(expandedRuns[run.id]));
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
                    {titles[trace.api] ? `${titles[trace.api]} · ` : ""}
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
                  <pre className={codeClass}>{responseView.text}</pre>
                  {responseView.hiddenLines > 0 ? (
                    <p className="text-xs text-slate-500">
                      Showing the first {PREVIEW_LINES} lines. {responseView.hiddenLines.toLocaleString("en-IN")} more
                      lines ({formatBytes(responseText)} in total) were received.{" "}
                      <button
                        type="button"
                        className="font-medium text-slate-700 underline"
                        onClick={() => setExpandedRuns((current) => ({ ...current, [run.id]: true }))}
                      >
                        Show full response
                      </button>
                    </p>
                  ) : null}
                  {xml ? (
                    <>
                      <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Response XML, indented
                      </h3>
                      <pre className={codeClass}>{clip(indentXml(xml), Boolean(expandedRuns[run.id])).text}</pre>
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
