"use client";

import { useState } from "react";
import { applyActionsAndGeneratePdf, PdfAction } from "./utils/pdfEditor";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type Props = {
  file: File;
  actions: PdfAction[];
  setActions: (a: PdfAction[]) => void;
  canvasWidth: number;
  canvasHeight: number;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  onFileChange: (f: File) => void;
  canUndo: boolean;
  canRedo: boolean;
};

export default function Toolbar({
  file,
  actions,
  setActions: _setActions,
  canvasWidth,
  canvasHeight,
  onUndo,
  onRedo,
  onClearAll,
  onFileChange,
  canUndo,
  canRedo,
}: Props) {
  const [removingPremium, setRemovingPremium] = useState(false);

  async function downloadPdf() {
    if (canvasWidth === 0 || canvasHeight === 0) {
      alert("Canvas dimensions not available. Please wait for the PDF to fully load.");
      return;
    }
    if (actions.length === 0) {
      alert("No redactions to apply. Draw rectangles on the PDF first.");
      return;
    }
    try {
      const bytes = await applyActionsAndGeneratePdf(file, actions, canvasWidth, canvasHeight);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.pdf$/i, "")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  async function removePremiumRow() {
    setRemovingPremium(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/pdf/edit-insurance`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Server responded with ${response.status}`);
      }
      const blob = await response.blob();
      const newFile = new File([blob], file.name, { type: "application/pdf" });

      // Update the file in the parent component to refresh the view
      onFileChange(newFile);

      // Notify user and ask for download
      if (confirm("Premium row removed successfully! Would you like to download the edited PDF?")) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${file.name.replace(/\.pdf$/i, "")}_edited.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error: unknown) {
      console.error("Error removing premium row:", error);
      alert(`Failed to remove premium row: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRemovingPremium(false);
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm flex-wrap">
      {/* History controls */}
      <div className="flex gap-1 border-r border-gray-200 pr-3 mr-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 7 L7 3 L7 5 C11 5 14 8 14 12 C12 9 9 8 7 8 L7 10 Z" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M13 7 L9 3 L9 5 C5 5 2 8 2 12 C4 9 7 8 9 8 L9 10 Z" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          Redo
        </button>
      </div>

      {/* Clear */}
      <button
        onClick={onClearAll}
        disabled={actions.length === 0}
        title="Clear all redactions"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Clear All
      </button>

      {/* Remove Premium Row */}
      <button
        onClick={removePremiumRow}
        disabled={removingPremium}
        title="Remove PREMIUM / TAXES / TOTAL PREMIUM row via backend"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-violet-600 border border-violet-700 rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {removingPremium ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
              <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
            </svg>
            Processing…
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 8h12M2 4h12M2 12h8" strokeLinecap="round" />
              <path d="M11 10l3 3m0-3l-3 3" strokeLinecap="round" />
            </svg>
            Remove Premium Row
          </>
        )}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Redaction count badge */}
      {actions.length > 0 && (
        <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
          {actions.length} redaction{actions.length !== 1 ? "s" : ""}
        </span>
      )}

      {/* Download */}
      <button
        onClick={downloadPdf}
        disabled={actions.length === 0}
        title="Download edited PDF"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 border border-emerald-700 rounded hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 2v8m0 0l-3-3m3 3l3-3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" strokeLinecap="round" />
        </svg>
        Download PDF
      </button>
    </div>
  );
}