import type { TransactionEvent } from "./transaction.ts";
import type { CaseOrigin } from "./case.ts";

export type UploadStep =
  | "entry"          // Choice between Upload transaction data vs Explore synthetic demo
  | "upload"         // Drag and drop file selection
  | "mapping"        // Column mapping matrix (Reference 2 style)
  | "validation"     // Row-level error check and dataset health audit
  | "setup"          // Case metadata, reported fraud seed & sink configuration
  | "processing";    // Ingesting & running analysis pipeline

export type FileFormat = "csv" | "json" | "jsonl";

export interface ColumnMappingConfig {
  transaction_id: string;
  sender_account_id: string;
  receiver_account_id: string;
  amount: string;
  occurred_at: string;
  currency?: string | null;
  status?: string | null;
  channel?: string | null;
  event_id?: string | null;
  sender_institution?: string | null;
  receiver_institution?: string | null;
  reference?: string | null;
}

export type CanonicalFieldKey = keyof ColumnMappingConfig;

export interface CanonicalFieldDef {
  key: CanonicalFieldKey;
  label: string;
  required: boolean;
  typeIcon: string; // "# ID", "T Text", "₹ Currency", "📅 Datetime", "🏷️ Status"
  description: string;
  example: string;
}

export interface ValidationErrorDetail {
  row_number: number;
  field: string;
  message: string;
  raw_value?: unknown;
}

export interface CandidateSeed {
  transaction_id: string;
  sender: string;
  receiver: string;
  amount_minor_units: number;
  occurred_at: string;
  reason: string;
}

export interface ValidationSummary {
  total_rows: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  unique_senders_count: number;
  unique_receivers_count: number;
  total_volume_minor_units: number;
  earliest_timestamp?: string | null;
  latest_timestamp?: string | null;
  detected_columns: string[];
  suggested_mapping: Record<string, string>;
  candidate_seeds: CandidateSeed[];
  candidate_sinks: string[];
  errors: ValidationErrorDetail[];
  preview_rows: Record<string, unknown>[];
}

export interface IngestUploadedDatasetRequest {
  case_id: string;
  title: string;
  description?: string | null;
  origin: CaseOrigin;
  events: TransactionEvent[];
}

export interface IngestUploadedDatasetResponse {
  case: {
    case_id: string;
    title: string;
    description: string | null;
    origin: string;
    status: string;
    opened_at: string;
    updated_at: string;
  };
  events_count: number;
  accepted_event_ids: string[];
  suggested_seed_transaction_id?: string | null;
  suggested_tainted_amount_minor_units?: number | null;
  candidate_sinks: string[];
}
