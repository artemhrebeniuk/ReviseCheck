"use client";

import React, { useState, useEffect } from "react";
import {
  FileSearch,
  Calculator,
  GitCompare,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

interface AnalysisStepperProps {
  customMessage?: string;
}

interface StepInfo {
  id: number;
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepInfo[] = [
  {
    id: 1,
    title: "Parsing PDF & Spatial Mapping",
    detail:
      "Extracting vector text streams, bounding boxes & tabular geometry across pages",
    icon: FileSearch,
  },
  {
    id: 2,
    title: "Deterministic Math Audit (Decimal.js)",
    detail:
      "Auditing line item qty × price products and grand totals with zero floating-point drift",
    icon: Calculator,
  },
  {
    id: 3,
    title: "Entity Matching & Layout Filtering",
    detail:
      "Reconciling line items across pages, catching reorders & filtering font/column transposition",
    icon: GitCompare,
  },
  {
    id: 4,
    title: "Executive Synthesis & Decision Matrix",
    detail:
      "Synthesizing APPROVE / REJECT verdict, financial delta, and actionable signing briefing",
    icon: ShieldCheck,
  },
];

export function AnalysisStepper({ customMessage }: AnalysisStepperProps) {
  const [activeStep, setActiveStep] = useState<number>(1);

  useEffect(() => {
    // Progressive stepper simulation for immediate feedback
    const t1 = setTimeout(() => setActiveStep(2), 350);
    const t2 = setTimeout(() => setActiveStep(3), 850);
    const t3 = setTimeout(() => setActiveStep(4), 1450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-3xl mx-auto my-6">
      {/* Top Header */}
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-mono font-semibold uppercase tracking-wider">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          <span>Audit Pipeline in Progress</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 font-display tracking-tight">
          Differential Inspection &amp; Arithmetic Engine
        </h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          {customMessage ||
            "Executing 4-stage deterministic analysis across commercial documents..."}
        </p>
      </div>

      {/* 4-Stage Stepper List */}
      <div className="space-y-4 relative">
        {STEPS.map((step, idx) => {
          const isCompleted = activeStep > step.id;
          const isActive = activeStep === step.id;
          const isPending = activeStep < step.id;
          const StepIcon = step.icon;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.08 }}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 ${
                isActive
                  ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-500/30 shadow-xs"
                  : isCompleted
                    ? "bg-slate-50/80 border-slate-200/80 text-gray-800"
                    : "bg-white border-gray-100 opacity-50"
              }`}
            >
              {/* Step Status Icon */}
              <div className="shrink-0 mt-0.5">
                {isCompleted ? (
                  <div className="h-9 w-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                ) : isActive ? (
                  <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md ring-4 ring-blue-100 animate-pulse">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center border border-gray-200">
                    <StepIcon className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Step Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : isCompleted
                            ? "bg-slate-200 text-slate-800"
                            : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      Stage 0{step.id}
                    </span>
                    <h4
                      className={`text-sm sm:text-base font-bold ${
                        isActive
                          ? "text-blue-950"
                          : isCompleted
                            ? "text-gray-900"
                            : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </h4>
                  </div>

                  {/* Stage State Badge */}
                  <span className="text-sm font-mono">
                    {isCompleted && (
                      <span className="text-emerald-700 font-semibold">
                        Completed
                      </span>
                    )}
                    {isActive && (
                      <span className="text-blue-700 font-semibold animate-pulse">
                        Processing...
                      </span>
                    )}
                    {isPending && <span className="text-gray-400">Queued</span>}
                  </span>
                </div>

                <p className="text-sm font-mono text-gray-500 mt-1.5 leading-relaxed">
                  {step.detail}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Engine Status Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Deterministic Local Execution (0 Cloud Leakage)</span>
        </span>
        <span>Decimal.js Precision: 28 Digits</span>
      </div>
    </div>
  );
}
