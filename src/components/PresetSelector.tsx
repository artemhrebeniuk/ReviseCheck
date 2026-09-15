"use client";

import React, { useRef, useState } from "react";
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
  Check
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
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);

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
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Benchmark Suites ({suites.length})
        </h4>
        <button
          onClick={() => setShowUploadPanel(!showUploadPanel)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
        >
          <Upload className="h-3 w-3" />
          <span>{showUploadPanel ? "Close Upload" : "Upload Custom"}</span>
        </button>
      </div>

      {/* Custom Upload Drawer */}
      {showUploadPanel && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900">Upload Custom PDF Proposals</span>
            <span className="text-[10px] font-mono text-gray-500">Max 3 Pages • 10 Items</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div 
              onClick={() => file1Ref.current?.click()}
              className="border border-dashed border-gray-300 rounded-lg p-2.5 bg-white text-center cursor-pointer hover:border-indigo-400 transition"
            >
              <input
                ref={file1Ref}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile1(e.target.files?.[0] || null)}
              />
              <span className="text-xs font-medium text-gray-600 truncate block">
                {file1 ? `✓ Doc A: ${file1.name}` : "Click to select Document A (Original)"}
              </span>
            </div>

            <div 
              onClick={() => file2Ref.current?.click()}
              className="border border-dashed border-gray-300 rounded-lg p-2.5 bg-white text-center cursor-pointer hover:border-indigo-400 transition"
            >
              <input
                ref={file2Ref}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile2(e.target.files?.[0] || null)}
              />
              <span className="text-xs font-medium text-gray-600 truncate block">
                {file2 ? `✓ Doc B: ${file2.name}` : "Click to select Document B (Revised)"}
              </span>
            </div>
          </div>

          <button
            onClick={handleCustomSubmit}
            disabled={!file1 || !file2 || isLoading}
            className="w-full py-2 px-3 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <FileUp className="h-3.5 w-3.5" />
            <span>{isLoading ? "Analyzing Proposals..." : "Audit Custom Proposals"}</span>
          </button>
        </div>
      )}

      {/* 8 Benchmark Suite Cards */}
      <div className="space-y-1.5 max-h-115 overflow-y-auto pr-1">
        {suites.map((suite) => {
          const isSelected = currentPreset === suite.id;
          const Icon = suite.icon;

          return (
            <button
              key={suite.id}
              onClick={() => onSelectPreset(suite.id)}
              disabled={isLoading}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? "bg-white border-gray-300 shadow-sm ring-1 ring-gray-900/5"
                  : "bg-gray-50 hover:bg-white border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isSelected ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-600"
                  }`}>
                    {suite.index}
                  </span>
                  <h5 className={`font-bold text-xs truncate ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                    {suite.name}
                  </h5>
                </div>
                <span className="text-[10px] font-mono text-gray-500 shrink-0">
                  {suite.tag}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed font-normal">
                {suite.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
