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
  ScanLine,
  ArrowRight
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
    const docPromise = getPdfJs()
      .then((pdfjs) => {
        if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL("/pdf.worker.min.mjs", window.location.origin).toString();
        }
        return pdfjs.getDocument({ url, isEvalSupported: false }).promise;
      })
      .catch((err) => {
        globalPdfDocCache.delete(url);
        throw err;
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
  const [scale, setScale] = useState(0.88);
  const [viewMode, setViewMode] = useState<"split" | "orig" | "rev">("split");
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

  // Reset page numbers when document source URLs change
  useEffect(() => {
    setOrigPageNum(1);
  }, [originalPdfUrl]);

  useEffect(() => {
    setRevPageNum(1);
  }, [revisedPdfUrl]);

  // Clamp page numbers if total pages count changes
  useEffect(() => {
    if (totalOrigPages > 0 && origPageNum > totalOrigPages) {
      setOrigPageNum(totalOrigPages);
    }
  }, [totalOrigPages, origPageNum]);

  useEffect(() => {
    if (totalRevPages > 0 && revPageNum > totalRevPages) {
      setRevPageNum(totalRevPages);
    }
  }, [totalRevPages, revPageNum]);

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
    <div id="pdf-dual-viewer" className="case-study-card p-5 sm:p-6 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
      
      {/* Header with Viewer Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-50 text-gray-700 shrink-0">
            <ScanLine className="h-4 w-4 text-[#e21022]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">
                Dual-Source Synchronized Spatial Inspector
              </h3>
              <span className="font-mono text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                Auto-Tracking Active
              </span>
            </div>
            <p className="text-xs text-gray-500 font-normal">
              High-precision geometric token alignment with interactive dual-canvas SVG overlays.
            </p>
          </div>
        </div>

        {/* View Mode & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* View Mode Switcher (Desktop & Mobile) */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setViewMode("split")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                viewMode === "split"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode("orig")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                viewMode === "orig"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Document A
            </button>
            <button
              onClick={() => setViewMode("rev")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                viewMode === "rev"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Document B
            </button>
          </div>

          {/* Global Zoom Controls */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1 text-xs text-gray-700">
            <button
              onClick={() => setScale((s) => Math.max(0.5, Math.round((s - 0.12) * 100) / 100))}
              className="tactile-btn p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-900 cursor-pointer"
              title="Zoom Out (Min 50%)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono text-xs font-semibold text-gray-900 min-w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.0, Math.round((s + 0.12) * 100) / 100))}
              className="tactile-btn p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-900 cursor-pointer"
              title="Zoom In (Max 200%)"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setScale(0.88)}
              className="tactile-btn px-2 py-1 hover:bg-gray-200 rounded-md text-gray-600 hover:text-gray-900 border-l border-gray-200 ml-1 cursor-pointer font-medium text-xs flex items-center gap-1"
              title="Fit to Width (88%)"
              aria-label="Fit Viewport Width"
            >
              <Maximize2 className="h-3 w-3" />
              <span>Fit Width</span>
            </button>
          </div>
        </div>
      </div>

      {/* Split-Screen Canvas Panes */}
      <div className={`grid gap-4 ${viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        
        {/* PANE 1: Original Offer (Doc A) */}
        {(viewMode === "split" || viewMode === "orig") && (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#b43d1a]" />
                <span className="font-bold text-gray-900 tracking-tight text-xs sm:text-sm">
                  Reference Offer (Document A)
                </span>
                <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-semibold">
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
                <span className="text-xs font-mono text-gray-700 px-1 font-medium">
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

            {/* Viewport Frame with scroll and high-detail canvas zoom */}
            <div
              ref={containerOrigRef}
              className="relative overflow-auto scroll-smooth h-150 lg:h-187.5 bg-gray-100 rounded-xl border border-gray-200 p-2 sm:p-4 shadow-inner"
            >
              <div className="w-full min-w-max flex justify-start items-start">
                <div
                  className="relative inline-block shrink-0 mx-auto"
                  style={{ width: `${origDims.width}px`, height: `${origDims.height}px` }}
                >
                  {/* PDF Canvas */}
                  <canvas
                    ref={canvasOrigRef}
                    style={{ width: `${origDims.width}px`, height: `${origDims.height}px` }}
                    className="rounded-lg shadow-sm border border-gray-300 bg-white block"
                  />

                  {/* Synchronized SVG Bounding Box Layer */}
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ width: `${origDims.width}px`, height: `${origDims.height}px` }}
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
                          y={activeOrigBbox.y - 20}
                          width={Math.min(180, activeOrigBbox.width + 20)}
                          height="18"
                          fill="#e21022"
                          rx="4"
                        />
                        <text
                          x={activeOrigBbox.x + 6}
                          y={activeOrigBbox.y - 7}
                          fill="#fff"
                          fontSize="11"
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
          </div>
        )}

        {/* PANE 2: Revised Offer (Doc B) */}
        {(viewMode === "split" || viewMode === "rev") && (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#86a357]" />
                <span className="font-bold text-gray-900 tracking-tight text-xs sm:text-sm">
                  Candidate Proposal (Document B)
                </span>
                <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-semibold">
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
                <span className="text-xs font-mono text-gray-700 px-1 font-medium">
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

            {/* Viewport Frame with scroll and high-detail canvas zoom */}
            <div
              ref={containerRevRef}
              className="relative overflow-auto scroll-smooth h-150 lg:h-187.5 bg-gray-100 rounded-xl border border-gray-200 p-2 sm:p-4 shadow-inner"
            >
              <div className="w-full min-w-max flex justify-start items-start">
                <div
                  className="relative inline-block shrink-0 mx-auto"
                  style={{ width: `${revDims.width}px`, height: `${revDims.height}px` }}
                >
                  {/* PDF Canvas */}
                  <canvas
                    ref={canvasRevRef}
                    style={{ width: `${revDims.width}px`, height: `${revDims.height}px` }}
                    className="rounded-lg shadow-sm border border-gray-300 bg-white block"
                  />

                  {/* Synchronized SVG Bounding Box Layer */}
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ width: `${revDims.width}px`, height: `${revDims.height}px` }}
                    viewBox={`0 0 ${revDims.width} ${revDims.height}`}
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
                          y={activeRevBbox.y - 20}
                          width={Math.min(210, activeRevBbox.width + 20)}
                          height="18"
                          fill={activeDiff?.type === "ARITHMETIC_ERROR" ? "#e21022" : "#86a357"}
                          rx="4"
                        />
                        <text
                          x={activeRevBbox.x + 6}
                          y={activeRevBbox.y - 7}
                          fill="#fff"
                          fontSize="11"
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
        )}

      </div>

      {/* Spatial Inspector Bottom Bar */}
      {activeDiff && (
        <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white border border-gray-200 text-[#e21022] shadow-sm">
              <Crosshair className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase text-[#e21022] font-bold tracking-wider">
                  Pinned Target
                </span>
                <span className="text-gray-900 font-bold text-sm tracking-tight">
                  {activeDiff.title}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-mono mt-0.5 line-clamp-1">
                &ldquo;{activeDiff.originalLocation?.textSnippet || activeDiff.revisedLocation?.textSnippet || "Line item context"}&rdquo;
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs self-end sm:self-auto shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-800 font-semibold shadow-xs">
              Doc A: P.{activeDiff.originalLocation?.page ?? 1}, L.{activeDiff.originalLocation?.lineNumber ?? 1}
            </span>
            <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-800 font-semibold shadow-xs">
              Doc B: P.{activeDiff.revisedLocation?.page ?? 1}, L.{activeDiff.revisedLocation?.lineNumber ?? 1}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
