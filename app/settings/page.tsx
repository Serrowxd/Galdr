"use client";

import { useState } from "react";
import {
  type AIProvider,
  loadGlobalAISettings,
  saveGlobalAISettings,
} from "@/lib/globalSettings";

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
    setSavedNotice("Saved. Loom report tab will auto-fill this provider and key.");
    setTimeout(() => setSavedNotice(""), 1800);
  };

  return (
    <section className="container page-block panel-stack">
      <div className="section-head">
        <h1 className="section-title">Settings</h1>
        <span className="muted">Global AI provider defaults</span>
      </div>

      <article className="section global-settings-panel">
        <p className="muted">
          Set your global provider and API key once. The Loom structured report tab will
          auto-fill these values.
        </p>

        <div className="global-settings-grid">
          <label className="global-settings-field">
            Provider
            <select
              className="select"
              value={provider}
              onChange={(event) => setProvider(event.target.value as AIProvider)}
              aria-label="Global AI provider"
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="global-settings-field">
            API Key
            <input
              className="input"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              aria-label="Global API key"
            />
          </label>
        </div>

        <div className="global-settings-actions">
          <button className="btn" type="button" onClick={handleSave}>
            Save global defaults
          </button>
          {savedNotice ? <span className="muted">{savedNotice}</span> : null}
        </div>
      </article>
    </section>
  );
}
