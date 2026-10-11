"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  HelpCircle,
  Search,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Filter,
} from "lucide-react";
import type { CanonicalFieldKey } from "../../types/upload";
import {
  CANONICAL_FIELDS,
  evaluateMappingStatus,
  autoSuggestMapping,
} from "../../lib/upload/columnMapper";

interface ColumnMappingTableProps {
  filename: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  mapping: Record<string, CanonicalFieldKey | "skip">;
  onChangeMapping: (column: string, target: CanonicalFieldKey | "skip") => void;
  onApplyAutoMatch: () => void;
  onCancel: () => void;
  onProceed: () => void;
}

type FilterTab = "all" | "ready" | "review" | "skipped" | "unmapped";

export function ColumnMappingTable({
  filename,
  columns,
  sampleRows,
  totalRows,
  mapping,
  onChangeMapping,
  onApplyAutoMatch,
  onCancel,
  onProceed,
}: ColumnMappingTableProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const statusSummary = useMemo(
    () => evaluateMappingStatus(columns, mapping),
    [columns, mapping]
  );

  const mappedCount = statusSummary.readyCount + statusSummary.reviewCount;

  // Filter columns based on tab and search
  const filteredColumns = useMemo(() => {
    return columns.filter((col) => {
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = col.toLowerCase().includes(q);
        const mappedTarget = mapping[col] || "";
        const matchesTarget = mappedTarget.toLowerCase().includes(q);
        if (!matchesName && !matchesTarget) return false;
      }

      const target = mapping[col];
      if (activeFilter === "all") return true;
      if (activeFilter === "skipped") return target === "skip";
      if (activeFilter === "unmapped") return !target;

      const fieldDef = CANONICAL_FIELDS.find((f) => f.key === target);
      if (activeFilter === "ready") return fieldDef?.required === true;
      if (activeFilter === "review") return target && target !== "skip" && !fieldDef?.required;

      return true;
    });
  }, [columns, mapping, activeFilter, searchQuery]);

  return (
    <div className="space-y-5 font-sans">
      {/* Top Banner (Reference 2 style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Map your columns
            </h2>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-brand-primary/15 text-brand-periwinkle border border-brand-primary/30">
              {mappedCount} / {columns.length} mapped
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Align source file columns with canonical banking fields to ensure zero attribution errors
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-surface-card border border-surface-border text-slate-300">
            📄 {filename}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-card h-2 rounded-full overflow-hidden flex border border-surface-border">
        <div
          className="bg-brand-celadon h-full transition-all duration-300"
          style={{ width: `${(statusSummary.readyCount / columns.length) * 100}%` }}
          title={`${statusSummary.readyCount} Mandatory Fields Ready`}
        />
        <div
          className="bg-brand-primary h-full transition-all duration-300"
          style={{ width: `${(statusSummary.reviewCount / columns.length) * 100}%` }}
          title={`${statusSummary.reviewCount} Optional Fields Mapped`}
        />
        <div
          className="bg-slate-700 h-full transition-all duration-300"
          style={{ width: `${(statusSummary.skippedCount / columns.length) * 100}%` }}
          title={`${statusSummary.skippedCount} Skipped`}
        />
      </div>

      {/* Status Badges Row & Quick Jump */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>{statusSummary.readyCount} Required Ready</span>
          </span>

          <span className="inline-flex items-center gap-1.5 font-medium text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span>{statusSummary.reviewCount} Optional Mapped</span>
          </span>

          <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            <span>{statusSummary.skippedCount} Skipped</span>
          </span>

          {statusSummary.unmappedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>{statusSummary.unmappedCount} Unmapped</span>
            </span>
          )}
        </div>

        {!statusSummary.isMandatorySatisfied && (
          <div className="text-xs text-amber-300 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>
              Missing required:{" "}
              {statusSummary.missingMandatoryFields.map((f) => f.label).join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === "all"
                ? "bg-surface-card text-white border border-surface-border"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All {columns.length}
          </button>
          <button
            onClick={() => setActiveFilter("ready")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === "ready"
                ? "bg-surface-card text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Ready {statusSummary.readyCount}
          </button>
          <button
            onClick={() => setActiveFilter("review")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === "review"
                ? "bg-surface-card text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Optional {statusSummary.reviewCount}
          </button>
          <button
            onClick={() => setActiveFilter("skipped")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === "skipped"
                ? "bg-surface-card text-slate-300 border border-surface-border"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Skipped {statusSummary.skippedCount}
          </button>
          {statusSummary.unmappedCount > 0 && (
            <button
              onClick={() => setActiveFilter("unmapped")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === "unmapped"
                  ? "bg-surface-card text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Unmapped {statusSummary.unmappedCount}
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter columns..."
            className="w-full sm:w-60 bg-surface-card border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-brand-primary transition-colors"
          />
        </div>
      </div>

      {/* Column Rows List */}
      <div className="rounded-xl border border-surface-border bg-surface/80 divide-y divide-surface-border overflow-hidden">
        {filteredColumns.map((col) => {
          const currentTarget = mapping[col];
          const isSkipped = currentTarget === "skip";
          const fieldDef = CANONICAL_FIELDS.find((f) => f.key === currentTarget);
          const isRequired = fieldDef?.required;

          // Sample values preview from first 3 rows
          const sampleValues = sampleRows
            .map((r) => r[col])
            .filter((v) => v !== undefined && v !== "")
            .slice(0, 2);

          return (
            <div
              key={col}
              className={`p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors ${
                isSkipped
                  ? "opacity-60 bg-surface-subtle/30"
                  : isRequired
                  ? "bg-surface-card/20"
                  : "hover:bg-surface-card/40"
              }`}
            >
              {/* Left: Checkbox + Column Name + Sample values */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={!isSkipped}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Re-suggest or default
                      const syn = autoSuggestMapping([col]);
                      onChangeMapping(col, syn[col] !== "skip" ? syn[col] : "transaction_id");
                    } else {
                      onChangeMapping(col, "skip");
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded bg-surface-card border-surface-border text-brand-primary cursor-pointer accent-brand-primary"
                  title={isSkipped ? "Include column" : "Skip column"}
                />

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-white tracking-wide truncate">
                      {col}
                    </span>
                    {isRequired && (
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Required
                      </span>
                    )}
                  </div>

                  {sampleValues.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="text-slate-500">Sample:</span>
                      {sampleValues.map((val, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-card text-slate-300 border border-surface-border truncate max-w-[180px]"
                        >
                          {val}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow Indicator */}
              <ChevronRight className="h-4 w-4 text-slate-500 hidden md:block shrink-0" />

              {/* Right: Target Field Selector + Status Icon */}
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                <div className="relative flex-1 md:w-64">
                  <select
                    value={currentTarget || "skip"}
                    onChange={(e) => onChangeMapping(col, e.target.value as CanonicalFieldKey | "skip")}
                    className={`w-full appearance-none rounded-lg px-3 py-2 text-xs font-medium outline-none cursor-pointer border transition-colors ${
                      isSkipped
                        ? "bg-surface-card text-slate-400 border-surface-border"
                        : isRequired
                        ? "bg-surface-elevated text-emerald-300 border-emerald-500/40 focus:border-emerald-400 font-semibold"
                        : "bg-surface-elevated text-sky-300 border-sky-500/40 focus:border-sky-400"
                    }`}
                  >
                    <option value="skip" className="bg-surface-elevated text-slate-400">
                      &mdash; Skip (Do not import)
                    </option>
                    <optgroup label="Canonical Banking Fields" className="bg-surface-elevated text-slate-200 font-semibold">
                      {CANONICAL_FIELDS.map((f) => (
                        <option
                          key={f.key}
                          value={f.key}
                          className="bg-surface-elevated text-slate-200 py-1"
                        >
                          {f.typeIcon} {f.label} {f.required ? "*" : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Status Indicator Icon */}
                <div className="shrink-0">
                  {isSkipped ? (
                    <span title="Skipped">
                      <MinusCircle className="h-4 w-4 text-slate-500" />
                    </span>
                  ) : isRequired ? (
                    <span title="Mandatory Field Mapped">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </span>
                  ) : (
                    <span title="Optional Field Mapped">
                      <CheckCircle2 className="h-4 w-4 text-sky-400" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Bar (Reference 2 style) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-surface-border">
        <button
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-surface-card hover:bg-surface-elevated text-xs text-slate-300 transition-colors border border-surface-border cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="text-xs text-slate-400 hidden sm:block">
            <span>{totalRows.toLocaleString()} rows</span> &bull;{" "}
            <span>{mappedCount}/{columns.length} mapped</span>
          </div>

          <button
            onClick={onApplyAutoMatch}
            className="px-3.5 py-2 rounded-lg bg-surface-elevated hover:bg-surface-card text-xs text-brand-periwinkle font-medium border border-surface-border hover:border-brand-primary/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-indigo" />
            <span>Run Auto-matching</span>
          </button>

          <button
            onClick={onProceed}
            disabled={!statusSummary.isMandatorySatisfied}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-brand-primary hover:bg-[#5252ee] text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-primary/20"
          >
            <span>Proceed to validation</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
