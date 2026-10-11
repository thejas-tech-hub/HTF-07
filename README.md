# AEGIS-Flow

> **Temporal Fraud-Flow Intervention Engine**
> Hackathon Prototype — Synthetic Data Only

---

## Problem Statement

Modern financial fraud increasingly operates across multi-hop transaction chains: illicit funds are laundered through a sequence of accounts, often spanning multiple institutions, before reaching a cash-out point. Existing rule-based fraud systems are account-centric and flag individual suspicious transactions in isolation. They cannot reconstruct the full temporal flow of tainted capital, identify the structural chokepoints where intervention would maximally recover illicit funds, or simulate the downstream consequences of blocking a specific transaction. This leaves investigators with fragmented evidence, no provenance chain, and no principled basis for deciding *where* and *when* to intervene in a live fraud flow.

## Solution Overview

AEGIS-Flow reconstructs the full directed temporal transaction graph from normalized synthetic evidence, propagates taint deterministically using a provenance-aware flow-conservation model, predicts likely next hops using a lightweight ML model trained on graph features, and identifies optimal intervention chokepoints using counterfactual simulation. For any candidate intervention, the system computes the expected recovery of illicit capital versus the collateral disruption to legitimate capital, returning a ranked intervention recommendation with a full structured audit trail. An optional LLM layer can translate the structured evidence into a natural-language case summary for investigators, but all provenance decisions, taint values, and intervention rankings are produced entirely by deterministic or learned algorithms — the LLM does not influence any financial conclusion.

---

## Five Core Technical Pillars

| # | Pillar | Description |
|---|--------|-------------|
| 1 | **Temporal Graph Construction** | Transactions are ingested, normalized, and assembled into a time-ordered directed multigraph. Edge weights encode transfer amounts; node attributes carry account metadata and cold-start risk scores. |
| 2 | **Dynamic Taint & Provenance Tracking** | A deterministic, flow-conservation-based taint propagation algorithm tracks the fraction of illicit capital at each node across time. Full provenance lineage (which source taint reached which destination, via which path) is recorded and is reproducible. |
| 3 | **Cold-Start Risk Scoring** | Newly created or data-sparse accounts receive a risk score from a lightweight ML model (gradient-boosted trees) trained on structural graph features and behavioral signals, preventing blind spots in the taint graph. |
| 4 | **Next-Hop Prediction** | A trained ML model estimates the probability distribution over likely next transaction destinations from any active node, enabling proactive identification of probable future hops before they occur. |
| 5 | **Counterfactual Intervention Optimization** | For each candidate chokepoint, the system simulates the counterfactual world where that intervention was applied, computing recoverable illicit capital and collateral impact on legitimate flows. Interventions are ranked by a configurable utility function. |

---

## High-Level Architecture

```
Synthetic Data Layer
        │
        ▼
  Data Ingestion & Normalization
  (bank-agnostic schema, timestamps, amounts, account IDs)
        │
        ▼
  Temporal Graph Engine  ──────────────────────────────────┐
  (directed multigraph, time-ordered edges)                │
        │                                                   │
        ▼                                                   │
  Taint Propagation Engine                         Graph Compression
  (deterministic, flow-conservation)               (summary subgraphs)
        │
        ▼
  ML Layer
  ├── Cold-Start Risk Model (GBT)
  └── Next-Hop Prediction Model (GNN / GBT)
        │
        ▼
  Intervention Engine
  (chokepoint identification + counterfactual simulation)
        │
        ▼
  Structured Evidence Package
  (audit trail, provenance chain, ranked interventions)
        │
        ▼ (optional)
  LLM Explanation Layer
  (natural-language summary only — no financial decisions)
        │
        ▼
  REST API / CLI
        │
        ▼
  Frontend Dashboard
  (graph visualization, intervention explorer)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+, TypeScript 5.9 |
| Graph Engine | NetworkX, igraph, Temporal Directed Multigraphs |
| ML & Forecast | scikit-learn, LightGBM, Monte Carlo Trajectory Forecasts |
| Backend API | FastAPI, Pydantic v2, Uvicorn |
| Frontend Workspace | Next.js 16 (Turbopack), React 19, Tailwind CSS 4, Cytoscape.js 3.34, Lucide Icons |
| Verification & Testing | pytest (342 Python tests), Node.js native test runner (21 frontend unit tests) |

---

## Quickstart & Demo Walkthrough

### 1. Start the FastAPI Backend
```bash
# Activate virtual environment if on Windows:
.venv\Scripts\uvicorn backend.app.main:app --reload --port 8000
```
Backend API docs are available at `http://localhost:8000/docs` and health check at `http://localhost:8000/health`.

### 2. Start the Frontend Command Center
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to access the investigator workspace.

