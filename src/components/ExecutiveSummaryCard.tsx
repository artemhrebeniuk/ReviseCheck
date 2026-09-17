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
  FileCheck,
  Info,
} from "lucide-react";
import { AuditReport } from "@/lib/types";
import { formatCurrency } from "@/lib/engine/normalizer";

interface ExecutiveSummaryCardProps {
  report: AuditReport;
  onOpenClarification?: () => void;
}

export function ExecutiveSummaryCard({
  report,
  onOpenClarification,
}: ExecutiveSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const getCleanVerdictInfo = () => {
    switch (report.verdict) {
      case "REJECT":
        return {
          pill: "REJECT / HOLD",
          subtitle: "Arithmetic Discrepancies in Source",
        };
      case "NEEDS_CLARIFICATION":
        return {
          pill: "DECLINE TO CONCLUDE",
          subtitle: "Clarification Required Before Approval",
        };
      case "APPROVE":
      default:
        if (report.substantiveChangesCount === 0) {
          return {
            pill: "APPROVED",
            subtitle: "Formatting & Layout Update Only",
          };
        }
        if (report.netFinancialDelta > 0.01) {
          return {
            pill: "REVIEW & APPROVE",
            subtitle: "Price Increase Verified",
          };
        }
        return {
          pill: "READY TO APPROVE",
          subtitle:
            report.netFinancialDelta < -0.01
              ? "Cost Savings Verified"
              : "Commercial Variations Verified",
        };
    }
  };

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
        if (
          report.substantiveChangesCount > 0 &&
          report.netFinancialDelta > 0.01
        ) {
          return {
            badgeBg: "bg-blue-50 text-blue-900 border-blue-200",
            icon: <FileCheck className="h-5 w-5 text-blue-600 shrink-0" />,
            actionLabel: "COMMERCIAL REVIEW // PRICE INCREASE VERIFIED",
          };
        }
        return {
          badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          icon: <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />,
          actionLabel: "AUTHORIZATION APPROVED // 100% VERIFIED",
        };
    }
  };

  const theme = getVerdictTheme();
  const verdictInfo = getCleanVerdictInfo();

  const handleCopy = () => {
    const isCurrencyMismatch =
      (report.doc1Currency &&
        report.doc2Currency &&
        report.doc1Currency !== report.doc2Currency) ||
      report.diffs.some((d) => d.id === "currency-mismatch");
    const isCostReduction = report.netFinancialDelta < 0;
    const isCostIncrease = report.netFinancialDelta > 0;

    const formattedOriginal = formatCurrency(
      report.statedOriginalTotal,
      report.doc1Currency || "USD",
    );
    const formattedRevised = formatCurrency(
      report.statedRevisedTotal,
      report.doc2Currency || "USD",
    );

    let varianceString = "$0.00 (Neutral)";
    if (isCurrencyMismatch) {
      varianceString = `N/A (Cross-Currency: ${report.doc1Currency || "USD"} vs ${report.doc2Currency || "EUR"} pending forex reconciliation)`;
    } else if (isCostReduction) {
      varianceString = `${formatCurrency(report.netFinancialDelta, report.doc2Currency || "USD")} (${
        report.verdict === "REJECT"
          ? "Disputed Math Variance"
          : "Savings / Cost Reduction"
      })`;
    } else if (isCostIncrease) {
      varianceString = `+${formatCurrency(report.netFinancialDelta, report.doc2Currency || "USD")} (Price Increase)`;
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
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `revisecheck-audit-${Date.now()}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="case-study-card p-6 md:p-8 space-y-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
      {/* Top Bar: Verdict Badge & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center min-w-0">
          <span
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border text-sm sm:text-base md:text-base font-sans tracking-normal max-w-full shadow-2xs ${theme.badgeBg}`}
          >
            {theme.icon}
            <span className="font-black uppercase tracking-wider text-sm sm:text-base">
              {verdictInfo.pill}
            </span>
            <span className="opacity-40 font-light">•</span>
            <span className="font-semibold text-gray-800 tracking-tight">
              {verdictInfo.subtitle}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {report.clarificationQuestions &&
            report.clarificationQuestions.length > 0 &&
            onOpenClarification && (
              <button
                onClick={onOpenClarification}
                className="tactile-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition cursor-pointer active:scale-95"
                title="Open clarification dialogue"
              >
                <HelpCircle className="h-4 w-4 text-amber-600" />
                <span>
                  Clarifications ({report.clarificationQuestions.length})
                </span>
              </button>
            )}

          <button
            onClick={handleCopy}
            className="tactile-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer active:scale-95"
            title="Copy audit report summary to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4 text-gray-500" />
            )}
            <span>{copied ? "Copied" : "Copy Briefing"}</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="tactile-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer active:scale-95"
            title="Download full machine-readable JSON audit report"
          >
            <Download className="h-4 w-4 text-gray-500" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Editorial Headline & Summary */}
      <div className="space-y-2.5">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 font-display">
          Executive Verdict &amp; Differential Analysis
        </h2>
        <p className="text-base md:text-[17px] leading-relaxed text-gray-700 font-normal">
          {report.summary}
        </p>
      </div>

      {/* Metrics Grid - Spacious 2-col layout on desktop, 4-col on ultra-wide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 pt-2">
        {/* Metric 1 - Doc A Baseline */}
        <div className="p-4.5 sm:p-5 rounded-xl bg-slate-50/70 border border-slate-200/90 flex flex-col justify-between h-full min-h-36 hover:border-slate-300 transition-colors">
          <div className="h-6 flex items-center justify-between">
            <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-700">
              Original Total
            </span>
            <span className="text-sm font-sans font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
              DOC A
            </span>
          </div>
          <p className="font-mono text-xl sm:text-2xl 2xl:text-[26px] font-bold text-slate-900 tabular-nums my-2 whitespace-nowrap">
            {formatCurrency(
              report.statedOriginalTotal,
              report.doc1Currency || "USD",
            )}
          </p>
          <span className="text-sm text-slate-500 block">
            Baseline Scope Reference
          </span>
        </div>

        {/* Metric 2 - Doc B Candidate */}
        <div className="p-4.5 sm:p-5 rounded-xl bg-blue-50/40 border border-blue-200/80 flex flex-col justify-between h-full min-h-36 hover:border-blue-300 transition-colors">
          <div className="h-6 flex items-center justify-between">
            <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-blue-900">
              Revised Total
            </span>
            <span className="text-sm font-sans font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              DOC B
            </span>
          </div>
          <p className="font-mono text-xl sm:text-2xl 2xl:text-[26px] font-bold text-gray-900 tabular-nums my-2 whitespace-nowrap">
            {formatCurrency(
              report.statedRevisedTotal,
              report.doc2Currency || "USD",
            )}
          </p>
          <span className="text-sm text-blue-600/80 block">
            Candidate Revised Quote
          </span>
        </div>

        {/* Metric 3 */}
        {(() => {
          const isCurrencyMismatch =
            (report.doc1Currency &&
              report.doc2Currency &&
              report.doc1Currency !== report.doc2Currency) ||
            report.diffs.some((d) => d.id === "currency-mismatch");
          const isRejected = report.verdict === "REJECT";

          return (
            <div className="p-4.5 sm:p-5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between h-full min-h-36 hover:border-gray-300 transition-colors">
              <div className="h-6 flex items-center justify-between gap-2 min-w-0">
                <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-gray-600 truncate">
                  Net Variance
                </span>
                {isCurrencyMismatch ? (
                  <span className="font-sans text-sm font-bold px-2.5 py-0.5 rounded-md border shrink-0 bg-amber-100 text-amber-800 border-amber-200">
                    CURRENCY MISMATCH
                  </span>
                ) : (
                  <span
                    className={`font-sans text-sm font-bold px-2.5 py-0.5 rounded-md border shrink-0 ${
                      report.netFinancialDelta < 0
                        ? isRejected
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : report.netFinancialDelta > 0
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : "bg-gray-200 text-gray-700 border-gray-300"
                    }`}
                  >
                    {report.netFinancialDelta < 0
                      ? isRejected
                        ? "DISPUTED"
                        : "SAVINGS"
                      : report.netFinancialDelta > 0
                        ? "INCREASE"
                        : "NEUTRAL"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xl sm:text-2xl 2xl:text-[26px] font-bold tabular-nums my-2">
                {isCurrencyMismatch ? (
                  <span className="text-amber-800 font-bold whitespace-nowrap text-lg sm:text-xl">
                    N/A (Forex Pending)
                  </span>
                ) : report.netFinancialDelta < 0 ? (
                  <span
                    className={`flex items-center gap-1.5 whitespace-nowrap ${
                      isRejected ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                    <span>
                      {formatCurrency(
                        report.netFinancialDelta,
                        report.doc2Currency || "USD",
                      )}
                    </span>
                  </span>
                ) : report.netFinancialDelta > 0 ? (
                  <span className="text-rose-700 flex items-center gap-1.5 whitespace-nowrap">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                    <span>
                      +
                      {formatCurrency(
                        report.netFinancialDelta,
                        report.doc2Currency || "USD",
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-900 whitespace-nowrap">$0.00</span>
                )}
              </div>

              <span className="text-sm text-gray-500 block">
                {isCurrencyMismatch
                  ? `Cross-Currency (${report.doc1Currency || "USD"} vs ${report.doc2Currency || "EUR"})`
                  : report.netFinancialDelta < 0
                    ? isRejected
                      ? "Unreconciled Source Variance"
                      : "Calculated Savings"
                    : report.netFinancialDelta > 0
                      ? "Net Price Increase"
                      : "Zero Commercial Variance"}
              </span>
            </div>
          );
        })()}

        {/* Metric 4 */}
        <div className="p-4.5 sm:p-5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between h-full min-h-36 hover:border-gray-300 transition-colors">
          <div className="h-6 flex items-center">
            <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-gray-600">
              Substantive Changes
            </span>
          </div>
          <p className="font-mono text-xl sm:text-2xl 2xl:text-[26px] font-bold text-gray-900 tabular-nums my-2 whitespace-nowrap">
            {report.substantiveChangesCount}{" "}
            <span className="text-sm font-normal text-gray-500">
              / {report.formattingChangesCount} format
            </span>
          </p>
          <span className="text-sm text-gray-500 block">
            Zero False Positives
          </span>
        </div>
      </div>

      {/* Risk / Variations Callout Box */}
      {report.keyRisks.length > 0 &&
        (() => {
          const isRejected = report.verdict === "REJECT";
          const isClarification = report.verdict === "NEEDS_CLARIFICATION";

          const boxBg = isRejected
            ? "bg-rose-50 border-rose-200"
            : isClarification
              ? "bg-amber-50 border-amber-200"
              : "bg-slate-50 border-slate-200";

          const titleColor = isRejected
            ? "text-rose-900"
            : isClarification
              ? "text-amber-900"
              : "text-slate-900";

          const textColor = isRejected
            ? "text-rose-800"
            : isClarification
              ? "text-amber-800"
              : "text-slate-700";

          const boxTitle = isRejected
            ? "Critical Rejection Risks & Arithmetic Discrepancies"
            : isClarification
              ? "Contract Inconsistencies & Mandatory Clarifications"
              : "Noted Commercial Variations & Milestones";

          const IconComponent = isRejected
            ? AlertTriangle
            : isClarification
              ? HelpCircle
              : Info;

          return (
            <div
              className={`p-4.5 sm:p-5 rounded-xl border space-y-2 ${boxBg}`}
            >
              <div
                className={`flex items-center gap-2 font-bold text-sm sm:text-base uppercase tracking-wider ${titleColor}`}
              >
                <IconComponent className="h-4.5 w-4.5 shrink-0" />
                <span>{boxTitle}</span>
              </div>
              <ul
                className={`space-y-1.5 pl-5 list-disc text-sm sm:text-base leading-relaxed ${textColor}`}
              >
                {report.keyRisks.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            </div>
          );
        })()}
    </div>
  );
}
