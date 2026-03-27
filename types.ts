export type GraphMode = "planning" | "executing" | "results";

export type ExecutionMode = "calculate" | "plan";

export type NodeType = "dataset" | "planning" | "output";

export type LLMProvider = "anthropic" | "openai" | "gemini";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

export interface AppSettings {
  maxTokens: number;        // max tokens per request
  maxContextTokens: number; // max context window (for the usage bar display)
  maxFileRows: number;      // max rows allowed in uploaded files
  maxFileSizeMB: number;    // max file size in MB
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxTokens: 4096,
  maxContextTokens: 128000,
  maxFileRows: 10000,
  maxFileSizeMB: 10,
};

// Demo mode rate limit: 10,000 tokens per hour
export const DEMO_TOKENS_PER_HOUR = 10000;
export const DEMO_PROVIDER: LLMProvider = "gemini";
export const DEMO_MODEL = "gemini-2.5-flash";

export const PROVIDER_MODELS: Record<LLMProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { id: "claude-haiku-4-20250414", label: "Claude Haiku 4" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  ],
};

export interface CustomDataset {
  schema: DatasetSchema;
  sample: Row[];
  full: Row[];
  fileName: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  values?: string[];
}

export interface DatasetSchema {
  name: string;
  rowCount: number;
  columns: ColumnSchema[];
}

export type Row = Record<string, string | number>;

export interface DatasetNodeData {
  [key: string]: unknown;
  type: "dataset";
  label: string;
  schema: DatasetSchema;
}

export interface PlanningNodeData {
  [key: string]: unknown;
  type: "planning";
  label: string;
  title: string;
  description: string;
  input: string;
  output: string;
  chatMessages: ChatMessage[];
  isEditing: boolean;
}

export interface OutputNodeData {
  [key: string]: unknown;
  type: "output";
  label: string;
  content: string;
  parentNodeId: string;
}

export type AppNodeData = DatasetNodeData | PlanningNodeData | OutputNodeData;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SerializedGraph {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

export interface SerializedNode {
  id: string;
  type: NodeType;
  data: AppNodeData;
}

export interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  disabled: boolean;
}
