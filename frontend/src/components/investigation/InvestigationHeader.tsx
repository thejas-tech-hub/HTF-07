"use client";

import React, { useState } from "react";
import {
  Play,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  HelpCircle,
  TrendingDown,
} from "lucide-react";
import { FraudCase, InvestigationAnalysisResponse } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { isAnalysisStale } from "@/lib/mappers/analysisMapper";
import { formatMinorUnits, formatCompactINR } from "@/lib/currency";

interface InvestigationHeaderProps {
  currentCase: FraudCase | null;
  eventsCount: number;
  decisionTimestamp: string;
  analysis: InvestigationAnalysisResponse | null;
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
  reportedAmountMinorUnits?: number;
}

export function InvestigationHeader({
  currentCase,
  eventsCount,
  decisionTimestamp,
  analysis,
  isAnalyzing,
  onRunAnalysis,
  reportedAmountMinorUnits,
}: InvestigationHeaderProps) {
  const [showQuestionGuide, setShowQuestionGuide] = useState(false);

  if (!currentCase) {
    return null;
  }

  const isStale = isAnalysisStale(analysis, decisionTimestamp);

  // Pipeline completeness
  const stages = analysis?.stages || {};
  const stageEntries = Object.entries(stages);
  const completedStagesCount = stageEntries.filter(
    ([, s]) => s.status === "completed" || s.status === "available"
  ).length;
  const allStagesAvailable = stageEntries.length > 0 && completedStagesCount === stageEntries.length;
  const unavailableStages = stageEntries.filter(
    ([, s]) => s.status === "unavailable" || s.status === "failed" || s.status === "insufficient_evidence"
  );

  const bestRecommendation = analysis?.selected_recommendation;

  return (
    <div className="border-b border-surface-border bg-surface-elevated/70 px-4 py-4 lg:px-6 font-sans">
      <div className="max-w-[1680px] mx-auto space-y-4">
        {/* Top Case Identity & Freshness Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Case Title & Badges */}
          <div className="space-y-1.5 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                {currentCase.title}
              </h1>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-surface-card text-brand-periwinkle border border-surface-border font-semibold select-all">
                {currentCase.case_id}
              </span>
              <StatusBadge
                label={currentCase.status === "open" ? "Open case" : currentCase.status.replace(/_/g, " ")}
                variant="neutral"
                size="sm"
              />
              {currentCase.origin === "synthetic" ? (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Synthetic Benchmark
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-periwinkle border border-brand-primary/20">
                  Real Bank Telemetry
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              {currentCase.description || "Active multi-hop financial crime investigation."}
            </p>
          </div>

          {/* Right: Freshness Status & Main Action Button */}
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center shrink-0">
            {analysis && !isStale && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                  allStagesAvailable
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-surface-card border-surface-border text-slate-300"
                }`}
              >
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${allStagesAvailable ? "text-emerald-400" : "text-brand-periwinkle"}`}
                />
                <div>
                  <div className="font-semibold text-xs leading-none">
                    {allStagesAvailable ? "Analysis Verified" : "Analysis Complete (Partial)"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {allStagesAvailable
                      ? "All 7 stages complete"
                      : `${completedStagesCount}/${stageEntries.length} stages active • ${unavailableStages.length} unconfigured`}
                  </div>
                </div>
              </div>
            )}

            {isStale && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-xs leading-none">
                    Cutoff Time T Adjusted
                  </div>
                  <div className="text-[10px] text-amber-400/80 mt-0.5">
                    Recalculation required
                  </div>
                </div>
              </div>
            )}

            {!analysis && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-card border border-surface-border text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>Awaiting analysis execution</span>
              </div>
            )}

            <button
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 ${
                isStale
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold focus:ring-amber-500/50 shadow-amber-500/20"
                  : "bg-brand-primary hover:bg-[#5252ee] active:bg-[#4343d8] focus:ring-brand-primary/50 shadow-brand-primary/25"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Play className={`h-3.5 w-3.5 fill-current ${isAnalyzing ? "animate-spin" : ""}`} />
              <span>
                {isAnalyzing
                  ? "Analyzing Case..."
                  : isStale
                  ? "Recalculate at Time T"
                  : "Run Investigation Analysis"}
              </span>
              {!isAnalyzing && <ArrowRight className="h-3 w-3 opacity-80" />}
            </button>
          </div>
        </div>

        {/* Executive Forensic Summary Strip (Reference 1 & 3 style) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1 text-xs">
          <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-0.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Layers className="h-3 w-3 text-brand-periwinkle" />
              <span>Transfers Analyzed</span>
            </span>
            <div className="text-base font-bold text-white font-mono">
              {eventsCount} <span className="text-xs font-normal text-slate-400">records</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-0.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-rose-400" />
              <span>Reported Fraud Seed</span>
            </span>
            <div className="text-base font-bold text-rose-400 font-mono">
              {reportedAmountMinorUnits ? formatCompactINR(reportedAmountMinorUnits) : "N/A"}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {reportedAmountMinorUnits ? formatMinorUnits(reportedAmountMinorUnits) : ""}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-0.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span>Interceptable Illicit Capital</span>
            </span>
            <div className="text-base font-bold text-emerald-400 font-mono">
              {bestRecommendation
                ? formatCompactINR(bestRecommendation.modeled_tainted_capital_intercepted)
                : analysis ? "₹0" : "Awaiting run"}
            </div>
            <div className="text-[10px] text-slate-500">
              {bestRecommendation ? "Pareto Rank 1 hold" : "Modeled recovery"}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-0.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-amber-400" />
              <span>Customer Collateral Risk</span>
            </span>
            <div className={`text-base font-bold font-mono ${bestRecommendation && bestRecommendation.modeled_legitimate_capital_affected > 0 ? "text-amber-400" : "text-slate-400"}`}>
              {bestRecommendation
                ? formatMinorUnits(bestRecommendation.modeled_legitimate_capital_affected)
                : "₹0.00"}
            </div>
            <div className="text-[10px] text-slate-500">
              {bestRecommendation?.modeled_legitimate_capital_affected === 0 ? "Zero customer collateral" : "Legitimate impact"}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-0.5 col-span-2 md:col-span-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3 text-sky-400" />
              <span>Investigation Cutoff T</span>
            </span>
            <div className="text-base font-bold text-sky-300 font-mono">
              {decisionTimestamp ? decisionTimestamp.slice(11, 19) : "12:00:00"} <span className="text-xs font-normal text-slate-400">UTC</span>
            </div>
            <div className="text-[10px] text-slate-500">
              {decisionTimestamp ? new Date(decisionTimestamp).toLocaleDateString() : ""}
            </div>
          </div>
        </div>

        {/* 3 Key Questions Investigator Guidance Bar */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowQuestionGuide(!showQuestionGuide)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {showQuestionGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span className="font-medium">
              {showQuestionGuide ? "Hide investigation workflow guidance" : "Show 3 Key Questions workflow guidance (What happened? Where did it move? What intervention to review?)"}
            </span>
          </button>

          {showQuestionGuide && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
              <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-1">
                <span className="text-[11px] font-bold text-brand-periwinkle uppercase tracking-wider block">
                  1. What happened?
                </span>
                <p className="text-xs text-slate-300">
                  Review the reported unauthorized payment, the initial illicit injection amount, and the originating victim account.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-1">
                <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                  2. Where did it move?
                </span>
                <p className="text-xs text-slate-300">
                  Follow multi-hop dispersals, merchant commingling, and next-hop forecasts across accounts on the transaction graph.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-1">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  3. What intervention to review?
                </span>
                <p className="text-xs text-slate-300">
                  Evaluate Pareto-optimal holds to maximize intercepted illicit funds while safeguarding legitimate customer capital.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
