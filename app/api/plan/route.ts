import { NextResponse } from "next/server";
import { callLLMStructured, ToolSchema } from "@/lib/llm";
import { DatasetSchema, LLMProvider } from "@/types";

interface ExistingNode {
  id: string;
  title: string;
  description: string;
  input: string;
  output: string;
}

interface PlanNode {
  title: string;
  description: string;
  input: string;
  output: string;
}

interface PlanResult {
  branchFrom: string;
  nodes: PlanNode[];
}

const PLAN_TOOL: ToolSchema = {
  name: "create_analysis_plan",
  description:
    "Create a structured analysis plan with ordered steps. Each step has a title, description, input, and output.",
  schema: {
    type: "object",
    properties: {
      branchFrom: {
        type: "string",
        description:
          'The node ID to branch from. Use an existing node ID, or "dataset-root" for a fresh branch from the dataset.',
      },
      nodes: {
        type: "array",
        description: "The ordered list of analysis steps (2-5 steps).",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short label for the step (max 6 words)",
            },
            description: {
              type: "string",
              description: "What this step does (1-2 sentences)",
            },
            input: {
              type: "string",
              description: "What data/results this step needs",
            },
            output: {
              type: "string",
              description: "What this step produces",
            },
          },
          required: ["title", "description", "input", "output"],
        },
      },
    },
    required: ["branchFrom", "nodes"],
  },
};

export async function POST(req: Request) {
  try {
    const { apiKey, provider, model, datasetSchema, question, existingNodes } =
      (await req.json()) as {
        apiKey: string;
        provider: LLMProvider;
        model: string;
        datasetSchema: DatasetSchema;
        question: string;
        existingNodes?: ExistingNode[] | null;
      };

    if (!apiKey || !question) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const columnsStr = datasetSchema.columns
      .map((c) => {
        let desc = `${c.name} (${c.type})`;
        if (c.values) desc += ` [values: ${c.values.join(", ")}]`;
        return desc;
      })
      .join("\n  ");

    let existingContext = "";
    if (existingNodes && existingNodes.length > 0) {
      existingContext = `\n\nEXISTING ANALYSIS PLAN (already on canvas — build on this, do NOT recreate these steps):
${existingNodes.map((n, i) => `  Step ${i + 1} [${n.id}]: ${n.title} — ${n.description} (Input: ${n.input}, Output: ${n.output})`).join("\n")}

The user wants to EXTEND or BRANCH from this existing plan. Determine if the new request:
- Is a continuation of the last step → set branchFrom to the last existing step's node ID
- Is related to an earlier step → set branchFrom to that step's node ID
- Is independent / starts fresh from the dataset → set branchFrom to "dataset-root"`;
    }

    const prompt = `You are a data analysis planning assistant. Given a dataset and a user's question, create a step-by-step analysis plan.

DATASET: ${datasetSchema.name} (${datasetSchema.rowCount} rows)
Columns:
  ${columnsStr}
${existingContext}

USER QUESTION: ${question}

Create 2-5 analysis steps that would answer this question. Each step should be a specific, actionable analysis task.${
      !existingNodes || existingNodes.length === 0
        ? '\n\nSet branchFrom to "dataset-root" since this is a fresh plan.'
        : ""
    }`;

    const response = await callLLMStructured<PlanResult>(
      provider || "anthropic",
      model || "claude-sonnet-4-20250514",
      apiKey,
      [{ role: "user", content: prompt }],
      1024,
      PLAN_TOOL
    );

    console.log("[Plan Structured Response]", response.data);

    return NextResponse.json({
      nodes: response.data.nodes,
      branchFrom: response.data.branchFrom,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
