"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Layers,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Users,
  ShieldAlert,
} from "lucide-react";
import { ValidationSummary, ValidationErrorDetail } from "../../types/upload";
import { formatMinorUnits, formatCompactINR } from "../../lib/currency";

interface ValidationAuditPanelProps {
  summary: ValidationSummary;
  filename: string;
  amountInMinorUnits: boolean;
  onToggleMinorUnits: (inMinor: boolean) => void;
  onBackToMapping: () => void;
  onProceedToSetup: () => void;
}

export function ValidationAuditPanel({
  summary,
  filename,
  amountInMinorUnits,
  onToggleMinorUnits,
  onBackToMapping,
  onProceedToSetup,
}: ValidationAuditPanelProps) {
  const [excludeInvalid, setExcludeInvalid] = useState(true);

  const hasErrors = summary.invalid_rows_count > 0;
  const canProceed = summary.valid_rows_count > 0;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Dataset Validation & Integrity Audit
            </h2>
            {summary.invalid_rows_count === 0 ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>100% Valid</span>
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>{summary.invalid_rows_count} Errors Found</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Audit row-level schemas, positive amount constraints, valid timestamps, and account party existence
          </p>
        </div>

        <span className="text-xs font-mono px-3 py-1 rounded-lg bg-surface-card border border-surface-border text-slate-300 self-start sm:self-auto">
          📄 {filename}
        </span>
      </div>

      {/* 5 Key Dataset Audit Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Layers className="h-3.5 w-3.5 text-brand-periwinkle" />
            <span>Total rows</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {summary.total_rows.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500">Parsed from source</div>
        </div>

        <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Valid transfers</span>
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono">
            {summary.valid_rows_count.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500">Ready for graph ingestion</div>
        </div>

        <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
            <span>Invalid rows</span>
          </div>
          <div className={`text-lg font-bold font-mono ${summary.invalid_rows_count > 0 ? "text-rose-400" : "text-slate-400"}`}>
            {summary.invalid_rows_count.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500">Violate contract rules</div>
        </div>

        <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Users className="h-3.5 w-3.5 text-sky-400" />
            <span>Unique accounts</span>
          </div>
          <div className="text-lg font-bold text-sky-300 font-mono">
            {(summary.unique_senders_count + summary.unique_receivers_count).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500">
            {summary.unique_senders_count} senders &bull; {summary.unique_receivers_count} receivers
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1 col-span-2 md:col-span-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <DollarSign className="h-3.5 w-3.5 text-brand-celadon" />
            <span>Total volume</span>
          </div>
          <div className="text-lg font-bold text-brand-celadon font-mono">
            {formatCompactINR(summary.total_volume_minor_units)}
          </div>
          <div className="text-[10px] text-slate-500">
            {formatMinorUnits(summary.total_volume_minor_units)}
          </div>
        </div>
      </div>

      {/* Timestamp Horizon & Unit Controls */}
      <div className="p-4 rounded-xl bg-surface-elevated/70 border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <span className="text-[11px] text-slate-400 font-medium block">
            Observed Transaction Timeline Horizon
          </span>
          <div className="flex items-center gap-2 font-mono text-slate-200">
            <Clock className="h-3.5 w-3.5 text-brand-indigo" />
            <span>{summary.earliest_timestamp ? new Date(summary.earliest_timestamp).toUTCString() : "N/A"}</span>
            <span className="text-slate-500">&rarr;</span>
            <span>{summary.latest_timestamp ? new Date(summary.latest_timestamp).toUTCString() : "N/A"}</span>
          </div>
        </div>

        {/* Currency Denomination Toggle */}
        <div className="flex items-center gap-2 bg-surface-card p-1.5 rounded-lg border border-surface-border self-start md:self-auto">
          <span className="text-[11px] text-slate-400 px-1.5 font-medium">Amount units:</span>
          <button
            type="button"
            onClick={() => onToggleMinorUnits(false)}
            className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
              !amountInMinorUnits
                ? "bg-brand-primary text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Major (Rupees ₹)
          </button>
          <button
            type="button"
            onClick={() => onToggleMinorUnits(true)}
            className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
              amountInMinorUnits
                ? "bg-brand-primary text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Minor (Paise)
          </button>
        </div>
      </div>

      {/* Row-Level Errors Table (if any) */}
      {hasErrors && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <span>Rows with validation issues ({summary.errors.length} displayed)</span>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeInvalid}
                onChange={(e) => setExcludeInvalid(e.target.checked)}
                className="rounded bg-surface-card border-surface-border text-brand-primary accent-brand-primary cursor-pointer"
              />
              <span>Exclude invalid rows and proceed with {summary.valid_rows_count} valid records</span>
            </label>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-surface-border bg-surface/90 divide-y divide-surface-border text-xs">
            {summary.errors.map((err, idx) => (
              <div key={idx} className="p-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    Row {err.row_number}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-200 font-mono">
                      Field: {err.field}
                    </span>
                    <p className="text-slate-400 text-xs mt-0.5">{err.message}</p>
                  </div>
                </div>

                {err.raw_value !== undefined && err.raw_value !== null && (
                  <span className="font-mono text-[11px] text-slate-400 px-2 py-0.5 rounded bg-surface-card border border-surface-border shrink-0 max-w-[200px] truncate">
                    {String(err.raw_value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-surface-border">
        <button
          onClick={onBackToMapping}
          className="px-4 py-2 rounded-lg bg-surface-card hover:bg-surface-elevated text-xs text-slate-300 transition-colors border border-surface-border cursor-pointer flex items-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to column mapping</span>
        </button>

        <button
          onClick={onProceedToSetup}
          disabled={!canProceed || (hasErrors && !excludeInvalid)}
          className="px-5 py-2 rounded-lg bg-brand-primary hover:bg-[#5252ee] text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-primary/20"
        >
          <span>Configure investigation parameters</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
