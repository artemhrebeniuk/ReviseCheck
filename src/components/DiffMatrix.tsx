"use client";

import React, { useState } from "react";
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
  Tag
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

  const substantiveCount = diffs.filter((d) => d.isSubstantive).length;
  const formattingCount = diffs.filter((d) => !d.isSubstantive).length;
  const arithmeticCount = diffs.filter((d) => d.type === "ARITHMETIC_ERROR").length;

  return (
    <div className="case-study-card p-6 md:p-8 space-y-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
      
      {/* Top Header & Search */}
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

        {/* Search Field */}
        <div className="relative w-full lg:w-72">
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

      {/* Segmented Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab("substantive")}
          className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "substantive"
              ? "bg-gray-900 text-white shadow-sm border border-gray-900"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <span>Substantive Alterations</span>
          <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === "substantive" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
          }`}>
            {substantiveCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("formatting")}
          className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "formatting"
              ? "bg-gray-900 text-white shadow-sm border border-gray-900"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <span>Formatting Immunity</span>
          <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === "formatting" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
          }`}>
            {formattingCount}
          </span>
        </button>

        {arithmeticCount > 0 && (
          <button
            onClick={() => setActiveTab("arithmetic")}
            className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "arithmetic"
                ? "bg-[#e21022] text-white shadow-sm border border-[#e21022]"
                : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
            }`}
          >
            <span>Arithmetic Errors</span>
            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === "arithmetic" ? "bg-white/20 text-white" : "bg-rose-200 text-rose-900"
            }`}>
              {arithmeticCount}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("scope")}
          className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "scope"
              ? "bg-gray-900 text-white shadow-sm border border-gray-900"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <span>Scope Additions / Deletions</span>
        </button>

        <button
          onClick={() => setActiveTab("pricing")}
          className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "pricing"
              ? "bg-gray-900 text-white shadow-sm border border-gray-900"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <span>Price &amp; Quantity</span>
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "all"
              ? "bg-gray-900 text-white shadow-sm border border-gray-900"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <span>All Changes ({diffs.length})</span>
        </button>
      </div>

      {/* Differential Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-xs">
        <table className="w-full text-left border-collapse text-xs bg-white">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Change Classification</th>
              <th className="py-3 px-4">Commercial Item &amp; Substantive Details</th>
              <th className="py-3 px-4 text-right">Variance Delta</th>
              <th className="py-3 px-4">Dual Source Coordinate Anchors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredDiffs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500 font-mono text-xs">
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
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${badge.bg}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* Title & Description */}
                    <td className="py-3.5 px-4 align-top max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs">
                          {diff.title}
                        </span>
                        {!diff.isSubstantive && (
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase">
                            Non-Substantive
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mt-0.5 text-xs leading-relaxed">
                        {diff.description}
                      </p>
                    </td>

                    {/* Values / Delta */}
                    <td className="py-3.5 px-4 text-right align-top whitespace-nowrap font-mono text-xs tabular-nums">
                      {diff.type === "PRICE_CHANGE" && diff.originalValue !== undefined && diff.revisedValue !== undefined && (
                        <div>
                          <span className="text-gray-500 line-through mr-1.5">${diff.originalValue}</span>
                          <span className="text-gray-900 font-bold">${diff.revisedValue}</span>
                        </div>
                      )}
                      {diff.type === "QTY_CHANGE" && diff.originalValue !== undefined && diff.revisedValue !== undefined && (
                        <div>
                          <span className="text-gray-500 line-through mr-1.5">{diff.originalValue} units</span>
                          <span className="text-gray-900 font-bold">{diff.revisedValue} units</span>
                        </div>
                      )}
                      {diff.type === "ARITHMETIC_ERROR" && diff.delta !== undefined && (
                        <span className="text-rose-700 font-bold">
                          {Number(diff.delta) > 0 ? `+$${diff.delta}` : `-$${Math.abs(Number(diff.delta))}`} Error
                        </span>
                      )}
                      {diff.type === "DATE_CHANGE" && (
                        <span className="text-purple-700 font-semibold">Timeline Shift</span>
                      )}
                      {!["PRICE_CHANGE", "QTY_CHANGE", "ARITHMETIC_ERROR", "DATE_CHANGE"].includes(diff.type) && (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Dual Source Anchors */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap font-mono text-[10px]">
                      <div className="flex items-center gap-1 text-gray-500">
                        <span className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200">
                          Doc A: P.{diff.originalLocation?.page ?? 1}, L.{diff.originalLocation?.lineNumber ?? 1}
                        </span>
                        <span className="text-gray-400">➔</span>
                        <span className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200">
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

    </div>
  );
}
