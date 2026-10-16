'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  MessageSquareText,
  PanelRightOpen,
  Send,
  Sparkles,
  Table2,
  UserRound,
  X,
} from 'lucide-react';
import {
  AiReportDataQuestionResponse,
  AiReportMessage,
  AiReportPreviewResponse,
  adminApi,
} from '@/features/admin/api/admin.api';
import { useAdmin } from '@/features/admin/context/AdminContext';

type ChatMessage = AiReportMessage & {
  id: string;
  status?: AiReportPreviewResponse['status'];
};

type DataAnswer = AiReportDataQuestionResponse & {
  id: string;
  question: string;
};

const STARTERS = [
  'Yesterday tender coconut invoice details',
  'Pending insurance payments with invoice, customer, premium and balance',
  'Last month verified invoices by state with premium and GMV',
  'Rejected invoices this month with reason',
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fileNameFromDisposition(disposition?: string): string {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || `ai-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function formatColumnLabel(column: string): string {
  return column
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactAssistantMessage(response: AiReportPreviewResponse): string {
  if (response.status === 'needs_clarification') {
    return response.clarifyingQuestions?.join('\n') || response.assistantMessage;
  }

  if (response.status === 'refuse') {
    return response.assistantMessage || 'I cannot generate that report.';
  }

  const issueCount = response.verification?.issues?.length || 0;
  if (issueCount > 0) {
    return `Preview ready with ${response.rowCount || 0} rows. ${issueCount} check ${issueCount === 1 ? 'needs' : 'need'} review in Details.`;
  }

  return `Preview ready with ${response.rowCount || 0} rows. Export will download the data-only Excel.`;
}

export default function AdminAiReportsPage() {
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const { isAuthenticated, loading, canAccessSection } = useAdmin();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Ask for the report you want. I will generate a preview first, then export the data.',
    },
  ]);
  const [result, setResult] = useState<AiReportPreviewResponse | null>(null);
  const [lastPrompt, setLastPrompt] = useState('');
  const [dataQuestion, setDataQuestion] = useState('');
  const [dataAnswers, setDataAnswers] = useState<DataAnswer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAskingData, setIsAskingData] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const requestHistory = useMemo<AiReportMessage[]>(
    () =>
      messages
        .filter((message) => message.id !== 'welcome')
        .map(({ role, content }) => ({ role, content }))
        .slice(-8),
    [messages],
  );

  const columns = useMemo(() => {
    const rows = result?.rows || [];
    const keys = new Set<string>();
    rows.slice(0, 30).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return [...keys];
  }, [result]);

  const canExport = Boolean(result?.status === 'ready' && !isRunning);
  const canAskData = Boolean(result?.status === 'ready' && result.reportId && !isRunning);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isRunning]);

  useEffect(() => {
    if (result?.status === 'ready' && columns.length > 0) {
      setSelectedExportColumns(columns);
    } else {
      setSelectedExportColumns([]);
      setShowExportModal(false);
    }
  }, [columns, result?.status]);

  if (!loading && (!isAuthenticated || !canAccessSection('reports'))) {
    router.replace('/admin/dashboard');
    return null;
  }

  async function submitPrompt(nextPrompt?: string) {
    const value = (nextPrompt || prompt).trim();
    if (!value || isRunning) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: value,
    };

    setMessages((current) => [...current, userMessage]);
    setLastPrompt(value);
    setPrompt('');
    setError(null);
    setIsRunning(true);

    try {
      const response = await adminApi.previewAiReport({
        message: value,
        history: requestHistory,
        includeSql: true,
      });

      setResult(response);
      setDataAnswers([]);
      setDataQuestion('');
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          status: response.status,
          content: compactAssistantMessage(response),
        },
      ]);
    } catch (runError: any) {
      const message =
        runError?.response?.data?.message ||
        runError?.message ||
        'Failed to run AI report.';
      const readableMessage = Array.isArray(message) ? message.join(', ') : message;
      setError(readableMessage);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          status: 'refuse',
          content: readableMessage,
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  }

  async function askCurrentData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = dataQuestion.trim();
    if (!question || !result?.reportId || isAskingData) return;

    setIsAskingData(true);
    setError(null);
    setDataQuestion('');

    try {
      const answer = await adminApi.askAiReportData({
        reportId: result.reportId,
        question,
      });
      setDataAnswers((current) => [
        ...current,
        {
          ...answer,
          id: `data-answer-${Date.now()}`,
          question,
        },
      ]);
    } catch (askError: any) {
      const message =
        askError?.response?.data?.message ||
        askError?.message ||
        'Failed to answer from this report data.';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setIsAskingData(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPrompt();
  }

  function toggleExportColumn(column: string) {
    setSelectedExportColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column],
    );
  }

  function openExportColumns() {
    if (!canExport || isExporting) return;
    setSelectedExportColumns((current) => (current.length ? current : columns));
    setShowExportModal(true);
  }

  async function exportReport() {
    if (!lastPrompt || result?.status !== 'ready' || isExporting) return;
    if (columns.length > 0 && selectedExportColumns.length === 0) {
      setError('Select at least one column to export.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/admin/ai-reports/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...(result.reportId ? { reportId: result.reportId } : {}),
          message: lastPrompt,
          history: requestHistory,
          selectedColumns: selectedExportColumns,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to export report.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileNameFromDisposition(response.headers.get('content-disposition') || undefined);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (exportError: any) {
      setError(exportError?.message || 'Failed to export report.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="h-[calc(100vh-116px)] min-h-[680px] overflow-hidden bg-[#f7f8f4] text-slate-950">
      <div className="grid h-full grid-cols-1 overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
          <header className="shrink-0 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-normal text-slate-950">AI Reports</h1>
                  <span className="rounded-md bg-[#e7f0ed] px-2 py-1 text-xs font-semibold text-[#155e63]">
                    Preview first
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Create new reports here. Ask data questions on the preview.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#155e63] text-white">
                <Database className="h-5 w-5" />
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[84%] rounded-lg px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                      message.role === 'user'
                        ? 'bg-[#155e63] text-white'
                        : 'border border-slate-200 bg-[#fbfbf8] text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#f59e0b] text-white">
                      <UserRound className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}
              {isRunning && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#fbfbf8] px-3 py-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-[#155e63]" />
                  Planning, querying, checking preview
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white p-4">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => submitPrompt(starter)}
                  className="shrink-0 rounded-md border border-slate-200 bg-[#fbfbf8] px-3 py-2 text-left text-xs font-medium text-slate-600 hover:border-[#155e63] hover:text-[#155e63]"
                >
                  {starter}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={2}
                placeholder="Generate a new report..."
                className="max-h-28 min-h-[58px] flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-[#155e63] focus:ring-2 focus:ring-[#155e63]/15"
              />
              <button
                type="submit"
                disabled={isRunning || !prompt.trim()}
                className="flex h-[58px] w-12 items-center justify-center rounded-lg bg-[#155e63] text-white hover:bg-[#104b4f] disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Send report prompt"
              >
                {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </form>
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-[#f7f8f4]">
          <header className="shrink-0 border-b border-slate-200 bg-[#fdfdf9] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-[#155e63]" />
                  <h2 className="truncate text-xl font-semibold text-slate-950">
                    {result?.reportTitle || 'Report Preview'}
                  </h2>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                    <Table2 className="h-3.5 w-3.5" />
                    {result?.rowCount ?? 0} matching rows
                  </span>
                  {Boolean(result?.rows?.length) && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                      <PanelRightOpen className="h-3.5 w-3.5" />
                      {result?.rows?.length ?? 0} shown
                    </span>
                  )}
                  {columns.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                      <Database className="h-3.5 w-3.5" />
                      {columns.length} columns
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    {result?.status || 'waiting'}
                  </span>
                  {result?.truncated && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      preview capped
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={openExportColumns}
                disabled={!canExport || isExporting}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExporting ? 'Exporting' : 'Export data'}
              </button>
            </div>
          </header>

          {error && (
            <div className="mx-5 mt-4 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Table2 className="h-4 w-4 text-[#155e63]" />
                  Data Preview
                </div>
                <span className="text-xs font-medium text-slate-500">
                  Export downloads full approved query, up to 10k rows
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {result?.rows?.length && columns.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr>
                        {columns.map((column) => (
                          <th
                            key={column}
                            className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-normal text-slate-500"
                          >
                            {formatColumnLabel(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {result.rows.map((row, index) => (
                        <tr key={index} className="hover:bg-[#f7f8f4]">
                          {columns.map((column) => (
                            <td key={column} className="max-w-[320px] px-4 py-3 text-slate-700">
                              <span className="line-clamp-2 break-words">{formatValue(row[column])}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex h-full min-h-[360px] items-center justify-center px-6 text-center">
                    <div>
                      <PanelRightOpen className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">
                        {result?.status === 'needs_clarification'
                          ? result.clarifyingQuestions?.join(' ')
                          : 'Ask for a report to see the table preview.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <MessageSquareText className="h-4 w-4 text-[#155e63]" />
                  Ask this data
                </div>
                <span className="text-xs font-medium text-slate-500">
                  Answers use the current exported dataset
                </span>
              </div>

              <div className="space-y-3 p-4">
                <div className="max-h-36 space-y-2 overflow-auto pr-1">
                  {dataAnswers.length ? (
                    dataAnswers.map((answer) => (
                      <div key={answer.id} className="rounded-md bg-[#f7f8f4] px-3 py-2 text-sm">
                        <p className="font-medium text-slate-900">{answer.question}</p>
                        <p className="mt-1 leading-6 text-slate-700">{answer.answer}</p>
                        {answer.calculations.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            {answer.calculations.join(' / ')}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      {result?.status === 'ready'
                        ? result.reportId
                          ? 'Ask totals, averages, counts, or quick checks without losing this report.'
                          : 'Refresh the preview to enable data Q&A.'
                        : 'Generate a report preview first, then ask questions about its data.'}
                    </p>
                  )}
                </div>

                <form onSubmit={askCurrentData} className="flex items-center gap-2">
                  <input
                    value={dataQuestion}
                    onChange={(event) => setDataQuestion(event.target.value)}
                    disabled={!canAskData || isAskingData}
                    placeholder="Ask about the current data..."
                    className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm outline-none focus:border-[#155e63] focus:ring-2 focus:ring-[#155e63]/15 disabled:bg-slate-50"
                  />
                  <button
                    type="submit"
                    disabled={!canAskData || isAskingData || !dataQuestion.trim()}
                    className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#155e63] text-white hover:bg-[#104b4f] disabled:cursor-not-allowed disabled:bg-slate-300"
                    aria-label="Ask this report data"
                  >
                    {isAskingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-[#fdfdf9] px-5 py-3">
            <details className="group rounded-lg border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800">
                Details, checks and SQL
                <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
              </summary>
              <div className="grid max-h-72 gap-4 overflow-auto border-t border-slate-200 p-4 text-sm lg:grid-cols-3">
                <div>
                  <div className="mb-2 font-semibold text-slate-900">Summary</div>
                  <p className="leading-6 text-slate-600">
                    {result?.verification?.user_summary || result?.assistantMessage || 'No run yet.'}
                  </p>
                </div>
                <div>
                  <div className="mb-2 font-semibold text-slate-900">Assumptions</div>
                  <div className="space-y-2 leading-6 text-slate-600">
                    {(result?.assumptions?.length ? result.assumptions : ['None']).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                  {Boolean(result?.verification?.issues?.length) && (
                    <>
                      <div className="mb-2 mt-4 font-semibold text-amber-800">Issues</div>
                      <div className="space-y-2 leading-6 text-amber-700">
                        {result?.verification?.issues.map((issue) => (
                          <p key={issue}>{issue}</p>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <div className="mb-2 font-semibold text-slate-900">SQL</div>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                    {result?.sql || 'No SQL yet.'}
                  </pre>
                </div>
              </div>
            </details>
          </div>
        </section>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-[2150] flex items-center justify-center p-3 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setShowExportModal(false)}
            aria-label="Close export columns"
          />
          <div className="relative flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Select Export Columns</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Choose the report fields you want in the Excel export.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 px-5 py-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedExportColumns(columns)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedExportColumns([])}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear all
                </button>
                <span className="self-center text-sm text-slate-500">
                  {selectedExportColumns.length} columns selected
                </span>
              </div>

              <div className="grid max-h-[48vh] grid-cols-1 gap-3 overflow-y-auto rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {columns.map((column) => (
                  <label
                    key={column}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExportColumns.includes(column)}
                      onChange={() => toggleExportColumn(column)}
                      className="h-4 w-4 rounded border-slate-300 text-[#155e63] focus:ring-[#155e63]"
                    />
                    <span className="min-w-0 truncate">{formatColumnLabel(column)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={exportReport}
                disabled={isExporting || selectedExportColumns.length === 0}
                className="rounded-xl bg-[#155e63] px-4 py-2 text-sm font-semibold text-white hover:bg-[#104b4f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? 'Exporting...' : 'Export Selected Columns'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
