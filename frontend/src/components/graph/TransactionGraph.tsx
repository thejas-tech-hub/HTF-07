"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import cytoscape, { Core } from "cytoscape";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  GitBranch,
  Network,
  Table as TableIcon,
  Search,
  Lock,
  ArrowRight,
  Filter,
} from "lucide-react";
import {
  TransactionEvent,
  InvestigationAnalysisResponse,
  SelectedEntity,
  GraphNodeData,
  GraphEdgeData,
} from "@/types";
import { buildCytoscapeElements } from "@/lib/mappers/graphMapper";
import { GraphLegend } from "./GraphLegend";
import { EntityInspector } from "./EntityInspector";
import { formatMinorUnits, formatPaise } from "@/lib/currency";

interface TransactionGraphProps {
  events: TransactionEvent[];
  analysis: InvestigationAnalysisResponse | null;
  decisionTimestamp: string;
  sinkAccounts?: string[];
  seedTxIds?: string[];
}

export function TransactionGraph({
  events,
  analysis,
  decisionTimestamp,
  sinkAccounts = [],
  seedTxIds = [],
}: TransactionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [showForecasts, setShowForecasts] = useState<boolean>(true);
  const [layoutType, setLayoutType] = useState<"breadthfirst" | "cose">("breadthfirst");
  const [accountSearch, setAccountSearch] = useState<string>("");

  // ── Cytoscape Instance Lifecycle ──────────────────────────────────────────
  // Dedicated container is permanently mounted in DOM to prevent React reconciliation
  // divergences (avoiding NotFoundError: removeChild). Graph rebuilds only when topology
  // or visualization parameters change, NOT on view toggles.
  useEffect(() => {
    if (!containerRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    if (events.length === 0) return;

    const elements = buildCytoscapeElements({
      events,
      analysis,
      decisionTimestamp,
      showForecasts,
      sinkAccounts,
      seedTxIds,
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements as cytoscape.ElementDefinition[],
      style: [
        // ── Nodes ─────────────────────────────────────────────────────────
        {
          selector: "node",
          style: {
            label: "data(label)",
            color: "#f1f5f9",
            "font-size": "11px",
            "font-family": "ui-monospace, monospace",
            "font-weight": "bold",
            "text-valign": "bottom",
            "text-margin-y": 8,
            "background-color": "#131c30",
            "border-width": 2,
            "border-color": "#283b5e",
            width: 38,
            height: 38,
            "text-background-opacity": 0.94,
            "text-background-color": "#080c14",
            "text-background-padding": "3px 6px",
            "text-background-shape": "roundrectangle",
          },
        },
        {
          selector: "node.tainted",
          style: {
            "background-color": "#2d121c",
            "border-color": "#ef4444",
            "border-width": 2.5,
            color: "#fee2e2",
          },
        },
        {
          selector: "node.seed",
          style: {
            "background-color": "#3f1422",
            "border-color": "#ef4444",
            "border-width": 3.5,
            width: 44,
            height: 44,
            color: "#fee2e2",
          },
        },
        {
          selector: "node.sink",
          style: {
            "background-color": "#17233c",
            "border-color": "#3b82f6",
            "border-width": 3,
            width: 44,
            height: 44,
            color: "#93c5fd",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#6366f1",
            "border-width": 4,
          },
        },

        // ── Edges ─────────────────────────────────────────────────────────
        {
          selector: "edge",
          style: {
            width: 2.5,
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#64748b",
            "line-color": "#64748b",
            "arrow-scale": 1.25,
            label: "data(label)",
            "font-size": "10px",
            "font-family": "ui-monospace, monospace",
            "font-weight": "bold",
            color: "#e2e8f0",
            "text-background-opacity": 0.94,
            "text-background-color": "#080c14",
            "text-background-padding": "3px 5px",
            "text-background-shape": "roundrectangle",
            "text-rotation": "none",
            "text-margin-y": -11,
          },
        },
        {
          selector: "edge.historical",
          style: {
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
            width: 2.5,
          },
        },
        {
          selector: "edge.later-observation",
          style: {
            "line-color": "#f59e0b",
            "target-arrow-color": "#f59e0b",
            opacity: 0.6,
            "line-style": "dotted",
            color: "#fde68a",
          },
        },
        {
          selector: "edge.cut-edge",
          style: {
            "line-color": "#ef4444",
            "target-arrow-color": "#ef4444",
            width: 4,
            color: "#fca5a5",
            "font-weight": "bold",
          },
        },
        {
          selector: "edge.forecast-edge",
          style: {
            "line-style": "dashed",
            "line-dash-pattern": [6, 4],
            "line-color": "#6366f1",
            "target-arrow-color": "#6366f1",
            color: "#c7d2fe",
            width: 2.5,
          },
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#3b82f6",
            "target-arrow-color": "#3b82f6",
            width: 4.5,
          },
        },
      ],
      layout: {
        name: layoutType,
        directed: true,
        padding: 40,
        animate: false,
        spacingFactor: 1.45,
      },
    });

    cy.on("tap", "node", (evt) => {
      const nodeData = evt.target.data() as GraphNodeData;
      setSelectedEntity({ type: "node", data: nodeData });
    });

    cy.on("tap", "edge", (evt) => {
      const edgeData = evt.target.data() as GraphEdgeData;
      setSelectedEntity({ type: "edge", data: edgeData });
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedEntity(null);
      }
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [events, analysis, decisionTimestamp, showForecasts, layoutType, sinkAccounts, seedTxIds]);

  // ── Smooth View Switching Adaptation ──────────────────────────────────────
  // When switching back to Canvas view, trigger resize and centering
  // without re-instantiating the Cytoscape graph or dropping state.
  useEffect(() => {
    if (viewMode === "graph" && cyRef.current) {
      cyRef.current.resize();
      cyRef.current.fit(undefined, 35);
    }
  }, [viewMode]);

  const handleZoomIn = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.25);
  };

  const handleZoomOut = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 0.8);
  };

  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(undefined, 35);
  };

  const handleToggleLayout = () => {
    setLayoutType((prev) => (prev === "breadthfirst" ? "cose" : "breadthfirst"));
  };

  // Search and center node
  const handleSearchAccount = (accId: string) => {
    setAccountSearch(accId);
    if (!accId.trim() || !cyRef.current) return;

    const matched = cyRef.current.nodes().filter((n) =>
      n.id().toLowerCase().includes(accId.toLowerCase())
    );

    if (matched.length > 0) {
      cyRef.current.center(matched);
      cyRef.current.zoom(1.4);
      matched[0].select();
      const nodeData = matched[0].data() as GraphNodeData;
      setSelectedEntity({ type: "node", data: nodeData });
    }
  };

  // Filtered transactions for accessible table ledger
  const filteredEventsForTable = useMemo(() => {
    if (!accountSearch.trim()) return events;
    const q = accountSearch.toLowerCase();
    return events.filter(
      (e) =>
        e.transaction_id.toLowerCase().includes(q) ||
        e.sender.account_id.toLowerCase().includes(q) ||
        e.receiver.account_id.toLowerCase().includes(q) ||
        (e.reference && e.reference.toLowerCase().includes(q))
    );
  }, [events, accountSearch]);

  const cutEdgeSet = useMemo(() => {
    return new Set(analysis?.chokepoint_report?.cut_event_ids || []);
  }, [analysis]);

  return (
    <div className="relative rounded-2xl border border-surface-border bg-background overflow-hidden shadow-2xl flex flex-col h-[600px] lg:h-[640px] font-sans">
      {/* Top Floating HUD Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-surface-border bg-surface/90 backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-brand-primary" />
            <span className="text-xs font-bold text-white font-sans">
              Transaction flow graph
            </span>
          </div>

          {events.length > 0 && (
            <span className="text-xs text-slate-400 border-l border-surface-border pl-3 font-sans">
              {events.length} transfers
            </span>
          )}

          {/* View Mode Switcher: Canvas vs Accessible Table */}
          <div className="flex items-center bg-surface-card p-0.5 rounded-lg border border-surface-border ml-2">
            <button
              onClick={() => setViewMode("graph")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                viewMode === "graph"
                  ? "bg-brand-primary text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>Canvas</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                viewMode === "table"
                  ? "bg-brand-primary text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Accessible tabular ledger alternative"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>
          </div>
        </div>

        {/* HUD Controls */}
        <div className="flex items-center gap-2">
          {/* Account Search input */}
          <div className="relative hidden md:block">
            <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={accountSearch}
              onChange={(e) => handleSearchAccount(e.target.value)}
              placeholder="Find account..."
              className="w-36 lg:w-48 bg-surface-card border border-surface-border rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-slate-500 outline-none focus:border-brand-primary transition-colors font-mono"
            />
          </div>

          {/* Toggle Forecast Edges */}
          <button
            onClick={() => setShowForecasts(!showForecasts)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-primary ${
              showForecasts
                ? "bg-brand-primary/15 text-brand-periwinkle border-brand-primary/40 shadow-sm"
                : "bg-surface-elevated text-slate-400 border-surface-border hover:text-white"
            }`}
            title="Toggle display of simulated next-hop forecast trajectories"
          >
            {showForecasts ? <Eye className="h-3.5 w-3.5 text-brand-periwinkle" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Forecast trajectories</span>
          </button>

          {viewMode === "graph" && (
            <>
              {/* Toggle Layout */}
              <button
                onClick={handleToggleLayout}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-elevated hover:bg-surface-card text-slate-200 text-xs border border-surface-border transition-colors cursor-pointer"
                title={`Switch graph layout (current: ${layoutType === "breadthfirst" ? "Hierarchical flow" : "Force directed"})`}
              >
                <GitBranch className="h-3.5 w-3.5 text-brand-periwinkle" />
                <span>{layoutType === "breadthfirst" ? "Hierarchical" : "Force-Directed"}</span>
              </button>

              {/* Zoom & Fit HUD */}
              <div className="flex items-center border-l border-surface-border pl-2 gap-1">
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-card text-slate-300 hover:text-white transition-colors cursor-pointer border border-surface-border"
                  title="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-card text-slate-300 hover:text-white transition-colors cursor-pointer border border-surface-border"
                  title="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleFit}
                  className="p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-card text-slate-300 hover:text-white transition-colors cursor-pointer border border-surface-border"
                  title="Fit to viewport / Center"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Visualization Viewport Container */}
      <div className="relative flex-1 min-h-0 w-full bg-graph-grid overflow-hidden">
        {/* Permanent Cytoscape Canvas Container Layer */}
        {/* Kept permanently mounted in the DOM to eliminate React Fiber reconciler DOM node mismatches */}
        <div
          className={`absolute inset-0 w-full h-full ${
            viewMode === "graph" ? "block z-10 pointer-events-auto" : "invisible pointer-events-none z-0"
          }`}
          aria-hidden={viewMode !== "graph"}
        >
          <div ref={containerRef} className="w-full h-full" />

          {/* Empty state if no events */}
          {events.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-background/90 backdrop-blur-sm z-10 font-sans">
              <p className="text-sm font-semibold text-slate-300 font-sans">
                No transaction topology present
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm font-sans">
                Upload a transaction dataset or load the demo scenario to visualize account fund flows.
              </p>
            </div>
          )}
        </div>

        {/* Permanent Sibling: Accessible Tabular Ledger Alternative */}
        <div
          className={`absolute inset-0 p-4 overflow-y-auto bg-surface/95 backdrop-blur-sm ${
            viewMode === "table" ? "block z-20 pointer-events-auto" : "hidden pointer-events-none z-0"
          }`}
          aria-hidden={viewMode !== "table"}
          role="region"
          aria-label="Transaction ledger table view"
        >
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 bg-surface-elevated/50 rounded-xl border border-surface-border">
              <TableIcon className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No transaction records present</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Upload a transaction dataset or load the demo scenario to populate the transaction ledger.
              </p>
            </div>
          ) : filteredEventsForTable.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 bg-surface-elevated/50 rounded-xl border border-surface-border">
              <Search className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No matching transactions</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No transactions match the search filter &ldquo;{accountSearch}&rdquo;. Clear the search input to view all transfers.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-surface-border bg-surface-elevated overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-card border-b border-surface-border text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-3">Timeline State</th>
                    <th className="p-3">Tx ID / Ref</th>
                    <th className="p-3">Sender Account</th>
                    <th className="p-3">Receiver Account</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Timestamp (UTC)</th>
                    <th className="p-3">Rail</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border text-slate-300 font-mono">
                  {filteredEventsForTable.map((ev) => {
                    const isHistorical = new Date(ev.occurred_at) <= new Date(decisionTimestamp);
                    const isCut = cutEdgeSet.has(ev.event_id);

                    return (
                      <tr
                        key={ev.event_id}
                        className="hover:bg-surface-card/60 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedEntity({
                            type: "edge",
                            data: {
                              id: ev.event_id,
                              source: ev.sender.account_id,
                              target: ev.receiver.account_id,
                              amountMinorUnits: ev.amount_minor_units,
                              currency: ev.currency,
                              occurredAt: ev.occurred_at,
                              isObserved: true,
                              isCutEdge: isCut,
                              isTaintAllocated: false,
                              status: ev.status,
                              channel: ev.channel,
                              event_id: ev.event_id,
                            },
                          });
                        }}
                      >
                        <td className="p-3">
                          {isCut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <Lock className="h-3 w-3" /> Min-Cut Hold
                            </span>
                          ) : isHistorical ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-surface-card text-slate-300 border border-surface-border">
                              Historical (&le; T)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              Later Observation (&gt; T)
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-white select-all">
                          {ev.transaction_id}
                          {ev.reference && (
                            <span className="block text-[10px] text-slate-500 font-sans">{ev.reference}</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-200">
                          {ev.sender.account_id}
                          {ev.sender.institution && (
                            <span className="text-slate-500 text-[10px] ml-1 font-sans">({ev.sender.institution})</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-200">
                          {ev.receiver.account_id}
                          {ev.receiver.institution && (
                            <span className="text-slate-500 text-[10px] ml-1 font-sans">({ev.receiver.institution})</span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-emerald-400">
                          {formatMinorUnits(ev.amount_minor_units, ev.currency)}
                        </td>
                        <td className="p-3 text-slate-400 font-sans text-[11px]">
                          {new Date(ev.occurred_at).toUTCString().slice(5, 25)}
                        </td>
                        <td className="p-3 text-slate-400 uppercase text-[11px] font-sans">
                          {ev.channel}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded bg-surface-card hover:bg-brand-primary text-[11px] font-sans text-slate-300 hover:text-white transition-colors border border-surface-border cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntity({
                                type: "edge",
                                data: {
                                  id: ev.event_id,
                                  source: ev.sender.account_id,
                                  target: ev.receiver.account_id,
                                  amountMinorUnits: ev.amount_minor_units,
                                  currency: ev.currency,
                                  occurredAt: ev.occurred_at,
                                  isObserved: true,
                                  isCutEdge: isCut,
                                  isTaintAllocated: false,
                                  status: ev.status,
                                  channel: ev.channel,
                                  event_id: ev.event_id,
                                },
                              });
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Slide-over Entity Inspector Drawer */}
        {/* Rendered at root z-30 level so inspection functions seamlessly in both Canvas and Table View */}
        <EntityInspector
          selectedEntity={selectedEntity}
          onClose={() => setSelectedEntity(null)}
        />
      </div>

      {/* Bottom Floating Legend Bar */}
      <div className="p-2 border-t border-surface-border bg-surface/95 backdrop-blur-md z-20 shrink-0">
        <GraphLegend />
      </div>
    </div>
  );
}
