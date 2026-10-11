export type TransactionStatus =
  | "completed"
  | "pending"
  | "failed"
  | "reversed"
  | "held";

export type TransactionChannel =
  | "upi"
  | "imps"
  | "neft"
  | "rtgs"
  | "wire"
  | "card"
  | "cash"
  | "internal"
  | "internal_transfer"
  | "other";

export type EventOrigin =
  | "bank_feed"
  | "manual_upload"
  | "api_push"
  | "payment_gateway"
  | "core_banking"
  | "partner_network"
  | "synthetic";

export interface AccountReference {
  account_id: string;
  institution?: string | null;
}

export interface TransactionEvent {
  schema_version: string;
  event_id: string;
  transaction_id: string;
  reference?: string | null;
  sender: AccountReference;
  receiver: AccountReference;
  amount_minor_units: number;
  currency: string;
  occurred_at: string;
  observed_at: string;
  status: TransactionStatus;
  channel: TransactionChannel;
  origin: EventOrigin;
}
