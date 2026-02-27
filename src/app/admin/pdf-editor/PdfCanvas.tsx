"use client";

import { useEffect, useRef, useState } from "react";
import { loadPdfPage } from "./utils/pdfLoader";
import { PdfAction } from "./utils/pdfEditor";

type Props = {
  file: File;
  pageNumber: number;
  onPageChange: (page: number) => void;
  actions: PdfAction[];
  setActions: (a: PdfAction[]) => void;
  onCanvasDimensionsChange?: (width: number, height: number) => void;
};

export default function PdfCanvas({
  file,
  pageNumber,
  onPageChange,
  actions,
  setActions,
  onCanvasDimensionsChange,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);

  /* --------------------------------------------------
     CREATE NEW CANVAS ON FILE / PAGE CHANGE
  -------------------------------------------------- */
  useEffect(() => {
    if (!wrapperRef.current) return;

    // remove old canvas completely
    wrapperRef.current.innerHTML = "";

    const newCanvas = document.createElement("canvas");
    wrapperRef.current.appendChild(newCanvas);

    setCanvasEl(newCanvas);
  }, [file, pageNumber]);

  /* --------------------------------------------------
     LOAD PDF SAFELY
  -------------------------------------------------- */
  useEffect(() => {
    if (!canvasEl) return;

    loadPdfPage(file, pageNumber, canvasEl).then((res) => {
      if (!res || !overlayRef.current) return;

      // Match overlay CSS size to the rendered PDF canvas CSS size
      overlayRef.current.style.width = canvasEl.style.width;
      overlayRef.current.style.height = canvasEl.style.height;

      // Keep overlay internal buffer in device pixels for crisp drawing
      overlayRef.current.width = canvasEl.width;
      overlayRef.current.height = canvasEl.height;
      setTotalPages(res.totalPages);

      // Pass canvas dimensions to parent
      if (onCanvasDimensionsChange) {
        // IMPORTANT: actions are recorded in CSS pixel coordinates (mouse/pointer),
        // so send CSS dimensions (not device pixels) to the PDF generator.
        const cssW = Number.parseFloat(canvasEl.style.width || "0") || 0;
        const cssH = Number.parseFloat(canvasEl.style.height || "0") || 0;
        onCanvasDimensionsChange(cssW, cssH);
      }

      // Redraw all white rectangles for current page
      redrawActions();
    });
  }, [canvasEl, file, pageNumber]);

  /* --------------------------------------------------
     REDRAW WHEN ACTIONS CHANGE
  -------------------------------------------------- */
  useEffect(() => {
    redrawActions();
  }, [actions]);

  /* --------------------------------------------------
     REDRAW SAVED ACTIONS ON OVERLAY
  -------------------------------------------------- */
  function redrawActions() {
    if (!overlayRef.current) return;

    const ctx = overlayRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

    // Scale drawing so actions (CSS px) map correctly to device-pixel canvas buffer
    const rect = overlayRef.current.getBoundingClientRect();
    const scaleX = rect.width ? overlayRef.current.width / rect.width : 1;
    const scaleY = rect.height ? overlayRef.current.height / rect.height : 1;
    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // Draw all white rectangles for current page
    actions
      .filter(a => a.page === pageNumber && a.type === "rect")
      .forEach(a => {
        ctx.fillStyle = "white";
        ctx.fillRect(a.x, a.y, a.w, a.h);

        // Add subtle border to see white rectangles clearly
        ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(a.x, a.y, a.w, a.h);
      });

    ctx.restore();
  }

  function getPointerPos(e: React.PointerEvent) {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!overlayRef.current) return;
    overlayRef.current.setPointerCapture(e.pointerId);
    setStart(getPointerPos(e));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start || !overlayRef.current) return;

    const ctx = overlayRef.current.getContext("2d")!;
    const { x, y } = getPointerPos(e);

    // Redraw existing actions first
    redrawActions();

    // Draw current selection rectangle in CSS coordinates (transform handles scaling)
    const rect = overlayRef.current.getBoundingClientRect();
    const scaleX = rect.width ? overlayRef.current.width / rect.width : 1;
    const scaleY = rect.height ? overlayRef.current.height / rect.height : 1;
    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(start.x, start.y, x - start.x, y - start.y);
    ctx.restore();
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!start || !overlayRef.current) return;

    const { x, y } = getPointerPos(e);

    const rect = {
      x: Math.min(start.x, x),
      y: Math.min(start.y, y),
      w: Math.abs(x - start.x),
      h: Math.abs(y - start.y),
    };

    if (rect.w > 5 && rect.h > 5) {
      setActions([
        ...actions,
        { type: "rect" as const, page: pageNumber, ...rect },
      ]);
    }

    setStart(null);
  }

  return (
    <div className="flex flex-col items-center space-y-6 w-full max-w-full overflow-x-auto pb-4">
      <div
        className="relative bg-white shadow-md ring-1 ring-slate-200 overflow-hidden shrink-0"
        style={{
          width: canvasEl?.style.width,
          height: canvasEl?.style.height,
        }}
      >
        <div ref={wrapperRef} />
        <canvas
          ref={overlayRef}
          className="absolute top-0 left-0 cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
          <button
            disabled={pageNumber === 1}
            onClick={() => onPageChange(pageNumber - 1)}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Previous Page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="text-sm font-medium text-slate-600 min-w-[5rem] text-center">
            {pageNumber} <span className="text-slate-400 font-normal">/ {totalPages}</span>
          </span>

          <button
            disabled={pageNumber === totalPages}
            onClick={() => onPageChange(pageNumber + 1)}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Next Page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}