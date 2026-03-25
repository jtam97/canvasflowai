"use client";

import { Handle, Position } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { OutputNodeData } from "@/types";

interface OutputNodeProps {
  data: OutputNodeData;
}

export default function OutputNode({ data }: OutputNodeProps) {
  return (
    <div className="bg-white border-2 border-amber-400 rounded-xl shadow-lg min-w-[300px] max-w-[400px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-500 !w-3 !h-3"
      />

      <div className="bg-amber-500 text-white px-4 py-2.5 rounded-t-[10px]">
        <span className="font-bold text-sm">Result</span>
      </div>

      <div className="p-4 prose prose-sm max-w-none max-h-[400px] overflow-y-auto text-gray-800">
        <ReactMarkdown>{data.content}</ReactMarkdown>
      </div>
    </div>
  );
}
