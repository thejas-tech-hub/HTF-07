"""Tests for /api/upload endpoints."""

from __future__ import annotations

import json
import pytest

SAMPLE_CSV = """transaction_id,sender_account_id,receiver_account_id,amount,occurred_at,currency,channel
tx-001,Victim-1,Mule-1,50000,2026-10-10T08:00:00Z,INR,upi
tx-002,Mule-1,Mule-2,30000,2026-10-10T08:15:00Z,INR,upi
tx-003,Mule-2,Exit-1,30000,2026-10-10T08:45:00Z,INR,neft
"""

SAMPLE_CSV_WITH_ERRORS = """transaction_id,sender_account_id,receiver_account_id,amount,occurred_at
tx-001,Victim-1,Mule-1,-500,2026-10-10T08:00:00Z
tx-002,,Mule-2,30000,2026-10-10T08:15:00Z
tx-003,Mule-1,Mule-1,20000,2026-10-10T08:30:00Z
tx-004,Mule-2,Exit-1,10000,invalid-date-string
"""

SAMPLE_JSON = [
    {
        "tx_id": "tx-json-01",
        "from_acc": "Victim-Corp",
        "to_acc": "Mule-Alpha",
        "value": 150000,
        "timestamp": "2026-10-10T10:00:00Z",
    },
    {
        "tx_id": "tx-json-02",
        "from_acc": "Mule-Alpha",
        "to_acc": "Exit-Desk",
        "value": 150000,
        "timestamp": "2026-10-10T10:30:00Z",
    },
]


