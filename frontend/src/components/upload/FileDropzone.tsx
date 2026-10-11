"use client";

import React, { useRef, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
} from "lucide-react";
import { SAMPLE_DATASETS, SampleDataset } from "../../lib/upload/sampleDatasets";

interface FileDropzoneProps {
  onFileLoaded: (content: string, filename: string, format: "csv" | "json" | "jsonl") => void;
  onSelectSample: (sample: SampleDataset) => void;
  isLoading?: boolean;
}

export function FileDropzone({
  onFileLoaded,
  onSelectSample,
  isLoading = false,
}: FileDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileProcess = (file: File) => {
    setError(null);

    // Max 15MB limit
    if (file.size > 15 * 1024 * 1024) {
      setError("File exceeds 15MB limit. Please upload a smaller dataset.");
      return;
    }

    const name = file.name.toLowerCase();
    let format: "csv" | "json" | "jsonl" = "csv";
    if (name.endsWith(".json")) {
      format = "json";
    } else if (name.endsWith(".jsonl")) {
      format = "jsonl";
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      format = "csv";
    } else {
      setError("Unsupported format. Please upload CSV (.csv), JSON (.json), or JSONL (.jsonl) files.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || !content.trim()) {
        setError("The uploaded file appears to be empty.");
        return;
      }
      onFileLoaded(content, file.name, format);
    };
    reader.onerror = () => {
      setError("Failed to read file from disk. Please check file permissions.");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div className="space-y-6">
      {/* Primary Drag & Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center group ${
          isDragOver
            ? "border-brand-primary bg-brand-primary/10 scale-[0.99]"
            : "border-surface-border bg-surface/50 hover:bg-surface-elevated/70 hover:border-slate-500"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.jsonl,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileProcess(e.target.files[0]);
            }
          }}
        />

        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-card border border-surface-border group-hover:border-brand-primary/40 group-hover:scale-105 transition-all text-brand-primary shadow-xl">
          <UploadCloud className="h-8 w-8 text-brand-primary" />
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="text-base font-semibold text-white tracking-tight">
            Drop transaction file here or <span className="text-brand-primary underline underline-offset-4">browse files</span>
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Upload banking ledgers, core banking dumps, payment gateway logs, or switch reports
          </p>
        </div>

        {/* Format Badges */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-surface-card border border-surface-border text-slate-300">
            <FileSpreadsheet className="h-3.5 w-3.5 text-brand-celadon" />
            <span>CSV (.csv)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-surface-card border border-surface-border text-slate-300">
            <FileCode className="h-3.5 w-3.5 text-brand-periwinkle" />
            <span>JSON (.json)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-surface-card border border-surface-border text-slate-300">
            <FileCode className="h-3.5 w-3.5 text-brand-cyan" />
            <span>JSONL (.jsonl)</span>
          </span>
          <span className="text-xs text-slate-500">Max size: 15 MB / ~25,000 rows</span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-risk-danger/15 border border-risk-danger/30 text-xs text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-risk-danger shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Security & Confidentiality Notice */}
      <div className="p-4 rounded-xl bg-surface-elevated/60 border border-surface-border flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
        <ShieldCheck className="h-5 w-5 text-brand-celadon shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-white flex items-center gap-2">
            <span>Sovereign Financial Confidentiality</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              In-Memory / Local
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Uploaded transaction ledgers are processed strictly inside the local AEGIS-Flow backend instance. Data is never shared with third-party AI models, public clouds, or external telemetry trackers.
          </p>
        </div>
      </div>

      {/* 1-Click Realistic Benchmark Scenarios */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-indigo" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Or test with realistic banking exports (1-click load)
            </h4>
          </div>
          <span className="text-[11px] text-slate-500">Disparate schemas & headers</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SAMPLE_DATASETS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => onSelectSample(sample)}
              className="p-4 rounded-xl bg-surface-elevated border border-surface-border hover:border-brand-primary/50 hover:bg-surface-card transition-all cursor-pointer flex flex-col justify-between group space-y-3 shadow-md"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-brand-periwinkle transition-colors">
                    {sample.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-surface-border text-slate-400 uppercase">
                    {sample.format}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                  {sample.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-surface-border/60 text-[11px]">
                <span className="text-brand-celadon font-medium">{sample.badge}</span>
                <span className="text-brand-primary group-hover:translate-x-1 transition-transform">
                  Load dataset &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
