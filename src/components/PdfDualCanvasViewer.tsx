"use client";

import React, { useEffect, useRef, useState } from "react";
import { CommercialDiff, SourceLocation } from "@/lib/types";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  ChevronLeft, 
  ChevronRight, 
  Crosshair, 
  ScanLine
} from "lucide-react";

interface PdfDualCanvasViewerProps {
  originalPdfUrl: string;
  revisedPdfUrl: string;
  activeDiff: CommercialDiff | null;
  allDiffs: CommercialDiff[];
  onSelectDiff: (diff: CommercialDiff) => void;
}

/**
 * Global PDF.js singleton and document cache.
 * Ensures that the PDF.js worker is initialized only once and documents are cached 
 * in memory to allow for instant page transitions.
 */
let cachedPdfJsPromise: Promise<any> | null = null;
const globalPdfDocCache = new Map<string, Promise<any>>();

function getPdfJs() {
  if (!cachedPdfJsPromise) {
    cachedPdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      if (typeof window !== "undefined") {
        const workerUrl = new URL("/pdf.worker.min.mjs", window.location.origin).toString();
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      }
      return pdfjs;
    });
  }
  return cachedPdfJsPromise;
}

function getLoadedPdfDoc(url: string) {
  if (!globalPdfDocCache.has(url)) {
    const docPromise = getPdfJs().then((pdfjs) => {
      if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("/pdf.worker.min.mjs", window.location.origin).toString();
      }
      return pdfjs.getDocument({ url, isEvalSupported: false }).promise;
    });
    globalPdfDocCache.set(url, docPromise);
  }
  return globalPdfDocCache.get(url)!;
}

