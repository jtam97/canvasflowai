"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  type Edge,
  type OnConnect,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { useGraphStore } from "@/store/graphStore";
import { buildSerializedGraph, serializeGraph } from "@/lib/serialize";
import { IRIS_SCHEMA, IRIS_SAMPLE } from "@/lib/irisData";
import { AppNodeData, CustomDataset, DatasetSchema, DEMO_PROVIDER, DEMO_MODEL, PlanningNodeData, Row } from "@/types";

import DatasetNode from "./nodes/DatasetNode";
import PlanningNode from "./nodes/PlanningNode";
import OutputNode from "./nodes/OutputNode";
import StatusEdge from "./edges/StatusEdge";
import ResultEdge from "./edges/ResultEdge";
import SettingsModal from "./SettingsModal";
import PreflightModal from "./PreflightModal";
import PlanModal from "./PlanModal";
import WelcomeModal from "./WelcomeModal";

const nodeTypes = {
  datasetNode: DatasetNode,
  planningNode: PlanningNode,
  outputNode: OutputNode,
};

const edgeTypes = {
  statusEdge: StatusEdge,
  resultEdge: ResultEdge,
};

export default function Canvas() {
  const {
    nodes,
    edges,
    mode,
    provider,
    model,
    apiKeys,
    settings,
    tokenUsage,
    customDataset,
    executionMode,
    isLoading,
    useDemo,
    onNodesChange,
    onEdgesChange,
    setEdges,
    setMode,
    setIsLoading,
    setShowSettings,
    setExecutionMode,
    addPlanningNode,
    addOutputNode,
    updateNodeData,
    clearOutputNodes,
    addTokenUsage,
    addDemoTokenUsage,
    checkDemoLimit,
    setCustomDataset,
    loadSession,
    resetSession,
    toggleEdge,
  } = useGraphStore();

  const { fitView } = useReactFlow();

  const [question, setQuestion] = useState("");
  const [preflightIssues, setPreflightIssues] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [planText, setPlanText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeKey = useDemo ? "DEMO" : apiKeys[provider];
  const activeProvider = useDemo ? DEMO_PROVIDER : provider;
  const activeModel = useDemo ? DEMO_MODEL : model;

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Fit view after nodes change (debounced)
  const fitViewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevNodeCount = useRef(nodes.length);
  useEffect(() => {
    if (nodes.length !== prevNodeCount.current) {
      prevNodeCount.current = nodes.length;
      if (fitViewTimeout.current) clearTimeout(fitViewTimeout.current);
      fitViewTimeout.current = setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 100);
    }
  }, [nodes.length, fitView]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges(addEdge({ ...connection, type: "statusEdge", data: { disabled: false } }, edges));
    },
    [edges, setEdges]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      // Result edges are not interactive (output nodes can't be branched/toggled)
      if (edge.type === "resultEdge") return;
      toggleEdge(edge.id);
    },
    [toggleEdge]
  );

  // Active dataset schema & sample
  const activeSchema = customDataset?.schema ?? IRIS_SCHEMA;
  const activeSample = customDataset?.sample ?? IRIS_SAMPLE;

  // Get existing planning nodes for context in subsequent plan calls
  const getExistingPlanContext = useCallback(() => {
    const planningNodes = nodes.filter(
      (n) => (n.data as AppNodeData).type === "planning"
    );
    if (planningNodes.length === 0) return null;
    return planningNodes.map((n) => {
      const d = n.data as PlanningNodeData;
      return { id: n.id, title: d.title, description: d.description, input: d.input, output: d.output };
    });
  }, [nodes]);

  const handlePlan = useCallback(async () => {
    if (!question.trim() || !activeKey) return;

    // Check demo rate limit
    if (useDemo) {
      const { allowed, remaining } = checkDemoLimit();
      if (!allowed) {
        setError(`Demo rate limit reached (0 tokens remaining). Resets hourly. Add your own API key in Settings for unlimited use.`);
        return;
      }
      if (remaining < 500) {
        setError(`Demo: only ~${remaining} tokens remaining this hour. Add your own API key in Settings for unlimited use.`);
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const existingNodes = getExistingPlanContext();
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: activeKey,
          provider: activeProvider,
          model: activeModel,
          datasetSchema: activeSchema,
          question: question.trim(),
          existingNodes,
        }),
      });

      const json = await res.json();
      console.log("[Plan Response]", json);
      if (!res.ok) throw new Error(json.error || "Planning failed");

      const totalTokens = (json.usage?.inputTokens ?? 0) + (json.usage?.outputTokens ?? 0);
      if (json.usage) {
        addTokenUsage(totalTokens);
      }
      if (useDemo && totalTokens > 0) {
        addDemoTokenUsage(totalTokens);
      }

      if (json.nodes && Array.isArray(json.nodes)) {
        const planningNodes = nodes.filter(
          (n) => (n.data as AppNodeData).type === "planning"
        );
        let defaultParentId = "dataset-root";
        if (planningNodes.length > 0) {
          const sourceIds = new Set(edges.map((e) => e.source));
          const leafNodes = planningNodes.filter((n) => !sourceIds.has(n.id));
          defaultParentId = leafNodes.length > 0 ? leafNodes[leafNodes.length - 1].id : planningNodes[planningNodes.length - 1].id;
        }

        let lastParentId = json.branchFrom || defaultParentId;
        for (const node of json.nodes) {
          const nodeId = addPlanningNode(
            node.title,
            node.description,
            node.input || "Full dataset",
            node.output || "",
            lastParentId
          );
          lastParentId = nodeId;
        }
      }
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning failed");
    } finally {
      setIsLoading(false);
    }
  }, [question, activeKey, activeProvider, activeModel, useDemo, activeSchema, nodes, edges, setIsLoading, addPlanningNode, addTokenUsage, addDemoTokenUsage, checkDemoLimit, getExistingPlanContext]);

  const handlePreflight = useCallback(async () => {
    if (!activeKey) return;

    if (useDemo) {
      const { allowed } = checkDemoLimit();
      if (!allowed) {
        setError(`Demo rate limit reached. Resets hourly. Add your own API key in Settings.`);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const graph = buildSerializedGraph(nodes, edges);
      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: activeKey, provider: activeProvider, model: activeModel, graph }),
      });

      const json = await res.json();
      console.log("[Preflight Response]", json);
      if (!res.ok) throw new Error(json.error || "Preflight check failed");

      const totalTokens = (json.usage?.inputTokens ?? 0) + (json.usage?.outputTokens ?? 0);
      if (json.usage) {
        addTokenUsage(totalTokens);
      }
      if (useDemo && totalTokens > 0) {
        addDemoTokenUsage(totalTokens);
      }

      if (json.improvedNodes && Array.isArray(json.improvedNodes)) {
        for (const improved of json.improvedNodes) {
          if (improved.id && improved.description) {
            updateNodeData(improved.id, {
              type: "planning",
              description: improved.description,
              ...(improved.title ? { title: improved.title, label: improved.title } : {}),
              ...(improved.input ? { input: improved.input } : {}),
              ...(improved.output ? { output: improved.output } : {}),
            } as Partial<AppNodeData>);
          }
        }
      }

      setPreflightIssues(json.issues || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preflight failed");
    } finally {
      setIsLoading(false);
    }
  }, [activeKey, activeProvider, activeModel, useDemo, nodes, edges, setIsLoading, addTokenUsage, addDemoTokenUsage, checkDemoLimit, updateNodeData]);

  const handleExecute = useCallback(async () => {
    if (!activeKey) return;

    if (useDemo) {
      const { allowed } = checkDemoLimit();
      if (!allowed) {
        setError(`Demo rate limit reached. Resets hourly. Add your own API key in Settings.`);
        return;
      }
    }

    setPreflightIssues(null);
    setMode("executing");
    setIsLoading(true);
    setError(null);
    clearOutputNodes();

    try {
      const prompt = serializeGraph(nodes, edges, activeSchema);

      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: activeKey,
          provider: activeProvider,
          model: activeModel,
          maxTokens: settings.maxTokens,
          serializedPrompt: prompt,
          datasetSample: activeSample,
          executionMode,
        }),
      });

      const json = await res.json();
      console.log("[Execute Response]", json);
      if (!res.ok) throw new Error(json.error || "Execution failed");

      const totalTokens = (json.usage?.inputTokens ?? 0) + (json.usage?.outputTokens ?? 0);
      if (json.usage) {
        addTokenUsage(totalTokens);
      }
      if (useDemo && totalTokens > 0) {
        addDemoTokenUsage(totalTokens);
      }

      if (executionMode === "plan") {
        setPlanText(json.plan || "");
        setMode("planning");
      } else {
        if (json.results && Array.isArray(json.results)) {
          for (const result of json.results) {
            addOutputNode(result.nodeId, result.output);
          }
        }
        setMode("results");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
      setMode("planning");
    } finally {
      setIsLoading(false);
    }
  }, [
    activeKey,
    activeProvider,
    activeModel,
    useDemo,
    settings.maxTokens,
    activeSchema,
    activeSample,
    executionMode,
    nodes,
    edges,
    setMode,
    setIsLoading,
    clearOutputNodes,
    addOutputNode,
    addTokenUsage,
    addDemoTokenUsage,
    checkDemoLimit,
  ]);

  // File upload handler
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadError(null);

      // Check file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > settings.maxFileSizeMB) {
        setUploadError(`File too large (${sizeMB.toFixed(1)}MB). Max: ${settings.maxFileSizeMB}MB.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "csv") {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            processUploadedData(file.name, result.data as Record<string, string>[]);
          },
          error: () => {
            setUploadError("Failed to parse CSV file.");
          },
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const wb = XLSX.read(evt.target?.result, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws) as Record<string, string | number>[];
            processUploadedData(file.name, data);
          } catch {
            setUploadError("Failed to parse Excel file.");
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setUploadError("Unsupported file type. Use CSV or Excel (.xlsx/.xls).");
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [settings.maxFileSizeMB, settings.maxFileRows] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const processUploadedData = useCallback(
    (fileName: string, rawData: Record<string, string | number>[]) => {
      if (rawData.length === 0) {
        setUploadError("File contains no data.");
        return;
      }

      if (rawData.length > settings.maxFileRows) {
        setUploadError(
          `Too many rows (${rawData.length.toLocaleString()}). Max: ${settings.maxFileRows.toLocaleString()}.`
        );
        return;
      }

      // Infer schema
      const columns = Object.keys(rawData[0]).map((name) => {
        const sampleValues = rawData.slice(0, 20).map((r) => r[name]);
        const isNumeric = sampleValues.every(
          (v) => v !== undefined && v !== "" && !isNaN(Number(v))
        );
        return { name, type: isNumeric ? "float" : "string" };
      });

      const schema: DatasetSchema = {
        name: fileName,
        rowCount: rawData.length,
        columns,
      };

      // Cast numeric columns
      const full: Row[] = rawData.map((r) => {
        const row: Row = {};
        for (const col of columns) {
          row[col.name] =
            col.type === "float" ? Number(r[col.name]) : String(r[col.name] ?? "");
        }
        return row;
      });

      const sample = full.slice(0, 20);

      const dataset: CustomDataset = { schema, sample, full, fileName };
      setCustomDataset(dataset);
    },
    [settings.maxFileRows, setCustomDataset]
  );

  const hasPlanningNodes = useMemo(
    () =>
      nodes.some((n) => (n.data as AppNodeData).type === "planning"),
    [nodes]
  );

  // Token usage bar calculations
  const maxCtx = settings.maxContextTokens;
  const usagePct = Math.min((tokenUsage / maxCtx) * 100, 100);
  const usageK = (tokenUsage / 1000).toFixed(1);
  const maxK = maxCtx >= 1000 ? `${Math.round(maxCtx / 1000)}k` : String(maxCtx);

  return (
    <div className="w-full h-full relative">
      <WelcomeModal />
      <SettingsModal />

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Clear Canvas</h3>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure? This will remove all planning and result nodes from
              the canvas and reset the analysis context.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetSession();
                  setShowClearConfirm(false);
                  setError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {planText !== null && (
        <PlanModal plan={planText} onClose={() => setPlanText(null)} />
      )}

      {preflightIssues !== null && (
        <PreflightModal
          issues={preflightIssues}
          onConfirm={handleExecute}
          onCancel={() => setPreflightIssues(null)}
        />
      )}

      {/* Top Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        {/* Main toolbar row */}
        <div className="px-6 py-3 flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900 shrink-0">
            CanvasFlowAI
          </h1>

          {/* Token Usage Bar */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${usagePct}%`,
                  backgroundColor:
                    usagePct > 80 ? "#ef4444" : usagePct > 50 ? "#f59e0b" : "#3b82f6",
                }}
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {usageK}k / {maxK}
            </span>
          </div>

          {/* Demo indicator */}
          {useDemo && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors shrink-0"
              title="Using demo mode — click to add your own key"
            >
              Demo &middot; Add your key
            </button>
          )}

          <div className="flex-1" />

          {/* Execution Mode Toggle */}
          {mode === "planning" && hasPlanningNodes && (
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setExecutionMode("calculate")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  executionMode === "calculate"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                title="Execute analysis on the spot — Claude computes statistics and results directly"
              >
                Calculate
              </button>
              <button
                onClick={() => setExecutionMode("plan")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  executionMode === "plan"
                    ? "bg-white text-purple-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                title="Generate a detailed implementation plan to paste into your preferred IDE agent (Claude Code, Cursor, etc.)"
              >
                Plan
              </button>
            </div>
          )}

          {mode === "executing" && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">
                {executionMode === "plan" ? "Generating plan..." : "Executing analysis..."}
              </span>
            </div>
          )}

          {mode === "results" && (
            <button
              onClick={() => setMode("planning")}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Back to planning
            </button>
          )}

          {mode === "planning" && hasPlanningNodes && (
            <button
              onClick={handlePreflight}
              disabled={isLoading}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0"
            >
              Run
            </button>
          )}

          {/* Clear button */}
          {mode === "planning" && hasPlanningNodes && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors shrink-0"
            >
              Clear
            </button>
          )}

          {/* Settings gear button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Error banner — wraps to show full error text */}
        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-200 flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "statusEdge" }}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.01}
        maxZoom={2.5}
        className="bg-gray-100"
      >
        <Background gap={20} size={2} color="#b0b4ba" />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>

      {/* Bottom Prompt Bar — inset from edges to avoid overlapping Controls (bottom-left) and MiniMap (bottom-right) */}
      {mode === "planning" && (
        <div className="absolute bottom-2 left-[60px] right-[200px] z-10 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              title="Upload CSV or Excel file"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 17h14M10 3v11M6 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />

            {customDataset && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 shrink-0">
                <span className="truncate max-w-[120px]">{customDataset.fileName}</span>
                <button
                  onClick={() => setCustomDataset(null)}
                  className="text-emerald-500 hover:text-emerald-700"
                  title="Remove uploaded dataset"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              </div>
            )}

            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePlan();
              }}
              placeholder="What would you like to learn about this dataset?"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
              disabled={isLoading || !activeKey}
            />
            <button
              onClick={handlePlan}
              disabled={isLoading || !question.trim() || !activeKey}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {isLoading ? "Planning..." : "Plan"}
            </button>
          </div>
          {uploadError && (
            <p className="text-red-500 text-xs mt-2 text-center">{uploadError}</p>
          )}
          <p className="text-xs text-gray-400 text-center mt-2">
            Built by <a href="https://justinztam.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline">Justin Tam</a> &middot; <a href="https://projects.justinztam.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline">Other projects I have built</a>
          </p>
        </div>
      )}
    </div>
  );
}
