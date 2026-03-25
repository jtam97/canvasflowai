import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { Row, LLMProvider, ExecutionMode } from "@/types";

export async function POST(req: Request) {
  try {
    const {
      apiKey,
      provider,
      model,
      maxTokens,
      serializedPrompt,
      datasetSample,
      executionMode,
    } = (await req.json()) as {
      apiKey: string;
      provider: LLMProvider;
      model: string;
      maxTokens?: number;
      serializedPrompt: string;
      datasetSample: Row[];
      executionMode?: ExecutionMode;
    };

    if (!apiKey || !serializedPrompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const sampleStr = JSON.stringify(datasetSample.slice(0, 20), null, 2);
    const mode = executionMode || "calculate";

    let prompt: string;

    if (mode === "plan") {
      // Plan mode: generate ONE unified implementation plan (not per-node)
      prompt = `You are a senior data scientist generating a detailed, copy-paste-ready implementation plan.

${serializedPrompt}

SAMPLE DATA (first 20 rows):
${sampleStr}

Generate a COMPLETE, unified implementation plan that a coding LLM (like Claude Code, Cursor, Copilot, etc.) can execute directly.

Structure the plan as a single document:
1. Start with "## Implementation Plan" as the title
2. Include a setup section (imports, data loading)
3. Then detail each analysis step with:
   - The exact Python code approach (pandas, matplotlib, seaborn, scipy, etc.)
   - Specific function calls, column references, and parameters
   - Expected output format (DataFrame shape, plot type, statistical test results)
   - Edge cases or data cleaning needed
4. End with a validation/summary section

IMPORTANT:
- This plan will be pasted directly into an IDE agent (Claude Code, Cursor, Windsurf, etc.)
- Write it as one cohesive document, not separate sections per node
- Be specific about library versions and function signatures
- Use markdown formatting for readability`;
    } else {
      // Calculate mode: produce per-node results
      prompt = `You are a data analyst. Execute the following analysis plan on the provided dataset.

${serializedPrompt}

SAMPLE DATA (first 20 rows):
${sampleStr}

Execute each step carefully. For each step, provide thorough analysis with:
- Specific numbers and statistics where applicable
- Clear observations and insights
- Markdown formatting for readability (tables, lists, bold for emphasis)

IMPORTANT: For each step, start the result with exactly:
RESULT [node_id]:
where node_id matches the ID in the step header.`;
    }

    const response = await callLLM(
      provider || "anthropic",
      model || "claude-sonnet-4-20250514",
      apiKey,
      [{ role: "user", content: prompt }],
      maxTokens || 4096
    );
    console.log("[Execute LLM Response]", response.text);

    if (mode === "plan") {
      // Plan mode: return the full text as a single plan
      return NextResponse.json({
        plan: response.text,
        usage: {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        },
      });
    } else {
      // Calculate mode: parse results by node ID
      const resultBlocks = response.text.split(/RESULT \[([^\]]+)\]:/);
      const results: { nodeId: string; output: string }[] = [];

      for (let i = 1; i < resultBlocks.length; i += 2) {
        const nodeId = resultBlocks[i].trim();
        const output = (resultBlocks[i + 1] || "").trim();
        if (nodeId && output) {
          results.push({ nodeId, output });
        }
      }

      return NextResponse.json({
        results,
        usage: {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
