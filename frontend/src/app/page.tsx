"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Zap,
  AlertTriangle,
  Scale,
  Brain,
  FileText,
  GitFork,
  Target,
  ArrowRight,
  Search,
  UploadCloud,
} from "lucide-react";
import {
  FraudCase,
  TransactionEvent,
  InvestigationAnalysisResponse,
  InvestigationAnalysisRequest,
} from "@/types";
import { apiClient, ApiError } from "@/lib/api/client";
import {
  loadDemoScenario,
  DEMO_DEFAULT_DECISION_TIME,
  getDemoAnalysisRequest,
} from "@/lib/demo/scenario";
import { Navbar } from "@/components/layout/Navbar";
import { InvestigationHeader } from "@/components/investigation/InvestigationHeader";
import { TimelineControl } from "@/components/timeline/TimelineControl";
import { TransactionGraph } from "@/components/graph/TransactionGraph";
import { ProvenancePanel } from "@/components/provenance/ProvenancePanel";
import { IntelligencePanel } from "@/components/intelligence/IntelligencePanel";
import { ChokepointPanel } from "@/components/chokepoint/ChokepointPanel";
import { RecommendationCard } from "@/components/interventions/RecommendationCard";
import { InterventionComparison } from "@/components/interventions/InterventionComparison";
import { EvidenceWarningsPanel } from "@/components/evidence/EvidenceWarningsPanel";
import { CaseIntakeWorkflow } from "@/components/upload/CaseIntakeWorkflow";

type ActiveTab = "overview" | "comparison" | "provenance" | "intelligence" | "evidence";

