/**
 * Realistic pre-configured bank export datasets for testing real data upload.
 * These represent authentic banking feed formats with disparate column headers.
 */

export interface SampleDataset {
  id: string;
  name: string;
  badge: string;
  filename: string;
  format: "csv" | "json";
  description: string;
  content: string;
  expectedRows: number;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "sample-synthetic-layering",
    name: "Synthetic 16-TXN Layering (CSV)",
    badge: "16 Synthetic Transfers • SYN-TXN",
    filename: "synthetic_16_transactions.csv",
    format: "csv",
    description:
      "16 synthetic transactions with SYN-TXN-001 to SYN-TXN-016 modeling multi-tier mule dispersal and crypto/ATM cash-out.",
    expectedRows: 16,
    content: `transaction_id,sender_account_id,receiver_account_id,amount,occurred_at,currency,channel
SYN-TXN-001,Victim-Primary-Corp,Mule-Tier1-Alpha,500000.00,2026-10-10T08:00:00Z,INR,upi
SYN-TXN-002,Mule-Tier1-Alpha,Mule-Tier2-Bravo,250000.00,2026-10-10T08:05:00Z,INR,upi
SYN-TXN-003,Mule-Tier1-Alpha,Mule-Tier2-Charlie,250000.00,2026-10-10T08:07:00Z,INR,upi
SYN-TXN-004,Clean-Vendor-99,Mule-Tier2-Bravo,50000.00,2026-10-10T08:10:00Z,INR,imps
SYN-TXN-005,Mule-Tier2-Bravo,Mule-Tier3-Delta,180000.00,2026-10-10T08:15:00Z,INR,neft
SYN-TXN-006,Mule-Tier2-Bravo,Mule-Tier3-Echo,120000.00,2026-10-10T08:18:00Z,INR,neft
SYN-TXN-007,Mule-Tier2-Charlie,Mule-Tier3-Delta,150000.00,2026-10-10T08:22:00Z,INR,upi
SYN-TXN-008,Mule-Tier2-Charlie,Mule-Tier3-Foxtrot,100000.00,2026-10-10T08:25:00Z,INR,upi
SYN-TXN-009,Mule-Tier3-Delta,Exit-CryptoDesk-X1,280000.00,2026-10-10T08:35:00Z,INR,rtgs
SYN-TXN-010,Mule-Tier3-Delta,Mule-Reserve-Vault,50000.00,2026-10-10T08:40:00Z,INR,internal
SYN-TXN-011,Mule-Tier3-Echo,Exit-ATM-Network-9,120000.00,2026-10-10T08:45:00Z,INR,cash
SYN-TXN-012,Mule-Tier3-Foxtrot,Exit-HawalaHub-07,95000.00,2026-10-10T08:50:00Z,INR,rtgs
SYN-TXN-013,Mule-Reserve-Vault,Exit-CryptoDesk-X1,50000.00,2026-10-10T09:00:00Z,INR,rtgs
SYN-TXN-014,Clean-Retail-Client,Exit-ATM-Network-9,10000.00,2026-10-10T09:10:00Z,INR,upi
SYN-TXN-015,Mule-Tier1-Alpha,Exit-Direct-CashOut,5000.00,2026-10-10T09:15:00Z,INR,cash
SYN-TXN-016,Exit-CryptoDesk-X1,Overseas-Wallet-88,330000.00,2026-10-10T09:30:00Z,INR,wire
`,
  },
  {
    id: "sample-corporate-treasury",
    name: "Corporate Treasury Breach (CSV)",
    badge: "12 Transfers • ₹7,50,000 Seed",
    filename: "bank_feed_corp_treasury_export.csv",
    format: "csv",
    description:
      "A corporate account unauthorized payout via UPI dispersing across 3 mule tiers, mixed with clean merchant credits, and converging on a crypto OTC desk.",
    expectedRows: 12,
    content: `Payment_Ref,Payer_Account,Payee_Account,Amount_INR,Booking_Time,Payment_Rail,Payer_Bank,Payee_Bank,Narrative
TXN-CORP-01,Victim-Apex-Corp,Mule-Tier1-101,750000.00,2026-10-10T09:00:00Z,UPI,HDFC,ICICI,Unauthorized Treasury Payout
TXN-MULE-02,Mule-Tier1-101,Mule-Tier2-201,400000.00,2026-10-10T09:15:00Z,UPI,ICICI,AXIS,Vendor Settlement
TXN-MULE-03,Mule-Tier1-101,Mule-Tier2-202,350000.00,2026-10-10T09:20:00Z,UPI,ICICI,KOTAK,Invoice Payment
TXN-CLEAN-04,Clean-Retail-Store,Mule-Tier2-201,150000.00,2026-10-10T09:35:00Z,IMPS,SBI,AXIS,POS Merchant Settlement
TXN-MULE-05,Mule-Tier2-201,Mule-Tier3-301,520000.00,2026-10-10T09:50:00Z,NEFT,AXIS,YES,Consultancy Retainer
TXN-MULE-06,Mule-Tier2-202,Mule-Tier3-301,330000.00,2026-10-10T10:05:00Z,UPI,KOTAK,YES,Contractor Fee
TXN-CLEAN-07,Genuine-Payroll,Mule-Tier3-301,80000.00,2026-10-10T10:20:00Z,NEFT,INDUSIND,YES,Direct Salary
TXN-MULE-08,Mule-Tier3-301,Mule-Aggregator-401,900000.00,2026-10-10T10:40:00Z,RTGS,YES,FEDERAL,Inter-account Consolidation
TXN-EXIT-09,Mule-Aggregator-401,Exit-CryptoDesk-X8,650000.00,2026-10-10T11:15:00Z,RTGS,FEDERAL,RBL,Digital Asset Inflow
TXN-EXIT-10,Mule-Aggregator-401,Exit-ATM-Network-04,220000.00,2026-10-10T11:30:00Z,CASH,FEDERAL,FEDERAL,High Value Cash Out
TXN-RESID-11,Mule-Tier2-201,Clean-SubVendor-501,25000.00,2026-10-10T11:45:00Z,UPI,AXIS,SBI,Utility Remittance
TXN-RESID-12,Mule-Tier2-202,Clean-SubVendor-502,18000.00,2026-10-10T11:50:00Z,UPI,KOTAK,HDFC,Office Supplies
`,
  },
  {
    id: "sample-layered-mules",
    name: "Layered Mule Network (JSON)",
    badge: "8 Transfers • JSON Format",
    filename: "fin_crime_telemetry_batch.json",
    format: "json",
    description:
      "Core banking wire telemetry in JSON format capturing multi-bank dispersal and cash-out layering across disparate institutions.",
    expectedRows: 8,
    content: JSON.stringify(
      [
        {
          tx_id: "WIRE-2026-001",
          source_account_id: "Victim-Escrow-00",
          destination_account: "Mule-Broker-10",
          amount: 500000,
          timestamp: "2026-10-10T08:00:00Z",
          channel: "wire",
          status: "completed",
          reference: "ESCROW/CLAIM/091",
        },
        {
          tx_id: "WIRE-2026-002",
          source_account_id: "Mule-Broker-10",
          destination_account: "Mule-Layer-21",
          amount: 250000,
          timestamp: "2026-10-10T08:25:00Z",
          channel: "imps",
          status: "completed",
          reference: "SPLIT/A/002",
        },
        {
          tx_id: "WIRE-2026-003",
          source_account_id: "Mule-Broker-10",
          destination_account: "Mule-Layer-22",
          amount: 250000,
          timestamp: "2026-10-10T08:30:00Z",
          channel: "imps",
          status: "completed",
          reference: "SPLIT/B/003",
        },
        {
          tx_id: "WIRE-2026-004",
          source_account_id: "Clean-Merchant-Groceries",
          destination_account: "Mule-Layer-21",
          amount: 60000,
          timestamp: "2026-10-10T08:45:00Z",
          channel: "upi",
          status: "completed",
          reference: "RETAIL/SALES/04",
        },
        {
          tx_id: "WIRE-2026-005",
          source_account_id: "Mule-Layer-21",
          destination_account: "Mule-Collector-33",
          amount: 290000,
          timestamp: "2026-10-10T09:10:00Z",
          channel: "neft",
          status: "completed",
          reference: "COMMINGLED/SWEEP/05",
        },
        {
          tx_id: "WIRE-2026-006",
          source_account_id: "Mule-Layer-22",
          destination_account: "Mule-Collector-33",
          amount: 245000,
          timestamp: "2026-10-10T09:15:00Z",
          channel: "neft",
          status: "completed",
          reference: "SWEEP/B/06",
        },
        {
          tx_id: "WIRE-2026-007",
          source_account_id: "Mule-Collector-33",
          destination_account: "Exit-RemittanceDesk-99",
          amount: 510000,
          timestamp: "2026-10-10T09:55:00Z",
          channel: "rtgs",
          status: "completed",
          reference: "OFFSHORE/HAWALA/07",
        },
        {
          tx_id: "WIRE-2026-008",
          source_account_id: "Mule-Collector-33",
          destination_account: "Mule-Reserve-44",
          amount: 20000,
          timestamp: "2026-10-10T10:00:00Z",
          channel: "internal",
          status: "completed",
          reference: "COMMISSION/08",
        },
      ],
      null,
      2
    ),
  },
  {
    id: "sample-smurfing",
    name: "Micro-Flow Structuring (CSV)",
    badge: "15 Micro-Transfers",
    filename: "structured_smurfing_feed.csv",
    format: "csv",
    description:
      "A high-velocity structuring operation breaking down ₹3,00,000 into sub-threshold ₹20,000 micro-payments routed via rapid UPI transfers.",
    expectedRows: 15,
    content: `transaction_id,sender_account,receiver_account,amount,timestamp,channel
TXN-SMURF-01,Victim-Account-Primary,Mule-Accumulator-01,300000.00,2026-10-10T07:00:00Z,NEFT
TXN-SMURF-02,Mule-Accumulator-01,Smurf-Mule-A,20000.00,2026-10-10T07:10:00Z,UPI
TXN-SMURF-03,Mule-Accumulator-01,Smurf-Mule-B,20000.00,2026-10-10T07:11:00Z,UPI
TXN-SMURF-04,Mule-Accumulator-01,Smurf-Mule-C,20000.00,2026-10-10T07:12:00Z,UPI
TXN-SMURF-05,Mule-Accumulator-01,Smurf-Mule-D,20000.00,2026-10-10T07:13:00Z,UPI
TXN-SMURF-06,Mule-Accumulator-01,Smurf-Mule-E,20000.00,2026-10-10T07:14:00Z,UPI
TXN-SMURF-07,Mule-Accumulator-01,Smurf-Mule-F,20000.00,2026-10-10T07:15:00Z,UPI
TXN-SMURF-08,Mule-Accumulator-01,Smurf-Mule-G,20000.00,2026-10-10T07:16:00Z,UPI
TXN-SMURF-09,Mule-Accumulator-01,Smurf-Mule-H,20000.00,2026-10-10T07:17:00Z,UPI
TXN-SMURF-10,Smurf-Mule-A,Exit-Aggregator-Sink,20000.00,2026-10-10T07:30:00Z,UPI
TXN-SMURF-11,Smurf-Mule-B,Exit-Aggregator-Sink,20000.00,2026-10-10T07:31:00Z,UPI
TXN-SMURF-12,Smurf-Mule-C,Exit-Aggregator-Sink,20000.00,2026-10-10T07:32:00Z,UPI
TXN-SMURF-13,Smurf-Mule-D,Exit-Aggregator-Sink,20000.00,2026-10-10T07:33:00Z,UPI
TXN-SMURF-14,Smurf-Mule-E,Exit-Aggregator-Sink,20000.00,2026-10-10T07:34:00Z,UPI
TXN-SMURF-15,Exit-Aggregator-Sink,Exit-CryptoDesk-99,100000.00,2026-10-10T07:55:00Z,IMPS
`,
  },
];
