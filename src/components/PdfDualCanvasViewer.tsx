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
  ArrowRight,
  Info
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
interface CachedPageBitmap {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}

let cachedPdfJsPromise: Promise<any> | null = null;
const globalPdfDocCache = new Map<string, Promise<any>>();
const globalPageBitmapCache = new Map<string, Promise<CachedPageBitmap>>();

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

/**
 * Renders a PDF page to an offscreen canvas and caches the resulting bitmap.
 * Eliminates canvas clearing flickers and makes page transitions 100% instantaneous.
 */
async function getOrRenderPageBitmap(
  pdfDoc: any,
  url: string,
  pageNum: number,
  scale: number
): Promise<CachedPageBitmap> {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cacheKey = `${url}-${pageNum}-${scale}-${dpr}`;

  if (globalPageBitmapCache.has(cacheKey)) {
    return globalPageBitmapCache.get(cacheKey)!;
  }

  const renderPromise = (async () => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.floor(viewport.width * dpr);
    offscreen.height = Math.floor(viewport.height * dpr);
    const ctx = offscreen.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context for offscreen canvas");

    const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;
    const renderContext = {
      canvasContext: ctx,
      transform: transform,
      viewport: viewport,
    };
    await page.render(renderContext).promise;

    return {
      canvas: offscreen,
      width: offscreen.width,
      height: offscreen.height,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    };
  })();

  globalPageBitmapCache.set(cacheKey, renderPromise);
  return renderPromise;
}

/**
 * Non-blocking background pre-fetcher that pre-renders all pages of a document.
 */
function prefetchAndRenderAllPages(pdfDoc: any, url: string, scale: number) {
  const numPages = pdfDoc?.numPages || 1;
  for (let p = 1; p <= numPages; p++) {
    getOrRenderPageBitmap(pdfDoc, url, p, scale).catch(() => {});
  }
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

  // Track last successfully rendered key to avoid redrawing when toggling view modes
  const renderedOrigKeyRef = useRef<string>("");
  const renderedRevKeyRef = useRef<string>("");

  // Reset page numbers and cached keys when document source URLs change
  useEffect(() => {
    setOrigPageNum(1);
    renderedOrigKeyRef.current = "";
  }, [originalPdfUrl]);

  useEffect(() => {
    setRevPageNum(1);
    renderedRevKeyRef.current = "";
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

  // Render Original PDF with instant cache & double-buffering
  useEffect(() => {
    let isCancelled = false;

    async function renderOrigPage() {
      if (!canvasOrigRef.current || !originalPdfUrl) return;
      if (viewMode !== "split" && viewMode !== "orig") return;

      const currentKey = `${originalPdfUrl}-${origPageNum}-${scale}`;
      if (renderedOrigKeyRef.current === currentKey && canvasOrigRef.current.width > 0) {
        return;
      }

      try {
        const pdfDoc = await getLoadedPdfDoc(originalPdfUrl);
        if (isCancelled) return;

        setTotalOrigPages(pdfDoc.numPages);
        prefetchAndRenderAllPages(pdfDoc, originalPdfUrl, scale);

        const validPageNum = Math.min(Math.max(1, origPageNum), pdfDoc.numPages);
        const bitmap = await getOrRenderPageBitmap(pdfDoc, originalPdfUrl, validPageNum, scale);
        if (isCancelled) return;

        const canvas = canvasOrigRef.current;
        if (!canvas) return;

        // Atomic swap - visible canvas is ONLY resized and painted once the offscreen bitmap is 100% ready
        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
        }
        setOrigDims({ width: bitmap.viewportWidth, height: bitmap.viewportHeight });

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap.canvas, 0, 0);
        }
        renderedOrigKeyRef.current = currentKey;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Failed to render Original PDF canvas:", err);
        }
      }
    }

    renderOrigPage();

    return () => {
      isCancelled = true;
    };
  }, [originalPdfUrl, origPageNum, scale, viewMode]);

  /**
   * Render Revised PDF with instant cache & double-buffering.
   */
  useEffect(() => {
    let isCancelled = false;

    async function renderRevPage() {
      if (!canvasRevRef.current || !revisedPdfUrl) return;
      if (viewMode !== "split" && viewMode !== "rev") return;

      const currentKey = `${revisedPdfUrl}-${revPageNum}-${scale}`;
      if (renderedRevKeyRef.current === currentKey && canvasRevRef.current.width > 0) {
        return;
      }

      try {
        const pdfDoc = await getLoadedPdfDoc(revisedPdfUrl);
        if (isCancelled) return;

        setTotalRevPages(pdfDoc.numPages);
        prefetchAndRenderAllPages(pdfDoc, revisedPdfUrl, scale);

        const validPageNum = Math.min(Math.max(1, revPageNum), pdfDoc.numPages);
        const bitmap = await getOrRenderPageBitmap(pdfDoc, revisedPdfUrl, validPageNum, scale);
        if (isCancelled) return;

        const canvas = canvasRevRef.current;
        if (!canvas) return;

        // Atomic swap - visible canvas is ONLY resized and painted once the offscreen bitmap is 100% ready
        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
        }
        setRevDims({ width: bitmap.viewportWidth, height: bitmap.viewportHeight });

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap.canvas, 0, 0);
        }
        renderedRevKeyRef.current = currentKey;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Failed to render Revised PDF canvas:", err);
        }
      }
    }

    renderRevPage();

    return () => {
      isCancelled = true;
    };
  }, [revisedPdfUrl, revPageNum, scale, viewMode]);

