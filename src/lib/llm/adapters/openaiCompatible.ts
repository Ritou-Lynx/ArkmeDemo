import { isLLMConfigReady } from "../config";
import { parseRecognizeArrangementResult } from "../json";
import {
  buildArrangementRecognizerSystemPrompt,
  buildArrangementRecognizerUserPrompt,
} from "../prompt";
import { createNoArrangementResult, type LLMConfig } from "../types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

class OpenAICompatibleRequestError extends Error {
  constructor(
    readonly status: number,
    readonly responseText: string
  ) {
    super(`OpenAI-compatible request failed with ${status}: ${responseText}`);
  }
}

export async function callOpenAICompatibleRecognition(text: string, config: LLMConfig) {
  if (!isLLMConfigReady(config)) {
    return createNoArrangementResult("missing_llm_config");
  }

  try {
    return await requestChatCompletion(text, config, true);
  } catch (error) {
    console.error("[llm] JSON mode request failed, attempting fallback without JSON mode.", error);

    try {
      return await requestChatCompletion(text, config, false);
    } catch (fallbackError) {
      console.error("[llm] OpenAI-compatible recognition failed after fallback.", fallbackError);
      return createNoArrangementResult("api_request_failed");
    }
  }
}

async function requestChatCompletion(text: string, config: LLMConfig, useJsonMode: boolean) {
  const endpoint = buildChatCompletionsEndpoint(config.baseUrl ?? "");
  const body = {
    model: config.model,
    temperature: 0,
    messages: [
      { role: "system", content: buildArrangementRecognizerSystemPrompt() },
      { role: "user", content: buildArrangementRecognizerUserPrompt(text) },
    ],
    ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  const requestBody = JSON.stringify(body);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: requestBody,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new OpenAICompatibleRequestError(response.status, responseText);
  }

  const data = JSON.parse(responseText) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.error("[llm] OpenAI-compatible response did not include message content.", data);
    return createNoArrangementResult("empty_llm_response");
  }

  return parseRecognizeArrangementResult(content);
}

function buildChatCompletionsEndpoint(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  return `${normalizedBaseUrl}/chat/completions`;
}


