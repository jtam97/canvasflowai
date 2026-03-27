"use client";

import { create } from "zustand";
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import {
  AppNodeData,
  GraphMode,
  ExecutionMode,
  PlanningNodeData,
  ChatMessage,
  LLMProvider,
  AppSettings,
  DEFAULT_SETTINGS,
  DEMO_TOKENS_PER_HOUR,
  DEMO_PROVIDER,
  DEMO_MODEL,
  CustomDataset,
} from "@/types";
import { IRIS_SCHEMA } from "@/lib/irisData";

const STORAGE_KEY_SESSION = "adaviz_session";
const STORAGE_KEY_API_KEYS = "adaviz_api_keys";
const STORAGE_KEY_PROVIDER = "adaviz_provider";
const STORAGE_KEY_MODEL = "adaviz_model";
const STORAGE_KEY_SETTINGS = "adaviz_settings";
const STORAGE_KEY_DEMO_MODE = "adaviz_demo_mode";
const STORAGE_KEY_DEMO_TOKENS = "adaviz_demo_tokens";
const STORAGE_KEY_DEMO_RESET = "adaviz_demo_reset";
// Legacy key for migration
const STORAGE_KEY_API_KEY_LEGACY = "adaviz_api_key";

function createDatasetNode(): Node<AppNodeData> {
  return {
    id: "dataset-root",
    type: "datasetNode",
    position: { x: 250, y: 50 },
    data: {
      type: "dataset",
      label: IRIS_SCHEMA.name,
      schema: IRIS_SCHEMA,
    },
    deletable: false,
  };
}

let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

interface GraphState {
  nodes: Node<AppNodeData>[];
  edges: Edge[];
  mode: GraphMode;
  isLoading: boolean;

  // LLM provider config
  provider: LLMProvider;
  model: string;
  apiKeys: Record<LLMProvider, string>;

  // Settings
  settings: AppSettings;

  // Token usage tracking
  tokenUsage: number;

  // Demo mode
  useDemo: boolean;
  demoTokensUsed: number;
  demoResetTime: number; // timestamp when demo tokens reset
  setUseDemo: (useDemo: boolean) => void;
  addDemoTokenUsage: (tokens: number) => void;
  getDemoTokensRemaining: () => number;
  checkDemoLimit: (estimatedTokens?: number) => { allowed: boolean; remaining: number };

  // Custom dataset
  customDataset: CustomDataset | null;

  // Execution mode
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => void;

  // Settings modal
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  setProvider: (provider: LLMProvider) => void;
  setModel: (model: string) => void;
  setApiKeyForProvider: (provider: LLMProvider, key: string) => void;
  getActiveApiKey: () => string | null;
  setSettings: (settings: Partial<AppSettings>) => void;
  addTokenUsage: (tokens: number) => void;
  resetTokenUsage: () => void;
  setCustomDataset: (dataset: CustomDataset | null) => void;