/**
 * Resolves contextual pin tag label, color, and dynamic badge width for Baseline Offer (Doc A).
 */
function getOrigTagDetails(diff: CommercialDiff | null, page: number): { text: string; color: string; width: number } {
  if (!diff) return { text: `REF • P.${page}`, color: "#e21022", width: 120 };

  const origStr = diff.originalValue !== undefined && diff.originalValue !== null ? String(diff.originalValue) : "";

  switch (diff.type) {
    case "SCOPE_ADDED":
      return { text: "NOT IN BASELINE (SCOPE ANCHOR)", color: "#d97706", width: 235 };
    case "SCOPE_REMOVED":
      return { text: "REMOVED FROM SCOPE", color: "#e21022", width: 165 };
    case "PRICE_CHANGE":
      return { text: `ORIGINAL: ${origStr || "RATE"}`, color: "#b43d1a", width: Math.max(140, origStr.length * 8 + 80) };
    case "QTY_CHANGE":
      return { text: `ORIGINAL: ${origStr || "QTY"} UNITS`, color: "#b43d1a", width: Math.max(150, origStr.length * 8 + 105) };
    case "RENAMED_ITEM":
      return { text: "ORIGINAL SPECIFICATION", color: "#b43d1a", width: 180 };
    case "DATE_CHANGE":
      return { text: `ORIGINAL DATE: ${origStr}`, color: "#b43d1a", width: Math.max(160, origStr.length * 7.5 + 80) };
    case "ARITHMETIC_ERROR":
      return { text: "ORIGINAL CALCULATION", color: "#b43d1a", width: 170 };
    default:
      return { text: `REF • PAGE ${page}`, color: "#e21022", width: 120 };
  }
}

/**
 * Resolves contextual pin tag label, color, and dynamic badge width for Candidate Proposal (Doc B).
 */
