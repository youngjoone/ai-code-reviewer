import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiErrorResponseSchema,
  responseLanguageSchema,
  reviewHealthResponseSchema,
  reviewRequestSchema,
  reviewResponseSchema,
} from "@/lib/schemas";
import { getLlmProvider } from "@/lib/llm";

const REVIEW_MAX_FILES = 12;
const REVIEW_MAX_TOTAL_CHARS = 80_000;

type NormalizedReviewFile = {
  filename: string;
  language: string;
  code: string;
  lineCount: number;
};

function zodIssuesToStrings(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    return `${path}: ${issue.message}`;
  });
}

function createErrorResponse(
  error: string,
  status: number,
  details?: string[]
) {
  const errorPayload = apiErrorResponseSchema.parse({
    ok: false,
    error,
    details,
  });

  return NextResponse.json(errorPayload, { status });
}

function safeLineCount(code: string): number {
  const normalized = code.replace(/\r\n/g, "\n");
  return normalized ? normalized.split("\n").length : 0;
}

function extensionForLanguage(language: string): string | null {
  const normalized = language.trim().toLowerCase();
  if (normalized === "typescript" || normalized === "ts") {
    return "ts";
  }
  if (normalized === "javascript" || normalized === "js") {
    return "js";
  }
  if (normalized === "python" || normalized === "py") {
    return "py";
  }
  if (normalized === "java") {
    return "java";
  }
  if (normalized === "kotlin" || normalized === "kt") {
    return "kt";
  }
  return null;
}

function inferLanguageFromFilename(filename: string): string | null {
  const normalized = filename.trim().toLowerCase();
  if (normalized.endsWith(".ts") || normalized.endsWith(".tsx")) {
    return "typescript";
  }
  if (normalized.endsWith(".js") || normalized.endsWith(".jsx")) {
    return "javascript";
  }
  if (normalized.endsWith(".py")) {
    return "python";
  }
  if (normalized.endsWith(".java")) {
    return "java";
  }
  if (normalized.endsWith(".kt")) {
    return "kotlin";
  }
  return null;
}

function normalizeReviewFile(
  filename: string,
  code: string,
  preferredLanguage?: string
): NormalizedReviewFile {
  const normalizedFilename = filename.trim() || "snippet.txt";
  const normalizedLanguage =
    preferredLanguage?.trim() ||
    inferLanguageFromFilename(normalizedFilename) ||
    "plaintext";

  return {
    filename: normalizedFilename,
    language: normalizedLanguage,
    code,
    lineCount: safeLineCount(code),
  };
}

export async function GET() {
  const payload = reviewHealthResponseSchema.parse({
    ok: true,
    endpoint: "/api/review",
    message: "Review API is running",
    method: "POST",
  });

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }

  const parsedBody = reviewRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return createErrorResponse(
      "Invalid request body",
      400,
      zodIssuesToStrings(parsedBody.error)
    );
  }

  const uploadedFiles = (parsedBody.data.files ?? []).map((file) =>
    normalizeReviewFile(file.filename, file.code, file.language)
  );
  const inlineCode = parsedBody.data.code;
  let inlineFile: NormalizedReviewFile | null = null;
  if (inlineCode) {
    const requestedLanguage = parsedBody.data.language?.trim();
    const requestedFilename = parsedBody.data.filename?.trim();
    const fallbackExtension =
      requestedLanguage ? extensionForLanguage(requestedLanguage) : null;
    const filename =
      requestedFilename ||
      (fallbackExtension ? `snippet.${fallbackExtension}` : "snippet.txt");
    inlineFile = normalizeReviewFile(filename, inlineCode, requestedLanguage);
  }

  const allFiles = inlineFile ? [...uploadedFiles, inlineFile] : uploadedFiles;
  if (allFiles.length === 0) {
    return createErrorResponse("Invalid request body", 400, [
      "`code` or `files` is required",
    ]);
  }

  if (allFiles.length > REVIEW_MAX_FILES) {
    return createErrorResponse("Invalid request body", 400, [
      `Too many files. Maximum is ${REVIEW_MAX_FILES}.`,
    ]);
  }

  const totalChars = allFiles.reduce((sum, file) => sum + file.code.length, 0);
  if (totalChars > REVIEW_MAX_TOTAL_CHARS) {
    return createErrorResponse("Invalid request body", 400, [
      `Total code size is too large. Maximum is ${REVIEW_MAX_TOTAL_CHARS} characters.`,
    ]);
  }

  const primaryFile = inlineFile ?? allFiles[0];
  const totalLineCount = allFiles.reduce((sum, file) => sum + file.lineCount, 0);
  const responseLanguage =
    parsedBody.data.responseLanguage ?? responseLanguageSchema.enum.ko;

  try {
    const provider = getLlmProvider();
    const parsed = await provider.review({
      files: allFiles.map((file) => ({
        filename: file.filename,
        language: file.language,
        code: file.code,
      })),
      responseLanguage,
      signal: request.signal,
    });

    const responsePayloadResult = reviewResponseSchema.safeParse({
      ok: true,
      mode: "review",
      input: {
        filename: primaryFile.filename,
        language: primaryFile.language,
        responseLanguage,
        lineCount: primaryFile.lineCount,
        fileCount: allFiles.length,
        totalLineCount,
      },
      summary: parsed.summary,
      issues: parsed.issues,
      refactoredCode: parsed.refactoredCode,
      suggestedTests: parsed.suggestedTests,
    });

    if (!responsePayloadResult.success) {
      return createErrorResponse(
        "LLM output validation failed",
        502,
        zodIssuesToStrings(responsePayloadResult.error)
      );
    }

    return NextResponse.json(responsePayloadResult.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to call LLM API";
    return createErrorResponse("LLM request failed", 502, [message]);
  }
}
