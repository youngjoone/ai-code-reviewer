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
};

type GenerateInput = {
  prompt: string;
  language: GenerateLanguage;
  style: GenerateStyle;
  responseLanguage: ResponseLanguage;
};

export type LlmProvider = {
  name: LlmProviderName;
  model: string;
  review: (input: ReviewInput) => Promise<ReviewLlmOutput>;
  generate: (input: GenerateInput) => Promise<GenerateLlmOutput>;
};

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

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

async function geminiJsonRequest<T>(
  schema: z.ZodType<T>,
  prompt: string
): Promise<T> {
  const { apiKey, model } = getGeminiConfig();
  const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    const maybeError = (payload as { error?: { message?: unknown } }).error;
    if (maybeError && typeof maybeError.message === "string") {
      throw new Error(`Gemini API error: ${maybeError.message}`);
    }

    throw new Error(`Gemini API error: HTTP ${response.status}`);
  }

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
}

function createGeminiProvider(): LlmProvider {
  const { model } = getGeminiConfig();

  return {
    name: "gemini",
    model,
    review: async (input) =>
      geminiJsonRequest(reviewLlmOutputSchema, buildReviewPrompt(input)),
    generate: async (input) =>
      geminiJsonRequest(generateLlmOutputSchema, buildGeneratePrompt(input)),
  };
}

export function getLlmProvider(): LlmProvider {
  const provider = readLlmProvider();

  if (provider === "gemini") {
    return createGeminiProvider();
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}
