"use client";

import { useState, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import { PlanningNodeData } from "@/types";
import { useGraphStore } from "@/store/graphStore";

interface PlanningNodeProps {
  id: string;
  data: PlanningNodeData;
}

export default function PlanningNode({ id, data }: PlanningNodeProps) {
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [editTitle, setEditTitle] = useState(data.title);
  const [editDescription, setEditDescription] = useState(data.description);
  const [editInput, setEditInput] = useState(data.input);
  const [editOutput, setEditOutput] = useState(data.output);

  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const addBranch = useGraphStore((s) => s.addBranch);
  const deleteNode = useGraphStore((s) => s.deleteNode);
  const addChatMessage = useGraphStore((s) => s.addChatMessage);
  const addTokenUsage = useGraphStore((s) => s.addTokenUsage);
  const provider = useGraphStore((s) => s.provider);
  const model = useGraphStore((s) => s.model);
  const apiKeys = useGraphStore((s) => s.apiKeys);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const mode = useGraphStore((s) => s.mode);

  const apiKey = apiKeys[provider];

  const isEditing = data.isEditing;
  const isExecuting = mode === "executing";

  const handleSave = useCallback(() => {
    updateNodeData(id, {
      title: editTitle,
      description: editDescription,
      input: editInput,
      output: editOutput,
      label: editTitle,
      isEditing: false,
    } as Partial<PlanningNodeData>);
  }, [id, editTitle, editDescription, editInput, editOutput, updateNodeData]);

  const handleEdit = useCallback(() => {
    setEditTitle(data.title);
    setEditDescription(data.description);
    setEditInput(data.input);
    setEditOutput(data.output);
    updateNodeData(id, { isEditing: true } as Partial<PlanningNodeData>);
  }, [id, data, updateNodeData]);

  const handleChat = useCallback(async () => {
    if (!chatInput.trim() || !apiKey) return;
    const message = chatInput.trim();
    setChatInput("");
    setIsChatting(true);

    addChatMessage(id, { role: "user", content: message });

    try {
      const { buildSerializedGraph } = await import("@/lib/serialize");
      const graph = buildSerializedGraph(nodes, edges);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          provider,
          model,
          graph,
          nodeId: id,
          message,
        }),
      });

      const json = await res.json();
      if (json.reply) {
        addChatMessage(id, { role: "assistant", content: json.reply });
      }
      if (json.usage) {
        addTokenUsage(json.usage.inputTokens + json.usage.outputTokens);
      }
    } catch {
      addChatMessage(id, {
        role: "assistant",
        content: "Failed to get a response. Please try again.",
      });
    } finally {
      setIsChatting(false);
    }
  }, [chatInput, apiKey, provider, model, id, nodes, edges, addChatMessage, addTokenUsage]);

  const lastAssistantMessage = [...data.chatMessages]
    .reverse()
    .find((m) => m.role === "assistant");

  return (
    <div className="bg-white border-2 border-blue-400 rounded-xl shadow-lg min-w-[300px] max-w-[360px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3 !h-3"
      />

      {/* Header */}
      <div className="bg-blue-500 text-white px-4 py-2.5 rounded-t-[10px] flex items-center justify-between">
        {isEditing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-bold w-full outline-none placeholder:text-blue-200"
            placeholder="Step title..."
            autoFocus
          />
        ) : (
          <span className="font-bold text-sm truncate">{data.title}</span>
        )}
        {isExecuting && (
          <div className="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {isEditing ? (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-400 outline-none text-gray-900"
                rows={3}
                placeholder="What should this step do?"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Input
              </label>
              <input
                value={editInput}
                onChange={(e) => setEditInput(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none text-gray-900"
                placeholder="What this step receives..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Output
              </label>
              <input
                value={editOutput}
                onChange={(e) => setEditOutput(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none text-gray-900"
                placeholder="What this step produces..."
              />
            </div>
            <button
              onClick={handleSave}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </>
        ) : (
          <>
            {data.description && (
              <p className="text-sm text-gray-700">{data.description}</p>
            )}
            {data.input && (
              <div className="text-xs">
                <span className="font-semibold text-gray-500">Input: </span>
                <span className="text-gray-600">{data.input}</span>
              </div>
            )}
            {data.output && (
              <div className="text-xs">
                <span className="font-semibold text-gray-500">Output: </span>
                <span className="text-gray-600">{data.output}</span>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => deleteNode(id)}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => addBranch(id)}
                className="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              >
                Branch
              </button>
            </div>

            {/* Chat */}
            <div className="border-t border-gray-100 pt-3 mt-2">
              {lastAssistantMessage && (
                <div className="bg-gray-50 rounded-lg p-3 mb-2 text-xs text-gray-700 max-h-32 overflow-y-auto">
                  {lastAssistantMessage.content}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleChat();
                    }
                  }}
                  placeholder="Ask Claude about this step..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 outline-none text-gray-900"
                  disabled={isChatting}
                />
                <button
                  onClick={handleChat}
                  disabled={isChatting || !chatInput.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isChatting ? "..." : "Ask"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3"
      />
    </div>
  );
}
