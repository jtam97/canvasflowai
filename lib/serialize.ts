import { Node, Edge } from "@xyflow/react";
import { AppNodeData, SerializedGraph, DatasetSchema } from "@/types";

export function serializeGraph(
  nodes: Node<AppNodeData>[],
  edges: Edge[],
  schema: DatasetSchema
): string {
  const enabledEdges = edges.filter((e) => !e.data?.disabled);

  // Find dataset node
  const datasetNode = nodes.find((n) => (n.data as AppNodeData).type === "dataset");
  if (!datasetNode) return "";

  // BFS to get ordered planning nodes following enabled edges
  const orderedNodes: Node<AppNodeData>[] = [];
  const visited = new Set<string>();
  const queue = [datasetNode.id];
  visited.add(datasetNode.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = enabledEdges
      .filter((e) => e.source === currentId)
      .map((e) => e.target);

    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        const childNode = nodes.find((n) => n.id === childId);
        if (childNode && (childNode.data as AppNodeData).type === "planning") {
          orderedNodes.push(childNode);
        }
        queue.push(childId);
      }
    }
  }

  const columnsStr = schema.columns
    .map((c) => `${c.name} (${c.type})`)
    .join(", ");

  let prompt = `DATASET: ${schema.name} (${schema.rowCount} rows)\n`;
  prompt += `Columns: ${columnsStr}\n\n`;
  prompt += `ANALYSIS PLAN:\n`;
  prompt += `The following steps should be performed in order. Each step receives the results of the previous step as context.\n\n`;

  orderedNodes.forEach((node, i) => {
    const data = node.data as AppNodeData;
    if (data.type !== "planning") return;
    prompt += `[Step ${i + 1} — ${node.id}]\n`;
    prompt += `Title: ${data.title}\n`;
    prompt += `Description: ${data.description}\n`;
    prompt += `Input: ${data.input}\n`;
    prompt += `Output: ${data.output}\n\n`;
  });

  prompt += `For each step, provide a clearly labelled result block starting with:\nRESULT [node_id]:`;

  return prompt;
}

export function buildSerializedGraph(
  nodes: Node<AppNodeData>[],
  edges: Edge[]
): SerializedGraph {
  return {
    nodes: nodes
      .filter((n) => (n.data as AppNodeData).type !== "output")
      .map((n) => ({
        id: n.id,
        type: (n.data as AppNodeData).type,
        data: n.data as AppNodeData,
      })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      disabled: !!e.data?.disabled,
    })),
  };
}
