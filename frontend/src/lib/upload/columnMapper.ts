import type {
  CanonicalFieldDef,
  CanonicalFieldKey,
  ColumnMappingConfig,
} from "../../types/upload.ts";

export const CANONICAL_FIELDS: CanonicalFieldDef[] = [
  {
    key: "transaction_id",
    label: "Transaction ID",
    required: true,
    typeIcon: "# ID",
    description: "Unique payment or transaction reference identifier",
    example: "TXN-9021-X9",
  },
  {
    key: "sender_account_id",
    label: "Sender / Source Account",
    required: true,
    typeIcon: "👤 Account",
    description: "Account that initiated or debited the transfer",
    example: "ACC-MULE-101",
  },
  {
    key: "receiver_account_id",
    label: "Receiver / Destination Account",
    required: true,
    typeIcon: "🏦 Account",
    description: "Account that received or was credited by the transfer",
    example: "ACC-CRYPTO-909",
  },
  {
    key: "amount",
    label: "Transfer Amount",
    required: true,
    typeIcon: "₹ Amount",
    description: "Transferred monetary value (e.g. 50,000.00)",
    example: "50000.00",
  },
  {
    key: "occurred_at",
    label: "Transaction Timestamp",
    required: true,
    typeIcon: "📅 Datetime",
    description: "Timezone-aware moment payment occurred",
    example: "2026-10-10T08:15:00Z",
  },
  {
    key: "currency",
    label: "Currency Code",
    required: false,
    typeIcon: "💱 Currency",
    description: "ISO-4217 currency code (defaults to INR)",
    example: "INR",
  },
  {
    key: "status",
    label: "Lifecycle Status",
    required: false,
    typeIcon: "🏷️ Status",
    description: "Transaction state (completed, pending, reversed)",
    example: "completed",
  },
  {
    key: "channel",
    label: "Payment Rail / Channel",
    required: false,
    typeIcon: "⚡ Rail",
    description: "Payment system (UPI, IMPS, NEFT, RTGS, WIRE)",
    example: "upi",
  },
  {
    key: "sender_institution",
    label: "Sender Bank / IFSC",
    required: false,
    typeIcon: "🏛️ Bank",
    description: "Originating financial institution or IFSC",
    example: "HDFC",
  },
  {
    key: "receiver_institution",
    label: "Receiver Bank / IFSC",
    required: false,
    typeIcon: "🏛️ Bank",
    description: "Receiving financial institution or IFSC",
    example: "ICICI",
  },
  {
    key: "reference",
    label: "External Reference / UTR",
    required: false,
    typeIcon: "🔖 Ref",
    description: "External payment gateway UTR or RRN reference",
    example: "UTR/2026/0992",
  },
  {
    key: "event_id",
    label: "Event ID (Optional)",
    required: false,
    typeIcon: "# Event",
    description: "Observation ID (auto-generated if omitted)",
    example: "EVT-001",
  },
];

const SYNONYMS: Record<CanonicalFieldKey, string[]> = {
  transaction_id: [
    "transaction_id",
    "txn_id",
    "tx_id",
    "txid",
    "transactionid",
    "txnreference",
    "txn_reference",
    "tx_reference",
    "transaction_reference",
    "payment_reference",
    "id",
    "payment_id",
    "reference_id",
    "trans_id",
    "payment_ref",
  ],
  sender_account_id: [
    "sender_account_id",
    "sender_account",
    "sender_id",
    "sender",
    "source_account",
    "source_account_id",
    "from_account",
    "from_account_id",
    "from",
    "originator",
    "debtor_account",
    "payer_account",
    "payer",
    "remitter_account",
  ],
  receiver_account_id: [
    "receiver_account_id",
    "receiver_account",
    "receiver_id",
    "receiver",
    "destination_account",
    "dest_account",
    "to_account",
    "to_account_id",
    "to",
    "beneficiary_account",
    "beneficiary",
    "creditor_account",
    "payee_account",
    "payee",
  ],
  amount: [
    "amount",
    "txn_amount",
    "transaction_amount",
    "amt",
    "value",
    "transfer_amount",
    "amount_inr",
    "amount_minor_units",
    "total_amount",
  ],
  occurred_at: [
    "occurred_at",
    "timestamp",
    "booking_timestamp",
    "booking_time",
    "booking_date",
    "tx_timestamp",
    "transaction_timestamp",
    "transfer_timestamp",
    "value_timestamp",
    "payment_timestamp",
    "event_timestamp",
    "tx_time",
    "transaction_time",
    "datetime",
    "date_time",
    "time",
    "date",
    "created_at",
    "value_date",
    "executed_at",
  ],
  currency: ["currency", "ccy", "currency_code", "iso_currency"],
  status: ["status", "tx_status", "state", "payment_status"],
  channel: [
    "channel",
    "payment_channel",
    "rail",
    "payment_rail",
    "method",
    "payment_method",
    "payment_type",
    "txn_type",
    "transaction_type",
    "transfer_type",
    "type",
    "mode",
  ],
  sender_institution: ["sender_institution", "sender_bank", "from_bank", "source_bank", "sender_ifsc", "remitter_bank", "payer_bank"],
  receiver_institution: ["receiver_institution", "receiver_bank", "to_bank", "dest_bank", "receiver_ifsc", "beneficiary_bank", "payee_bank"],
  reference: ["reference", "ref", "utr", "rrn", "external_ref", "narration", "description", "remarks"],
  event_id: ["event_id", "observation_id", "eventid"],
};