  setNodes: (nodes: Node<AppNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange<Node<AppNodeData>>;
  onEdgesChange: OnEdgesChange;
  updateNodeData: (id: string, data: Partial<AppNodeData>) => void;
  addPlanningNode: (
    title: string,
    description: string,
    input: string,
    output: string,
    parentId: string
  ) => string;
  addBranch: (fromNodeId: string) => string;
  deleteNode: (nodeId: string) => void;
  toggleEdge: (edgeId: string) => void;
  addChatMessage: (nodeId: string, message: ChatMessage) => void;
  setMode: (mode: GraphMode) => void;
  setIsLoading: (loading: boolean) => void;
  addOutputNode: (parentNodeId: string, content: string) => void;
  clearOutputNodes: () => void;
  saveSession: () => void;
  loadSession: () => void;
  resetSession: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [createDatasetNode()],
  edges: [],
  mode: "planning",
  isLoading: false,

  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  apiKeys: { anthropic: "", openai: "", gemini: "" },

  settings: { ...DEFAULT_SETTINGS },
  tokenUsage: 0,
  useDemo: true, // default to demo mode
  demoTokensUsed: 0,
  demoResetTime: Date.now() + 3600000, // 1 hour from now
  customDataset: null,

  executionMode: "calculate",
  setExecutionMode: (mode: ExecutionMode) => set({ executionMode: mode }),

  setUseDemo: (useDemo: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_DEMO_MODE, JSON.stringify(useDemo));
    }
    set({ useDemo });
  },

  addDemoTokenUsage: (tokens: number) => {
    const now = Date.now();
    let { demoTokensUsed, demoResetTime } = get();
    // Reset if the hour has passed
    if (now >= demoResetTime) {
      demoTokensUsed = 0;
      demoResetTime = now + 3600000;
    }
    demoTokensUsed += tokens;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_DEMO_TOKENS, String(demoTokensUsed));
      localStorage.setItem(STORAGE_KEY_DEMO_RESET, String(demoResetTime));
    }
    set({ demoTokensUsed, demoResetTime });
  },

  getDemoTokensRemaining: () => {
    const now = Date.now();
    const { demoTokensUsed, demoResetTime } = get();
    if (now >= demoResetTime) return DEMO_TOKENS_PER_HOUR;
    return Math.max(0, DEMO_TOKENS_PER_HOUR - demoTokensUsed);
  },

  checkDemoLimit: (estimatedTokens = 0) => {
    const remaining = get().getDemoTokensRemaining();
    return {
      allowed: remaining > estimatedTokens,
      remaining,
    };
  },

  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),

  setProvider: (provider: LLMProvider) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
    }
    set({ provider });
  },

  setModel: (model: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MODEL, model);
    }
    set({ model });
  },

  setApiKeyForProvider: (provider: LLMProvider, key: string) => {
    const apiKeys = { ...get().apiKeys, [provider]: key };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(apiKeys));
    }
    set({ apiKeys });
  },

  getActiveApiKey: () => {
    const { useDemo, provider, apiKeys } = get();
    if (useDemo) return "DEMO";
    return apiKeys[provider] || null;
  },

  setSettings: (partial: Partial<AppSettings>) => {
    const settings = { ...get().settings, ...partial };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    }
    set({ settings });
  },

  addTokenUsage: (tokens: number) => {
    set({ tokenUsage: get().tokenUsage + tokens });
  },

  resetTokenUsage: () => set({ tokenUsage: 0 }),

  setCustomDataset: (dataset: CustomDataset | null) => {
    set({ customDataset: dataset });
    // Update the dataset node on the canvas
    if (dataset) {
      set({
        nodes: get().nodes.map((node) =>
          node.id === "dataset-root"
            ? {
                ...node,
                data: {
                  type: "dataset" as const,
                  label: dataset.schema.name,
                  schema: dataset.schema,
                },
              }
            : node
        ),
      });
    } else {
      set({
        nodes: get().nodes.map((node) =>
          node.id === "dataset-root"
            ? {
                ...node,
                data: {
                  type: "dataset" as const,
                  label: IRIS_SCHEMA.name,
                  schema: IRIS_SCHEMA,
                },
              }
            : node
        ),
      });
    }
    get().saveSession();
  },

  setNodes: (nodes) => {
    set({ nodes });
    get().saveSession();
  },

  setEdges: (edges) => {
    set({ edges });
    get().saveSession();
  },

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<AppNodeData>[],
    });
    get().saveSession();
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
    get().saveSession();
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } as AppNodeData }
          : node
      ),
    });
    get().saveSession();
  },

  addPlanningNode: (title, description, input, output, parentId) => {
    const id = generateNodeId();
    const parentNode = get().nodes.find((n) => n.id === parentId);
    const parentX = parentNode?.position.x ?? 250;
    const parentY = parentNode?.position.y ?? 50;

    const existingChildren = get().edges.filter(
      (e) => e.source === parentId
    ).length;

    const newNode: Node<AppNodeData> = {
      id,
      type: "planningNode",
      position: {
        x: parentX + existingChildren * 500,
        y: parentY + 450,
      },
      data: {
        type: "planning",
        label: title,
        title,
        description,
        input,
        output,
        chatMessages: [],
        isEditing: false,
      },
    };

    const newEdge: Edge = {
      id: `edge_${parentId}_${id}`,
      source: parentId,
      target: id,
      type: "statusEdge",
      data: { disabled: false },
    };

    set({
      nodes: [...get().nodes, newNode],
      edges: [...get().edges, newEdge],
    });
    get().saveSession();
    return id;
  },

  addBranch: (fromNodeId: string) => {
    const id = generateNodeId();
    const parentNode = get().nodes.find((n) => n.id === fromNodeId);
    const parentX = parentNode?.position.x ?? 250;
    const parentY = parentNode?.position.y ?? 50;

    const existingChildren = get().edges.filter(
      (e) => e.source === fromNodeId
    ).length;

    const newNode: Node<AppNodeData> = {
      id,
      type: "planningNode",
      position: {
        x: parentX + existingChildren * 500,
        y: parentY + 450,
      },
      data: {
        type: "planning",
        label: "New Step",
        title: "New Step",
        description: "",
        input: "Result of previous step",
        output: "",
        chatMessages: [],
        isEditing: true,
      },
    };

    const newEdge: Edge = {
      id: `edge_${fromNodeId}_${id}`,
      source: fromNodeId,
      target: id,
      type: "statusEdge",
      data: { disabled: false },
    };

    set({
      nodes: [...get().nodes, newNode],
      edges: [...get().edges, newEdge],
    });
    get().saveSession();
    return id;
  },

  deleteNode: (nodeId: string) => {
    const nodesToDelete = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      nodesToDelete.add(current);
      const children = get()
        .edges.filter((e) => e.source === current)
        .map((e) => e.target);
      queue.push(...children);
    }

    set({
      nodes: get().nodes.filter((n) => !nodesToDelete.has(n.id)),
      edges: get().edges.filter(
        (e) => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)
      ),
    });
    get().saveSession();
  },

  toggleEdge: (edgeId: string) => {
    set({
      edges: get().edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              type: "statusEdge",
              data: { ...edge.data, disabled: !edge.data?.disabled },
            }
          : edge
      ),
    });
    get().saveSession();
  },

  addChatMessage: (nodeId: string, message: ChatMessage) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const data = node.data as PlanningNodeData;
        return {
          ...node,
          data: {
            ...data,
            chatMessages: [...data.chatMessages, message],
          },
        };
      }),
    });
    get().saveSession();
  },

  setMode: (mode: GraphMode) => set({ mode }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),

  addOutputNode: (parentNodeId: string, content: string) => {
    const id = generateNodeId();
    const parentNode = get().nodes.find((n) => n.id === parentNodeId);
    const parentX = parentNode?.position.x ?? 250;
    const parentY = parentNode?.position.y ?? 50;

    const newNode: Node<AppNodeData> = {
      id,
      type: "outputNode",
      position: {
        x: parentX + 420,
        y: parentY,
      },
      data: {
        type: "output",
        label: "Result",
        content,
        parentNodeId,
      },
      deletable: false,
    };

    const newEdge: Edge = {
      id: `edge_${parentNodeId}_${id}`,
      source: parentNodeId,
      target: id,
      type: "resultEdge",
    };

    set({
      nodes: [...get().nodes, newNode],
      edges: [...get().edges, newEdge],
    });
  },

  clearOutputNodes: () => {
    const outputNodeIds = new Set(
      get()
        .nodes.filter((n) => (n.data as AppNodeData).type === "output")
        .map((n) => n.id)
    );
    set({
      nodes: get().nodes.filter((n) => !outputNodeIds.has(n.id)),
      edges: get().edges.filter(
        (e) => !outputNodeIds.has(e.source) && !outputNodeIds.has(e.target)
      ),
    });
  },

  saveSession: () => {
    if (typeof window === "undefined") return;
    const { nodes, edges } = get();
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({ nodes, edges }));
  },

  loadSession: () => {
    if (typeof window === "undefined") return;

    // Migrate legacy single API key
    const legacyKey = localStorage.getItem(STORAGE_KEY_API_KEY_LEGACY);
    if (legacyKey) {
      const apiKeys = { anthropic: legacyKey, openai: "", gemini: "" };
      localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(apiKeys));
      localStorage.removeItem(STORAGE_KEY_API_KEY_LEGACY);
      set({ apiKeys });
    }

    // Load API keys
    const savedKeys = localStorage.getItem(STORAGE_KEY_API_KEYS);
    if (savedKeys) {
      try {
        const keys = JSON.parse(savedKeys);
        set({ apiKeys: { anthropic: keys.anthropic || "", openai: keys.openai || "", gemini: keys.gemini || "" } });
      } catch {
        // ignore
      }
    }

    // Load provider
    const savedProvider = localStorage.getItem(STORAGE_KEY_PROVIDER) as LLMProvider | null;
    if (savedProvider && ["anthropic", "openai", "gemini"].includes(savedProvider)) {
      set({ provider: savedProvider });
    }

    // Load model
    const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);
    if (savedModel) {
      set({ model: savedModel });
    }

    // Load settings
    const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (savedSettings) {
      try {
        const s = JSON.parse(savedSettings);
        set({ settings: { ...DEFAULT_SETTINGS, ...s } });
      } catch {
        // ignore
      }
    }

    // Load demo mode
    const savedDemo = localStorage.getItem(STORAGE_KEY_DEMO_MODE);
    if (savedDemo !== null) {
      try {
        set({ useDemo: JSON.parse(savedDemo) });
      } catch {
        // ignore
      }
    }

    // Load demo token tracking
    const savedDemoTokens = localStorage.getItem(STORAGE_KEY_DEMO_TOKENS);
    const savedDemoReset = localStorage.getItem(STORAGE_KEY_DEMO_RESET);
    if (savedDemoTokens && savedDemoReset) {
      const resetTime = Number(savedDemoReset);
      if (Date.now() >= resetTime) {
        // Hour has passed, reset
        set({ demoTokensUsed: 0, demoResetTime: Date.now() + 3600000 });
      } else {
        set({ demoTokensUsed: Number(savedDemoTokens), demoResetTime: resetTime });
      }
    }

    // Load session
    const saved = localStorage.getItem(STORAGE_KEY_SESSION);
    if (saved) {
      try {
        const { nodes, edges } = JSON.parse(saved);
        set({ nodes, edges });
      } catch {
        set({ nodes: [createDatasetNode()], edges: [] });
      }
    }

    // Show settings if no active API key and not in demo mode
    const state = get();
    if (!state.useDemo && !state.apiKeys[state.provider]) {
      set({ showSettings: true });
    }
  },

  resetSession: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    }
    set({
      nodes: [createDatasetNode()],
      edges: [],
      mode: "planning",
    });
  },
}));
