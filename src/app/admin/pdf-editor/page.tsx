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
    <div className="p-6 space-y-4 bg-gray-100 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit Insurance PDF</h1>

        {file && (
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-sm text-gray-600">
              <kbd className="px-2 py-1 bg-gray-100 border rounded">Ctrl+Z</kbd>
              <span>Undo</span>
              <kbd className="px-2 py-1 bg-gray-100 border rounded ml-2">Ctrl+Shift+Z</kbd>
              <span>Redo</span>
            </div>

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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" strokeLinejoin="round" />
                <path d="M9 2v4h4" strokeLinejoin="round" />
              </svg>
              Change PDF
            </button>
          </div>
        )}
      </div>

      {!file && <PdfUploader onUpload={handleFileChange} />}

      {file && (
        <>
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

          <PdfCanvas
            file={file}
            pageNumber={pageNumber}
            onPageChange={setPageNumber}
            actions={actions}
            setActions={handleActionsChange}
            onCanvasDimensionsChange={handleCanvasDimensionsChange}
          />
        </>
      )}
    </div>
  );
}