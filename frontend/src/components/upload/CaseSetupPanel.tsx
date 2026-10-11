"use client";

import React, { useState, useMemo } from "react";
import {
  FolderPlus,
  Target,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  HelpCircle,
  Clock,
  ShieldCheck,
  Search,
} from "lucide-react";
import { ValidationSummary, CandidateSeed } from "../../types/upload";
import { CaseOrigin } from "../../types/case";
import { formatMinorUnits, formatCompactINR } from "../../lib/currency";

interface CaseSetupPanelProps {
  summary: ValidationSummary;
  onBack: () => void;
  onSubmit: (params: {
    caseId: string;
    title: string;
    description: string;
    origin: CaseOrigin;
    seedTxId: string;
    taintedAmountMinorUnits: number;
    sinkAccountIds: string[];
    decisionTimestamp: string;
  }) => void;
  isSubmitting?: boolean;
}

export function CaseSetupPanel({
  summary,
  onBack,
  onSubmit,
  isSubmitting = false,
}: CaseSetupPanelProps) {
  // Generate random default case reference e.g. CASE-2026-OPS-492
  const defaultCaseId = useMemo(() => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CASE-2026-OPS-${rand}`;
  }, []);

  const [caseId, setCaseId] = useState(defaultCaseId);
  const [title, setTitle] = useState("Corporate Treasury Infiltration Investigation");
  const [description, setDescription] = useState(
    "Multi-tier fund dispersal and suspected laundering investigation initiated from bank file upload."
  );
  const [origin, setOrigin] = useState<CaseOrigin>("manual_investigation");

  // Fraud Seed Selection
  const defaultSeed = summary.candidate_seeds[0];
  const [selectedSeedTxId, setSelectedSeedTxId] = useState<string>(
    defaultSeed?.transaction_id || ""
  );
  const [taintedAmountMinor, setTaintedAmountMinor] = useState<number>(
    defaultSeed?.amount_minor_units || 0
  );

  // Sinks: default to auto-detected terminal sinks
  const [selectedSinks, setSelectedSinks] = useState<string[]>(
    summary.candidate_sinks.slice(0, 2)
  );

  // Decision Timestamp T
  const defaultCutoff = summary.latest_timestamp || new Date().toISOString();
  const [decisionTimestamp, setDecisionTimestamp] = useState<string>(defaultCutoff);

  const handleSelectSeed = (seed: CandidateSeed) => {
    setSelectedSeedTxId(seed.transaction_id);
    setTaintedAmountMinor(seed.amount_minor_units);
  };

  const handleToggleSink = (sink: string) => {
    setSelectedSinks((prev) =>
      prev.includes(sink) ? prev.filter((s) => s !== sink) : [...prev, sink]
    );
  };

  const handleRegenerateCaseId = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setCaseId(`CASE-2026-OPS-${rand}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !caseId.trim() || !title.trim() || !selectedSeedTxId) return;

    onSubmit({
      caseId: caseId.trim(),
      title: title.trim(),
      description: description.trim(),
      origin,
      seedTxId: selectedSeedTxId,
      taintedAmountMinorUnits: taintedAmountMinor,
      sinkAccountIds: selectedSinks,
      decisionTimestamp,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Investigation Parameters & Case Intake
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-primary/15 text-brand-periwinkle border border-brand-primary/30">
              Ready for Analysis
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Designate the reported illicit payment seed and optional cash-out targets to initialize the graph
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Case Envelope Metadata */}
        <div className="space-y-4 p-5 rounded-xl bg-surface-elevated/70 border border-surface-border">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-border">
            <FolderPlus className="h-4 w-4 text-brand-periwinkle" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Case Envelope Metadata
            </h3>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Case Reference ID <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={handleRegenerateCaseId}
                className="text-[11px] text-brand-periwinkle hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>Auto-generate</span>
              </button>
            </div>
            <input
              type="text"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              required
              className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 outline-none focus:border-brand-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Investigation Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-brand-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Investigative Notes / Case Narrative
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-brand-primary resize-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Intake Origin Channel
            </label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value as CaseOrigin)}
              className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-brand-primary transition-colors cursor-pointer"
            >
              <option value="manual_investigation">Manual Bank Investigation</option>
              <option value="customer_report">Customer Fraud Report</option>
              <option value="bank_detection">Core Banking Rule Detection</option>
              <option value="shared_intelligence">Shared FIU / Inter-Bank Intelligence</option>
            </select>
          </div>
        </div>

        {/* Right Column: Fraud Seed & Exit Targets */}
        <div className="space-y-4 p-5 rounded-xl bg-surface-elevated/70 border border-surface-border">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-border">
            <Target className="h-4 w-4 text-brand-celadon" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Illicit Proceeds Seed (Taint Anchor)
            </h3>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Select Initial Fraud Transfer <span className="text-rose-400">*</span>
            </label>
            <p className="text-[11px] text-slate-400">
              The deterministic taint propagation algorithm propagates illicit volume forward from this transaction.
            </p>

            {/* Candidate Seeds List */}
            <div className="space-y-2 pt-1">
              {summary.candidate_seeds.map((cand) => {
                const isSelected = selectedSeedTxId === cand.transaction_id;
                return (
                  <div
                    key={cand.transaction_id}
                    onClick={() => handleSelectSeed(cand)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-brand-primary/15 border-brand-primary text-white shadow-sm"
                        : "bg-surface-card/60 border-surface-border text-slate-300 hover:bg-surface-card"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold">{cand.transaction_id}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded bg-surface border border-surface-border text-slate-400">
                          {cand.reason}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {cand.sender} &rarr; {cand.receiver}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {formatMinorUnits(cand.amount_minor_units)}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {new Date(cand.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modeled Tainted Amount */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Modeled Tainted Proceeds (in Paise)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={taintedAmountMinor}
                onChange={(e) => setTaintedAmountMinor(Math.max(1, parseInt(e.target.value) || 0))}
                min={1}
                required
                className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-brand-primary transition-colors"
              />
              <span className="text-xs text-brand-celadon font-mono whitespace-nowrap">
                {formatMinorUnits(taintedAmountMinor)}
              </span>
            </div>
          </div>

          {/* Cash-Out Exit Sink Accounts */}
          {summary.candidate_sinks.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-medium text-slate-300">
                Target Cash-Out Exit Sinks (For Temporal Min-Cut)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {summary.candidate_sinks.map((sink) => {
                  const isChecked = selectedSinks.includes(sink);
                  return (
                    <button
                      key={sink}
                      type="button"
                      onClick={() => handleToggleSink(sink)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer border ${
                        isChecked
                          ? "bg-brand-primary/20 border-brand-primary text-brand-periwinkle font-semibold"
                          : "bg-surface-card border-surface-border text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {isChecked ? "✓ " : "+ "}
                      {sink}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-surface-border">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-surface-card hover:bg-surface-elevated text-xs text-slate-300 transition-colors border border-surface-border cursor-pointer flex items-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to audit</span>
        </button>

        <button
          type="submit"
          disabled={isSubmitting || !selectedSeedTxId}
          className="px-6 py-2.5 rounded-lg bg-brand-primary hover:bg-[#5252ee] text-xs font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-xl shadow-brand-primary/25"
        >
          <span>{isSubmitting ? "Ingesting & Analyzing..." : "Launch Investigation Analysis"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
