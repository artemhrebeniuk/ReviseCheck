"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { PresetSelector, PresetType } from "@/components/PresetSelector";
import { ExecutiveSummaryCard } from "@/components/ExecutiveSummaryCard";
import { PdfDualCanvasViewer } from "@/components/PdfDualCanvasViewer";
import { DiffMatrix } from "@/components/DiffMatrix";
import { ClarificationModal } from "@/components/ClarificationModal";
import { AuditReport, CommercialDiff } from "@/lib/types";
import { Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [currentPreset, setCurrentPreset] = useState<PresetType>("standard");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [activeDiff, setActiveDiff] = useState<CommercialDiff | null>(null);
  const [showClarification, setShowClarification] = useState<boolean>(false);

  // URLs for the PDF canvas viewer
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string>("/samples/offer_original.pdf");
  const [revisedPdfUrl, setRevisedPdfUrl] = useState<string>("/samples/offer_revised_v1.pdf");

  const clientCacheRef = useRef<Map<string, AuditReport>>(new Map());

  const getPdfUrlsForPreset = (preset: PresetType) => {
    switch (preset) {
      case "hyperscale_3page": return { orig: "/samples/offer_3page_original.pdf", rev: "/samples/offer_3page_revised.pdf" };
      case "cloud_migration": return { orig: "/samples/offer_cloud_migration_orig.pdf", rev: "/samples/offer_cloud_migration_rev.pdf" };
      case "arithmetic_inflation": return { orig: "/samples/offer_arithmetic_inflation_orig.pdf", rev: "/samples/offer_arithmetic_inflation_rev.pdf" };
      case "milestone_schedule": return { orig: "/samples/offer_milestone_schedule_orig.pdf", rev: "/samples/offer_milestone_schedule_rev.pdf" };
      case "formatting": return { orig: "/samples/offer_original.pdf", rev: "/samples/offer_formatting_only.pdf" };
      case "ambiguous": return { orig: "/samples/offer_original.pdf", rev: "/samples/offer_ambiguous.pdf" };
      case "clean_approval": return { orig: "/samples/offer_original.pdf", rev: "/samples/offer_clean_approval.pdf" };
      case "standard":
      default: return { orig: "/samples/offer_original.pdf", rev: "/samples/offer_revised_v1.pdf" };
    }
  };

  const customObjectUrlsRef = useRef<{ orig?: string; rev?: string }>({});

  const loadPreset = async (preset: PresetType) => {
    setError(null);
    setCurrentPreset(preset);

    if (customObjectUrlsRef.current.orig) {
      URL.revokeObjectURL(customObjectUrlsRef.current.orig);
      if (customObjectUrlsRef.current.rev) URL.revokeObjectURL(customObjectUrlsRef.current.rev);
      customObjectUrlsRef.current = {};
    }

    const urls = getPdfUrlsForPreset(preset);
    setOriginalPdfUrl(urls.orig);
    setRevisedPdfUrl(urls.rev);

    if (clientCacheRef.current.has(preset)) {
      const cachedReport = clientCacheRef.current.get(preset)!;
      setReport(cachedReport);
      setActiveDiff(cachedReport.diffs.length > 0 ? cachedReport.diffs[0] : null);
      if (preset === "ambiguous" || cachedReport.verdict === "NEEDS_CLARIFICATION") {
        setShowClarification(true);
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setReport(null);
    setActiveDiff(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
      });
      if (!res.ok) throw new Error("Failed to generate audit report");
      const data = await res.json();
      
      clientCacheRef.current.set(preset, data.report);
      setReport(data.report);
      if (data.report.diffs && data.report.diffs.length > 0) {
        setActiveDiff(data.report.diffs[0]);
      }
      if (preset === "ambiguous" || data.report.verdict === "NEEDS_CLARIFICATION") {
        setShowClarification(true);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomUpload = async (file1: File, file2: File) => {
    setError(null);
    setCurrentPreset("custom" as any);
    setIsLoading(true);
    setReport(null);
    setActiveDiff(null);

    try {
      if (customObjectUrlsRef.current.orig) URL.revokeObjectURL(customObjectUrlsRef.current.orig);
      if (customObjectUrlsRef.current.rev) URL.revokeObjectURL(customObjectUrlsRef.current.rev);

      const url1 = URL.createObjectURL(file1);
      const url2 = URL.createObjectURL(file2);
      customObjectUrlsRef.current = { orig: url1, rev: url2 };
      setOriginalPdfUrl(url1);
      setRevisedPdfUrl(url2);

      const formData = new FormData();
      formData.append("fileOriginal", file1);
      formData.append("fileRevised", file2);

      const res = await fetch("/api/compare", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to process custom uploaded documents (Status ${res.status})`);
      }

      const data = await res.json();
      setReport(data.report);
      if (data.report.diffs && data.report.diffs.length > 0) {
        setActiveDiff(data.report.diffs[0]);
      }
      if (data.report.verdict === "NEEDS_CLARIFICATION" && data.report.clarificationQuestions?.length > 0) {
        setShowClarification(true);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during document audit.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPreset("standard");
    const prefetchPresets = async () => {
      const presetsToPrefetch: PresetType[] = ["hyperscale_3page", "cloud_migration", "arithmetic_inflation", "milestone_schedule"];
      for (const p of presetsToPrefetch) {
        try {
          const res = await fetch("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: p }) });
          if (res.ok) {
            const data = await res.json();
            clientCacheRef.current.set(p, data.report);
          }
        } catch (e) {}
      }
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(() => setTimeout(prefetchPresets, 150));
    } else {
      setTimeout(prefetchPresets, 150);
    }
  }, []);

  return (
    <div className="min-h-screen text-gray-900 flex flex-col font-sans">
      <Header telemetry={report?.telemetry} />

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 lg:px-12 pt-24 lg:pt-32">
        
        <div className="flex flex-col xl:flex-row gap-12 lg:gap-16 items-start">
          
          {/* LEFT COLUMN: Clean Minimalist Controls */}
          <aside className="w-full xl:w-95 shrink-0 space-y-10 sticky top-32">
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 mb-3">
                Proposal Audit
              </h1>
              <p className="text-sm text-gray-500 leading-relaxed max-w-md">
                Automated differential auditor. Upload the original and revised commercial offers to instantly reveal substantive changes to scope, pricing, and schedules.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            >
              <PresetSelector
                currentPreset={currentPreset}
                isLoading={isLoading}
                onSelectPreset={loadPreset}
                onUploadCustom={handleCustomUpload}
              />
            </motion.div>

          </aside>

          {/* RIGHT COLUMN: Minimalist Workspace Viewport */}
          <motion.div 
            className="flex-1 min-w-0 w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            
            <AnimatePresence mode="wait">
              {isLoading && (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white border border-gray-200 rounded-[20px] p-16 flex flex-col items-center justify-center gap-4 text-center min-h-125"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <p className="text-sm text-gray-500">Processing commercial documents...</p>
                </motion.div>
              )}

              {error && !isLoading && (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm flex items-center gap-3"
                >
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {!isLoading && report && (
                <motion.div 
                  key="content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <ExecutiveSummaryCard 
                    report={report} 
                    onOpenClarification={() => setShowClarification(true)} 
                  />

                  <PdfDualCanvasViewer
                    originalPdfUrl={originalPdfUrl}
                    revisedPdfUrl={revisedPdfUrl}
                    activeDiff={activeDiff}
                    allDiffs={report.diffs}
                    onSelectDiff={(d) => setActiveDiff(d)}
                  />

                  <DiffMatrix
                    diffs={report.diffs}
                    activeDiff={activeDiff}
                    onSelectDiff={(d) => setActiveDiff(d)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </div>
      </main>

      <ClarificationModal
        isOpen={showClarification}
        questions={report?.clarificationQuestions || []}
        onClose={() => setShowClarification(false)}
        onResolveQuestion={(idx, ans) => {
          console.log(`Question ${idx} answered: ${ans}`);
        }}
      />
    </div>
  );
}
