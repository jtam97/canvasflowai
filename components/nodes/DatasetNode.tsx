"use client";

import { Handle, Position } from "@xyflow/react";
import { DatasetNodeData } from "@/types";

interface DatasetNodeProps {
  data: DatasetNodeData;
}

export default function DatasetNode({ data }: DatasetNodeProps) {
  const { schema } = data;

  return (
    <div className="bg-white border-2 border-emerald-500 rounded-xl shadow-lg min-w-[280px]">
      <div className="bg-emerald-500 text-white px-4 py-2.5 rounded-t-[10px]">
        <div className="font-bold text-sm">{schema.name}</div>
        <div className="text-emerald-100 text-xs">{schema.rowCount} rows</div>
      </div>
      <div className="p-4">
        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Columns
        </div>
        <div className="space-y-1">
          {schema.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-800 font-mono">{col.name}</span>
              <span className="text-gray-400 text-xs">{col.type}</span>
            </div>
          ))}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !w-3 !h-3"
      />
    </div>
  );
}
