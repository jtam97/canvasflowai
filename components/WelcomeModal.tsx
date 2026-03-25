"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY_WELCOME_SHOWN = "adaviz_welcome_shown";

export default function WelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shown = localStorage.getItem(STORAGE_KEY_WELCOME_SHOWN);
    if (!shown) {
      setShow(true);
    }
  }, []);

  const handleClose = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY_WELCOME_SHOWN, "true");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
          <h2 className="text-xl font-bold text-white">
            Welcome to CanvasFlowAI
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            Plan, refine, and execute data analysis visually with AI.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 text-sm text-gray-700">
          <p>
            This is a visual canvas where you describe what you want to learn
            from a dataset using natural language. An LLM helps you plan your
            analysis as a graph of steps, then executes it all at once.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <span className="font-semibold text-gray-900">Plan</span> — Ask
                a question about your dataset. The LLM generates analysis steps
                as nodes on the canvas.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <span className="font-semibold text-gray-900">Refine</span> —
                Edit nodes, branch new paths, connect or disconnect steps, and
                chat with the LLM per-node.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <span className="font-semibold text-gray-900">Run</span> — Hit
                Run and the full graph is sent for execution. Results appear
                next to each node.
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="font-semibold text-gray-900">Execution Modes</p>
            <ul className="space-y-1 text-gray-600">
              <li>
                <span className="font-medium text-blue-700">Calculate</span> —
                The LLM computes statistics and results directly from your data.
              </li>
              <li>
                <span className="font-medium text-purple-700">Plan</span> —
                Generates a detailed implementation plan you can paste into an
                IDE agent (Claude Code, Cursor, etc.).
              </li>
            </ul>
          </div>

          <p className="text-gray-900 font-medium">
            To get started, add your API key.
          </p>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs">
            <span className="font-semibold">Privacy:</span> Your API keys are
            stored locally in your browser ONLY. They are never sent to or
            stored on any server — they are only used to make direct API calls
            to your chosen LLM provider.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleClose}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
