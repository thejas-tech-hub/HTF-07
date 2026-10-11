"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  Zap,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  X,
  AlertTriangle,
} from "lucide-react";
import { UploadStep, ValidationSummary, CanonicalFieldKey } from "../../types/upload";
import { FraudCase, TransactionEvent } from "../../types";
import { FileDropzone } from "./FileDropzone";
import { ColumnMappingTable } from "./ColumnMappingTable";
import { ValidationAuditPanel } from "./ValidationAuditPanel";
import { CaseSetupPanel } from "./CaseSetupPanel";
import { parseCSV, parseJSON } from "../../lib/upload/csvParser";
import {
  autoSuggestMapping,
  buildConfigFromMapping,
} from "../../lib/upload/columnMapper";
import { transformRawRowsToEvents } from "../../lib/upload/transformEvents";
import { SampleDataset } from "../../lib/upload/sampleDatasets";
import { apiClient, ApiError } from "../../lib/api/client";

interface CaseIntakeWorkflowProps {
  onInvestigationReady: (
    caseData: FraudCase,
    events: TransactionEvent[],
    analysisSeedTxId: string,
    sinkAccounts?: string[],
    decisionTimestamp?: string
  ) => Promise<void>;
  onLoadSyntheticDemo: () => Promise<void>;
  isLoadingDemo?: boolean;
  onCloseModal?: () => void;
  isModal?: boolean;
}

