export type CaseOrigin =
  | "customer_report"
  | "bank_detection"
  | "shared_intelligence"
  | "manual_investigation"
  | "intelligence_feed"
  | "law_enforcement"
  | "synthetic";

export type CaseStatus =
  | "open"
  | "under_review"
  | "under_investigation"
  | "escalated"
  | "resolved"
  | "closed"
  | "closed_recovered"
  | "closed_unrecovered";

export interface FraudCase {
  schema_version: string;
  case_id: string;
  title: string;
  description: string | null;
  origin: CaseOrigin;
  status: CaseStatus;
  transaction_ids: string[];
  opened_at: string;
  updated_at: string;
}
