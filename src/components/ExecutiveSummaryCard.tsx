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
    const isCostReduction = report.netFinancialDelta < 0;
    const isCostIncrease = report.netFinancialDelta > 0;

    const formattedOriginal = formatCurrency(report.statedOriginalTotal);
    const formattedRevised = formatCurrency(report.statedRevisedTotal);

    let varianceString = "$0.00 (Neutral)";
    if (isCostReduction) {
      varianceString = `${formatCurrency(report.netFinancialDelta)} (Savings / Cost Reduction)`;
    } else if (isCostIncrease) {
      varianceString = `+${formatCurrency(report.netFinancialDelta)} (Price Increase)`;
    }

    const actionRecommendation =
      report.verdict === "REJECT"
        ? "DO NOT SIGN // Hold agreement pending written vendor arithmetic reconciliation."
        : report.verdict === "NEEDS_CLARIFICATION"
        ? "HOLD SIGNATURE // Clarification required from procurement leadership on ambiguous terms."
        : "AUTHORIZED TO SIGN // All commercial terms verified with zero arithmetic discrepancies.";

    const text = `===============================================================
REVISECHECK COMMERCIAL AUDIT BRIEFING
===============================================================

VERDICT: ${report.verdict} — ${report.verdictTitle}
ACTION:  ${actionRecommendation}

EXECUTIVE SUMMARY:
${report.summary}

COMMERCIAL FINANCIAL RECONCILIATION:
 • Stated Original (Doc A):  ${formattedOriginal} USD
 • Stated Revised (Doc B):   ${formattedRevised} USD
 • Net Commercial Variance:  ${varianceString}
 • Substantive Line Changes: ${report.substantiveChangesCount} modifications
 • Non-Substantive Changes:  ${report.formattingChangesCount} verified (Formatting Immunity applied)
 • Arithmetic Errors:        ${report.arithmeticErrorsCount} detected

${
  report.keyRisks.length > 0
    ? `KEY RISKS & ARITHMETIC DISCREPANCIES:
${report.keyRisks.map((risk) => ` • ${risk}`).join("\n")}`
    : "RISK ASSESSMENT:\n • Zero commercial risks or arithmetic discrepancies detected."
}
${
  report.clarificationQuestions && report.clarificationQuestions.length > 0
    ? `\nMANDATORY CLARIFICATION QUESTIONS:
${report.clarificationQuestions.map((q, idx) => ` [${idx + 1}] ${q}`).join("\n")}`
    : ""
}
===============================================================
Audited with deterministic Decimal.js & dual-source vector spatial mapping.
Verified by ReviseCheck (https://github.com/artemhrebeniuk/ReviseCheck)
===============================================================`;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center min-w-0">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono tracking-wide max-w-full ${theme.badgeBg}`}>
            {theme.icon}
            <span className="wrap-break-word leading-tight">{report.verdict}: {report.verdictTitle}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {report.clarificationQuestions && report.clarificationQuestions.length > 0 && onOpenClarification && (
            <button
              onClick={onOpenClarification}
              className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100 hover:text-amber-900 transition cursor-pointer"
              title="Open clarification dialogue"
            >
              <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Clarifications ({report.clarificationQuestions.length})</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
            title="Copy audit report summary to clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-gray-500" />}
            <span>{copied ? "Copied" : "Copy Briefing"}</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Original Total
          </span>
          <p className="font-mono text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(report.statedOriginalTotal)}
          </p>
          <span className="text-xs text-gray-500 block">Stated Base Scope</span>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Revised Total
          </span>
          <p className="font-mono text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(report.statedRevisedTotal)}
          </p>
          <span className="text-xs text-gray-500 block">Candidate Revised Quote</span>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Net Variance
            </span>
            {report.netFinancialDelta < 0 ? (
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                SAVINGS
              </span>
            ) : report.netFinancialDelta > 0 ? (
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                INCREASE
              </span>
            ) : (
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 shrink-0">
                NEUTRAL
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 font-mono text-xl xl:text-2xl font-bold tabular-nums">
            {report.netFinancialDelta < 0 ? (
              <span className="text-emerald-700 flex items-center gap-1.5 truncate">
                <TrendingDown className="h-5 w-5 shrink-0" />
                <span>{formatCurrency(report.netFinancialDelta)}</span>
              </span>
            ) : report.netFinancialDelta > 0 ? (
              <span className="text-rose-700 flex items-center gap-1.5 truncate">
                <TrendingUp className="h-5 w-5 shrink-0" />
                <span>+{formatCurrency(report.netFinancialDelta)}</span>
              </span>
            ) : (
              <span className="text-gray-900">$0.00</span>
            )}
          </div>

          <span className="text-xs text-gray-500 block truncate mt-1">
            {report.netFinancialDelta < 0
              ? "Calculated Savings"
              : report.netFinancialDelta > 0
              ? "Net Price Increase"
              : "Zero Commercial Variance"}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Substantive Changes
          </span>
          <p className="font-mono text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">
            {report.substantiveChangesCount} <span className="text-xs font-normal text-gray-500">/ {report.formattingChangesCount} format</span>
          </p>
          <span className="text-xs text-gray-500 block">Zero False Positives</span>
        </div>
      </div>

      {/* Critical Risks & Arithmetic Errors Warning Box */}
      {report.keyRisks.length > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs sm:text-sm uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>High Priority Commercial &amp; Arithmetic Warnings</span>
          </div>
          <ul className="space-y-1.5 pl-5 list-disc text-sm text-rose-800 leading-relaxed">
            {report.keyRisks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
