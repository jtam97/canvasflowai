"use client";

import dynamic from "next/dynamic";
import { ReactFlowProvider } from "@xyflow/react";

const Canvas = dynamic(() => import("@/components/Canvas"), { ssr: false });

export default function Home() {
  return (
    <main className="w-screen h-screen">
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </main>
  );
}
