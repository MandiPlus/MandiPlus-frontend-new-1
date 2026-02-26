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
  canUndo,
  canRedo
}: Props) {
  const [removingPremium, setRemovingPremium] = useState(false);

  async function downloadPdf() {
    if (canvasWidth === 0 || canvasHeight === 0) {
      alert("Canvas dimensions not available. Please wait for PDF to load.");
      return;
    }

    if (actions.length === 0) {
      alert("No redactions to apply. Please draw rectangles on the PDF first.");
      return;
    }

    try {
      const bytes = await applyActionsAndGeneratePdf(
        file,
        actions,
        canvasWidth,
        canvasHeight
      );

      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const originalName = file.name.replace(/\.pdf$/i, "");
      a.download = `${originalName}.pdf`;
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
        throw new Error(text || `Server error: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const originalName = file.name.replace(/\.pdf$/i, "");
      a.download = `${originalName}_edited.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      console.error("Error removing premium row:", error);
      const msg = error instanceof Error ? error.message : String(error);
      alert(`Failed to remove premium row: ${msg}`);
    } finally {
      setRemovingPremium(false);
    }
  }

  return (
    <div className="flex gap-3 items-center border p-3 rounded bg-gray-50 flex-wrap">
      {/* Undo/Redo Section */}
      <div className="flex gap-2 border-r pr-3">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷ Redo
        </button>
      </div>

      {/* Clear Section */}
      <button
        onClick={onClearAll}
        disabled={actions.length === 0}
        className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-50 text-red-600 border-red-300 transition-colors"
        title="Clear all redactions"
      >
        🗑️ Clear All
      </button>

      {/* Remove Premium Row — calls backend */}
      <button
        onClick={removePremiumRow}
        disabled={removingPremium}
        className="px-4 py-1 border rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Send to backend to remove PREMIUM / TAXES / TOTAL PREMIUM row"
      >
        {removingPremium ? "⏳ Processing..." : "✂️ Remove Premium Row"}
      </button>

      {/* Download Section */}
      <button
        onClick={downloadPdf}
        className="px-4 py-1 border rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
        disabled={actions.length === 0}
        title="Download edited PDF"
      >
        ⬇️ Download PDF
      </button>

      {/* Status */}
      {actions.length > 0 && (
        <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded border">
          {actions.length} redaction{actions.length !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}