class TestUploadValidate:
    """POST /api/upload/validate"""

    @pytest.mark.asyncio
    async def test_validate_valid_csv(self, client):
        resp = await client.post(
            "/api/upload/validate",
            json={
                "raw_content": SAMPLE_CSV,
                "format": "csv",
                "amount_in_minor_units": False,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_rows"] == 3
        assert data["valid_rows_count"] == 3
        assert data["invalid_rows_count"] == 0
        assert data["unique_senders_count"] == 3
        assert data["unique_receivers_count"] == 3
        # 50,000 + 30,000 + 30,000 = 110,000 rupees -> 11,000,000 paise
        assert data["total_volume_minor_units"] == 11000000
        assert len(data["candidate_seeds"]) >= 1
        assert data["candidate_seeds"][0]["transaction_id"] == "tx-001"
        assert "Exit-1" in data["candidate_sinks"]

    @pytest.mark.asyncio
    async def test_validate_csv_with_errors(self, client):
        resp = await client.post(
            "/api/upload/validate",
            json={
                "raw_content": SAMPLE_CSV_WITH_ERRORS,
                "format": "csv",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_rows"] == 4
        assert data["valid_rows_count"] == 0
        assert data["invalid_rows_count"] == 4
        assert len(data["errors"]) == 4

        error_fields = {e["field"] for e in data["errors"]}
        assert "amount" in error_fields
        assert "sender_account_id" in error_fields
        assert "receiver_account_id" in error_fields
        assert "occurred_at" in error_fields

    @pytest.mark.asyncio
    async def test_validate_json_format_auto_synonyms(self, client):
        resp = await client.post(
            "/api/upload/validate",
            json={
                "raw_content": json.dumps(SAMPLE_JSON),
                "format": "json",
                "column_mapping": {
                    "transaction_id": "tx_id",
                    "sender_account_id": "from_acc",
                    "receiver_account_id": "to_acc",
                    "amount": "value",
                    "occurred_at": "timestamp",
                },
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_rows"] == 2
        assert data["valid_rows_count"] == 2
        assert data["invalid_rows_count"] == 0
        assert data["unique_senders_count"] == 2
        assert data["unique_receivers_count"] == 2


class TestUploadIngest:
    """POST /api/upload/ingest"""

    @pytest.mark.asyncio
    async def test_ingest_valid_dataset(self, client):
        events = [
            {
                "schema_version": "1.0.0",
                "event_id": "evt-up-001",
                "transaction_id": "tx-up-001",
                "sender": {"account_id": "Victim-10"},
                "receiver": {"account_id": "Mule-20"},
                "amount_minor_units": 5000000,
                "currency": "INR",
                "occurred_at": "2026-10-10T08:00:00Z",
                "observed_at": "2026-10-10T08:00:05Z",
                "status": "completed",
                "channel": "upi",
                "origin": "manual_upload",
            },
            {
                "schema_version": "1.0.0",
                "event_id": "evt-up-002",
                "transaction_id": "tx-up-002",
                "sender": {"account_id": "Mule-20"},
                "receiver": {"account_id": "Exit-30"},
                "amount_minor_units": 5000000,
                "currency": "INR",
                "occurred_at": "2026-10-10T08:30:00Z",
                "observed_at": "2026-10-10T08:30:05Z",
                "status": "completed",
                "channel": "upi",
                "origin": "manual_upload",
            },
        ]

        payload = {
            "case_id": "case-upload-test-01",
            "title": "Uploaded Investigation Case 01",
            "description": "Real ingested test dataset",
            "origin": "manual_investigation",
            "events": events,
        }

        resp = await client.post("/api/upload/ingest", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["case"]["case_id"] == "case-upload-test-01"
        assert data["events_count"] == 2
        assert any("tx-up-001" in eid for eid in data["accepted_event_ids"])
        assert data["suggested_seed_transaction_id"] == "tx-up-001"
        assert "Exit-30" in data["candidate_sinks"]

        # Verify case is now retrievable and timeline matches
        timeline_resp = await client.get("/api/cases/case-upload-test-01/timeline")
        assert timeline_resp.status_code == 200
        assert len(timeline_resp.json()) == 2

    @pytest.mark.asyncio
    async def test_import_same_dataset_into_two_cases_succeeds(self, client):
        """Regression test: Importing identical synthetic transaction IDs into two distinct cases must succeed without global event collision."""
        # 16 synthetic transactions matching user's CSV IDs (SYN-TXN-001 to SYN-TXN-016)
        raw_synthetic_events = [
            {
                "schema_version": "1.0.0",
                "event_id": f"ev_SYN-TXN-{i:03d}",
                "transaction_id": f"SYN-TXN-{i:03d}",
                "sender": {"account_id": f"Mule-{i}"},
                "receiver": {"account_id": f"Mule-{i+1}"},
                "amount_minor_units": 1000000 * i,
                "currency": "INR",
                "occurred_at": f"2026-10-10T08:{i:02d}:00Z",
                "observed_at": f"2026-10-10T08:{i:02d}:05Z",
                "status": "completed",
                "channel": "upi",
                "origin": "manual_upload",
            }
            for i in range(1, 17)
        ]

        # Case 1: First ingestion of 16 transactions
        payload_1 = {
            "case_id": "CASE-2026-REGRESSION-ALPHA",
            "title": "First Upload of Synthetic Dataset",
            "events": raw_synthetic_events,
        }
        resp_1 = await client.post("/api/upload/ingest", json=payload_1)
        assert resp_1.status_code == 201
        data_1 = resp_1.json()
        assert data_1["events_count"] == 16
        assert len(data_1["accepted_event_ids"]) == 16

        # Case 2: Second ingestion of the EXACT SAME 16 synthetic transactions without restarting backend
        payload_2 = {
            "case_id": "CASE-2026-REGRESSION-BETA",
            "title": "Second Upload of Identical Synthetic Dataset",
            "events": raw_synthetic_events,
        }
        resp_2 = await client.post("/api/upload/ingest", json=payload_2)
        assert resp_2.status_code == 201
        data_2 = resp_2.json()
        assert data_2["events_count"] == 16
        assert len(data_2["accepted_event_ids"]) == 16

        # Verify both cases exist independently with identical business transaction IDs
        t1 = await client.get("/api/cases/CASE-2026-REGRESSION-ALPHA/timeline")
        t2 = await client.get("/api/cases/CASE-2026-REGRESSION-BETA/timeline")
        assert t1.status_code == 200
        assert t2.status_code == 200
        assert len(t1.json()) == 16
        assert len(t2.json()) == 16

        # Transaction IDs preserved:
        assert [e["transaction_id"] for e in t1.json()] == [f"SYN-TXN-{i:03d}" for i in range(1, 17)]
        assert [e["transaction_id"] for e in t2.json()] == [f"SYN-TXN-{i:03d}" for i in range(1, 17)]

        # Event IDs scoped to respective cases (no global collision):
        e1_ids = {e["event_id"] for e in t1.json()}
        e2_ids = {e["event_id"] for e in t2.json()}
        assert e1_ids.isdisjoint(e2_ids)

    @pytest.mark.asyncio
    async def test_repeated_submission_same_case_returns_409(self, client):
        """Repeated submission with identical case_id returns 409 Conflict without corrupting state."""
        events = [
            {
                "schema_version": "1.0.0",
                "event_id": "ev_DUP_001",
                "transaction_id": "TX_DUP_001",
                "sender": {"account_id": "A"},
                "receiver": {"account_id": "B"},
                "amount_minor_units": 500000,
                "currency": "INR",
                "occurred_at": "2026-10-10T09:00:00Z",
                "observed_at": "2026-10-10T09:00:05Z",
                "status": "completed",
                "channel": "upi",
                "origin": "manual_upload",
            }
        ]
        payload = {
            "case_id": "CASE-DUP-PREVENT",
            "title": "Duplicate Prevention Test",
            "events": events,
        }
        resp_1 = await client.post("/api/upload/ingest", json=payload)
        assert resp_1.status_code == 201

        # Second submission with same case ID
        resp_2 = await client.post("/api/upload/ingest", json=payload)
        assert resp_2.status_code == 409
        assert "already exists" in resp_2.json()["detail"]

        # Ensure first case remains fully intact
        t = await client.get("/api/cases/CASE-DUP-PREVENT/timeline")
        assert t.status_code == 200
        assert len(t.json()) == 1

    @pytest.mark.asyncio
    async def test_atomic_rollback_on_ingestion_failure(self, client):
        """If batch event ingestion fails, the case is completely rolled back and not left as an orphan."""
        from unittest.mock import patch

        failing_payload = {
            "case_id": "CASE-SHOULD-ROLLBACK",
            "title": "This Case Must Rollback",
            "events": [
                {
                    "schema_version": "1.0.0",
                    "event_id": "raw_ev_001",
                    "transaction_id": "TX_ROLLBACK_01",
                    "sender": {"account_id": "SenderY"},
                    "receiver": {"account_id": "ReceiverY"},
                    "amount_minor_units": 200000,
                    "currency": "INR",
                    "occurred_at": "2026-10-10T10:10:00Z",
                    "observed_at": "2026-10-10T10:10:05Z",
                    "status": "completed",
                    "channel": "upi",
                    "origin": "manual_upload",
                }
            ],
        }

        # Simulate unexpected storage failure during event ingestion
        with patch("backend.app.services.case_service.EventService.ingest_batch", side_effect=RuntimeError("Storage disk write failure")):
            res_fail = await client.post("/api/upload/ingest", json=failing_payload)
            assert res_fail.status_code == 422
            assert "Storage disk write failure" in res_fail.json()["detail"]

        # Verify CASE-SHOULD-ROLLBACK was completely rolled back and NOT left behind as an orphan
        chk = await client.get("/api/cases/CASE-SHOULD-ROLLBACK")
        assert chk.status_code == 404

    @pytest.mark.asyncio
    async def test_duplicate_transaction_ids_within_dataset_handled(self, client):
        """Duplicate transaction IDs within a single dataset receive distinct sequence-scoped event IDs."""
        events = [
            {
                "schema_version": "1.0.0",
                "event_id": "raw-evt-1",
                "transaction_id": "TXN-MULTI-LEG",
                "sender": {"account_id": "A"},
                "receiver": {"account_id": "B"},
                "amount_minor_units": 500000,
                "currency": "INR",
                "occurred_at": "2026-10-10T09:00:00Z",
                "observed_at": "2026-10-10T09:00:05Z",
                "status": "completed",
                "channel": "upi",
                "origin": "manual_upload",
            },
            {
                "schema_version": "1.0.0",
                "event_id": "raw-evt-2",
                "transaction_id": "TXN-MULTI-LEG",
                "sender": {"account_id": "A"},
                "receiver": {"account_id": "B"},
                "amount_minor_units": 500000,
                "currency": "INR",
                "occurred_at": "2026-10-10T09:05:00Z",
                "observed_at": "2026-10-10T09:05:05Z",
                "status": "completed",
                "channel": "upi",
                "origin": "manual_upload",
            },
        ]
        payload = {
            "case_id": "CASE-MULTI-LEG-01",
            "title": "Multi-Leg Transaction Test",
            "events": events,
        }
        resp = await client.post("/api/upload/ingest", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["events_count"] == 2
        # Verify event IDs are distinct and both transaction IDs are preserved
        assert len(set(data["accepted_event_ids"])) == 2
        timeline = await client.get("/api/cases/CASE-MULTI-LEG-01/timeline")
        assert timeline.status_code == 200
        assert all(e["transaction_id"] == "TXN-MULTI-LEG" for e in timeline.json())

