import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { SerializedGraph, LLMProvider } from "@/types";

export async function POST(req: Request) {
  try {
    const { apiKey, provider, model, graph, nodeId, message } = (await req.json()) as {
      apiKey: string;
      provider: LLMProvider;
      model: string;
      graph: SerializedGraph;
      nodeId: string;
      message: string;
    };

    if (!apiKey || !nodeId || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const targetNode = graph.nodes.find((n) => n.id === nodeId);
    const graphContext = graph.nodes
      .filter((n) => n.type === "planning")
      .map((n) => {
        const d = n.data;
        if (d.type !== "planning") return "";
        return `[${n.id}${n.id === nodeId ? " (CURRENT)" : ""}] ${d.title}: ${d.description}`;
      })
      .filter(Boolean)
      .join("\n");

    const nodeLabel =
      targetNode?.data.type === "planning" ? targetNode.data.title : nodeId;

    const prompt = `You are a data analysis assistant helping refine an analysis plan for the Iris dataset.

CURRENT ANALYSIS PLAN:
${graphContext}

The user is asking about the step "${nodeLabel}":
${message}

Provide a concise, helpful response. If suggesting changes to the step, be specific about what to update in the title, description, input, or output fields.`;

    const response = await callLLM(
      provider || "anthropic",
      model || "claude-sonnet-4-20250514",
      apiKey,
      [{ role: "user", content: prompt }],
      512
    );

    console.log("[Chat LLM Response]", response.text);

    return NextResponse.json({
      reply: response.text,
      usage: { inputTokens: response.inputTokens, outputTokens: response.outputTokens },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
