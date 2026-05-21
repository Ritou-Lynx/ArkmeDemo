import { readLLMConfigFromStorage } from "./config";
import { callReservedProviderRecognition } from "./adapters/notImplemented";
import { callOpenAICompatibleRecognition } from "./adapters/openaiCompatible";
import type { LLMConfig, RecognizeArrangementResult } from "./types";

export async function recognizeArrangementFromQuickNoteByAI(
  text: string
): Promise<RecognizeArrangementResult> {
  return recognizeArrangementFromQuickNoteByLLM(text, readLLMConfigFromStorage());
}

export async function recognizeArrangementFromQuickNoteByLLM(
  text: string,
  config: LLMConfig
): Promise<RecognizeArrangementResult> {
  if (config.useMockRecognition) {
    return {
      shouldCreate: false,
      confidence: "high",
      title: "",
      timeType: "none",
      date: null,
      timeText: null,
      person: null,
      location: null,
      note: null,
      target: "none",
      reason: "mock_recognition_enabled",
    };
  }

  switch (config.provider) {
    case "openai-compatible":
      return callOpenAICompatibleRecognition(text, config);
    case "anthropic":
    case "gemini":
    case "deepseek":
    case "qwen":
    case "custom":
      return callReservedProviderRecognition(config);
  }
}

