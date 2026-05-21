import { createNoArrangementResult, type RecognizeArrangementResult } from "./types";

export function parseRecognizeArrangementResult(rawText: string): RecognizeArrangementResult {
  try {
    const jsonText = extractJsonObjectText(rawText);
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return normalizeRecognizeArrangementResult(parsed);
  } catch (error) {
    console.error("[llm] Failed to parse arrangement recognition JSON.", error, rawText);
    return createNoArrangementResult("json_parse_failed");
  }
}

function extractJsonObjectText(rawText: string) {
  const trimmed = rawText.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in LLM response.");
  }
  return candidate.slice(firstBrace, lastBrace + 1);
}

function normalizeRecognizeArrangementResult(value: Record<string, unknown>): RecognizeArrangementResult {
  const confidence = readEnum(value.confidence, ["high", "medium", "low"], "low");
  const timeType = readEnum(value.timeType, ["specific", "vague", "none"], "none");
  const target = readEnum(value.target, ["timeline", "later", "none"], "none");
  const shouldCreate = Boolean(value.shouldCreate) && target !== "none";
  const normalizedTarget = shouldCreate ? target : "none";

  return {
    shouldCreate,
    confidence,
    title: shouldCreate ? readString(value.title) : "",
    timeType,
    date: readDate(value.date),
    timeText: readNullableString(value.timeText),
    person: readNullableString(value.person),
    location: readNullableString(value.location),
    note: readNullableString(value.note),
    target: normalizedTarget,
    reason: readString(value.reason) || "模型返回了结构化识别结果",
  };
}

function readEnum<const T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T
) {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(value: unknown) {
  const text = readString(value);
  return text || null;
}

function readDate(value: unknown) {
  const text = readString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

