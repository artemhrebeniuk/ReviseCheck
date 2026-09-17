"use client";

import React, { useRef, useState, useEffect } from "react";
import { 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ShieldCheck, 
  Server, 
  Cloud,
  TrendingDown,
  CalendarClock,
  Upload,
  FileUp,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export type PresetType =
  | "standard"
  | "formatting"
  | "ambiguous"
  | "clean_approval"
  | "hyperscale_3page"
  | "cloud_migration"
  | "arithmetic_inflation"
  | "milestone_schedule"
  | "custom";

interface PresetSelectorProps {
  currentPreset: PresetType;
  isLoading: boolean;
  onSelectPreset: (preset: PresetType) => void;
  onUploadCustom: (file1: File, file2: File) => void;
}

export function PresetSelector({
  currentPreset,
  isLoading,
  onSelectPreset,
  onUploadCustom,
}: PresetSelectorProps) {
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollerRef.current;
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 8);
    }
  };

  useEffect(() => {
    checkScroll();
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      return () => {
        scroller.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, []);

  const handleScrollStep = (direction: "left" | "right") => {
    if (scrollerRef.current) {
      const amount = direction === "left" ? -240 : 240;
      scrollerRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const handleCustomSubmit = () => {
    if (file1 && file2) {
      onUploadCustom(file1, file2);
    }
  };

  const suites = [
    {
      id: "standard" as PresetType,
      index: "01",
      name: "Standard Enterprise Audit",
      subtitle: "Dell Infrastructure (Original vs Revised v1)",
      desc: "7 substantive changes: item rename, row reorder, quantity shift, price delta, and -$200 math discrepancy.",
      icon: AlertTriangle,
      tag: "2 Pages • 10 Items",
    },
    {
      id: "formatting" as PresetType,
      index: "02",
      name: "Formatting-Only Immunity",
      subtitle: "Courier Typography & Column Transposition",
      desc: "Column swap, font substitution & layout reformat. Deterministically yields strict 0 commercial diffs.",
      icon: CheckCircle2,
      tag: "2 Pages • 10 Items",
    },
    {
      id: "ambiguous" as PresetType,
      index: "03",
      name: "Ambiguity & Decline to Conclude",
      subtitle: "EUR vs USD Clash & Indefinite TBD Timeline",
      desc: "Currency conflict and uncommitted delivery terms trigger automated Decline-to-Conclude modal.",
      icon: HelpCircle,
      tag: "2 Pages • 10 Items",
    },
    {
      id: "clean_approval" as PresetType,
      index: "04",
      name: "Clean Authorized Revision",
      subtitle: "Authorized 5% Bulk Volume Rebate",
      desc: "Clean volume discount across 10 items. Math reconciles with zero discrepancy.",
      icon: ShieldCheck,
      tag: "2 Pages • 10 Items",
    },
    {
      id: "hyperscale_3page" as PresetType,
      index: "05",
      name: "3-Page Hyperscale Infrastructure",
      subtitle: "Tier-3 Datacenter Quote (Schneider / HP / APC)",
      desc: "3 full pages, 10 complex multi-tier items, cross-page reordering & -$500 math mismatch on page 3.",
      icon: Server,
      tag: "3 Full Pages • 10 Items",
    },
    {
      id: "cloud_migration" as PresetType,
      index: "06",
      name: "Cloud Migration Architecture",
      subtitle: "AWS Compute Modernization (Graviton3)",
      desc: "Graviton3 compute modernization, S3 storage expansion, NAT Gateway elimination.",
      icon: Cloud,
      tag: "2 Pages • 10 Items",
    },
    {
      id: "arithmetic_inflation" as PresetType,
      index: "07",
      name: "Severe Arithmetic Inflation",
      subtitle: "+$4,500 Unallocated Source Margin Mismatch",
      desc: "Severe source math inflation: grand total inflated by $4,500 over stated line items.",
      icon: TrendingDown,
      tag: "2 Pages • 10 Items",
    },
    {
      id: "milestone_schedule" as PresetType,
      index: "08",
      name: "Phased Milestone Overhaul",
      subtitle: "Aerospace Hardware & Schedule Realignment",
      desc: "Avionics spec rename, wiring harness quantity doubled, delivery schedule postponed to Feb 2027.",
      icon: CalendarClock,
      tag: "2 Pages • 10 Items",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-600">
          Benchmark Suites ({suites.length})
        </h4>
        <button
          onClick={() => setShowUploadPanel(!showUploadPanel)}
          className="tactile-btn inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer shrink-0 active:scale-95"
        >
          <Upload className="h-4 w-4" />
          <span>{showUploadPanel ? "Close Upload" : "Upload Custom"}</span>
        </button>
      </div>

      {/* Custom Upload Drawer */}
      {showUploadPanel && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Upload Custom PDF Proposals</span>
            <span className="text-xs sm:text-sm font-mono text-gray-500">Max 3 Pages • 10 Items</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
            <div 
              onClick={() => file1Ref.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && f.type === "application/pdf") setFile1(f);
              }}
              className="tactile-btn border border-dashed border-gray-300 rounded-xl p-3.5 bg-white text-center cursor-pointer hover:border-indigo-400 active:scale-[0.99] transition flex flex-col items-center justify-center min-h-20"
            >
              <input
                ref={file1Ref}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile1(e.target.files?.[0] || null)}
              />
              <span className="text-sm font-medium text-gray-700 truncate flex items-center justify-center gap-1.5">
                {file1 ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="truncate">Doc A: {file1.name}</span>
                  </>
                ) : (
                  "Click or drop Document A (Original PDF)"
                )}
              </span>
            </div>

            <div 
              onClick={() => file2Ref.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && f.type === "application/pdf") setFile2(f);
              }}
              className="tactile-btn border border-dashed border-gray-300 rounded-xl p-3.5 bg-white text-center cursor-pointer hover:border-indigo-400 active:scale-[0.99] transition flex flex-col items-center justify-center min-h-20"
            >
              <input
                ref={file2Ref}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile2(e.target.files?.[0] || null)}
              />
              <span className="text-sm font-medium text-gray-700 truncate flex items-center justify-center gap-1.5">
                {file2 ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="truncate">Doc B: {file2.name}</span>
                  </>
                ) : (
                  "Click or drop Document B (Revised PDF)"
                )}
              </span>
            </div>
          </div>

          <button
            onClick={handleCustomSubmit}
            disabled={!file1 || !file2 || isLoading}
            className="tactile-btn w-full py-2.5 px-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98]"
          >
            <FileUp className="h-4 w-4" />
            <span>{isLoading ? "Analyzing Proposals..." : "Audit Custom Proposals"}</span>
          </button>
        </div>
      )}

      {/* MOBILE & TABLET: Space-Efficient Horizontal Scroller with Scroll Cues */}
      <div className="relative xl:hidden">
        {/* Left Scroll Cue & Arrow */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-2 z-10 flex items-center pr-4 pl-0.5 bg-linear-to-r from-slate-50 via-slate-50/95 to-transparent pointer-events-none">
            <button
              onClick={() => handleScrollStep("left")}
              className="tactile-btn pointer-events-auto p-2 rounded-full bg-white border border-gray-300 text-gray-700 shadow-md hover:bg-gray-50 active:scale-90 transition cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scroller Track */}
        <div
          ref={scrollerRef}
          className="flex overflow-x-auto gap-2.5 pb-2 -mx-1 px-1 scroll-smooth snap-x scrollbar-thin"
        >
          {suites.map((suite) => {
            const isSelected = currentPreset === suite.id;
            return (
              <button
                key={suite.id}
                onClick={() => onSelectPreset(suite.id)}
                disabled={isLoading}
                className={`tactile-btn shrink-0 snap-start flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left transition cursor-pointer active:scale-95 ${
                  isSelected
                    ? "bg-gray-900 border-gray-900 text-white shadow-sm ring-1 ring-gray-900"
                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 active:bg-gray-50"
                }`}
              >
                <span className={`font-mono text-xs sm:text-sm font-bold px-2 py-0.5 rounded ${
                  isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                }`}>
                  {suite.index}
                </span>
                <span className="text-sm font-semibold whitespace-nowrap">
                  {suite.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Scroll Cue & Arrow */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-2 z-10 flex items-center pl-4 pr-0.5 bg-linear-to-l from-slate-50 via-slate-50/95 to-transparent pointer-events-none">
            <button
              onClick={() => handleScrollStep("right")}
              className="tactile-btn pointer-events-auto p-2 rounded-full bg-white border border-gray-300 text-gray-700 shadow-md hover:bg-gray-50 active:scale-90 transition cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* DESKTOP: Full Vertical Suite Cards List */}
      <div className="hidden xl:block space-y-2.5 max-h-125 overflow-y-auto pr-1">
        {suites.map((suite) => {
          const isSelected = currentPreset === suite.id;

          return (
            <button
              key={suite.id}
              onClick={() => onSelectPreset(suite.id)}
              disabled={isLoading}
              className={`tactile-btn w-full text-left p-4 rounded-xl border transition-all cursor-pointer active:scale-[0.985] ${
                isSelected
                  ? "bg-gray-900 border-gray-900 text-white shadow-sm ring-1 ring-gray-900"
                  : "bg-gray-50/80 hover:bg-gray-100/90 border-gray-200/90 hover:border-gray-300 text-gray-600"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-mono text-xs sm:text-sm font-bold px-2 py-0.5 rounded ${
                    isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-800"
                  }`}>
                    {suite.index}
                  </span>
                  <h5 className={`font-bold text-base truncate ${isSelected ? "text-white" : "text-gray-900"}`}>
                    {suite.name}
                  </h5>
                </div>
                <span className={`text-xs sm:text-sm font-mono shrink-0 ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                  {suite.tag}
                </span>
              </div>
              <p className={`text-sm mt-2 line-clamp-2 leading-relaxed font-normal ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                {suite.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
