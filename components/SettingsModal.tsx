"use client";

import { useState } from "react";
import { useGraphStore } from "@/store/graphStore";
import { LLMProvider, PROVIDER_MODELS } from "@/types";

type Tab = "providers" | "general";

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
};

const PROVIDER_PLACEHOLDERS: Record<LLMProvider, string> = {
  anthropic: "sk-ant-...",
  openai: "sk-...",
  gemini: "AIza...",
};

export default function SettingsModal() {
  const {
    provider,
    model,
    apiKeys,
    settings,
    showSettings,
    setShowSettings,
    setProvider,
    setModel,
    setApiKeyForProvider,
    setSettings,
  } = useGraphStore();

  const [tab, setTab] = useState<Tab>("providers");
  const [localKeys, setLocalKeys] = useState({ ...apiKeys });
  const [localSettings, setLocalSettings] = useState({ ...settings });

  if (!showSettings) return null;

  const hasActiveKey = !!apiKeys[provider];

  const handleSave = () => {
    // Save all keys
    for (const p of ["anthropic", "openai", "gemini"] as LLMProvider[]) {
      if (localKeys[p] !== apiKeys[p]) {
        setApiKeyForProvider(p, localKeys[p]);
      }
    }
    // Save settings
    setSettings(localSettings);
    setShowSettings(false);
  };

  const handleProviderSelect = (p: LLMProvider) => {
    setProvider(p);
    // Auto-select first model for the provider
    const models = PROVIDER_MODELS[p];
    if (models.length > 0) {
      setModel(models[0].id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Settings</h2>
          {hasActiveKey && (
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab("providers")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === "providers"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            LLM Providers
          </button>
          <button
            onClick={() => setTab("general")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === "general"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Basic Settings
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {tab === "providers" && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">
                Select a provider and model, then enter your API key. Keys are stored locally in your browser.
              </p>

              {/* Provider selection */}
              <div className="grid grid-cols-3 gap-2">
                {(["anthropic", "openai", "gemini"] as LLMProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleProviderSelect(p)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      provider === p
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {PROVIDER_LABELS[p]}
                    {localKeys[p] && (
                      <span className="block text-xs mt-0.5 text-green-600">Key set</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Model selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {PROVIDER_MODELS[provider].map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {PROVIDER_LABELS[provider]} API Key
                </label>
                <input
                  type="password"
                  value={localKeys[provider]}
                  onChange={(e) =>
                    setLocalKeys({ ...localKeys, [provider]: e.target.value })
                  }
                  placeholder={PROVIDER_PLACEHOLDERS[provider]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Your key is stored in your browser and never sent to our servers.
                </p>
              </div>
            </div>
          )}

          {tab === "general" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Max Tokens Per Request
                </label>
                <input
                  type="number"
                  value={localSettings.maxTokens}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, maxTokens: parseInt(e.target.value) || 4096 })
                  }
                  min={256}
                  max={32768}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Maximum tokens the model can generate per request (256-32,768).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Max Context Window (tokens)
                </label>
                <input
                  type="number"
                  value={localSettings.maxContextTokens}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, maxContextTokens: parseInt(e.target.value) || 128000 })
                  }
                  min={4000}
                  step={1000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Context limit shown in the token usage bar (e.g., 128000 for 128k).
                </p>
              </div>

              <hr className="border-gray-200" />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Max Upload File Size (MB)
                </label>
                <input
                  type="number"
                  value={localSettings.maxFileSizeMB}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, maxFileSizeMB: parseInt(e.target.value) || 10 })
                  }
                  min={1}
                  max={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Max Upload File Rows
                </label>
                <input
                  type="number"
                  value={localSettings.maxFileRows}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, maxFileRows: parseInt(e.target.value) || 10000 })
                  }
                  min={100}
                  max={100000}
                  step={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Limits for CSV/Excel file uploads.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          {hasActiveKey && (
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!localKeys[provider].trim()}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
