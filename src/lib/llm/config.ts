import type { LLMConfig, LLMProvider } from "./types";

export const llmConfigStorageKey = "arkme-demo.llmConfig";

const defaultProvider: LLMProvider = "openai-compatible";

export function readLLMConfigFromStorage(): LLMConfig {
  const env = import.meta.env;
  const envConfig: LLMConfig = {
    provider: parseProvider(env.VITE_AI_PROVIDER) ?? defaultProvider,
    apiKey: env.VITE_AI_API_KEY || env.AI_API_KEY,
    baseUrl: env.VITE_AI_BASE_URL || env.AI_BASE_URL,
    model: env.VITE_AI_MODEL || env.AI_MODEL,
    useMockRecognition: parseBoolean(env.VITE_USE_MOCK_RECOGNITION),
  };

  if (typeof window === "undefined") return envConfig;

  try {
    const rawValue = window.localStorage.getItem(llmConfigStorageKey);
    if (!rawValue) return envConfig;
    const parsed = JSON.parse(rawValue) as Partial<LLMConfig>;
    return {
      provider: parseProvider(parsed.provider) ?? envConfig.provider,
      apiKey: normalizeOptionalString(parsed.apiKey) ?? envConfig.apiKey,
      baseUrl: normalizeOptionalString(parsed.baseUrl) ?? envConfig.baseUrl,
      model: normalizeOptionalString(parsed.model) ?? envConfig.model,
      useMockRecognition:
        typeof parsed.useMockRecognition === "boolean"
          ? parsed.useMockRecognition
          : envConfig.useMockRecognition,
    };
  } catch (error) {
    console.error("[llm] Failed to read LLM config from localStorage.", error);
    return envConfig;
  }
}

export function writeLLMConfigToStorage(config: LLMConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(llmConfigStorageKey, JSON.stringify(config));
}

export function isLLMConfigReady(config: LLMConfig) {
  return Boolean(
    config.apiKey?.trim() &&
      config.baseUrl?.trim() &&
      config.model?.trim()
  );
}

function parseProvider(value: unknown): LLMProvider | null {
  if (
    value === "openai-compatible" ||
    value === "anthropic" ||
    value === "gemini" ||
    value === "deepseek" ||
    value === "qwen" ||
    value === "custom"
  ) {
    return value;
  }
  return null;
}

function parseBoolean(value: unknown) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