export function PdfDualCanvasViewer({
  originalPdfUrl,
  revisedPdfUrl,
  activeDiff,
  allDiffs,
  onSelectDiff,
}: PdfDualCanvasViewerProps) {
  const [scale, setScale] = useState(2.0);
  const [origPageNum, setOrigPageNum] = useState(1);
  const [revPageNum, setRevPageNum] = useState(1);
  const [totalOrigPages, setTotalOrigPages] = useState(1);
  const [totalRevPages, setTotalRevPages] = useState(1);

  const canvasOrigRef = useRef<HTMLCanvasElement>(null);
  const canvasRevRef = useRef<HTMLCanvasElement>(null);
  const containerOrigRef = useRef<HTMLDivElement>(null);
  const containerRevRef = useRef<HTMLDivElement>(null);

  const [origDims, setOrigDims] = useState({ width: 612, height: 792 });
  const [revDims, setRevDims] = useState({ width: 612, height: 792 });

  // Automatically flip page and smoothly scroll to bounding box when active diff changes
  useEffect(() => {
    if (activeDiff) {
      if (activeDiff.originalLocation?.page) {
        setOrigPageNum(activeDiff.originalLocation.page);
      }
      if (activeDiff.revisedLocation?.page) {
        setRevPageNum(activeDiff.revisedLocation.page);
      }

      // Smooth scroll container to highlight coordinates
      const timer = setTimeout(() => {
        if (activeDiff.originalLocation?.bbox && containerOrigRef.current) {
          const targetY = activeDiff.originalLocation.bbox.y * scale - 90;
          containerOrigRef.current.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
        }
        if (activeDiff.revisedLocation?.bbox && containerRevRef.current) {
          const targetY = activeDiff.revisedLocation.bbox.y * scale - 90;
          containerRevRef.current.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
        }
      }, 140);

      return () => clearTimeout(timer);
    }
  }, [activeDiff, scale]);

  const renderTaskOrigRef = useRef<any>(null);
  const renderTaskRevRef = useRef<any>(null);

  // Render Original PDF with instant cache & renderTask cancellation
  useEffect(() => {
    let isCancelled = false;

    async function renderOrigPage() {
      if (!canvasOrigRef.current || !originalPdfUrl) return;

      try {
        if (renderTaskOrigRef.current) {
          try {
            renderTaskOrigRef.current.cancel();
          } catch {
            // Ignore cancel error
          }
        }

        const pdfDoc = await getLoadedPdfDoc(originalPdfUrl);
        if (isCancelled) return;

        setTotalOrigPages(pdfDoc.numPages);
        const validPageNum = Math.min(Math.max(1, origPageNum), pdfDoc.numPages);
        const page = await pdfDoc.getPage(validPageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasOrigRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        setOrigDims({ width: viewport.width, height: viewport.height });

        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;

        const renderContext = {
          canvasContext: ctx,
          transform: transform,
          viewport: viewport,
        };
        const renderTask = page.render(renderContext);
        renderTaskOrigRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Failed to render Original PDF canvas:", err);
        }
      }
    }

    renderOrigPage();

    return () => {
      isCancelled = true;
      if (renderTaskOrigRef.current) {
        try {
          renderTaskOrigRef.current.cancel();
        } catch {
          /** Ignore cancellation */
        }
      }
    };
  }, [originalPdfUrl, origPageNum, scale]);

  /**
   * Render Revised PDF with instant cache & renderTask cancellation.
   */
  useEffect(() => {
    let isCancelled = false;

    async function renderRevPage() {
      if (!canvasRevRef.current || !revisedPdfUrl) return;

      try {
        if (renderTaskRevRef.current) {
          try {
            renderTaskRevRef.current.cancel();
          } catch {
            /** Ignore cancel error */
          }
        }

        const pdfDoc = await getLoadedPdfDoc(revisedPdfUrl);
        if (isCancelled) return;

        setTotalRevPages(pdfDoc.numPages);
        const validPageNum = Math.min(Math.max(1, revPageNum), pdfDoc.numPages);
        const page = await pdfDoc.getPage(validPageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRevRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        setRevDims({ width: viewport.width, height: viewport.height });

        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;

        const renderContext = {
          canvasContext: ctx,
          transform: transform,
          viewport: viewport,
        };
        const renderTask = page.render(renderContext);
        renderTaskRevRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Failed to render Revised PDF canvas:", err);
        }
      }
    }

    renderRevPage();

    return () => {
      isCancelled = true;
      if (renderTaskRevRef.current) {
        try {
          renderTaskRevRef.current.cancel();
        } catch {
          /** Ignore cancellation */
        }
      }
    };
  }, [revisedPdfUrl, revPageNum, scale]);

  /**
   * Transform coordinates for SVG overlay based on viewport scale.
   */
  const toScaledBbox = (loc?: SourceLocation) => {
    if (!loc || !loc.bbox) return null;
    const s = scale;
    return {
      x: loc.bbox.x * s,
      y: loc.bbox.y * s,
      width: loc.bbox.width * s,
      height: Math.max(20 * s, loc.bbox.height * s),
    };
  };

  const activeOrigBbox = toScaledBbox(activeDiff?.originalLocation);
  const activeRevBbox = toScaledBbox(activeDiff?.revisedLocation);

  return (
    <div className="case-study-card p-5 sm:p-6 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
      
      {/* Header with Viewer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-50 text-gray-700">
            <ScanLine className="h-4 w-4 text-[#e21022]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">
                Dual-Source Synchronized Spatial Inspector
              </h3>
              <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                Auto-Tracking Active
              </span>
            </div>
            <p className="text-xs text-gray-500 font-normal">
              High-precision geometric token alignment with interactive dual-canvas SVG overlays.
            </p>
          </div>
        </div>

        {/* Global Zoom Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1 text-xs text-gray-700">
            <button
              onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}
              className="tactile-btn p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-900 cursor-pointer"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] font-semibold text-gray-900">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(1.4, s + 0.1))}
              className="tactile-btn p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-900 cursor-pointer"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setScale(0.95)}
              className="tactile-btn p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-900 border-l border-gray-200 ml-1 cursor-pointer"
              title="Fit to Container"
              aria-label="Fit Viewport"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Split-Screen Canvas Panes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* PANE 1: Original Offer (Doc A) */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#b43d1a]" />
              <span className="font-bold text-gray-900 tracking-tight">
                Reference Offer (Document A)
              </span>
              <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                BASE
              </span>
            </div>

            {/* Original Pagination Controls */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5">
              <button
                disabled={origPageNum <= 1}
                onClick={() => setOrigPageNum((p) => Math.max(1, p - 1))}
                className="tactile-btn p-1 text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[11px] font-mono text-gray-700 px-1">
                Page {origPageNum} of {totalOrigPages}
              </span>
              <button
                disabled={origPageNum >= totalOrigPages}
                onClick={() => setOrigPageNum((p) => Math.min(totalOrigPages, p + 1))}
                className="tactile-btn p-1 text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Viewport Frame */}
          <div
            ref={containerOrigRef}
            className="relative overflow-hidden h-150 lg:h-187.5 bg-gray-100 rounded-xl border border-gray-200 p-3 flex justify-center shadow-inner"
          >
            <div className="relative inline-block h-full">
              {/* PDF Canvas */}
              <canvas
                ref={canvasOrigRef}
                className="max-h-full w-auto rounded-lg shadow-sm border border-gray-300 bg-white object-contain"
              />

              {/* Synchronized SVG Bounding Box Layer */}
              <svg
                className="absolute inset-0 pointer-events-none w-full h-full"
                viewBox={`0 0 ${origDims.width} ${origDims.height}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Passive Bounding Boxes */}
                {allDiffs.map((d) => {
                  const itemPage = d.originalLocation?.page ?? 1;
                  if (itemPage !== origPageNum) return null;

                  const b = toScaledBbox(d.originalLocation);
                  if (!b || d.id === activeDiff?.id) return null;
                  return (
                    <g key={`passive-orig-${d.id}`} className="cursor-pointer pointer-events-auto" onClick={() => onSelectDiff(d)}>
                      <rect
                        x={b.x}
                        y={b.y}
                        width={b.width}
                        height={b.height}
                        fill="rgba(180, 61, 26, 0.06)"
                        stroke="rgba(180, 61, 26, 0.45)"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                        rx="4"
                        className="hover:fill-[#b43d1a]/20 transition-all duration-150"
                      />
                    </g>
                  );
                })}

                {/* Active Highlight Bounding Box */}
                {activeOrigBbox && (activeDiff?.originalLocation?.page ?? 1) === origPageNum && (
                  <g>
                    {/* Halo */}
                    <rect
                      x={activeOrigBbox.x - 3}
                      y={activeOrigBbox.y - 3}
                      width={activeOrigBbox.width + 6}
                      height={activeOrigBbox.height + 6}
                      fill="rgba(226, 16, 34, 0.18)"
                      stroke="#e21022"
                      strokeWidth="2"
                      rx="6"
                    />
                    
                    {/* Top Pin Tag */}
                    <rect
                      x={activeOrigBbox.x}
                      y={activeOrigBbox.y - 18}
                      width={Math.min(180, activeOrigBbox.width + 20)}
                      height="16"
                      fill="#e21022"
                      rx="4"
                    />
                    <text
                      x={activeOrigBbox.x + 6}
                      y={activeOrigBbox.y - 6}
                      fill="#fff"
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      REF • PAGE {origPageNum}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* PANE 2: Revised Offer (Doc B) */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#86a357]" />
              <span className="font-bold text-gray-900 tracking-tight">
                Candidate Proposal (Document B)
              </span>
              <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                REVISED
              </span>
            </div>

            {/* Revised Pagination Controls */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5">
              <button
                disabled={revPageNum <= 1}
                onClick={() => setRevPageNum((p) => Math.max(1, p - 1))}
                className="tactile-btn p-1 text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[11px] font-mono text-gray-700 px-1">
                Page {revPageNum} of {totalRevPages}
              </span>
              <button
                disabled={revPageNum >= totalRevPages}
                onClick={() => setRevPageNum((p) => Math.min(totalRevPages, p + 1))}
                className="tactile-btn p-1 text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Viewport Frame */}
          <div
            ref={containerRevRef}
            className="relative overflow-hidden h-150 lg:h-187.5 bg-gray-100 rounded-xl border border-gray-200 p-3 flex justify-center shadow-inner"
          >
            <div className="relative inline-block h-full">
              {/* PDF Canvas */}
              <canvas
                ref={canvasRevRef}
                className="max-h-full w-auto rounded-lg shadow-sm border border-gray-300 bg-white object-contain"
              />

              {/* Synchronized SVG Bounding Box Layer */}
              <svg
                className="absolute inset-0 pointer-events-none w-full h-full"
                viewBox={`0 0 ${revDims.width} ${revDims.height}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Passive Bounding Boxes */}
                {allDiffs.map((d) => {
                  const itemPage = d.revisedLocation?.page ?? 1;
                  if (itemPage !== revPageNum) return null;

                  const b = toScaledBbox(d.revisedLocation);
                  if (!b || d.id === activeDiff?.id) return null;
                  const isArith = d.type === "ARITHMETIC_ERROR";
                  return (
                    <g key={`passive-rev-${d.id}`} className="cursor-pointer pointer-events-auto" onClick={() => onSelectDiff(d)}>
                      <rect
                        x={b.x}
                        y={b.y}
                        width={b.width}
                        height={b.height}
                        fill={isArith ? "rgba(226, 16, 34, 0.08)" : "rgba(134, 163, 87, 0.08)"}
                        stroke={isArith ? "rgba(226, 16, 34, 0.55)" : "rgba(134, 163, 87, 0.5)"}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                        rx="4"
                        className="hover:fill-emerald-500/20 transition-all duration-150"
                      />
                    </g>
                  );
                })}

                {/* Active Highlight Bounding Box */}
                {activeRevBbox && (activeDiff?.revisedLocation?.page ?? 1) === revPageNum && (
                  <g>
                    {/* Ambient Halo */}
                    <rect
                      x={activeRevBbox.x - 3}
                      y={activeRevBbox.y - 3}
                      width={activeRevBbox.width + 6}
                      height={activeRevBbox.height + 6}
                      fill={
                        activeDiff?.type === "ARITHMETIC_ERROR"
                          ? "rgba(226, 16, 34, 0.22)"
                          : "rgba(134, 163, 87, 0.22)"
                      }
                      stroke={activeDiff?.type === "ARITHMETIC_ERROR" ? "#e21022" : "#86a357"}
                      strokeWidth="2"
                      rx="6"
                    />
                    
                    {/* Top Pin Tag */}
                    <rect
                      x={activeRevBbox.x}
                      y={activeRevBbox.y - 18}
                      width={Math.min(200, activeRevBbox.width + 20)}
                      height="16"
                      fill={activeDiff?.type === "ARITHMETIC_ERROR" ? "#e21022" : "#86a357"}
                      rx="4"
                    />
                    <text
                      x={activeRevBbox.x + 6}
                      y={activeRevBbox.y - 6}
                      fill="#fff"
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {activeDiff?.type === "ARITHMETIC_ERROR"
                        ? `MATH ERROR • P.${revPageNum}`
                        : `REVISED • P.${revPageNum}`}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>

      </div>

      {/* Spatial Inspector Bottom Bar */}
      {activeDiff && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white border border-gray-200 text-[#e21022] shadow-sm">
              <Crosshair className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase text-[#e21022] font-bold tracking-wider">
                  Pinned Target
                </span>
                <span className="text-gray-900 font-bold tracking-tight">
                  {activeDiff.title}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5 line-clamp-1">
                &ldquo;{activeDiff.originalLocation?.textSnippet || activeDiff.revisedLocation?.textSnippet || "Line item context"}&rdquo;
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10.5px] self-end sm:self-auto shrink-0">
            <span className="px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-700 font-medium">
              Doc A: P.{activeDiff.originalLocation?.page ?? 1}, L.{activeDiff.originalLocation?.lineNumber ?? 1}
            </span>
            <span className="text-gray-400">➔</span>
            <span className="px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-700 font-medium">
              Doc B: P.{activeDiff.revisedLocation?.page ?? 1}, L.{activeDiff.revisedLocation?.lineNumber ?? 1}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