### 3. Load & Run the Deterministic Demo Case
1. In the top navigation bar, click **"Load Demo Case"**.
2. This creates synthetic fraud case **Operation ShatterFlow** (`case-demo-synthetic-001`) with ₹5,00,000 initial theft, 3-layer branching, clean commingling, and an egress mule.
3. Click **"Run Full Analysis"** to invoke `POST /api/cases/case-demo-synthetic-001/analyze`.
4. Inspect:
   - **Transaction Graph**: Cytoscape visualization distinguishing observed historical edges from dashed cyan forecast trajectories and orange min-cut chokepoint barriers.
   - **Timeline Scrubber**: Scrub decision timestamp $T$ to observe evidence available at decision time vs. later discoveries.
   - **Money Provenance**: FIFO taint propagation, tainted balances per mule, and legal caveats.
   - **ML Intelligence**: Account risk scores, next-hop probabilities, and generated Monte Carlo paths.
   - **Intervention Comparison**: Multi-objective candidate trade-offs comparing illicit capital intercepted against legitimate capital affected.

---

## Real Data Upload & Investigation Intake Workflow

AEGIS-Flow puts **real transaction data upload as the primary entry point** for banking fraud operations, with synthetic demonstrations clearly separated and labeled.

```
       Upload File (CSV / JSON / JSONL)
                     │
                     ▼
       Auto-Detection & Delimiter Sniffing
                     │
                     ▼
       Column Mapping Matrix (Reference 2)
  [ Ready: 5 | Review: 2 | Skipped: 3 | Unmapped: 0 ]
                     │
                     ▼
       Validation Audit & Integrity Checks
   • Duplicates • Self-transfers • Non-positive amounts
   • ISO-8601 timestamps • Paise/Rupee denomination
                     │
                     ▼
       Case Setup & Candidate Seed Selection
   • Select reported victim transfer (taint seed)
   • Identify egress crypto/cash-out sinks
                     │
                     ▼
       Atomic Ingestion & Pipeline Orchestration
   `POST /api/upload/ingest` ➔ `POST /api/cases/{id}/analyze`
                     │
                     ▼
       Executive Investigation Workspace (References 1, 3, 4)
   • Cytoscape Multigraph + Accessible Ledger Alternative
   • Proportional Taint Allocation & Commingled Balances
   • Dinic's Algorithm Min-Cut Chokepoints
   • Counterfactual Simulation & Pareto Frontier
```

### Supported Ingestion Formats & Canonical Mapping

| Canonical Field | Type | Required | Description & Synonyms |
|---|---|---|---|
| `transaction_id` | String | **Yes** | Unique payment reference (`tx_id`, `txn_reference`, `payment_id`, `id`) |
| `sender_account_id` | String | **Yes** | Debited / originator account (`source_account`, `from_account`, `payer`) |
| `receiver_account_id` | String | **Yes** | Credited / beneficiary account (`destination_account`, `to_account`, `payee`) |
| `amount` | Number | **Yes** | Transfer value (`txn_amount`, `value`, `transfer_amount`, `amount_inr`) |
| `occurred_at` | ISO-8601 | **Yes** | Transaction timestamp (`booking_timestamp`, `tx_time`, `datetime`, `date`) |
| `currency` | String | No | ISO-4217 code (e.g. `INR`, `USD`; defaults to `INR`) |
| `channel` | String | No | Payment rail (`upi`, `neft`, `rtgs`, `imps`, `wire`, `card`) |
| `status` | String | No | Lifecycle status (`completed`, `pending`, `held`, `reversed`) |
| `sender_institution` | String | No | Originating bank / IFSC (`sender_bank`, `remitter_bank`) |
| `receiver_institution` | String | No | Beneficiary bank / IFSC (`receiver_bank`, `beneficiary_bank`) |
| `reference` | String | No | External UTR / narration / remarks |

### Confidentiality & Sensitive Financial Data Protection

- **Local & Sovereign Processing**: Uploaded transaction payloads are parsed and validated directly in the application perimeter. No case data is transmitted to third-party generative AI APIs or external trackers.
- **Strict Server-Side Validation**: File structure, timestamps, integer minor-units, and payload sizes are enforced on both client and server before analysis execution.
- **Transparency on Models & Evidence**: If an optional ML model (e.g., LightGBM) is unavailable, AEGIS-Flow displays an explicit `Unavailable` status rather than fabricating risk scores or confidence values.

---

## Testing & Quality Assurance

```bash
# Backend pytest suite (55 tests passing)
.venv\Scripts\pytest tests/backend

# Frontend test suite (29 tests passing across 7 suites)
cd frontend
npm test

# Production build check (Turbopack)
npm run build
```

---

## ⚠️ Advisory & Operational Scope

- **Decision-Support Only**: AEGIS-Flow is an investigative decision-support platform designed for authorized banking personnel. It simulates counterfactual interventions to assist human analysts; it does **not** autonomously freeze accounts or halt interbank payment rails.
- **Legal Caveat on Taint Allocation**: Model-estimated proportional taint allocation and graph-cut chokepoints provide mathematical provenance and candidate prioritization, not definitive judicial proof of criminal intent.

---

## License

[MIT](LICENSE)
