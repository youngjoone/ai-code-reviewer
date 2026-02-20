import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiErrorResponseSchema,
  generateHealthResponseSchema,
  generateLanguageSchema,
  generateRequestSchema,
  generateResponseSchema,
  generateStyleSchema,
  responseLanguageSchema,
} from "@/lib/schemas";
import { getLlmProvider } from "@/lib/llm";

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

export async function GET() {
  const payload = generateHealthResponseSchema.parse({
    ok: true,
    endpoint: "/api/generate",
    message: "Generate API is running",
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

  const parsedBody = generateRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return createErrorResponse(
      "Invalid request body",
      400,
      zodIssuesToStrings(parsedBody.error)
    );
  }

  const prompt = parsedBody.data.prompt;
  const language = parsedBody.data.language ?? generateLanguageSchema.enum.typescript;
  const style = parsedBody.data.style ?? generateStyleSchema.enum.clean;
  const responseLanguage =
    parsedBody.data.responseLanguage ?? responseLanguageSchema.enum.ko;

  try {
    const provider = getLlmProvider();
    const parsed = await provider.generate({
      prompt,
      language,
      style,
      responseLanguage,
    });

    const responsePayloadResult = generateResponseSchema.safeParse({
      ok: true,
      mode: "generate",
      input: {
        language,
        style,
        responseLanguage,
        promptLength: prompt.length,
      },
      summary: parsed.summary,
      code: parsed.code,
      notes: parsed.notes,
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
