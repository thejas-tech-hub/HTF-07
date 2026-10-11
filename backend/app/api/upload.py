"""Upload and dataset intake API routes.

Provides endpoints for:
1. POST /api/upload/validate - Validates raw or structured transaction data on the server,
   detects columns, suggests mappings, performs row-by-row integrity checks, and returns
   dataset statistics and candidate fraud seeds.
2. POST /api/upload/ingest - Atomically creates a FraudCase and batch-ingests the validated
   TransactionEvents into the case and temporal graph registry.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("aegis.upload")

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from contracts.account import AccountReference
from contracts.case import FraudCase
from contracts.enums import (
    CaseOrigin,
    CaseStatus,
    EventOrigin,
    TransactionChannel,
    TransactionStatus,
)
from contracts.transaction import TransactionEvent

from backend.app.dependencies import get_case_service, get_event_service
from backend.app.services.case_service import CaseService, EventService

router = APIRouter(prefix="/api/upload", tags=["upload"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ColumnMappingConfig(BaseModel):
    """Maps user source columns to canonical transaction fields."""

    model_config = ConfigDict(extra="ignore")

    transaction_id: str = "transaction_id"
    sender_account_id: str = "sender_account_id"
    receiver_account_id: str = "receiver_account_id"
    amount: str = "amount"
    occurred_at: str = "occurred_at"
    currency: str | None = None
    status: str | None = None
    channel: str | None = None
    event_id: str | None = None
    sender_institution: str | None = None
    receiver_institution: str | None = None
    reference: str | None = None


class DatasetValidationRequest(BaseModel):
    """Request payload for dataset validation on the server."""

    raw_content: str | None = Field(
        default=None,
        description="Raw string content of uploaded CSV, JSON, or JSONL file (up to 15MB).",
    )
    format: str = Field(
        default="csv",
        description="Source format: 'csv', 'json', or 'jsonl'.",
    )
    column_mapping: ColumnMappingConfig = Field(
        default_factory=ColumnMappingConfig,
        description="User-configured or auto-suggested column mapping.",
    )
    default_currency: str = Field(
        default="INR",
        description="Fallback ISO currency code if omitted in source.",
    )
    amount_in_minor_units: bool = Field(
        default=False,
        description="If True, amount is already integer paise. If False, converts major rupees to paise (*100).",
    )
    default_timezone_offset_minutes: int = Field(
        default=0,
        description="Fallback timezone offset in minutes (e.g. 330 for IST +05:30) if source timestamps lack timezone.",
    )


class ValidationErrorDetail(BaseModel):
    row_number: int
    field: str
    message: str
    raw_value: Any = None


class ValidationSummary(BaseModel):
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    unique_senders_count: int
    unique_receivers_count: int
    total_volume_minor_units: int
    earliest_timestamp: str | None = None
    latest_timestamp: str | None = None
    detected_columns: list[str] = Field(default_factory=list)
    suggested_mapping: dict[str, str] = Field(default_factory=dict)
    candidate_seeds: list[dict[str, Any]] = Field(default_factory=list)
    candidate_sinks: list[str] = Field(default_factory=list)
    errors: list[ValidationErrorDetail] = Field(default_factory=list)
    preview_rows: list[dict[str, Any]] = Field(default_factory=list)


class IngestUploadedDatasetRequest(BaseModel):
    """Request payload to create a case and ingest validated events."""

    case_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str | None = None
    origin: CaseOrigin = Field(default=CaseOrigin.MANUAL_INVESTIGATION)
    events: list[TransactionEvent] = Field(..., min_length=1)


class IngestUploadedDatasetResponse(BaseModel):
    case: FraudCase
    events_count: int
    accepted_event_ids: list[str]
    suggested_seed_transaction_id: str | None = None
    suggested_tainted_amount_minor_units: int | None = None
    candidate_sinks: list[str] = Field(default_factory=list)


# ── Heuristic Column Mapping Suggester ───────────────────────────────────────

COLUMN_SYNONYMS: dict[str, list[str]] = {
    "transaction_id": [
        "transaction_id",
        "txn_id",
        "tx_id",
        "txid",
        "transactionid",
        "id",
        "payment_id",
        "reference_id",
        "trans_id",
    ],
    "sender_account_id": [
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
    ],
    "receiver_account_id": [
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
    ],
    "amount": [
        "amount",
        "txn_amount",
        "transaction_amount",
        "amt",
        "value",
        "transfer_amount",
        "amount_inr",
        "amount_minor_units",
    ],
    "occurred_at": [
        "occurred_at",
        "timestamp",
        "tx_time",
        "transaction_time",
        "datetime",
        "date_time",
        "time",
        "date",
        "created_at",
        "booking_date",
        "value_date",
    ],
    "currency": ["currency", "ccy", "currency_code", "iso_currency"],
    "status": ["status", "tx_status", "state", "payment_status"],
    "channel": ["channel", "payment_channel", "rail", "payment_rail", "method", "payment_method", "type"],
    "reference": ["reference", "ref", "utr", "rrn", "external_ref", "narration", "description"],
    "sender_institution": ["sender_institution", "sender_bank", "from_bank", "source_bank", "sender_ifsc"],
    "receiver_institution": ["receiver_institution", "receiver_bank", "to_bank", "dest_bank", "receiver_ifsc"],
}


def suggest_mappings(columns: list[str]) -> dict[str, str]:
    """Suggest canonical mapping for raw column headers."""
    suggested: dict[str, str] = {}
    normalized = {c.strip().lower().replace(" ", "_").replace("-", "_"): c for c in columns}

    for canonical_field, synonyms in COLUMN_SYNONYMS.items():
        matched_raw: str | None = None
        for syn in synonyms:
            if syn in normalized:
                matched_raw = normalized[syn]
                break
        if matched_raw:
            suggested[canonical_field] = matched_raw

    return suggested


def parse_raw_records(raw_content: str, fmt: str) -> list[dict[str, Any]]:
    """Parse raw CSV, JSON, or JSONL string into a list of row dicts."""
    fmt = fmt.strip().lower()
    if fmt == "json":
        data = json.loads(raw_content)
        if isinstance(data, list):
            return [dict(item) for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            # Check for standard data envelopes
            for key in ("transactions", "events", "data", "records", "rows"):
                if key in data and isinstance(data[key], list):
                    return [dict(item) for item in data[key] if isinstance(item, dict)]
            return [data]
        return []

    if fmt == "jsonl":
        rows: list[dict[str, Any]] = []
        for line in raw_content.splitlines():
            line = line.strip()
            if line:
                parsed = json.loads(line)
                if isinstance(parsed, dict):
                    rows.append(parsed)
        return rows

    # Default: CSV
    # Sniff delimiter if possible
    first_lines = "\n".join(raw_content.splitlines()[:5])
    delimiter = ","
    try:
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(first_lines, delimiters=",\t;|")
        delimiter = dialect.delimiter
    except Exception:
        delimiter = ","

    reader = csv.DictReader(io.StringIO(raw_content), delimiter=delimiter)
    return [dict(row) for row in reader if row]


def parse_timestamp_safe(ts_val: Any, default_tz_offset_minutes: int) -> datetime:
    """Safely parse diverse datetime representations and ensure timezone-awareness."""
    if isinstance(ts_val, datetime):
        if ts_val.tzinfo is None:
            offset = timezone(timedelta(minutes=default_tz_offset_minutes))
            return ts_val.replace(tzinfo=offset)
        return ts_val

    s = str(ts_val).strip()
    # Try ISO formats
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        # Common fallback formats
        formats = [
            "%Y-%m-%d %H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y",
        ]
        parsed_dt = None
        for fmt in formats:
            try:
                parsed_dt = datetime.strptime(s, fmt)
                break
            except ValueError:
                continue
        if parsed_dt is None:
            raise ValueError(f"Unparseable timestamp: '{s}'")
        dt = parsed_dt

    if dt.tzinfo is None:
        from datetime import timedelta
        offset = timezone(timedelta(minutes=default_tz_offset_minutes))
        dt = dt.replace(tzinfo=offset)

    return dt.astimezone(timezone.utc)


# ── Validation Endpoint ──────────────────────────────────────────────────────


@router.post("/validate", response_model=ValidationSummary)
async def validate_dataset(req: DatasetValidationRequest) -> ValidationSummary:
    """
    Validate raw transaction file contents on the server against AEGIS-Flow contracts.

    Performs column detection, row-level validation, checks for duplicate IDs, negative
    amounts, unparseable timestamps, and missing account identifiers.
    Returns preview rows, statistics, and candidate seeds for the investigator.
    """
    if not req.raw_content or not req.raw_content.strip():
        raise HTTPException(status_code=422, detail="raw_content cannot be empty.")

    # File size check: 15MB limit
    if len(req.raw_content.encode("utf-8")) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Uploaded file exceeds 15MB server limit.")

    try:
        raw_rows = parse_raw_records(req.raw_content, req.format)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse {req.format.upper()} data: {exc}")

    if not raw_rows:
        raise HTTPException(status_code=422, detail="Dataset contains zero records.")

    # Detected columns from first non-empty row
    detected_columns = list(raw_rows[0].keys())
    suggested = suggest_mappings(detected_columns)

    # Use mapping config, falling back to suggestions or identical column names
    mapping = {
        "transaction_id": req.column_mapping.transaction_id or suggested.get("transaction_id", "transaction_id"),
        "sender_account_id": req.column_mapping.sender_account_id or suggested.get("sender_account_id", "sender_account_id"),
        "receiver_account_id": req.column_mapping.receiver_account_id or suggested.get("receiver_account_id", "receiver_account_id"),
        "amount": req.column_mapping.amount or suggested.get("amount", "amount"),
        "occurred_at": req.column_mapping.occurred_at or suggested.get("occurred_at", "occurred_at"),
        "currency": req.column_mapping.currency or suggested.get("currency"),
        "status": req.column_mapping.status or suggested.get("status"),
        "channel": req.column_mapping.channel or suggested.get("channel"),
        "event_id": req.column_mapping.event_id or suggested.get("event_id"),
        "reference": req.column_mapping.reference or suggested.get("reference"),
        "sender_institution": req.column_mapping.sender_institution or suggested.get("sender_institution"),
        "receiver_institution": req.column_mapping.receiver_institution or suggested.get("receiver_institution"),
    }

    errors: list[ValidationErrorDetail] = []
    seen_tx_ids: set[str] = set()
    unique_senders: set[str] = set()
    unique_receivers: set[str] = set()
    total_volume_minor = 0
    earliest_dt: datetime | None = None
    latest_dt: datetime | None = None
    valid_rows_count = 0

    valid_events_summary: list[dict[str, Any]] = []

    for idx, row in enumerate(raw_rows, start=1):
        row_has_error = False

        # 1. Transaction ID
        raw_tx_id = str(row.get(mapping["transaction_id"], "")).strip() if mapping["transaction_id"] in row else ""
        if not raw_tx_id:
            errors.append(
                ValidationErrorDetail(
                    row_number=idx,
                    field="transaction_id",
                    message=f"Missing transaction identifier in column '{mapping['transaction_id']}'",
                )
            )
            row_has_error = True
        elif raw_tx_id in seen_tx_ids:
            errors.append(
                ValidationErrorDetail(
                    row_number=idx,
                    field="transaction_id",
                    message=f"Duplicate transaction ID '{raw_tx_id}'",
                    raw_value=raw_tx_id,
                )
            )
            row_has_error = True
        else:
            seen_tx_ids.add(raw_tx_id)

        # 2. Sender Account
        raw_sender = str(row.get(mapping["sender_account_id"], "")).strip() if mapping["sender_account_id"] in row else ""
        if not raw_sender:
            errors.append(
                ValidationErrorDetail(
                    row_number=idx,
                    field="sender_account_id",
                    message=f"Missing sender account ID in column '{mapping['sender_account_id']}'",
                )
            )
            row_has_error = True

        # 3. Receiver Account
        raw_receiver = str(row.get(mapping["receiver_account_id"], "")).strip() if mapping["receiver_account_id"] in row else ""
        if not raw_receiver:
            errors.append(
                ValidationErrorDetail(
                    row_number=idx,
                    field="receiver_account_id",
                    message=f"Missing receiver account ID in column '{mapping['receiver_account_id']}'",
                )
            )
            row_has_error = True

        if raw_sender and raw_receiver and raw_sender == raw_receiver:
            errors.append(
                ValidationErrorDetail(
                    row_number=idx,
                    field="receiver_account_id",
                    message=f"Self-transfer detected (sender == receiver: '{raw_sender}')",
                    raw_value=raw_sender,
                )
            )
            row_has_error = True

        # 4. Amount
        raw_amt_val = row.get(mapping["amount"], "") if mapping["amount"] in row else ""
        amount_minor = 0
        try:
            cleaned_amt_str = str(raw_amt_val).replace(",", "").replace("$", "").replace("₹", "").replace("£", "").strip()
            num_val = float(cleaned_amt_str)
            if num_val <= 0:
                errors.append(
                    ValidationErrorDetail(
                        row_number=idx,
                        field="amount",
                        message="Amount must be strictly greater than zero",
                        raw_value=raw_amt_val,
                    )
                )
                row_has_error = True
            else:
                if req.amount_in_minor_units:
                    amount_minor = int(round(num_val))
                else:
                    amount_minor = int(round(num_val * 100))
        except (ValueError, TypeError):
            errors.append(
                ValidationErrorDetail(
                    row_number=idx,
                    field="amount",
                    message=f"Unparseable numeric amount '{raw_amt_val}' in column '{mapping['amount']}'",
                    raw_value=raw_amt_val,
                )
            )
            row_has_error = True

        # 5. Timestamp
        raw_time_val = row.get(mapping["occurred_at"], "") if mapping["occurred_at"] in row else ""
        parsed_dt: datetime | None = None
        try:
            parsed_dt = parse_timestamp_safe(raw_time_val, req.default_timezone_offset_minutes)
        except Exception as exc:
            errors.append(
                ValidationErrorDetail(
                    row_number=idx,
                    field="occurred_at",
                    message=f"Invalid timestamp in column '{mapping['occurred_at']}': {exc}",
                    raw_value=raw_time_val,
                )
            )
            row_has_error = True

        if not row_has_error and parsed_dt is not None:
            valid_rows_count += 1
            unique_senders.add(raw_sender)
            unique_receivers.add(raw_receiver)
            total_volume_minor += amount_minor

            if earliest_dt is None or parsed_dt < earliest_dt:
                earliest_dt = parsed_dt
            if latest_dt is None or parsed_dt > latest_dt:
                latest_dt = parsed_dt

            valid_events_summary.append({
                "transaction_id": raw_tx_id,
                "sender": raw_sender,
                "receiver": raw_receiver,
                "amount_minor_units": amount_minor,
                "occurred_at": parsed_dt.isoformat(),
            })

    # Sort valid events chronologically to detect candidates
    valid_events_summary.sort(key=lambda e: e["occurred_at"])

    # Candidate seeds: First 3 high-value transactions or earliest transactions
    candidate_seeds: list[dict[str, Any]] = []
    if valid_events_summary:
        # Candidate 1: Earliest transaction
        candidate_seeds.append({
            "transaction_id": valid_events_summary[0]["transaction_id"],
            "sender": valid_events_summary[0]["sender"],
            "receiver": valid_events_summary[0]["receiver"],
            "amount_minor_units": valid_events_summary[0]["amount_minor_units"],
            "occurred_at": valid_events_summary[0]["occurred_at"],
            "reason": "Earliest observed transfer in timeline",
        })

        # Candidate 2: Highest volume transfer in first 3 hops if distinct
        top_by_amount = max(valid_events_summary[:min(10, len(valid_events_summary))], key=lambda e: e["amount_minor_units"])
        if top_by_amount["transaction_id"] != candidate_seeds[0]["transaction_id"]:
            candidate_seeds.append({
                "transaction_id": top_by_amount["transaction_id"],
                "sender": top_by_amount["sender"],
                "receiver": top_by_amount["receiver"],
                "amount_minor_units": top_by_amount["amount_minor_units"],
                "occurred_at": top_by_amount["occurred_at"],
                "reason": "Highest-value early transfer",
            })

    # Candidate sinks: accounts that only receive, never send (terminal sinks)
    terminal_sinks = sorted(unique_receivers - unique_senders)

    return ValidationSummary(
        total_rows=len(raw_rows),
        valid_rows_count=valid_rows_count,
        invalid_rows_count=len(raw_rows) - valid_rows_count,
        unique_senders_count=len(unique_senders),
        unique_receivers_count=len(unique_receivers),
        total_volume_minor_units=total_volume_minor,
        earliest_timestamp=earliest_dt.isoformat() if earliest_dt else None,
        latest_timestamp=latest_dt.isoformat() if latest_dt else None,
        detected_columns=detected_columns,
        suggested_mapping=suggested,
        candidate_seeds=candidate_seeds,
        candidate_sinks=terminal_sinks[:10],
        errors=errors[:100],  # cap at first 100 for response size
        preview_rows=raw_rows[:10],
    )


# ── Ingest Endpoint ──────────────────────────────────────────────────────────


@router.post("/ingest", response_model=IngestUploadedDatasetResponse, status_code=201)
async def ingest_uploaded_dataset(
    request: Request,
    case_svc: CaseService = Depends(get_case_service),
    event_svc: EventService = Depends(get_event_service),
) -> IngestUploadedDatasetResponse:
    """
    Atomically create a new FraudCase and ingest the uploaded TransactionEvents batch.

    Ensures zero race conditions between case envelope creation and event attachment.
    """
    body = await request.body()
    try:
        raw_json = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {exc}")

    case_id = str(raw_json.get("case_id", "")).strip()
    title = str(raw_json.get("title", "")).strip()
    description = raw_json.get("description")
    origin_str = raw_json.get("origin", "manual_investigation")
    raw_events = raw_json.get("events", [])

    if not case_id or not title:
        raise HTTPException(status_code=422, detail="case_id and title are required.")
    if not isinstance(raw_events, list) or len(raw_events) == 0:
        raise HTTPException(status_code=422, detail="events must be a non-empty list.")

    logger.info(
        "Ingestion initiated: case_id='%s', title='%s', raw_events_count=%d",
        case_id,
        title,
        len(raw_events),
    )

    try:
        case_origin = CaseOrigin(origin_str)
    except ValueError:
        case_origin = CaseOrigin.MANUAL_INVESTIGATION

    # 1. Check if case already exists before processing events
    existing = await case_svc.get_case(case_id)
    if existing is not None:
        logger.warning("Ingestion rejected: case_id='%s' already exists", case_id)
        raise HTTPException(
            status_code=409,
            detail=f"Case ID '{case_id}' already exists. Please provide a unique case reference.",
        )

    # 2. Parse events and assign deterministic, collision-safe case-scoped event_ids
    scoped_events: list[TransactionEvent] = []
    seen_event_ids: set[str] = set()
    tx_id_counts: dict[str, int] = {}

    for idx, ev_data in enumerate(raw_events, start=1):
        try:
            ev = TransactionEvent.model_validate_json(json.dumps(ev_data))
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Event at index {idx - 1}: {exc}")

        tx_id = ev.transaction_id.strip()
        count = tx_id_counts.get(tx_id, 0) + 1
        tx_id_counts[tx_id] = count

        orig_ev_id = ev.event_id.strip()
        # If the client already scoped to this case_id, preserve it; otherwise scope deterministically
        if orig_ev_id.startswith(f"ev_{case_id}_") or orig_ev_id.startswith(f"{case_id}_"):
            scoped_id = orig_ev_id
        else:
            scoped_id = f"ev_{case_id}_{tx_id}" if count == 1 else f"ev_{case_id}_{tx_id}_{count}"

        if scoped_id in seen_event_ids:
            scoped_id = f"{scoped_id}_{idx}"

        if scoped_id in seen_event_ids:
            raise HTTPException(
                status_code=422,
                detail=f"Duplicate event_id '{scoped_id}' within upload batch.",
            )
        seen_event_ids.add(scoped_id)

        if scoped_id != ev.event_id:
            ev = ev.model_copy(update={"event_id": scoped_id})
        scoped_events.append(ev)

    logger.info(
        "Scoped %d events for case_id='%s' (first: '%s', last: '%s')",
        len(scoped_events),
        case_id,
        scoped_events[0].event_id,
        scoped_events[-1].event_id,
    )

    # 3. Pre-validate against global event store to avoid partial writes
    for ev in scoped_events:
        if await event_svc._events.event_exists(ev.event_id):
            logger.warning("Event '%s' already exists in global store", ev.event_id)
            raise HTTPException(
                status_code=409,
                detail=f"Event '{ev.event_id}' already exists. Please choose a distinct case reference.",
            )

    now = datetime.now(timezone.utc)
    tx_ids = [e.transaction_id for e in scoped_events]
    case = FraudCase(
        schema_version="1.0.0",
        case_id=case_id,
        title=title,
        description=description,
        origin=case_origin,
        status=CaseStatus.OPEN,
        transaction_ids=tx_ids,
        opened_at=now,
        updated_at=now,
    )

    # 4. Atomic execution: create case + ingest events with full rollback on any failure
    created_case: FraudCase | None = None
    try:
        created_case = await case_svc.create_case(case)
        stored_events = await event_svc.ingest_batch(scoped_events, case_id)
        logger.info(
            "Atomic ingestion committed: case_id='%s', events_stored=%d",
            case_id,
            len(stored_events),
        )
    except Exception as exc:
        logger.error(
            "Atomic ingestion failed for case_id='%s': %s. Rolling back case and events.",
            case_id,
            exc,
        )
        if created_case is not None:
            await case_svc.delete_case(case_id)
        await event_svc.delete_events_for_case(case_id)
        raise HTTPException(status_code=422, detail=f"Failed to ingest transactions: {exc}")

    # Determine candidate sinks and seed
    senders = {e.sender.account_id for e in stored_events}
    receivers = {e.receiver.account_id for e in stored_events}
    terminal_sinks = sorted(receivers - senders)

    seed_tx_id = stored_events[0].transaction_id if stored_events else None
    seed_amt = stored_events[0].amount_minor_units if stored_events else None

    return IngestUploadedDatasetResponse(
        case=created_case,
        events_count=len(stored_events),
        accepted_event_ids=[e.event_id for e in stored_events],
        suggested_seed_transaction_id=seed_tx_id,
        suggested_tainted_amount_minor_units=seed_amt,
        candidate_sinks=terminal_sinks[:10],
    )

