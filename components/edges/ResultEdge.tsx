import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
} from "@xyflow/react";

export default function ResultEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: "#10b981",
        strokeWidth: 1.5,
        strokeDasharray: "4 3",
      }}
    />
  );
}