/**
 * Suggest canonical field matches for detected columns.
 */
export function autoSuggestMapping(columns: string[]): Record<string, CanonicalFieldKey | "skip"> {
  const result: Record<string, CanonicalFieldKey | "skip"> = {};
  const usedCanonical = new Set<CanonicalFieldKey>();

  // 1. Exact or normalized matching
  for (const col of columns) {
    const norm = col
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const stripped = norm.replace(/_/g, "");

    let matched: CanonicalFieldKey | null = null;

    for (const [canonicalKey, syns] of Object.entries(SYNONYMS) as [CanonicalFieldKey, string[]][]) {
      if (usedCanonical.has(canonicalKey)) continue;

      const isMatch =
        norm === canonicalKey ||
        syns.includes(norm) ||
        syns.some((s) => s.replace(/_/g, "") === stripped);

      if (isMatch) {
        matched = canonicalKey;
        break;
      }
    }

    // Heuristic fallbacks for common suffixes
    if (!matched) {
      if (!usedCanonical.has("occurred_at") && (norm.includes("timestamp") || norm.endsWith("_datetime"))) {
        matched = "occurred_at";
      }
    }

    if (matched) {
      result[col] = matched;
      usedCanonical.add(matched);
    } else {
      result[col] = "skip";
    }
  }

  return result;
}

export type MappingStatus = "ready" | "review" | "skipped" | "unmapped";

export interface ColumnStatusSummary {
  readyCount: number;
  reviewCount: number;
  skippedCount: number;
  unmappedCount: number;
  isMandatorySatisfied: boolean;
  missingMandatoryFields: CanonicalFieldDef[];
}

export function evaluateMappingStatus(
  columns: string[],
  currentMapping: Record<string, CanonicalFieldKey | "skip">
): ColumnStatusSummary {
  let readyCount = 0;
  let reviewCount = 0;
  let skippedCount = 0;
  let unmappedCount = 0;

  const mappedCanonical = new Set<CanonicalFieldKey>();

  for (const col of columns) {
    const target = currentMapping[col];
    if (target === "skip") {
      skippedCount++;
    } else if (!target) {
      unmappedCount++;
    } else {
      const fieldDef = CANONICAL_FIELDS.find((f) => f.key === target);
      if (fieldDef?.required) {
        readyCount++;
      } else {
        reviewCount++;
      }
      mappedCanonical.add(target);
    }
  }

  const missingMandatory = CANONICAL_FIELDS.filter(
    (f) => f.required && !mappedCanonical.has(f.key)
  );

  return {
    readyCount,
    reviewCount,
    skippedCount,
    unmappedCount,
    isMandatorySatisfied: missingMandatory.length === 0,
    missingMandatoryFields: missingMandatory,
  };
}

export function buildConfigFromMapping(
  mapping: Record<string, CanonicalFieldKey | "skip">
): ColumnMappingConfig {
  const config: Partial<ColumnMappingConfig> = {};

  for (const [sourceCol, canonical] of Object.entries(mapping)) {
    if (canonical && canonical !== "skip") {
      config[canonical] = sourceCol;
    }
  }

  return {
    transaction_id: config.transaction_id || "transaction_id",
    sender_account_id: config.sender_account_id || "sender_account_id",
    receiver_account_id: config.receiver_account_id || "receiver_account_id",
    amount: config.amount || "amount",
    occurred_at: config.occurred_at || "occurred_at",
    currency: config.currency,
    status: config.status,
    channel: config.channel,
    event_id: config.event_id,
    sender_institution: config.sender_institution,
    receiver_institution: config.receiver_institution,
    reference: config.reference,
  };
}