function getRevTagDetails(diff: CommercialDiff | null, page: number): { text: string; color: string; width: number } {
  if (!diff) return { text: `REVISED • P.${page}`, color: "#86a357", width: 130 };

  const revStr = diff.revisedValue !== undefined && diff.revisedValue !== null ? String(diff.revisedValue) : "";
  const deltaStr = diff.delta !== undefined && diff.delta !== null ? String(diff.delta) : "";

  switch (diff.type) {
    case "ARITHMETIC_ERROR":
      return { text: `MATH ERROR: STATED ${revStr || "TOTAL"}`, color: "#e21022", width: Math.max(180, revStr.length * 8 + 120) };
    case "SCOPE_REMOVED":
      return { text: "OMITTED IN REVISION (SCOPE ANCHOR)", color: "#d97706", width: 250 };
    case "SCOPE_ADDED":
      return { text: "NEW DELIVERABLE ADDED", color: "#16a34a", width: 180 };
    case "PRICE_CHANGE":
      return { text: `REVISED: ${revStr} (${deltaStr || "PRICE"})`, color: "#16a34a", width: Math.max(170, (revStr.length + deltaStr.length) * 7.5 + 80) };
    case "QTY_CHANGE":
      return { text: `REVISED: ${revStr} UNITS (${deltaStr || "QTY"})`, color: "#16a34a", width: Math.max(180, (revStr.length + deltaStr.length) * 7.5 + 90) };
    case "RENAMED_ITEM":
      return { text: "RENAMED DELIVERABLE", color: "#16a34a", width: 170 };
    case "DATE_CHANGE":
      return { text: `NEW DATE: ${revStr}`, color: "#16a34a", width: Math.max(150, revStr.length * 7.5 + 80) };
    default:
      return { text: `REVISED • P.${page}`, color: "#86a357", width: 130 };
  }
}

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
    <div id="pdf-dual-viewer" className="case-study-card p-5 sm:p-6 space-y-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
      
      {/* Header with Viewer Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-50 text-[#e21022] shrink-0">
            <ScanLine className="h-5 w-5 text-[#e21022]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              Dual-Source Synchronized Spatial Inspector
            </h3>
            <p className="text-sm text-gray-500 font-normal">
              High-precision geometric token alignment with interactive dual-canvas SVG overlays.
            </p>
          </div>
        </div>

        {/* View Mode & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
          {/* View Mode Switcher (Desktop & Mobile) */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-sm font-semibold">
            <button
              onClick={() => setViewMode("split")}
              className={`tactile-btn px-3 py-1.5 rounded-lg transition cursor-pointer active:scale-95 ${
                viewMode === "split"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode("orig")}
              className={`tactile-btn px-3 py-1.5 rounded-lg transition cursor-pointer active:scale-95 ${
                viewMode === "orig"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className="hidden sm:inline">Document A</span>
              <span className="sm:hidden">Doc A</span>
            </button>
            <button
              onClick={() => setViewMode("rev")}
              className={`tactile-btn px-3 py-1.5 rounded-lg transition cursor-pointer active:scale-95 ${
                viewMode === "rev"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className="hidden sm:inline">Document B</span>
              <span className="sm:hidden">Doc B</span>
            </button>
          </div>

          {/* Global Zoom Controls */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 text-sm text-gray-700">
            <button
              onClick={() => setScale((s) => Math.max(0.5, Math.round((s - 0.12) * 100) / 100))}
              className="tactile-btn p-1.5 hover:bg-gray-200 rounded-lg text-gray-600 hover:text-gray-900 cursor-pointer active:scale-90"
              title="Zoom Out (Min 50%)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="px-2.5 font-mono text-sm font-bold text-gray-900 min-w-14 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.0, Math.round((s + 0.12) * 100) / 100))}
              className="tactile-btn p-1.5 hover:bg-gray-200 rounded-lg text-gray-600 hover:text-gray-900 cursor-pointer active:scale-90"
              title="Zoom In (Max 200%)"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setScale(0.88)}
              className="tactile-btn px-2.5 py-1 hover:bg-gray-200 rounded-lg text-gray-700 hover:text-gray-900 border-l border-gray-200 ml-1 cursor-pointer font-semibold text-sm flex items-center gap-1.5 active:scale-95"
              title="Fit to Width (88%)"
              aria-label="Fit Viewport Width"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Fit Width</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visual Spatial Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl bg-gray-50/90 border border-gray-200/80 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">Visual Legend:</span>
          <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#e21022] inline-block shadow-2xs" />
            <span>Doc A Baseline / Math Error</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#16a34a] inline-block shadow-2xs" />
            <span>Doc B Revised Value</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-3.5 h-2 rounded-xs border border-dashed border-gray-400 bg-gray-200/60 inline-block" />
            <span>Passive Delta (Click to inspect)</span>
          </div>
        </div>
        <span className="text-gray-400 font-mono text-[11px]">Unmarked rows = 100% Identical</span>
      </div>

      {/* Split-Screen Canvas Panes */}
      <div className={`grid gap-4 ${viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        
        {/* PANE 1: Original Offer (Doc A) */}
        <div
          key="pane-doc-a"
          className={`flex flex-col space-y-2.5 min-w-0 ${
            viewMode === "split" || viewMode === "orig" ? "flex" : "hidden"
          }`}
        >
          <div className="flex items-center justify-between min-h-9 px-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-[#b43d1a] shrink-0" />
              <span className="font-bold text-gray-900 tracking-tight text-sm sm:text-base whitespace-nowrap truncate">
                Reference Offer
              </span>
              <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200 font-bold shrink-0">
                Doc A
              </span>
            </div>

            {/* Original Pagination Controls */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 shrink-0">
              <button
                disabled={origPageNum <= 1}
                onClick={() => setOrigPageNum((p) => Math.max(1, p - 1))}
                className="tactile-btn p-1 text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer active:scale-90"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs sm:text-sm font-mono text-gray-800 px-1 font-semibold whitespace-nowrap">
                Page {origPageNum} of {totalOrigPages}
              </span>
              <button
                disabled={origPageNum >= totalOrigPages}
                onClick={() => setOrigPageNum((p) => Math.min(totalOrigPages, p + 1))}
                className="tactile-btn p-1 text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer active:scale-90"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
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
                  key="canvas-doc-a"
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
                  {activeOrigBbox && (activeDiff?.originalLocation?.page ?? 1) === origPageNum && (() => {
                    const tag = getOrigTagDetails(activeDiff, origPageNum);
                    return (
                      <g>
                        {/* Halo */}
                        <rect
                          x={activeOrigBbox.x - 3}
                          y={activeOrigBbox.y - 3}
                          width={activeOrigBbox.width + 6}
                          height={activeOrigBbox.height + 6}
                          fill={tag.color === "#d97706" ? "rgba(217, 119, 6, 0.16)" : "rgba(226, 16, 34, 0.18)"}
                          stroke={tag.color}
                          strokeWidth="2"
                          rx="6"
                        />
                        
                        {/* Top Pin Tag */}
                        <rect
                          x={activeOrigBbox.x}
                          y={activeOrigBbox.y - 22}
                          width={tag.width}
                          height="20"
                          fill={tag.color}
                          rx="5"
                        />
                        <text
                          x={activeOrigBbox.x + 6}
                          y={activeOrigBbox.y - 8}
                          fill="#fff"
                          fontSize="11"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {tag.text}
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* PANE 2: Revised Offer (Doc B) */}
        <div
          key="pane-doc-b"
          className={`flex flex-col space-y-2.5 min-w-0 ${
            viewMode === "split" || viewMode === "rev" ? "flex" : "hidden"
          }`}
        >
          <div className="flex items-center justify-between min-h-9 px-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-[#86a357] shrink-0" />
              <span className="font-bold text-gray-900 tracking-tight text-sm sm:text-base whitespace-nowrap truncate">
                Candidate Proposal
              </span>
              <span className="font-mono text-xs text-lime-800 bg-lime-50 px-2 py-0.5 rounded-md border border-lime-200 font-bold shrink-0">
                Doc B
              </span>
            </div>

            {/* Revised Pagination Controls */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 shrink-0">
              <button
                disabled={revPageNum <= 1}
                onClick={() => setRevPageNum((p) => Math.max(1, p - 1))}
                className="tactile-btn p-1 text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer active:scale-90"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs sm:text-sm font-mono text-gray-800 px-1 font-semibold whitespace-nowrap">
                Page {revPageNum} of {totalRevPages}
              </span>
              <button
                disabled={revPageNum >= totalRevPages}
                onClick={() => setRevPageNum((p) => Math.min(totalRevPages, p + 1))}
                className="tactile-btn p-1 text-gray-500 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer active:scale-90"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
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
                  key="canvas-doc-b"
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
                  {activeRevBbox && (activeDiff?.revisedLocation?.page ?? 1) === revPageNum && (() => {
                    const tag = getRevTagDetails(activeDiff, revPageNum);
                    return (
                      <g>
                        {/* Ambient Halo */}
                        <rect
                          x={activeRevBbox.x - 3}
                          y={activeRevBbox.y - 3}
                          width={activeRevBbox.width + 6}
                          height={activeRevBbox.height + 6}
                          fill={
                            tag.color === "#e21022"
                              ? "rgba(226, 16, 34, 0.22)"
                              : tag.color === "#d97706"
                              ? "rgba(217, 119, 6, 0.18)"
                              : "rgba(22, 163, 74, 0.20)"
                          }
                          stroke={tag.color}
                          strokeWidth="2"
                          rx="6"
                        />
                        
                        {/* Top Pin Tag */}
                        <rect
                          x={activeRevBbox.x}
                          y={activeRevBbox.y - 22}
                          width={tag.width}
                          height="20"
                          fill={tag.color}
                          rx="5"
                        />
                        <text
                          x={activeRevBbox.x + 6}
                          y={activeRevBbox.y - 8}
                          fill="#fff"
                          fontSize="11"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {tag.text}
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Spatial Inspector Bottom Bar */}
      {activeDiff && (
        <div className="flex flex-col gap-2.5">
          {/* Scope Anchor Contextual Guidance */}
          {activeDiff.type === "SCOPE_REMOVED" && (
            <div className="px-4 py-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-950 text-xs flex items-center gap-2.5 shadow-2xs">
              <Info className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong className="font-semibold text-amber-900">Scope Omission Context:</strong> This line item was removed from the Candidate Proposal. In compliance with dual-referencing standards, the highlighted Document Header in Candidate Proposal serves as the contractual Scope Anchor.
              </span>
            </div>
          )}
          {activeDiff.type === "SCOPE_ADDED" && (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 text-xs flex items-center gap-2.5 shadow-2xs">
              <Info className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong className="font-semibold text-emerald-900">New Scope Context:</strong> This line item is newly introduced in the Candidate Proposal. In compliance with dual-referencing standards, the highlighted Document Header in Baseline Offer serves as the contractual Scope Anchor.
              </span>
            </div>
          )}

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-gray-200 text-[#e21022] shadow-2xs shrink-0">
              <Crosshair className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs sm:text-sm uppercase text-[#e21022] font-bold tracking-wider">
                  Pinned Target
                </span>
                <span className="text-gray-900 font-bold text-sm sm:text-base tracking-tight">
                  {activeDiff.title}
                </span>
              </div>
              <p className="text-sm text-gray-600 font-mono mt-0.5 line-clamp-1">
                &ldquo;{activeDiff.originalLocation?.textSnippet || activeDiff.revisedLocation?.textSnippet || "Line item context"}&rdquo;
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs sm:text-sm self-start sm:self-auto">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-800 font-semibold shadow-2xs">
              Doc A: P.{activeDiff.originalLocation?.page ?? 1}, L.{activeDiff.originalLocation?.lineNumber ?? 1}
              {activeDiff.type === "SCOPE_ADDED" && (
                <span className="ml-1 text-xs text-amber-700 font-sans font-normal">(Doc A Header Anchor)</span>
              )}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-800 font-semibold shadow-2xs">
              Doc B: P.{activeDiff.revisedLocation?.page ?? 1}, L.{activeDiff.revisedLocation?.lineNumber ?? 1}
              {activeDiff.type === "SCOPE_REMOVED" && (
                <span className="ml-1 text-xs text-amber-700 font-sans font-normal">(Doc B Header Anchor)</span>
              )}
            </span>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
