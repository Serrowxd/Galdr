export type AIProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "custom";

export type GlobalAISettings = {
  provider: AIProvider;
  apiKey: string;
};

export const DEFAULT_AI_SETTINGS: GlobalAISettings = {
  provider: "openai",
  apiKey: "",
};

const STORAGE_KEY = "galdr.global.ai-settings.v1";

export function loadGlobalAISettings(): GlobalAISettings {
  if (typeof window === "undefined") {
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_AI_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<GlobalAISettings>;
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_AI_SETTINGS;
    }

    const provider =
      parsed.provider && typeof parsed.provider === "string"
        ? (parsed.provider as AIProvider)
        : DEFAULT_AI_SETTINGS.provider;
    const apiKey =
      parsed.apiKey && typeof parsed.apiKey === "string" ? parsed.apiKey : "";

    return { provider, apiKey };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveGlobalAISettings(settings: GlobalAISettings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