export default function InvestigatorDashboard() {
  // Case & Ledger State
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string>("");
  const [currentCase, setCurrentCase] = useState<FraudCase | null>(null);
  const [events, setEvents] = useState<TransactionEvent[]>([]);
  const [decisionTimestamp, setDecisionTimestamp] = useState<string>(DEMO_DEFAULT_DECISION_TIME);
  const [analysis, setAnalysis] = useState<InvestigationAnalysisResponse | null>(null);

  // Analysis Seed & Sink Anchors (User or Auto configured)
  const [activeSeedTxId, setActiveSeedTxId] = useState<string>("");
  const [activeSinkAccounts, setActiveSinkAccounts] = useState<string[]>([]);

  // Status & Loaders
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(true);
  const [isLoadingCases, setIsLoadingCases] = useState<boolean>(true);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  // Upload Intake Wizard Modal State
  const [isUploadWizardOpen, setIsUploadWizardOpen] = useState<boolean>(false);

  // ── 1. Initial Health Check & Case Loading ─────────────────────────────────
  const fetchCases = useCallback(async () => {
    setIsLoadingCases(true);
    setErrorMessage(null);
    try {
      await apiClient.health();
      setIsBackendHealthy(true);

      const caseList = await apiClient.listCases();
      setCases(caseList);

      if (caseList.length > 0) {
        setActiveCaseId((prev) => prev || caseList[0].case_id);
      }
    } catch (err) {
      setIsBackendHealthy(false);
      setErrorMessage(
        err instanceof ApiError
          ? err.detail
          : "Could not connect to AEGIS-Flow backend server. Ensure FastAPI is running on http://localhost:8000."
      );
    } finally {
      setIsLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await apiClient.health();
        if (!active) return;
        setIsBackendHealthy(true);

        const caseList = await apiClient.listCases();
        if (!active) return;
        setCases(caseList);

        if (caseList.length > 0) {
          setActiveCaseId((prev) => prev || caseList[0].case_id);
        }
      } catch (err) {
        if (!active) return;
        setIsBackendHealthy(false);
        setErrorMessage(
          err instanceof ApiError
            ? err.detail
            : "Could not connect to AEGIS-Flow backend server. Ensure FastAPI is running on http://localhost:8000."
        );
      } finally {
        if (active) setIsLoadingCases(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // ── 2. Load Active Case Details & Events ───────────────────────────────────
  useEffect(() => {
    if (!activeCaseId) return;
    let active = true;

    void (async () => {
      try {
        setIsLoadingTimeline(true);
        const caseDetail = await apiClient.getCase(activeCaseId);
        if (!active) return;
        setCurrentCase(caseDetail);

        const timeline = await apiClient.getTimeline(activeCaseId);
        if (!active) return;
        setEvents(timeline);

        if (timeline.length > 0) {
          const midpointIdx = Math.min(2, timeline.length - 1);
          setDecisionTimestamp((prev) => prev || timeline[midpointIdx].occurred_at);
          setActiveSeedTxId((prev) => prev || timeline[0].transaction_id);

          const senders = new Set(timeline.map((e) => e.sender.account_id));
          const receivers = new Set(timeline.map((e) => e.receiver.account_id));
          const terminalSinks = Array.from(receivers).filter((r) => !senders.has(r));
          setActiveSinkAccounts(terminalSinks.slice(0, 3));
        }
      } catch (err) {
        if (!active) return;
        setErrorMessage(
          err instanceof ApiError ? err.detail : "Failed to load case data"
        );
      } finally {
        if (active) setIsLoadingTimeline(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeCaseId]);

  // ── 3. Run Analysis ────────────────────────────────────────────────────────
  const executeAnalysis = useCallback(async () => {
    if (!activeCaseId || events.length === 0) return;

    setIsAnalyzing(true);
    setErrorMessage(null);

    // Identify seed event: matched by activeSeedTxId or default to first event
    const seedEvent = events.find((e) => e.transaction_id === activeSeedTxId) || events[0];
    const sinks = activeSinkAccounts.length > 0 ? activeSinkAccounts : undefined;

    const requestPayload: InvestigationAnalysisRequest = {
      simulation_timestamp: decisionTimestamp,
      taint_seeds: [
        {
          transaction_id: seedEvent.transaction_id,
          tainted_amount_minor_units: seedEvent.amount_minor_units,
        },
      ],
      source_account_ids: [seedEvent.receiver.account_id],
      sink_account_ids: sinks,
      forecast_config: {
        top_k: 3,
        max_depth: 3,
        hop_delay_seconds: 300,
      },
      constraints: {
        minimum_required_illicit_recovery: 0,
        maximum_interventions: 2,
      },
    };

    try {
      const result = await apiClient.analyzeCase(activeCaseId, requestPayload);
      setAnalysis(result);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.detail
          : "Investigation analysis failed. No fabricated analysis returned."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeCaseId, events, decisionTimestamp, activeSeedTxId, activeSinkAccounts]);

  // ── 4. Load Synthetic Demo Workflow (Clearly Labeled Demo) ─────────────────
  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    setErrorMessage(null);
    try {
      const { case: demoCase } = await loadDemoScenario(apiClient);
      await fetchCases();
      setActiveCaseId(demoCase.case_id);
      setCurrentCase(demoCase);

      const timeline = await apiClient.getTimeline(demoCase.case_id);
      setEvents(timeline);
      setDecisionTimestamp(DEMO_DEFAULT_DECISION_TIME);
      setActiveSeedTxId("tx-seed-1001");
      setActiveSinkAccounts(["Exit-CryptoDesk-909"]);

      const demoReq = getDemoAnalysisRequest(DEMO_DEFAULT_DECISION_TIME);
      const demoAnalysis = await apiClient.analyzeCase(demoCase.case_id, demoReq);
      setAnalysis(demoAnalysis);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.detail : "Failed to load demo scenario"
      );
    } finally {
      setIsLoadingDemo(false);
    }
  };

  // ── 5. Real Data Upload Completed Handler ──────────────────────────────────
  const handleInvestigationReady = async (
    caseData: FraudCase,
    ingestedEvents: TransactionEvent[],
    analysisSeedTxId: string,
    sinkAccounts: string[] = [],
    configuredCutoff?: string
  ) => {
    setIsUploadWizardOpen(false);
    setErrorMessage(null);

    // Refresh stored cases
    await fetchCases();

    setActiveCaseId(caseData.case_id);
    setCurrentCase(caseData);
    setEvents(ingestedEvents);
    setActiveSeedTxId(analysisSeedTxId);
    setActiveSinkAccounts(sinkAccounts);

    const cutoff = configuredCutoff || ingestedEvents[ingestedEvents.length - 1]?.occurred_at || new Date().toISOString();
    setDecisionTimestamp(cutoff);

    // Automatically trigger end-to-end analysis on newly uploaded dataset
    setIsAnalyzing(true);
    const seedEvent = ingestedEvents.find((e) => e.transaction_id === analysisSeedTxId) || ingestedEvents[0];

    const reqPayload: InvestigationAnalysisRequest = {
      simulation_timestamp: cutoff,
      taint_seeds: [
        {
          transaction_id: seedEvent.transaction_id,
          tainted_amount_minor_units: seedEvent.amount_minor_units,
        },
      ],
      source_account_ids: [seedEvent.receiver.account_id],
      sink_account_ids: sinkAccounts.length > 0 ? sinkAccounts : undefined,
      forecast_config: {
        top_k: 3,
        max_depth: 3,
        hop_delay_seconds: 300,
      },
      constraints: {
        minimum_required_illicit_recovery: 0,
        maximum_interventions: 2,
      },
    };

    try {
      const result = await apiClient.analyzeCase(caseData.case_id, reqPayload);
      setAnalysis(result);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.detail
          : "Case successfully ingested, but initial analysis stage failed. You can adjust parameters and retry."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans selection:bg-brand-primary selection:text-white">
      {/* ── Command Navigation Header ── */}
      <Navbar
        cases={cases}
        activeCaseId={activeCaseId}
        onSelectCase={(id) => {
          setActiveCaseId(id);
          setAnalysis(null);
        }}
        onLoadDemo={handleLoadDemo}
        onOpenUploadWizard={() => setIsUploadWizardOpen(true)}
        isLoadingDemo={isLoadingDemo}
        isBackendHealthy={isBackendHealthy}
      />

      {/* ── Global Alert Banner ── */}
      {errorMessage && (
        <div className="bg-risk-danger/15 border-b border-risk-danger/30 px-4 py-2.5 text-xs text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-risk-danger shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-400 hover:text-white underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col">
        {/* State A: Case Intake Screen (Step 4 Requirement: Upload First) */}
        {!currentCase && !isLoadingCases && (
          <div className="flex-1 flex items-center justify-center p-4">
            <CaseIntakeWorkflow
              onInvestigationReady={handleInvestigationReady}
              onLoadSyntheticDemo={handleLoadDemo}
              isLoadingDemo={isLoadingDemo}
            />
          </div>
        )}

        {/* State B: Active Investigation Workspace */}
        {currentCase && (
          <>
            {/* Layer B: Executive Case Summary Banner */}
            <InvestigationHeader
              currentCase={currentCase}
              eventsCount={events.length}
              decisionTimestamp={decisionTimestamp}
              analysis={analysis}
              isAnalyzing={isAnalyzing || isLoadingTimeline}
              onRunAnalysis={executeAnalysis}
              reportedAmountMinorUnits={
                events.find((e) => e.transaction_id === activeSeedTxId)?.amount_minor_units ||
                events[0]?.amount_minor_units
              }
            />

            <div className="flex-1 p-4 lg:p-6 space-y-5 max-w-[1680px] w-full mx-auto">
              {/* Layer C: Transaction Network Graph (Dominant Workspace Centerpiece) */}
              <div className="w-full">
                <TransactionGraph
                  events={events}
                  analysis={analysis}
                  decisionTimestamp={decisionTimestamp}
                  sinkAccounts={activeSinkAccounts}
                  seedTxIds={activeSeedTxId ? [activeSeedTxId] : events[0] ? [events[0].transaction_id] : []}
                />
              </div>

              {/* Layer D: Investigation Timeline Scrubber */}
              <div className="w-full">
                <TimelineControl
                  events={events}
                  decisionTimestamp={decisionTimestamp}
                  onSelectTimestamp={(ts) => {
                    setDecisionTimestamp(ts);
                  }}
                  analysisTimestamp={analysis?.simulation_timestamp}
                />
              </div>

              {/* Workbench Tabs Navigation */}
              <div className="border-b border-surface-border flex items-center gap-1 pt-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "overview"
                      ? "border-brand-primary text-white bg-surface-elevated/80 font-semibold"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-elevated/40"
                  }`}
                >
                  <Target className={`h-3.5 w-3.5 ${activeTab === "overview" ? "text-brand-primary" : "text-slate-400"}`} />
                  <span>Recommended intervention</span>
                </button>

                <button
                  onClick={() => setActiveTab("comparison")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "comparison"
                      ? "border-brand-primary text-white bg-surface-elevated/80 font-semibold"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-elevated/40"
                  }`}
                >
                  <Scale className={`h-3.5 w-3.5 ${activeTab === "comparison" ? "text-brand-periwinkle" : "text-slate-400"}`} />
                  <span>Compare interventions ({analysis?.all_candidates?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab("provenance")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "provenance"
                      ? "border-brand-primary text-white bg-surface-elevated/80 font-semibold"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-elevated/40"
                  }`}
                >
                  <GitFork className={`h-3.5 w-3.5 ${activeTab === "provenance" ? "text-sky-400" : "text-slate-400"}`} />
                  <span>Money trail & taint propagation</span>
                </button>

                <button
                  onClick={() => setActiveTab("intelligence")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "intelligence"
                      ? "border-brand-primary text-white bg-surface-elevated/80 font-semibold"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-elevated/40"
                  }`}
                >
                  <Brain className={`h-3.5 w-3.5 ${activeTab === "intelligence" ? "text-brand-periwinkle" : "text-slate-400"}`} />
                  <span>Predictions and risk signals</span>
                </button>

                <button
                  onClick={() => setActiveTab("evidence")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "evidence"
                      ? "border-brand-primary text-white bg-surface-elevated/80 font-semibold"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-elevated/40"
                  }`}
                >
                  <FileText className={`h-3.5 w-3.5 ${activeTab === "evidence" ? "text-slate-300" : "text-slate-400"}`} />
                  <span>Evidence and methodology</span>
                </button>
              </div>

              {/* Workbench Tab Panes */}
              <div className="pt-1">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <RecommendationCard
                      recommendation={analysis?.selected_recommendation || null}
                      decisionTimestamp={decisionTimestamp}
                    />

                    <ChokepointPanel
                      chokepointReport={analysis?.chokepoint_report || null}
                      selectedRecommendation={analysis?.selected_recommendation || null}
                      sourceAccounts={events[0] ? [events[0].receiver.account_id] : []}
                      sinkAccounts={activeSinkAccounts}
                    />
                  </div>
                )}

                {activeTab === "comparison" && (
                  <InterventionComparison
                    candidates={analysis?.all_candidates || []}
                    competingReasons={analysis?.competing_candidates || []}
                    selectedInterventionId={
                      analysis?.selected_recommendation?.intervention_id
                    }
                    summary={analysis?.evaluated_candidates}
                  />
                )}

                {activeTab === "provenance" && (
                  <ProvenancePanel
                    taintSummary={analysis?.taint_summary || null}
                    selectedRecommendationIntercepted={
                      analysis?.selected_recommendation?.modeled_tainted_capital_intercepted
                    }
                  />
                )}

                {activeTab === "intelligence" && (
                  <IntelligencePanel
                    riskPredictions={analysis?.risk_predictions || []}
                    nextHopPredictions={analysis?.next_hop_predictions || []}
                    forecastReport={analysis?.forecast_report || null}
                    riskStage={analysis?.stages?.risk_assessment}
                    nextHopStage={analysis?.stages?.next_hop_prediction}
                    forecastStage={analysis?.stages?.forecast_simulation}
                  />
                )}

                {activeTab === "evidence" && (
                  <EvidenceWarningsPanel
                    warnings={analysis?.warnings_and_limitations || []}
                    stages={analysis?.stages}
                    analysisTimestamp={analysis?.analysis_timestamp}
                    overallStatus={analysis?.overall_status}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Case Intake Modal (Callable anytime via Upload CTA) ── */}
      {isUploadWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <CaseIntakeWorkflow
            isModal={true}
            onCloseModal={() => setIsUploadWizardOpen(false)}
            onInvestigationReady={handleInvestigationReady}
            onLoadSyntheticDemo={async () => {
              setIsUploadWizardOpen(false);
              await handleLoadDemo();
            }}
            isLoadingDemo={isLoadingDemo}
          />
        </div>
      )}
    </div>
  );
}
