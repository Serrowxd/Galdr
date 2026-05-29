"use client";

import { useState } from "react";
import {
  type AIProvider,
  loadGlobalAISettings,
  saveGlobalAISettings,
} from "@/lib/globalSettings";
import { ProfileSettings } from "@/components/ProfileSettings";

const providerOptions: { value: AIProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom" },
];

export default function SettingsPage() {
  const initialSettings = loadGlobalAISettings();
  const [provider, setProvider] = useState<AIProvider>(initialSettings.provider);
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [savedNotice, setSavedNotice] = useState("");

  const handleSave = () => {
    saveGlobalAISettings({ provider, apiKey });
    setSavedNotice("Saved. The Loom report tab will auto-fill this provider and key.");
    setTimeout(() => setSavedNotice(""), 2200);
  };

  return (
    <>
      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 500 }}>Profile</h2>
          <ProfileSettings />
        </div>

        <div style={{ display: "grid", gap: 16, maxWidth: 640, marginTop: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 500 }}>AI defaults</h2>
          <article className="surface surface-padded stack-sm">
            <h2 style={{ fontSize: 14, fontWeight: 500 }}>AI provider</h2>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Choose your preferred LLM provider for quality checks performed in the
              Loom.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 8,
              }}
            >
              <label className="stack-sm" style={{ gap: 6 }}>
                <span className="label-tiny">Provider</span>
                <select
                  className="select"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AIProvider)}
                  aria-label="Global AI provider"
                >
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack-sm" style={{ gap: 6 }}>
                <span className="label-tiny">API key</span>
                <input
                  className="input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  aria-label="Global API key"
                />
              </label>
            </div>

            <div
              className="row"
              style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}
            >
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>
                Save defaults
              </button>
              {savedNotice ? <span className="muted">{savedNotice}</span> : null}
            </div>
          </article>
        </div>
      </div>

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
        </div>
      </footer>
    </>
  );
}
