"use client";

import React from "react";
import {
  ShieldCheck,
  RefreshCw,
  Zap,
  UploadCloud,
  Activity,
  ChevronDown,
  Layers,
} from "lucide-react";
import { FraudCase } from "@/types";

interface NavbarProps {
  cases: FraudCase[];
  activeCaseId: string;
  onSelectCase: (caseId: string) => void;
  onLoadDemo: () => void;
  onOpenUploadWizard: () => void;
  isLoadingDemo: boolean;
  isBackendHealthy: boolean;
}

export function Navbar({
  cases,
  activeCaseId,
  onSelectCase,
  onLoadDemo,
  onOpenUploadWizard,
  isLoadingDemo,
  isBackendHealthy,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-surface-border bg-surface/95 px-4 lg:px-6 backdrop-blur-md font-sans">
      {/* Brand & System Status */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary text-white shadow-lg shadow-brand-primary/25 ring-1 ring-white/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white font-sans">
                AEGIS-Flow
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated text-brand-periwinkle border border-surface-border font-semibold">
                COGNITIVE INTERVENTION WORKSTATION
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
              Temporal fraud investigation & counterfactual intervention analysis
            </p>
          </div>
        </div>

        {/* System Sovereign Telemetry Posture (Reference 3 inspired) */}
        <div className="hidden xl:flex items-center gap-2 border-l border-surface-border pl-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-surface-border text-[11px] font-mono text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>EXECUTION: LOCAL</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-surface-border text-[11px] font-mono text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span>DATA: SOVEREIGN</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-surface-border text-[11px]">
            <span
              className={`h-2 w-2 rounded-full ${
                isBackendHealthy ? "bg-emerald-400" : "bg-rose-500 animate-pulse"
              }`}
            />
            <span className={isBackendHealthy ? "text-emerald-300" : "text-rose-300 font-semibold"}>
              {isBackendHealthy ? "Engine active" : "Engine disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Case Selection & Primary Action Bar */}
      <div className="flex items-center gap-2.5">
        {/* Case Selector Dropdown */}
        <div className="relative flex items-center bg-surface-elevated border border-surface-border rounded-xl px-3 py-1.5 text-xs hover:border-slate-500 transition-colors">
          <Activity className="h-3.5 w-3.5 text-brand-periwinkle mr-2 shrink-0" />
          <span className="text-slate-400 mr-1.5 text-[11px]">Case:</span>
          <select
            value={activeCaseId}
            onChange={(e) => onSelectCase(e.target.value)}
            className="bg-transparent text-xs text-slate-100 outline-none cursor-pointer pr-5 max-w-[170px] sm:max-w-[240px] truncate font-mono font-semibold"
          >
            {cases.length === 0 && <option value="">No cases loaded</option>}
            {cases.map((c) => (
              <option key={c.case_id} value={c.case_id} className="bg-surface-elevated text-slate-200">
                {c.case_id} {c.title ? `— ${c.title}` : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3 w-3 text-slate-400 pointer-events-none absolute right-2.5" />
        </div>

        {/* Primary CTA: Upload Transaction Data */}
        <button
          onClick={onOpenUploadWizard}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary hover:bg-[#5252ee] active:bg-[#4343d8] px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          title="Upload real transaction data (CSV, JSON, JSONL) to start an investigation"
        >
          <UploadCloud className="h-4 w-4" />
          <span className="hidden sm:inline">Upload Data / New Case</span>
          <span className="sm:hidden">Upload</span>
        </button>

        {/* Secondary Action: Explore Synthetic Demo */}
        <button
          onClick={onLoadDemo}
          disabled={isLoadingDemo}
          className="inline-flex items-center gap-1.5 rounded-xl bg-surface-elevated hover:bg-surface-card active:bg-surface border border-surface-border hover:border-slate-500 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          title="Load curated synthetic demonstration scenario (Operation ShatterFlow)"
        >
          {isLoadingDemo ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
          ) : (
            <Zap className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span className="hidden md:inline">{isLoadingDemo ? "Loading demo..." : "Demo scenario"}</span>
          <span className="md:hidden">Demo</span>
        </button>
      </div>
    </header>
  );
}
