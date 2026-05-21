import { createNoArrangementResult, type LLMConfig } from "../types";

export async function callReservedProviderRecognition(config: LLMConfig) {
  // TODO: Add real Anthropic Claude / Gemini / DeepSeek / Qwen / custom adapters here.
  console.warn(`[llm] Provider "${config.provider}" is reserved but not implemented in this MVP.`);
  return createNoArrangementResult("provider_not_implemented");
}

