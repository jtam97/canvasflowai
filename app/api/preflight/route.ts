import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { SerializedGraph, LLMProvider } from "@/types";

export async function POST(req: Request) {
  try {
    const { apiKey, provider, model, graph } = (await req.json()) as {
      apiKey: string;
      provider: LLMProvider;
      model: string;
      graph: SerializedGraph;
    };

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key" },
        { status: 400 }
      );
    }

    const planningNodes = graph.nodes.filter((n) => n.type === "planning");
    const enabledEdges = graph.edges.filter((e) => !e.disabled);

    if (planningNodes.length === 0) {
      return NextResponse.json({
        ok: false,
        issues: ["No analysis steps found. Add at least one planning node."],
      });
    }

    const stepsDescription = planningNodes
      .map((n) => {
        if (n.data.type !== "planning") return "";
        return `- [${n.id}] ${n.data.title}: ${n.data.description} (Input: ${n.data.input}, Output: ${n.data.output})`;
      })
      .filter(Boolean)
      .join("\n");

    const edgesDescription = enabledEdges
      .map((e) => `${e.source} -> ${e.target}`)
      .join(", ");

    const prompt = `You are reviewing AND improving a data analysis plan for the Iris dataset (150 rows: sepal_length, sepal_width, petal_length, petal_width, species).

ANALYSIS STEPS:
${stepsDescription}

CONNECTIONS: ${edgesDescription || "none"}

You have TWO jobs:

JOB 1 — VALIDATE: Check for issues:
1. Steps with empty or vague descriptions
2. Disconnected steps (no edges connecting them)
3. Circular dependencies
4. Steps that reference unavailable data or columns
5. Steps that are redundant or contradictory

JOB 2 — IMPROVE: For any step that has a vague, incomplete, or unclear description, rewrite it to be more specific and actionable. Preserve the user's intent but make it concrete. If a step is already well-specified, do NOT change it.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "ok": true/false,
  "issues": ["issue 1", "issue 2"],
  "improvedNodes": [
    {"id": "node_id", "title": "improved title", "description": "improved description", "input": "improved input", "output": "improved output"}
  ]
}

Only include nodes in "improvedNodes" if you actually improved them. If all nodes are already well-specified, return an empty array. Keep issues concise (one sentence each).`;

    const response = await callLLM(
      provider || "anthropic",
      model || "claude-sonnet-4-20250514",
      apiKey,
      [{ role: "user", content: prompt }],
      1024
    );
    console.log("[Preflight LLM Response]", response.text);

    // Parse JSON from response — gracefully fall back if parsing fails
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        ok: true,
        issues: [],
        improvedNodes: [],
        usage: { inputTokens: response.inputTokens, outputTokens: response.outputTokens },
      });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      ok: result.ok ?? true,
      issues: result.issues ?? [],
      improvedNodes: result.improvedNodes ?? [],
      usage: { inputTokens: response.inputTokens, outputTokens: response.outputTokens },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preflight failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
