import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import { LLMProvider } from "@/types";

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMStructuredResponse<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
}

export interface ToolSchema {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

// --- Unstructured (plain text) calls ---

export async function callLLM(
  provider: LLMProvider,
  model: string,
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number
): Promise<LLMResponse> {
  switch (provider) {
    case "anthropic":
      return callAnthropic(model, apiKey, messages, maxTokens);
    case "openai":
      return callOpenAI(model, apiKey, messages, maxTokens);
    case "gemini":
      return callGemini(model, apiKey, messages, maxTokens);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// --- Structured (tool-use / function-calling) calls ---

export async function callLLMStructured<T>(
  provider: LLMProvider,
  model: string,
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number,
  tool: ToolSchema
): Promise<LLMStructuredResponse<T>> {
  switch (provider) {
    case "anthropic":
      return callAnthropicStructured<T>(model, apiKey, messages, maxTokens, tool);
    case "openai":
      return callOpenAIStructured<T>(model, apiKey, messages, maxTokens, tool);
    case "gemini":
      return callGeminiStructured<T>(model, apiKey, messages, maxTokens, tool);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// --- Plain text implementations ---

async function callAnthropic(
  model: string,
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number
): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function callOpenAI(
  model: string,
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number
): Promise<LLMResponse> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = response.choices[0]?.message?.content || "";

  return {
    text,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

async function callGemini(
  model: string,
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number
): Promise<LLMResponse> {
  const ai = new GoogleGenAI({ apiKey });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1];

  const chat = ai.chats.create({
    model,
    config: { maxOutputTokens: maxTokens },
    history,
  });

  const response = await chat.sendMessage({ message: lastMessage.content });

  const usage = response.usageMetadata;

  return {
    text: response.text ?? "",
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

// --- Structured (tool-use) implementations ---

async function callAnthropicStructured<T>(
  model: string,
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number,
  tool: ToolSchema
): Promise<LLMStructuredResponse<T>> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages,
    tools: [
      {
        name: tool.name,
        description: tool.description,
        input_schema: tool.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool" as const, name: tool.name },
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Anthropic did not return structured tool output");
  }

  return {
    data: toolBlock.input as T,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function callOpenAIStructured<T>(
  model: string,
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number,
  tool: ToolSchema
): Promise<LLMStructuredResponse<T>> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    tools: [
      {
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.schema,
        },
      },
    ],
    tool_choice: { type: "function" as const, function: { name: tool.name } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") {
    throw new Error("OpenAI did not return structured tool output");
  }

  return {
    data: JSON.parse((toolCall as { function: { arguments: string } }).function.arguments) as T,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

async function callGeminiStructured<T>(
  model: string,
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number,
  tool: ToolSchema
): Promise<LLMStructuredResponse<T>> {
  const ai = new GoogleGenAI({ apiKey });

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      maxOutputTokens: maxTokens,
      tools: [
        {
          functionDeclarations: [
            {
              name: tool.name,
              description: tool.description,
              parameters: tool.schema,
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: [tool.name],
        },
      },
    },
  });

  const functionCalls = response.functionCalls;
  if (!functionCalls || functionCalls.length === 0) {
    throw new Error("Gemini did not return structured tool output");
  }

  const usage = response.usageMetadata;

  return {
    data: functionCalls[0].args as T,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}
