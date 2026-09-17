"use client";

import React, { useState, useEffect } from "react";
import {
  FileCheck2,
  Zap,
  DollarSign,
  Crosshair,
  Settings,
  Cpu,
  ExternalLink,
  X,
  ShieldCheck,
  Check,
} from "lucide-react";
import { TelemetryData } from "@/lib/types";

interface HeaderProps {
  telemetry?: TelemetryData;
}

export function Header({ telemetry }: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState(
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  );
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("revisecheck_together_key");
      if (savedKey) setApiKey(savedKey);
      const savedModel = localStorage.getItem("revisecheck_together_model");
      if (savedModel) setModelName(savedModel);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("revisecheck_together_key", apiKey);
    localStorage.setItem("revisecheck_together_model", modelName);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <>
      {/* Abhay Singh x Appsmith Floating Pill Header */}
      <header className="sticky top-3 sm:top-4 z-40 w-full px-4 sm:px-8 pointer-events-none mb-2 sm:mb-3">
        <div className="max-w-4xl mx-auto flex h-14 items-center justify-between gap-4 rounded-full border border-gray-200 bg-white/85 backdrop-blur-xl shadow-sm px-5 pointer-events-auto">
          {/* Left: Appsmith Inspired Brand Mark & Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-[#e21022] shrink-0 shadow-2xs">
              <FileCheck2 className="h-4.5 w-4.5 shrink-0" />
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/"
                className="text-base sm:text-[17px] font-bold tracking-tight text-gray-900 hover:text-gray-600 transition"
              >
                Revise<span className="text-[#e21022]">Check</span>
              </a>
            </div>
          </div>

          {/* Right: Live Telemetry & Quick Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Telemetry pill removed from header, moved to settings */}

            {/* Author Attribution Chip */}
            <a
              href="https://github.com/artemhrebeniuk"
              target="_blank"
              rel="noopener noreferrer"
              className="tactile-btn hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 shrink-0 active:scale-95"
              title="Author Profile: Artem Hrebeniuk"
            >
              <svg
                width="15"
                height="15"
                className="w-4 h-4 shrink-0 fill-gray-500"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span className="font-mono">artemhrebeniuk</span>
            </a>

            {/* Engine Settings Button */}
            <button
              id="header-settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              className="tactile-btn p-2 rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition flex items-center justify-center shrink-0 active:scale-95"
              title="Engine & Together AI Configuration"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal (Clean Editorial Dialog) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/20 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-50 text-[#e21022]">
                  <Cpu className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                  Engine Configuration
                </h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="tactile-btn p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-90"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Configure Together AI credentials for Tier-5 semantic identity
              resolution during commercial proposal audits.
            </p>

            {telemetry && (
              <div className="flex items-center justify-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm shadow-2xs">
                <div className="flex items-center gap-1.5 text-emerald-700 font-mono font-semibold">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <span>{telemetry.latencyMs}ms</span>
                </div>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-1.5 text-gray-600 font-mono font-medium">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span>${telemetry.costUSD.toFixed(5)}</span>
                </div>
              </div>
            )}

            <div className="space-y-3 font-mono text-sm">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Together API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter Together AI API key (optional)..."
                  className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Inference Model
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-sm sm:text-base text-gray-500 font-mono inline-flex items-center gap-1">
                {isSaved ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Settings saved locally</span>
                  </>
                ) : (
                  <span>Keys stored in browser localStorage</span>
                )}
              </span>
              <button
                onClick={handleSave}
                className="tactile-btn px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm active:scale-95"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