export function CaseIntakeWorkflow({
  onInvestigationReady,
  onLoadSyntheticDemo,
  isLoadingDemo = false,
  onCloseModal,
  isModal = false,
}: CaseIntakeWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<UploadStep>("entry");

  // Ingested Raw File State
  const [rawContent, setRawContent] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [format, setFormat] = useState<"csv" | "json" | "jsonl">("csv");

  // Parsed Structure State
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [totalParsedRows, setTotalParsedRows] = useState<number>(0);

  // Column Mapping Matrix State
  const [mapping, setMapping] = useState<Record<string, CanonicalFieldKey | "skip">>({});
  const [amountInMinorUnits, setAmountInMinorUnits] = useState(false);

  // Validation Audit Summary State
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);

  // Progress & Error
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Step 1: File Ingestion Handler ─────────────────────────────────────────
  const handleFileLoaded = (
    content: string,
    name: string,
    fmt: "csv" | "json" | "jsonl"
  ) => {
    setErrorMessage(null);
    setRawContent(content);
    setFilename(name);
    setFormat(fmt);

    try {
      const parsed = fmt === "json" || fmt === "jsonl" ? parseJSON(content) : parseCSV(content);

      if (parsed.columns.length === 0 || parsed.rows.length === 0) {
        setErrorMessage("File contains no parseable columns or data rows.");
        return;
      }

      setDetectedColumns(parsed.columns);
      setRawRows(parsed.rows);
      setTotalParsedRows(parsed.totalRows);

      // Auto-suggest mappings immediately
      const suggestions = autoSuggestMapping(parsed.columns);
      setMapping(suggestions);

      setCurrentStep("mapping");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to parse file format."
      );
    }
  };

  const handleSelectSample = (sample: SampleDataset) => {
    handleFileLoaded(sample.content, sample.filename, sample.format);
  };

  // ── Step 2: Mapping Completed -> Validate ──────────────────────────────────
  const handleProceedToValidation = async () => {
    setIsProcessing(true);
    setProcessingStatusText("Validating transaction records on server...");
    setErrorMessage(null);

    const config = buildConfigFromMapping(mapping);

    try {
      // 1. Perform server-side validation against canonical contracts
      const serverSummary = await apiClient.validateDataset({
        raw_content: rawContent,
        format,
        column_mapping: config as unknown as Record<string, string>,
        amount_in_minor_units: amountInMinorUnits,
        default_currency: "INR",
        default_timezone_offset_minutes: 0,
      });

      setValidationSummary(serverSummary);
      setCurrentStep("validation");
    } catch (err) {
      // Fallback: If server is unavailable, perform client-side transformation
      try {
        const clientTransform = transformRawRowsToEvents(rawRows, config, {
          amountInMinorUnits,
          defaultCurrency: "INR",
        });

        const senders = new Set(clientTransform.events.map((e) => e.sender.account_id));
        const receivers = new Set(clientTransform.events.map((e) => e.receiver.account_id));
        const totalVolume = clientTransform.events.reduce((sum, e) => sum + e.amount_minor_units, 0);

        const fallbackSummary: ValidationSummary = {
          total_rows: rawRows.length,
          valid_rows_count: clientTransform.validCount,
          invalid_rows_count: clientTransform.invalidCount,
          unique_senders_count: senders.size,
          unique_receivers_count: receivers.size,
          total_volume_minor_units: totalVolume,
          earliest_timestamp: clientTransform.events[0]?.occurred_at || null,
          latest_timestamp: clientTransform.events[clientTransform.events.length - 1]?.occurred_at || null,
          detected_columns: detectedColumns,
          suggested_mapping: config as unknown as Record<string, string>,
          candidate_seeds: clientTransform.events[0]
            ? [
                {
                  transaction_id: clientTransform.events[0].transaction_id,
                  sender: clientTransform.events[0].sender.account_id,
                  receiver: clientTransform.events[0].receiver.account_id,
                  amount_minor_units: clientTransform.events[0].amount_minor_units,
                  occurred_at: clientTransform.events[0].occurred_at,
                  reason: "Earliest transaction in timeline",
                },
              ]
            : [],
          candidate_sinks: Array.from(receivers).filter((r) => !senders.has(r)).slice(0, 5),
          errors: clientTransform.errors,
          preview_rows: rawRows.slice(0, 10),
        };

        setValidationSummary(fallbackSummary);
        setCurrentStep("validation");
      } catch (clientErr) {
        setErrorMessage(
          err instanceof ApiError ? err.detail : "Validation failed. Please verify column mappings."
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const isSubmittingRef = React.useRef(false);

  // ── Step 4: Submit Case & Launch Analysis ──────────────────────────────────
  const handleLaunchInvestigation = async (params: {
    caseId: string;
    title: string;
    description: string;
    origin: any;
    seedTxId: string;
    taintedAmountMinorUnits: number;
    sinkAccountIds: string[];
    decisionTimestamp: string;
  }) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);
    setProcessingStatusText("Transforming canonical transactions with case-scoped identifiers...");
    setErrorMessage(null);

    const config = buildConfigFromMapping(mapping);

    try {
      const transformResult = transformRawRowsToEvents(rawRows, config, {
        amountInMinorUnits,
        defaultCurrency: "INR",
        caseId: params.caseId,
      });

      if (transformResult.events.length === 0) {
        throw new Error("No valid transactions found to ingest.");
      }

      setProcessingStatusText(`Ingesting ${transformResult.events.length} transactions into case '${params.caseId}'...`);

      // 1. Submit through backend atomic ingest endpoint
      const ingestResp = await apiClient.ingestUploadedDataset({
        case_id: params.caseId,
        title: params.title,
        description: params.description,
        origin: params.origin,
        events: transformResult.events,
      });

      setProcessingStatusText("Constructing temporal graph & initializing workspace...");

      // 2. Open workspace with loaded investigation
      await onInvestigationReady(
        ingestResp.case as FraudCase,
        transformResult.events,
        params.seedTxId,
        params.sinkAccountIds,
        params.decisionTimestamp
      );

      if (onCloseModal) onCloseModal();
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
          ? err.message
          : "Failed to ingest and initialize investigation."
      );
    } finally {
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  };

  const containerClasses = isModal
    ? "bg-surface-elevated border border-surface-border rounded-2xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
    : "max-w-5xl mx-auto w-full p-4 lg:p-8 space-y-8";

  return (
    <div className={containerClasses}>
      {/* Modal Close Button */}
      {isModal && onCloseModal && (
        <div className="flex items-center justify-between pb-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-brand-primary" />
            <h3 className="text-base font-bold text-white">Start an Investigation</h3>
          </div>
          <button
            onClick={onCloseModal}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-card transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-risk-danger/15 border border-risk-danger/40 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-risk-danger shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-rose-100">Ingestion / Processing Error</span>
              <p className="text-rose-300 font-mono text-[11px]">{errorMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {currentStep === "setup" && (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setCurrentStep("validation");
                }}
                className="px-2.5 py-1 rounded bg-surface-card hover:bg-surface-elevated text-slate-300 border border-surface-border transition-colors text-[11px] cursor-pointer"
              >
                Back to audit
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-colors text-[11px] font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Screen A: Entry Selection (Step 4 Requirement) ── */}
      {currentStep === "entry" && (
        <div className="space-y-8 py-4">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-periwinkle px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20">
              Sovereign Fraud Investigation Platform
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Start an Investigation
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Upload real banking transaction ledgers to reconstruct money flows, identify laundering chokepoints, and evaluate Pareto-optimal intervention holds.
            </p>
          </div>

          {/* 2 Distinct Entry Paths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Entry Path 1: Real Data Upload (PRIMARY WORKFLOW) */}
            <div
              onClick={() => setCurrentStep("upload")}
              className="p-6 rounded-2xl bg-gradient-to-b from-surface-elevated to-surface border-2 border-brand-primary/50 hover:border-brand-primary transition-all cursor-pointer shadow-xl flex flex-col justify-between space-y-5 group relative overflow-hidden"
            >
              <div className="absolute top-3 right-3 text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-brand-primary text-white">
                Primary Intake
              </div>

              <div className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/20 text-brand-primary border border-brand-primary/30 group-hover:scale-105 transition-transform">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-brand-periwinkle transition-colors">
                  Upload Transaction Data
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Provide custom CSV, JSON, or JSONL bank records for an active investigation. Interactively map columns, audit validity, and analyze real fund flow.
                </p>
              </div>

              <div className="pt-4 border-t border-surface-border flex items-center justify-between text-xs font-semibold text-brand-primary">
                <span>Configure custom dataset &rarr;</span>
                <span className="text-slate-400 font-normal font-mono text-[11px]">CSV &bull; JSON &bull; JSONL</span>
              </div>
            </div>

            {/* Entry Path 2: Synthetic Benchmark Demo (CLEARLY LABELED DEMO) */}
            <div
              onClick={onLoadSyntheticDemo}
              className="p-6 rounded-2xl bg-surface-elevated border border-surface-border hover:border-slate-500 transition-all cursor-pointer shadow-md flex flex-col justify-between space-y-5 group"
            >
              <div className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Explore Synthetic Demo
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Demonstration
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Inspect &ldquo;Operation ShatterFlow&rdquo; — a pre-verified 7-stage synthetic benchmark case modeling corporate fraud branching, merchant mixing, and cash-out exit sinks.
                </p>
              </div>

              <div className="pt-4 border-t border-surface-border flex items-center justify-between text-xs font-medium text-slate-300 group-hover:text-white">
                <span>{isLoadingDemo ? "Loading demo..." : "Launch benchmark demo &rarr;"}</span>
                <span className="text-slate-500 text-[11px]">Preloaded Ground Truth</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Screen B: File Selection & Upload ── */}
      {currentStep === "upload" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Select Transaction Dataset</h2>
              <p className="text-xs text-slate-400">Step 1 of 4 &bull; Ingest financial transactions</p>
            </div>
            <button
              onClick={() => setCurrentStep("entry")}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              &larr; Back to entry options
            </button>
          </div>

          <FileDropzone
            onFileLoaded={handleFileLoaded}
            onSelectSample={handleSelectSample}
            isLoading={isProcessing}
          />
        </div>
      )}

      {/* ── Screen C: Column Mapping (Reference 2 Workflow) ── */}
      {currentStep === "mapping" && (
        <ColumnMappingTable
          filename={filename}
          columns={detectedColumns}
          sampleRows={rawRows}
          totalRows={totalParsedRows}
          mapping={mapping}
          onChangeMapping={(col, target) => setMapping((prev) => ({ ...prev, [col]: target }))}
          onApplyAutoMatch={() => setMapping(autoSuggestMapping(detectedColumns))}
          onCancel={() => setCurrentStep("upload")}
          onProceed={handleProceedToValidation}
        />
      )}

      {/* ── Screen D: Validation & Integrity Audit ── */}
      {currentStep === "validation" && validationSummary && (
        <ValidationAuditPanel
          summary={validationSummary}
          filename={filename}
          amountInMinorUnits={amountInMinorUnits}
          onToggleMinorUnits={(inMinor) => setAmountInMinorUnits(inMinor)}
          onBackToMapping={() => setCurrentStep("mapping")}
          onProceedToSetup={() => setCurrentStep("setup")}
        />
      )}

      {/* ── Screen E: Case Setup & Fraud Seed Anchor ── */}
      {currentStep === "setup" && validationSummary && (
        <CaseSetupPanel
          summary={validationSummary}
          onBack={() => setCurrentStep("validation")}
          onSubmit={handleLaunchInvestigation}
          isSubmitting={isProcessing}
        />
      )}

      {/* ── Processing Overlay ── */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 font-sans">
          <div className="p-8 rounded-2xl bg-surface-elevated border border-surface-border shadow-2xl max-w-sm w-full text-center space-y-4">
            <RefreshCw className="h-8 w-8 text-brand-primary animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Analyzing Financial Evidence</h4>
              <p className="text-xs text-slate-400">{processingStatusText}</p>
            </div>
            <div className="w-full bg-surface-card h-1.5 rounded-full overflow-hidden">
              <div className="bg-brand-primary h-full w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
