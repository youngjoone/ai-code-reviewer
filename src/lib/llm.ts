import { z } from "zod";
import {
  generateLlmOutputSchema,
  reviewLlmOutputSchema,
  type GenerateLanguage,
  type GenerateLlmOutput,
  type GenerateStyle,
  type ResponseLanguage,
  type ReviewLlmOutput,
} from "@/lib/schemas";

type LlmProviderName = "gemini";

type ReviewInput = {
  filename: string;
  language: string;
  code: string;
  responseLanguage: ResponseLanguage;
  signal?: AbortSignal;
};

type GenerateInput = {
  prompt: string;
  language: GenerateLanguage;
  style: GenerateStyle;
  responseLanguage: ResponseLanguage;
  signal?: AbortSignal;
};

export type LlmProvider = {
  name: LlmProviderName;
  model: string;
  review: (input: ReviewInput) => Promise<ReviewLlmOutput>;
  generate: (input: GenerateInput) => Promise<GenerateLlmOutput>;
};

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";
const GEMINI_RETRY_DELAY_MS = 3_000;
const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_TIMEOUT_MS = 300_000;

class GeminiRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "GeminiRequestError";
    this.retryable = retryable;
  }
}

function readLlmProvider(): LlmProviderName {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (!provider || provider === "gemini") {
    return "gemini";
  }

  throw new Error(
    `Unsupported LLM_PROVIDER: ${provider}. Supported value is "gemini".`
  );
}

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = process.env.GEMINI_MODEL?.trim() || GEMINI_FALLBACK_MODEL;
  return { apiKey, model };
}

function responseLanguageInstruction(responseLanguage: ResponseLanguage): string {
  if (responseLanguage === "ko") {
    return "Write all natural-language fields in Korean.";
  }

  return "Write all natural-language fields in English.";
}

function buildReviewPrompt(input: ReviewInput): string {
  return [
    "You are a senior software engineer.",
    "Analyze the code and return ONLY valid JSON.",
    responseLanguageInstruction(input.responseLanguage),
    "JSON schema:",
    '{ "summary": "string", "issues": [{ "id": "string", "severity": "low|medium|high", "title": "string", "message": "string", "line": 1 }], "refactoredCode": "string", "suggestedTests": ["string"] }',
    "",
    `filename: ${input.filename}`,
    `language: ${input.language}`,
    "",
    "code:",
    input.code,
  ].join("\n");
}

function buildGeneratePrompt(input: GenerateInput): string {
  return [
    "You are a practical coding assistant.",
    "Generate production-quality code and return ONLY valid JSON.",
    responseLanguageInstruction(input.responseLanguage),
    "JSON schema:",
    '{ "summary": "string", "code": "string", "notes": ["string"] }',
    "",
    `language: ${input.language}`,
    `style: ${input.style}`,
    "",
    "requirement:",
    input.prompt,
  ].join("\n");
}

function getTextFromGeminiResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Gemini returned an invalid response payload");
  }

  const maybeError = (payload as { error?: { message?: unknown } }).error;
  if (maybeError && typeof maybeError.message === "string") {
    throw new Error(maybeError.message);
  }

  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Gemini returned no candidates");
  }

  const firstCandidate = candidates[0] as {
    content?: { parts?: Array<{ text?: unknown }> };
  };
  const parts = firstCandidate.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("Gemini returned empty content");
  }

  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini returned empty text output");
  }

  return text;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof GeminiRequestError) {
    return error.retryable;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  return false;
}

async function fetchGeminiPayload(
  url: string,
  prompt: string,
  requestSignal?: AbortSignal
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let detachAbortHandler: (() => void) | null = null;

  try {
    if (requestSignal?.aborted) {
      controller.abort(requestSignal.reason);
    } else if (requestSignal) {
      const onAbort = () => controller.abort(requestSignal.reason);
      requestSignal.addEventListener("abort", onAbort, { once: true });
      detachAbortHandler = () => {
        requestSignal.removeEventListener("abort", onAbort);
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const maybeError = (payload as { error?: { message?: unknown } } | null)
        ?.error;
      const message =
        maybeError && typeof maybeError.message === "string"
          ? maybeError.message
          : `HTTP ${response.status}`;
      const retryable = response.status === 429 || response.status >= 500;
      throw new GeminiRequestError(`Gemini API error: ${message}`, retryable);
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (requestSignal?.aborted) {
        throw new GeminiRequestError("LLM request was aborted by client", false);
      }
      throw new GeminiRequestError(
        `Gemini API timeout after ${Math.floor(GEMINI_TIMEOUT_MS / 1000)}s`,
        true
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    detachAbortHandler?.();
  }
}

async function geminiJsonRequest<T>(
  schema: z.ZodType<T>,
  prompt: string,
  requestSignal?: AbortSignal
): Promise<T> {
  const { apiKey, model } = getGeminiConfig();
  const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const payload = await fetchGeminiPayload(url, prompt, requestSignal);
      const text = getTextFromGeminiResponse(payload);

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new Error("Gemini returned non-JSON output");
      }

      const parsed = schema.safeParse(parsedJson);
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join(", ");
        throw new Error(`Gemini output schema mismatch: ${message}`);
      }

      return parsed.data;
    } catch (error) {
      const canRetry = isRetryableError(error);
      const hasMoreAttempts = attempt < GEMINI_MAX_ATTEMPTS;
      if (!canRetry || !hasMoreAttempts) {
        throw error;
      }

      await delay(GEMINI_RETRY_DELAY_MS);
    }
  }

  throw new Error("Gemini request failed after retries");
}

function createGeminiProvider(): LlmProvider {
  const { model } = getGeminiConfig();

  return {
    name: "gemini",
    model,
    review: async (input) =>
      geminiJsonRequest(reviewLlmOutputSchema, buildReviewPrompt(input), input.signal),
    generate: async (input) =>
      geminiJsonRequest(
        generateLlmOutputSchema,
        buildGeneratePrompt(input),
        input.signal
      ),
  };
}

export function getLlmProvider(): LlmProvider {
  const provider = readLlmProvider();

  if (provider === "gemini") {
    return createGeminiProvider();
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}
