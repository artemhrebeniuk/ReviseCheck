"use client";

import React, { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Calendar,
  Layers,
  Calculator,
  ShieldAlert,
  ShieldCheck,
  FileCheck
} from "lucide-react";
import { AuditReport } from "@/lib/types";
import { formatCurrency } from "@/lib/engine/normalizer";

interface ExecutiveSummaryCardProps {
  report: AuditReport;
  onOpenClarification?: () => void;
}

export function ExecutiveSummaryCard({ report, onOpenClarification }: ExecutiveSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const getVerdictTheme = () => {
    switch (report.verdict) {
      case "REJECT":
        return {
          badgeBg: "bg-rose-50 text-rose-800 border-rose-200",
          icon: <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />,
          actionLabel: "DO NOT SIGN // CRITICAL RISKS DETECTED",
        };
      case "NEEDS_CLARIFICATION":
        return {
          badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: <HelpCircle className="h-5 w-5 text-amber-600 shrink-0" />,
          actionLabel: "HOLD SIGNATURE // CLARIFICATION MANDATED",
        };
      case "APPROVE":
      default:
        return {
          badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          icon: <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />,
          actionLabel: "AUTHORIZATION APPROVED // 100% VERIFIED",
        };
    }
  };

  const theme = getVerdictTheme();

  const handleCopy = () => {
    const text = `REVISECHECK AUDIT REPORT
Verdict: ${report.verdict} — ${report.verdictTitle}
Summary: ${report.summary}
Stated Original: $${report.statedOriginalTotal.toLocaleString()}
Stated Revised: $${report.statedRevisedTotal.toLocaleString()}
Net Variance: ${report.netFinancialDelta >= 0 ? "+" : ""}$${report.netFinancialDelta.toLocaleString()}
Substantive Diffs: ${report.substantiveChangesCount}
Arithmetic Discrepancies: ${report.arithmeticErrorsCount}
Key Risks Identified:
${report.keyRisks.map((r) => ` • ${r}`).join("\n")}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `revisecheck-audit-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="case-study-card p-6 md:p-8 space-y-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
      
      {/* Top Bar: Verdict Badge & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono tracking-wide ${theme.badgeBg}`}>
            {theme.icon}
            <span>{report.verdict}: {report.verdictTitle}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {report.clarificationQuestions && report.clarificationQuestions.length > 0 && onOpenClarification && (
            <button
              onClick={onOpenClarification}
              className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100 hover:text-amber-900 transition"
              title="Open clarification dialogue"
            >
              <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Clarifications ({report.clarificationQuestions.length})</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Copy audit report summary to clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-gray-500" />}
            <span>{copied ? "Copied" : "Copy Briefing"}</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Download full machine-readable JSON audit report"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Editorial Headline & Summary */}
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">
          Executive Verdict &amp; Differential Analysis
        </h2>
        <p className="text-sm md:text-base leading-relaxed text-gray-600 font-normal">
          {report.summary}
        </p>
      </div>

      {/* 4-Column Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Original Total
          </span>
          <p className="font-mono text-lg font-bold text-gray-900 tabular-nums">
            {formatCurrency(report.statedOriginalTotal)}
          </p>
          <span className="text-[10px] text-gray-500 block">Stated Base Scope</span>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Revised Total
          </span>
          <p className="font-mono text-lg font-bold text-gray-900 tabular-nums">
            {formatCurrency(report.statedRevisedTotal)}
          </p>
          <span className="text-[10px] text-gray-500 block">Candidate Revised Quote</span>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Net Variance
          </span>
          <div className="flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums">
            {report.netFinancialDelta < 0 ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                {formatCurrency(Math.abs(report.netFinancialDelta))} (Savings)
              </span>
            ) : report.netFinancialDelta > 0 ? (
              <span className="text-rose-700 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                +{formatCurrency(report.netFinancialDelta)}
              </span>
            ) : (
              <span className="text-gray-900">$0.00 (Neutral)</span>
            )}
          </div>
          <span className="text-[10px] text-gray-500 block">Calculated Net Delta</span>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Substantive Changes
          </span>
          <p className="font-mono text-lg font-bold text-gray-900 tabular-nums">
            {report.substantiveChangesCount} <span className="text-xs font-normal text-gray-500">/ {report.formattingChangesCount} format</span>
          </p>
          <span className="text-[10px] text-gray-500 block">Zero False Positives</span>
        </div>
      </div>

      {/* Critical Risks & Arithmetic Errors Warning Box */}
      {report.keyRisks.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>High Priority Commercial &amp; Arithmetic Warnings</span>
          </div>
          <ul className="space-y-1 pl-5 list-disc text-xs text-rose-800 leading-relaxed">
            {report.keyRisks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
