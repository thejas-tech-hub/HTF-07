import type { TransactionEvent, TransactionStatus, TransactionChannel } from "../../types/transaction.ts";
import type { ColumnMappingConfig, ValidationErrorDetail } from "../../types/upload.ts";

export interface TransformationResult {
  events: TransactionEvent[];
  errors: ValidationErrorDetail[];
  validCount: number;
  invalidCount: number;
}

const VALID_STATUSES: Set<string> = new Set(["completed", "pending", "failed", "reversed", "held"]);
const VALID_CHANNELS: Set<string> = new Set(["upi", "neft", "rtgs", "imps", "wire", "card", "cash", "internal", "other"]);

export function transformRawRowsToEvents(
  rows: Record<string, string>[],
  mapping: ColumnMappingConfig,
  options: {
    amountInMinorUnits?: boolean;
    defaultCurrency?: string;
    defaultTimezoneOffsetMinutes?: number;
    caseId?: string;
  } = {}
): TransformationResult {
  const events: TransactionEvent[] = [];
  const errors: ValidationErrorDetail[] = [];
  const seenTxIds = new Set<string>();
  const seenEventIds = new Set<string>();

  const isMinor = options.amountInMinorUnits ?? false;
  const defaultCurrency = (options.defaultCurrency || "INR").toUpperCase();
  const tzOffsetMinutes = options.defaultTimezoneOffsetMinutes ?? 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 1;
    let rowHasError = false;

    // 1. Transaction ID
    const rawTxId = (row[mapping.transaction_id] || "").trim();
    if (!rawTxId) {
      errors.push({
        row_number: rowNum,
        field: "transaction_id",
        message: `Missing transaction identifier in mapped column '${mapping.transaction_id}'`,
      });
      rowHasError = true;
    } else if (seenTxIds.has(rawTxId)) {
      errors.push({
        row_number: rowNum,
        field: "transaction_id",
        message: `Duplicate transaction ID '${rawTxId}'`,
        raw_value: rawTxId,
      });
      rowHasError = true;
    } else {
      seenTxIds.add(rawTxId);
    }

    // 2. Sender Account
    const rawSender = (row[mapping.sender_account_id] || "").trim();
    if (!rawSender) {
      errors.push({
        row_number: rowNum,
        field: "sender_account_id",
        message: `Missing sender account ID in mapped column '${mapping.sender_account_id}'`,
      });
      rowHasError = true;
    }

    // 3. Receiver Account
    const rawReceiver = (row[mapping.receiver_account_id] || "").trim();
    if (!rawReceiver) {
      errors.push({
        row_number: rowNum,
        field: "receiver_account_id",
        message: `Missing receiver account ID in mapped column '${mapping.receiver_account_id}'`,
      });
      rowHasError = true;
    }

    if (rawSender && rawReceiver && rawSender === rawReceiver) {
      errors.push({
        row_number: rowNum,
        field: "receiver_account_id",
        message: `Self-transfer detected (sender == receiver: '${rawSender}')`,
        raw_value: rawSender,
      });
      rowHasError = true;
    }

    // 4. Amount
    const rawAmt = row[mapping.amount] || "";
    let amountMinor = 0;
    try {
      const cleaned = String(rawAmt).replace(/[,₹$£\s]/g, "");
      const num = parseFloat(cleaned);
      if (isNaN(num) || num <= 0) {
        errors.push({
          row_number: rowNum,
          field: "amount",
          message: "Transfer amount must be a positive number greater than zero",
          raw_value: rawAmt,
        });
        rowHasError = true;
      } else {
        amountMinor = isMinor ? Math.round(num) : Math.round(num * 100);
      }
    } catch {
      errors.push({
        row_number: rowNum,
        field: "amount",
        message: `Unparseable amount value '${rawAmt}'`,
        raw_value: rawAmt,
      });
      rowHasError = true;
    }

    // 5. Timestamp
    const rawTime = (row[mapping.occurred_at] || "").trim();
    let occurredIso = "";
    if (!rawTime) {
      errors.push({
        row_number: rowNum,
        field: "occurred_at",
        message: "Missing transaction timestamp",
      });
      rowHasError = true;
    } else {
      try {
        const parsedDate = new Date(rawTime);
        if (isNaN(parsedDate.getTime())) {
          throw new Error("Invalid date");
        }
        occurredIso = parsedDate.toISOString();
      } catch {
        errors.push({
          row_number: rowNum,
          field: "occurred_at",
          message: `Unparseable timestamp '${rawTime}'. Use ISO format (YYYY-MM-DDTHH:mm:ssZ)`,
          raw_value: rawTime,
        });
        rowHasError = true;
      }
    }

    if (rowHasError) continue;

    // Optional fields
    const rawCurrency = (mapping.currency ? row[mapping.currency] : "") || defaultCurrency;
    const currency = rawCurrency.toUpperCase().slice(0, 3) || "INR";

    const rawStatus = (mapping.status ? row[mapping.status] : "")?.toLowerCase().trim();
    const status: TransactionStatus = VALID_STATUSES.has(rawStatus)
      ? (rawStatus as TransactionStatus)
      : "completed";

    const rawChannel = (mapping.channel ? row[mapping.channel] : "")?.toLowerCase().trim();
    const channel: TransactionChannel = VALID_CHANNELS.has(rawChannel)
      ? (rawChannel as TransactionChannel)
      : "upi";

    const casePrefix = options.caseId ? `${options.caseId}_` : "";
    let eventId = mapping.event_id ? (row[mapping.event_id] || "").trim() : "";
    if (eventId) {
      if (options.caseId && !eventId.startsWith(options.caseId)) {
        eventId = `ev_${casePrefix}${eventId}`;
      }
    } else {
      eventId = `ev_${casePrefix}${rawTxId}`;
    }
    // Ensure uniqueness of eventId within batch
    if (seenEventIds.has(eventId)) {
      eventId = `${eventId}_${rowNum}`;
    }
    seenEventIds.add(eventId);

    const senderInst = mapping.sender_institution ? (row[mapping.sender_institution] || "").trim() : null;
    const receiverInst = mapping.receiver_institution ? (row[mapping.receiver_institution] || "").trim() : null;
    const reference = mapping.reference ? (row[mapping.reference] || "").trim() : null;

    events.push({
      schema_version: "1.0.0",
      event_id: eventId,
      transaction_id: rawTxId,
      reference: reference || null,
      sender: {
        account_id: rawSender,
        institution: senderInst || null,
      },
      receiver: {
        account_id: rawReceiver,
        institution: receiverInst || null,
      },
      amount_minor_units: amountMinor,
      currency,
      occurred_at: occurredIso,
      observed_at: occurredIso,
      status,
      channel,
      origin: "manual_upload",
    });
  }

  // Sort events chronologically by occurred_at
  events.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  return {
    events,
    errors,
    validCount: events.length,
    invalidCount: errors.length,
  };
}
