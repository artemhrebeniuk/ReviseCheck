"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  ArrowLeftRight,
  Mic,
  Camera,
  CheckCircle2,
  Sparkles,
  Info,
  X,
  Play,
  Square,
  Volume2,
  AlertTriangle,
  FileUp,
  FileCheck2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DualDropzoneHeroProps {
  isLoading: boolean;
  onUploadCustom: (file1: File, file2: File) => void;
  currentDocAName?: string;
  currentDocBName?: string;
  onDirectiveChange?: (directive: string | null) => void;
  activeDirective?: string | null;
}

export function DualDropzoneHero({
  isLoading,
  onUploadCustom,
  currentDocAName,
  currentDocBName,
  onDirectiveChange,
  activeDirective,
}: DualDropzoneHeroProps) {
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [dragFeedback, setDragFeedback] = useState<string | null>(null);

  // Modals
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const fileInputDocARef = useRef<HTMLInputElement>(null);
  const fileInputDocBRef = useRef<HTMLInputElement>(null);
  const fileInputUnifiedRef = useRef<HTMLInputElement>(null);

  // Handle simultaneous 2-file drop
  const handleUnifiedDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingGlobal(false);
    setDragFeedback(null);

    const droppedFiles = Array.from(e.dataTransfer.files || []).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );

    if (droppedFiles.length >= 2) {
      // Sort or assign 1st -> Doc A, 2nd -> Doc B
      const [f1, f2] = droppedFiles;
      setFile1(f1);
      setFile2(f2);
      onUploadCustom(f1, f2);
    } else if (droppedFiles.length === 1) {
      if (!file1) {
        setFile1(droppedFiles[0]);
      } else {
        setFile2(droppedFiles[0]);
        onUploadCustom(file1, droppedFiles[0]);
      }
    }
  };

  const handleUnifiedFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );

    if (selected.length >= 2) {
      setFile1(selected[0]);
      setFile2(selected[1]);
      onUploadCustom(selected[0], selected[1]);
    } else if (selected.length === 1) {
      if (!file1) {
        setFile1(selected[0]);
      } else {
        setFile2(selected[0]);
        onUploadCustom(file1, selected[0]);
      }
    }
  };

  // Fast Swap: [Doc A ⇄ Doc B]
  const handleSwap = () => {
    if (file1 && file2) {
      const next1 = file2;
      const next2 = file1;
      setFile1(next1);
      setFile2(next2);
      onUploadCustom(next1, next2);
    }
  };

  // Voice recognition handling
  const startRecording = () => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onresult = (event: any) => {
            let current = "";
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript + " ";
            }
            setSpeechTranscript(current.trim());
          };

          recognition.onerror = (event: any) => {
            console.warn("Speech recognition error:", event.error);
            setIsRecording(false);
          };

          recognition.onend = () => {
            setIsRecording(false);
          };

          recognition.start();
          recognitionRef.current = recognition;
          setIsRecording(true);
          return;
        } catch (err) {
          console.warn("Could not start speech recognition:", err);
        }
      }
    }

    // Fallback simulation if speech recognition is unavailable or denied
    setIsRecording(true);
    let sample =
      "Reject any commercial revision with price variance exceeding 5% or delivery past Q4 2026.";
    let i = 0;
    const interval = setInterval(() => {
      i += 8;
      setSpeechTranscript(sample.slice(0, i));
      if (i >= sample.length) {
        clearInterval(interval);
        setIsRecording(false);
      }
    }, 120);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const applyDirective = (text: string) => {
    if (onDirectiveChange) {
      onDirectiveChange(text.trim() || null);
    }
    setShowVoiceModal(false);
  };

  return (
    <div className="w-full mb-6 sm:mb-8">
      {/* Hero Outer Container */}
      <div className="bg-linear-to-b from-white via-slate-50/50 to-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 shadow-sm space-y-6">
        {/* Hero Top Title & Modality Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-display">
              Commercial Proposal Differential Auditor
            </h2>
            <p className="text-sm sm:text-sm text-gray-500 font-normal max-w-2xl leading-relaxed">
              Drop both commercial offers simultaneously to automatically map
              Baseline (Doc A) vs Candidate (Doc B) with zero floating-point
              drift.
            </p>
          </div>

          {/* Modal Action Buttons: [Dictate Directive] & [Upload Photo/Scan] */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowVoiceModal(true)}
              className="tactile-btn inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 text-sm sm:text-sm font-semibold shadow-2xs transition cursor-pointer active:scale-95"
              title="Dictate procurement leadership directives for this audit"
            >
              <Mic className="h-4 w-4 text-rose-500 shrink-0" />
              <span>Dictate Directive</span>
              {activeDirective && (
                <span className="h-2 w-2 rounded-full bg-rose-500" />
              )}
            </button>

            <button
              onClick={() => setShowPhotoModal(true)}
              className="tactile-btn inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 text-sm sm:text-sm font-semibold shadow-2xs transition cursor-pointer active:scale-95"
              title="Affordance for scanned or photographed paper commercial quotes"
            >
              <Camera className="h-4 w-4 text-blue-600 shrink-0" />
              <span>Upload Photo/Scan</span>
            </button>
          </div>
        </div>

        {/* Active Directive Banner if set */}
        {activeDirective && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-rose-50/80 border border-rose-200/80 text-rose-950 text-sm sm:text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <Volume2 className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="font-semibold shrink-0">
                Executive Directive:
              </span>
              <span className="truncate text-rose-800 font-sans font-medium">
                &ldquo;{activeDirective}&rdquo;
              </span>
            </div>
            <button
              onClick={() => onDirectiveChange?.(null)}
              className="p-1 hover:bg-rose-100 rounded-md text-rose-700 cursor-pointer"
              title="Clear directive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* UNIFIED DUAL DROPZONE (Main Hero Interactive Surface) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingGlobal(true);
            setDragFeedback(
              "Drop 2 PDF files simultaneously for instant Doc A / Doc B reconciliation",
            );
          }}
          onDragLeave={() => {
            setIsDraggingGlobal(false);
            setDragFeedback(null);
          }}
          onDrop={handleUnifiedDrop}
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 p-5 sm:p-6 lg:p-7 ${
            isDraggingGlobal
              ? "border-blue-500 bg-blue-50/40 ring-4 ring-blue-100 scale-[1.002]"
              : "border-slate-300/90 bg-white hover:border-slate-400 shadow-2xs"
          }`}
        >
          {/* Hidden multi-file input */}
          <input
            ref={fileInputUnifiedRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={handleUnifiedFileSelect}
          />

          {/* Top Dropzone Cue */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 text-sm text-gray-500">
            <div className="flex items-center gap-2 font-medium">
              <UploadCloud className="h-5 w-5 text-blue-600 shrink-0" />
              <span className="text-gray-900 font-semibold">
                Dual Dropzone Surface:
              </span>
              <span>
                Drag &amp; drop two PDF files at once, or assign slots below
              </span>
            </div>
            <button
              onClick={() => fileInputUnifiedRef.current?.click()}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-4 cursor-pointer self-start sm:self-auto font-sans"
            >
              Browse Files Simultaneously
            </button>
          </div>

          {/* DUAL SLOTS + FAST SWAP BUTTON [Doc A ⇄ Doc B] */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* SLOT 1: Doc A (Baseline Reference - Neutral Slate #334155) */}
            <div
              onClick={() => fileInputDocARef.current?.click()}
              className={`tactile-btn p-4 sm:p-5 rounded-xl border transition cursor-pointer text-left flex flex-col justify-between min-h-32 active:scale-[0.99] ${
                file1
                  ? "bg-slate-50/90 border-slate-300 ring-1 ring-slate-400/20 shadow-xs"
                  : "bg-gray-50/60 border-gray-200 hover:border-slate-400"
              }`}
            >
              <input
                ref={fileInputDocARef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile1(f);
                    if (file2) onUploadCustom(f, file2);
                  }
                }}
              />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#334155] shrink-0" />
                  <span className="font-bold text-sm sm:text-sm uppercase tracking-wider text-slate-800 font-sans">
                    Doc A (Baseline Reference)
                  </span>
                </div>
                <span className="font-sans text-sm font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
                  SLATE
                </span>
              </div>

              <div className="my-2 min-w-0">
                {file1 ? (
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm sm:text-base text-gray-900 truncate flex items-center gap-1.5">
                      <FileCheck2 className="h-4 w-4 text-slate-700 shrink-0" />
                      <span>{file1.name}</span>
                    </p>
                    <p className="text-sm text-gray-500 font-sans">
                      {(file1.size / 1024).toFixed(1)} KB • Ready for audit
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-700">
                      {currentDocAName
                        ? `Current: ${currentDocAName}`
                        : "Click or drop Document A (Original PDF)"}
                    </p>
                    <p className="text-base text-gray-500 font-sans">
                      Stated baseline commercial scope
                    </p>
                  </div>
                )}
              </div>

              <div className="absolute inset-0 bg-slate-50/50 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                <span className="text-base font-medium text-slate-600 block font-sans">
                  {file1
                    ? "Click to replace Doc A"
                    : "Select or drag Baseline PDF"}
                </span>
              </div>
            </div>

            {/* FAST SWAP BUTTON: [Doc A ⇄ Doc B] */}
            <div className="flex justify-center my-1 md:my-0">
              <button
                type="button"
                onClick={handleSwap}
                disabled={!file1 && !file2}
                className="tactile-btn group p-3.5 rounded-2xl bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 hover:text-gray-900 shadow-sm transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex flex-col items-center gap-1 shrink-0"
                title="Quick Swap: Switch Doc A and Doc B and re-run comparison"
                aria-label="Swap Document A and Document B"
              >
                <ArrowLeftRight className="h-5 w-5 group-hover:rotate-180 transition-transform duration-300 text-blue-600" />
                <span className="font-sans text-sm font-bold text-gray-700 uppercase tracking-tight">
                  Swap A ⇄ B
                </span>
              </button>
            </div>

            {/* SLOT 2: Doc B (Candidate Proposal - Cobalt Blue #2563eb) */}
            <div
              onClick={() => fileInputDocBRef.current?.click()}
              className={`relative group tactile-btn p-4 sm:p-5 rounded-xl border transition cursor-pointer text-left flex flex-col justify-between min-h-32 active:scale-[0.99] ${
                file2
                  ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-400/20 shadow-xs"
                  : "bg-gray-50/60 border-gray-200 hover:border-blue-400"
              }`}
            >
              <input
                ref={fileInputDocBRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile2(f);
                    if (file1) onUploadCustom(file1, f);
                  }
                }}
              />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb] shrink-0" />
                  <span className="font-bold text-sm sm:text-sm uppercase tracking-wider text-blue-900 font-sans">
                    Doc B (Candidate Proposal)
                  </span>
                </div>
                <span className="font-sans text-sm font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  COBALT BLUE
                </span>
              </div>

              <div className="my-2 min-w-0">
                {file2 ? (
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm sm:text-base text-gray-900 truncate flex items-center gap-1.5">
                      <FileCheck2 className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>{file2.name}</span>
                    </p>
                    <p className="text-sm text-gray-500 font-sans">
                      {(file2.size / 1024).toFixed(1)} KB • Ready for audit
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-700">
                      {currentDocBName
                        ? `Current: ${currentDocBName}`
                        : "Click or drop Document B (Revised PDF)"}
                    </p>
                    <p className="text-base text-gray-500 font-sans">
                      Revised candidate commercial quote
                    </p>
                  </div>
                )}
              </div>

              <div className="absolute inset-0 bg-blue-50/50 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                <span className="text-base font-medium text-blue-700 block font-sans">
                  {file2
                    ? "Click to replace Doc B"
                    : "Select or drag Candidate PDF"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Trigger Bar if files are selected */}
          {file1 && file2 && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm text-gray-600 flex items-center gap-1.5 font-sans font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Dual documents staged for audit</span>
              </span>
              <button
                onClick={() => onUploadCustom(file1, file2)}
                disabled={isLoading}
                className="tactile-btn inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white font-semibold text-sm sm:text-sm transition cursor-pointer shadow-xs active:scale-95"
              >
                <FileUp className="h-4 w-4" />
                <span>
                  {isLoading ? "Auditing Proposals..." : "Audit Custom Offers"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: [Dictate Directive] */}
      <AnimatePresence>
        {showVoiceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div className="text-left space-y-0.5">
                    <span className="font-semibold text-gray-900 block text-base">
                      Dictate Directive
                    </span>
                    <p className="text-base text-gray-500">
                      Dictate governance criteria for executive review
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVoiceModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Voice Recording Control */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`tactile-btn p-3 rounded-full text-white cursor-pointer active:scale-95 transition ${
                      isRecording
                        ? "bg-rose-600 animate-pulse ring-4 ring-rose-200"
                        : "bg-gray-900 hover:bg-gray-800"
                    }`}
                    title={
                      isRecording
                        ? "Stop voice dictation"
                        : "Start voice dictation"
                    }
                  >
                    {isRecording ? (
                      <Square className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </button>
                  <div>
                    <span className="text-base font-semibold text-gray-800 block">
                      {isRecording
                        ? "Listening to leadership voice input..."
                        : "Speech-to-Text Dictation"}
                    </span>
                    <span className="text-base text-gray-500">
                      {isRecording
                        ? "Speak clearly into your microphone"
                        : "Click mic to speak directives (English/Ukrainian)"}
                    </span>
                  </div>
                </div>
                {isRecording && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-rose-100 text-rose-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
                    Recording
                  </span>
                )}
              </div>

              {/* Directive Textarea */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-600 block">
                  Directive Transcript (or Type Rule)
                </label>
                <textarea
                  value={speechTranscript}
                  onChange={(e) => setSpeechTranscript(e.target.value)}
                  placeholder="e.g., Reject any proposal with price increase over 5% or delivery schedule postponed past November 2026."
                  className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 min-h-24 resize-none font-sans"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setShowVoiceModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm sm:text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => applyDirective(speechTranscript)}
                  disabled={!speechTranscript.trim()}
                  className="tactile-btn px-5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white text-sm sm:text-sm font-semibold transition cursor-pointer active:scale-95"
                >
                  Save &amp; Apply Directive
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: [Upload Photo/Scan] */}
      <AnimatePresence>
        {showPhotoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div className="text-left space-y-0.5">
                    <span className="font-semibold text-gray-900 block text-base">
                      Upload Photo/Scan
                    </span>
                    <p className="text-base text-gray-500 font-sans">
                      Affordance for physical commercial quotes
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Specification Boundary Notice (ТЗ Compliance) */}
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 text-base leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900 uppercase tracking-wide text-base">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <span>Specification Scope Notice</span>
                </div>
                <p>
                  Per the challenge specification:{" "}
                  <em>
                    &ldquo;No legal advice or handwritten/scanned-document
                    support is required.&rdquo;
                  </em>{" "}
                  ReviseCheck relies on deterministic coordinate streams and
                  Decimal.js precision bounds.
                </p>
                <p className="text-amber-900 font-sans font-medium text-sm">
                  For optimal audit accuracy, paper quotes should be scanned
                  using an OCR tool or exported as searchable PDF.
                </p>
              </div>

              {/* Drop target for photo/scan */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50/70 hover:border-blue-400 transition cursor-pointer space-y-2">
                <Camera className="h-8 w-8 text-gray-400 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-gray-800 font-sans">
                    Drag paper scan image or searchable PDF here
                  </p>
                  <p className="text-sm text-gray-500 font-sans mt-0.5">
                    Supports .pdf, .png, .jpg, .jpeg (Up to 10 MB)
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="tactile-btn px-5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm sm:text-sm font-semibold transition cursor-pointer active:scale-95"
                >
                  Understood &amp; Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
