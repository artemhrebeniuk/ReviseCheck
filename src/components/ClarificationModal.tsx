"use client";

import React, { useState } from "react";
import { HelpCircle, AlertTriangle, Check, X, ShieldAlert, ArrowRight } from "lucide-react";

interface ClarificationModalProps {
  isOpen: boolean;
  questions: string[];
  onClose: () => void;
  onResolveQuestion: (index: number, answer: string) => void;
  onApplyClarifications?: (resolved: Record<number, string>) => void;
}

export function ClarificationModal({
  isOpen,
  questions,
  onClose,
  onResolveQuestion,
  onApplyClarifications,
}: ClarificationModalProps) {
  const [resolved, setResolved] = useState<Record<number, string>>({});

  if (!isOpen || questions.length === 0) return null;

  const handleSelect = (idx: number, answer: string) => {
    setResolved((prev) => ({ ...prev, [idx]: answer }));
    onResolveQuestion(idx, answer);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Human-In-The-Loop Guard
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight mt-0.5">
                Commercial Ambiguity Intercept
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="tactile-btn active:scale-95 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed font-sans">
          The deterministic engine declined to issue an automatic conclusion due to unresolvable contract ambiguities (e.g. currency conflict, uncommitted delivery schedule). Please clarify below:
        </p>

        {/* Question Cards */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {questions.map((q, idx) => (
            <div
              key={idx}
              className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2.5 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <span className="text-gray-900 font-medium text-sm leading-relaxed">{q}</span>
              </div>

              <div className="flex items-center gap-2 pt-1 pl-7">
                <button
                  onClick={() => handleSelect(idx, "CONFIRMED")}
                  className={`tactile-btn active:scale-95 px-3.5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    resolved[idx] === "CONFIRMED"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <Check className="h-4 w-4" />
                  <span>Confirm Scope</span>
                </button>

                <button
                  onClick={() => handleSelect(idx, "REJECTED")}
                  className={`tactile-btn active:scale-95 px-3.5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    resolved[idx] === "REJECTED"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <X className="h-4 w-4" />
                  <span>Reject Discrepancy</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-gray-100">
          <span className="text-sm font-mono text-gray-500">
            {Object.keys(resolved).length} of {questions.length} inquiries resolved
          </span>
          <button
            onClick={() => {
              if (onApplyClarifications) {
                onApplyClarifications(resolved);
              }
              onClose();
            }}
            className="tactile-btn active:scale-95 px-4 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm cursor-pointer"
          >
            Apply Clarifications
          </button>
        </div>

      </div>
    </div>
  );
}
