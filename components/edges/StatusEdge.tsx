import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from "@xyflow/react";

export default function StatusEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const disabled = !!data?.disabled;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: disabled ? "#9ca3af" : "#111827",
          strokeWidth: disabled ? 1.5 : 2,
          strokeDasharray: disabled ? "6 4" : undefined,
        }}
      />
      {disabled && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold"
          >
            ✕
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
