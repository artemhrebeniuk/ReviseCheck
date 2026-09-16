"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CommercialDiff,
  DiffCategory,
  DiffSeverity,
  DiffType,
} from "@/lib/types";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Layers,
  Calendar,
  Eye,
  Filter,
  Search,
  Crosshair,
  Hash,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Tag,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  LayoutList,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface DiffMatrixProps {
  diffs: CommercialDiff[];
  activeDiff: CommercialDiff | null;
  onSelectDiff: (diff: CommercialDiff) => void;
}

type TabType = "all" | "substantive" | "arithmetic" | "scope" | "pricing" | "formatting";

export function DiffMatrix({ diffs, activeDiff, onSelectDiff }: DiffMatrixProps) {
  const [activeTab, setActiveTab] = useState<TabType>("substantive");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const tableScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollTableLeft, setCanScrollTableLeft] = useState(false);
  const [canScrollTableRight, setCanScrollTableRight] = useState(false);

  // Initialize view mode based on screen width
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth >= 1024) {
        setViewMode("table");
      } else {
        setViewMode("cards");
      }
    }
  }, []);

  // Check horizontal table scroll
  const checkTableScroll = () => {
    if (tableScrollerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableScrollerRef.current;
      setCanScrollTableLeft(scrollLeft > 10);
      setCanScrollTableRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    if (viewMode === "table") {
      checkTableScroll();
      const el = tableScrollerRef.current;
      if (el) {
        el.addEventListener("scroll", checkTableScroll, { passive: true });
        window.addEventListener("resize", checkTableScroll);
        return () => {
          el.removeEventListener("scroll", checkTableScroll);
          window.removeEventListener("resize", checkTableScroll);
        };
      }
    }
  }, [viewMode]);

  const handleTableScroll = (direction: "left" | "right") => {
    if (tableScrollerRef.current) {
      const amount = direction === "left" ? -280 : 280;
      tableScrollerRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const toggleCard = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllCards = (items: CommercialDiff[]) => {
    if (expandedIds.size >= items.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(items.map((d) => d.id)));
    }
  };

  const filteredDiffs = diffs.filter((d) => {
    // Tab filter
    if (activeTab === "substantive" && !d.isSubstantive) return false;
    if (activeTab === "arithmetic" && d.type !== "ARITHMETIC_ERROR") return false;
    if (activeTab === "scope" && d.category !== "SCOPE") return false;
    if (activeTab === "pricing" && d.category !== "PRICING" && d.type !== "ARITHMETIC_ERROR") return false;
    if (activeTab === "formatting" && d.isSubstantive) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getDiffBadge = (type: DiffType) => {
    switch (type) {
      case "ARITHMETIC_ERROR":
        return {
          label: "Arithmetic Error",
          bg: "bg-rose-50 text-rose-800 border-rose-200",
          icon: <AlertTriangle className="h-3 w-3 text-rose-600" />,
        };
      case "SCOPE_REMOVED":
        return {
          label: "Scope Removed",
          bg: "bg-orange-50 text-orange-800 border-orange-200",
          icon: <Layers className="h-3 w-3 text-orange-600" />,
        };
      case "SCOPE_ADDED":
        return {
          label: "Scope Added",
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          icon: <Layers className="h-3 w-3 text-emerald-600" />,
        };
      case "PRICE_CHANGE":
        return {
          label: "Price Variance",
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: <DollarSign className="h-3 w-3 text-amber-600" />,
        };
      case "QTY_CHANGE":
        return {
          label: "Quantity Shift",
          bg: "bg-blue-50 text-blue-800 border-blue-200",
          icon: <Hash className="h-3 w-3 text-blue-600" />,
        };
      case "RENAMED_ITEM":
        return {
          label: "Renamed Spec",
          bg: "bg-purple-50 text-purple-800 border-purple-200",
          icon: <Eye className="h-3 w-3 text-purple-600" />,
        };
      case "DATE_CHANGE":
        return {
          label: "Date Shift",
          bg: "bg-purple-50 text-purple-800 border-purple-200",
          icon: <Calendar className="h-3 w-3 text-purple-600" />,
        };
      case "FORMATTING_ONLY":
      default:
        return {
          label: "Layout Immunity",
          bg: "bg-gray-100 text-gray-600 border-gray-200",
          icon: <CheckCircle2 className="h-3 w-3 text-gray-500" />,
        };
    }
  };

  const renderVarianceDelta = (diff: CommercialDiff) => {
    if (diff.type === "PRICE_CHANGE" && diff.originalValue !== undefined && diff.revisedValue !== undefined) {
      return (
        <div className="font-mono text-sm tabular-nums">
          <span className="text-gray-400 line-through mr-1.5">
            {String(diff.originalValue).startsWith("$") || String(diff.originalValue).startsWith("€")
              ? diff.originalValue
              : `$${diff.originalValue}`}
          </span>
          <span className="text-gray-900 font-bold">
            {String(diff.revisedValue).startsWith("$") || String(diff.revisedValue).startsWith("€")
              ? diff.revisedValue
              : `$${diff.revisedValue}`}
          </span>
        </div>
      );
    }
    if (diff.type === "QTY_CHANGE" && diff.originalValue !== undefined && diff.revisedValue !== undefined) {
      return (
        <div className="font-mono text-sm tabular-nums">
          <span className="text-gray-400 line-through mr-1.5">{diff.originalValue} units</span>
          <span className="text-gray-900 font-bold">{diff.revisedValue} units</span>
        </div>
      );
    }
    if (diff.type === "ARITHMETIC_ERROR" && diff.delta !== undefined) {
      return (
        <span className="font-mono text-sm text-rose-700 font-bold">
          {String(diff.delta)} Error
        </span>
      );
    }
    if (diff.type === "SCOPE_REMOVED" && diff.delta !== undefined) {
      return <span className="font-mono text-sm text-orange-700 font-semibold">{diff.delta}</span>;
    }
    if (diff.type === "SCOPE_ADDED" && diff.delta !== undefined) {
      return <span className="font-mono text-sm text-emerald-700 font-semibold">{diff.delta}</span>;
    }
    if (diff.type === "DATE_CHANGE") {
      return <span className="text-sm text-purple-700 font-semibold">Timeline Shift</span>;
    }
    if (diff.type === "RENAMED_ITEM") {
      return <span className="text-sm text-purple-700 font-semibold">Scope Matched</span>;
    }
    if (diff.type === "REORDERED") {
      return <span className="text-sm text-gray-500">{diff.revisedValue}</span>;
    }
    return <span className="text-sm text-gray-400">{diff.delta ? String(diff.delta) : "—"}</span>;
  };

  const substantiveCount = diffs.filter((d) => d.isSubstantive).length;
  const formattingCount = diffs.filter((d) => !d.isSubstantive).length;
  const arithmeticCount = diffs.filter((d) => d.type === "ARITHMETIC_ERROR").length;

  return (
    <div className="case-study-card p-4 sm:p-6 md:p-8 space-y-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
      
      {/* Top Header, Mode Switcher & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900">
              Differential Matrix
            </h3>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
              {diffs.length} Total Diffs
            </span>
          </div>
          <p className="text-xs text-gray-500 font-normal mt-0.5">
            Select any item to pin and highlight exact bounding coordinates in Document A and Document B.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          </div>

          {/* Search Field */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items, specs, or diffs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Segmented Filter Tabs & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("substantive")}
            className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "substantive"
                ? "bg-gray-900 text-white shadow-sm border border-gray-900"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>Substantive Alterations</span>
            <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
              activeTab === "substantive" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
            }`}>
              {substantiveCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("formatting")}
            className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "formatting"
                ? "bg-gray-900 text-white shadow-sm border border-gray-900"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>Formatting Immunity</span>
            <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
              activeTab === "formatting" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
            }`}>
              {formattingCount}
            </span>
          </button>

          {arithmeticCount > 0 && (
            <button
              onClick={() => setActiveTab("arithmetic")}
              className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "arithmetic"
                  ? "bg-[#e21022] text-white shadow-sm border border-[#e21022]"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <span>Arithmetic Errors</span>
              <span className={`font-mono text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "arithmetic" ? "bg-white/20 text-white" : "bg-rose-200 text-rose-900"
              }`}>
                {arithmeticCount}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("scope")}
            className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "scope"
                ? "bg-gray-900 text-white shadow-sm border border-gray-900"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>Scope</span>
          </button>

          <button
            onClick={() => setActiveTab("pricing")}
            className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "pricing"
                ? "bg-gray-900 text-white shadow-sm border border-gray-900"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>Price &amp; Qty</span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "all"
                ? "bg-gray-900 text-white shadow-sm border border-gray-900"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>All ({diffs.length})</span>
          </button>
        </div>

        {/* Expand / Collapse All for Cards Mode */}
        {viewMode === "cards" && filteredDiffs.length > 0 && (
          <button
            onClick={() => toggleAllCards(filteredDiffs)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            <span>
              {expandedIds.size >= filteredDiffs.length ? "Collapse All" : "Expand All"}
            </span>
          </button>
        )}
      </div>

      {/* VIEW MODE 1: Collapsible Cards View (Accordion) */}
      {viewMode === "cards" && (
        <div className="space-y-3">
          {filteredDiffs.length === 0 ? (
            <div className="py-12 text-center text-gray-500 font-mono text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No differences match the selected filter category.
            </div>
          ) : (
            filteredDiffs.map((diff) => {
              const isSelected = activeDiff?.id === diff.id;
              const isExpanded = expandedIds.has(diff.id);
              const badge = getDiffBadge(diff.type);

              return (
                <div
                  key={diff.id}
                  className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {/* Card Header (Tap to Expand / Collapse) */}
                  <div
                    onClick={() => toggleCard(diff.id)}
                    className="w-full text-left p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none bg-white hover:bg-gray-50/80 transition"
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${badge.bg}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm sm:text-base leading-snug">
                            {diff.title}
                          </span>
                          {!diff.isSubstantive && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase font-medium shrink-0">
                              Non-Substantive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <div className="text-left sm:text-right">
                        {renderVarianceDelta(diff)}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100/80 border border-gray-200 px-2 py-1 rounded-md">
                        <span>{isExpanded ? "Collapse" : "Expand"}</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </div>

                  {/* Card Accordion Body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 space-y-3.5 border-t border-gray-100 bg-gray-50/60">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                          Substantive Modification Details
                        </span>
                        <p className="text-sm text-gray-700 leading-relaxed font-normal bg-white p-3 rounded-lg border border-gray-200/90 shadow-2xs">
                          {diff.description}
                        </p>
                      </div>

                      {/* Coordinates & Quick Action */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                            Dual Source Coordinate Anchors
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                            <span className="px-2.5 py-1 rounded bg-white border border-gray-200 font-medium text-gray-700 shadow-2xs">
                              Doc A: P.{diff.originalLocation?.page ?? 1}, L.{diff.originalLocation?.lineNumber ?? 1}
                            </span>
                            <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="px-2.5 py-1 rounded bg-white border border-gray-200 font-medium text-gray-700 shadow-2xs">
                              Doc B: P.{diff.revisedLocation?.page ?? 1}, L.{diff.revisedLocation?.lineNumber ?? 1}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDiff(diff);
                            const viewer = document.getElementById("pdf-dual-viewer");
                            if (viewer) {
                              viewer.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                          className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-gray-900 text-white hover:bg-gray-800"
                          }`}
                        >
                          <Crosshair className="h-3.5 w-3.5" />
                          <span>{isSelected ? "Coordinates Active" : "Inspect in PDF Canvas"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: Differential Table with Horizontal Scroll Cues */}
      {viewMode === "table" && (
        <div className="space-y-2">
          {/* Mobile / Tablet Horizontal Swipe Cue Banner */}
          <div className="lg:hidden flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs text-indigo-950 font-medium shadow-2xs">
            <span className="flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span>Scroll horizontally to view all 4 columns</span>
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-md">
              <span>Swipe</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>

          <div className="relative">
            {/* Left Scroll Indicator & Button */}
            {canScrollTableLeft && (
              <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-4 pl-1 bg-linear-to-r from-white via-white/95 to-transparent pointer-events-none">
                <button
                  onClick={() => handleTableScroll("left")}
                  className="pointer-events-auto p-1.5 rounded-full bg-white border border-gray-300 text-gray-700 shadow-md hover:bg-gray-50 active:scale-95 transition cursor-pointer"
                  aria-label="Scroll table left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Overflow Table Container */}
            <div
              ref={tableScrollerRef}
              className="overflow-x-auto rounded-xl border border-gray-200 shadow-xs scrollbar-thin scroll-smooth"
            >
              <table className="w-full text-left border-collapse bg-white min-w-170">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-500 uppercase tracking-wider text-xs">
                    <th className="py-3 px-4">Change Classification</th>
                    <th className="py-3 px-4">Commercial Item &amp; Substantive Details</th>
                    <th className="py-3 px-4 text-right">Variance Delta</th>
                    <th className="py-3 px-4">Dual Source Coordinate Anchors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDiffs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500 font-mono text-sm">
                        No differences match the selected filter category.
                      </td>
                    </tr>
                  ) : (
                    filteredDiffs.map((diff) => {
                      const isSelected = activeDiff?.id === diff.id;
                      const badge = getDiffBadge(diff.type);

                      return (
                        <tr
                          key={diff.id}
                          onClick={() => onSelectDiff(diff)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-indigo-50/50 ring-1 ring-inset ring-indigo-500/20 font-medium"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          {/* Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap align-top">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${badge.bg}`}>
                              {badge.icon}
                              <span>{badge.label}</span>
                            </span>
                          </td>

                          {/* Title & Description */}
                          <td className="py-3.5 px-4 align-top max-w-xs sm:max-w-md">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm">
                                {diff.title}
                              </span>
                              {!diff.isSubstantive && (
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 uppercase font-medium">
                                  Non-Substantive
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                              {diff.description}
                            </p>
                          </td>

                          {/* Values / Delta */}
                          <td className="py-3.5 px-4 text-right align-top whitespace-nowrap font-mono text-sm tabular-nums">
                            {renderVarianceDelta(diff)}
                          </td>

                          {/* Dual Source Anchors */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap font-mono text-xs">
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <span className="px-2.5 py-1 rounded bg-gray-50 border border-gray-200 font-medium text-gray-700">
                                Doc A: P.{diff.originalLocation?.page ?? 1}, L.{diff.originalLocation?.lineNumber ?? 1}
                              </span>
                              <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                              <span className="px-2.5 py-1 rounded bg-gray-50 border border-gray-200 font-medium text-gray-700">
                                Doc B: P.{diff.revisedLocation?.page ?? 1}, L.{diff.revisedLocation?.lineNumber ?? 1}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Right Scroll Indicator & Button */}
            {canScrollTableRight && (
              <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-4 pr-1 bg-linear-to-l from-white via-white/95 to-transparent pointer-events-none">
                <button
                  onClick={() => handleTableScroll("right")}
                  className="pointer-events-auto p-1.5 rounded-full bg-white border border-gray-300 text-gray-700 shadow-md hover:bg-gray-50 active:scale-95 transition cursor-pointer"
                  aria-label="Scroll table right"
                >
                  <ChevronRight className="h-4 w-4 animate-pulse" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
