"use client";

import { useState, useEffect } from "react";
import PdfUploader from "./PdfUploader";
import PdfCanvas from "./PdfCanvas";
import Toolbar from "./Toolbar";
import { PdfAction } from "./utils/pdfEditor";

export default function PdfEditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [actions, setActions] = useState<PdfAction[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  // Undo/Redo history
  const [history, setHistory] = useState<PdfAction[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  /* --------------------------------------------------
     KEYBOARD SHORTCUTS
  -------------------------------------------------- */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      else if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Ctrl+Y or Cmd+Y for redo (alternative)
      else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyIndex, history]);

  function handleCanvasDimensionsChange(width: number, height: number) {
    setCanvasWidth(width);
    setCanvasHeight(height);
  }

  function handleActionsChange(newActions: PdfAction[]) {
    // Only add to history if actions actually changed
    if (JSON.stringify(newActions) === JSON.stringify(actions)) {
      return;
    }

    // Remove any "future" history when new action is added
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newActions);

    // Keep history limited to last 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }

    setHistory(newHistory);
    setActions(newActions);
  }

  function undo() {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setActions(history[newIndex]);
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setActions(history[newIndex]);
    }
  }

  function clearAll() {
    handleActionsChange([]);
  }

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  function handleFileChange(newFile: File) {
    // We add a timestamp to the file name to force react-pdf to see it as a "new" file 
    // and re-render completely. Otherwise, it might cache the old PDF buffer.
    const fileWithTimestamp = new File([newFile], `${Date.now()}_${newFile.name}`, { type: newFile.type });

    // Reset everything when new file is uploaded or edited backend-side
    setFile(fileWithTimestamp);
    setPageNumber(1);
    setActions([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setCanvasWidth(0);
    setCanvasHeight(0);
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 lg:p-8 text-slate-900">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document Editor</h1>
            <p className="text-sm text-slate-500 mt-1">Securely redact and modify insurance documents</p>
          </div>

          {file && (
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-sans shadow-sm font-medium text-slate-600">Ctrl+Z</kbd> Undo</span>
                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-sans shadow-sm font-medium text-slate-600">Ctrl+Shift+Z</kbd> Redo</span>
              </div>

              <div className="h-4 w-px bg-slate-200 hidden lg:block" />

              <button
                onClick={() => {
                  if (actions.length > 0) {
                    if (confirm("Are you sure? All unsaved changes will be lost.")) {
                      setFile(null);
                    }
                  } else {
                    setFile(null);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <svg className="w-4 h-4 text-slate-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 4h8v8H4z" strokeLinejoin="round" />
                  <path d="M6 4V2c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v2m-6 8v2c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2" strokeLinejoin="round" />
                </svg>
                Change Document
              </button>
            </div>
          )}
        </div>

        {/* Content Section */}
        {!file ? (
          <div className="mt-8">
            <PdfUploader onUpload={handleFileChange} />
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="border-b border-slate-200 bg-slate-50/50">
              <Toolbar
                file={file}
                actions={actions}
                setActions={handleActionsChange}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                onUndo={undo}
                onRedo={redo}
                onClearAll={clearAll}
                onFileChange={handleFileChange}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            </div>

            <div className="p-6 bg-slate-100/50 flex justify-center overflow-auto min-h-[600px]">
              <PdfCanvas
                file={file}
                pageNumber={pageNumber}
                onPageChange={setPageNumber}
                actions={actions}
                setActions={handleActionsChange}
                onCanvasDimensionsChange={handleCanvasDimensionsChange}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}