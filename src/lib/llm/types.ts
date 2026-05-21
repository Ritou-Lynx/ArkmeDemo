export type LLMProvider =
  | "openai-compatible"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "custom";

export type LLMConfig = {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  useMockRecognition?: boolean;
};

export type RecognizeArrangementResult = {
  shouldCreate: boolean;
  confidence: "high" | "medium" | "low";
  title: string;
  timeType: "specific" | "vague" | "none";
  date: string | null;
  timeText: string | null;
  person: string | null;
  location: string | null;
  note: string | null;
  target: "timeline" | "later" | "none";
  reason: string;
};

export function createNoArrangementResult(reason: string): RecognizeArrangementResult {
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
    reason,
  };
}

