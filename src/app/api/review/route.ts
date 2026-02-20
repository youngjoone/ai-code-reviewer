import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiErrorResponseSchema,
  reviewHealthResponseSchema,
  reviewRequestSchema,
  reviewResponseSchema,
} from "@/lib/schemas";
import { getLlmProvider } from "@/lib/llm";

function zodIssuesToStrings(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    return `${path}: ${issue.message}`;
  });
}

function safeLineCount(code: string): number {
  const normalized = code.replace(/\r\n/g, "\n");
  return normalized ? normalized.split("\n").length : 0;
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
    const errorPayload = apiErrorResponseSchema.parse({
      ok: false,
      error: "Invalid JSON body",
    });

    return NextResponse.json(errorPayload, { status: 400 });
  }

  const parsedBody = reviewRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    const errorPayload = apiErrorResponseSchema.parse({
      ok: false,
      error: "Invalid request body",
      details: zodIssuesToStrings(parsedBody.error),
    });

    return NextResponse.json(errorPayload, { status: 400 });
  }

  const code = parsedBody.data.code;
  const language = parsedBody.data.language ?? "typescript";
  const filename = parsedBody.data.filename ?? "snippet.ts";
  const lineCount = safeLineCount(code);

  try {
    const provider = getLlmProvider();
    const parsed = await provider.review({ filename, language, code });

    const responsePayload = reviewResponseSchema.parse({
      ok: true,
      mode: "review",
      input: {
        filename,
        language,
        lineCount,
      },
      summary: parsed.summary,
      issues: parsed.issues,
      refactoredCode: parsed.refactoredCode,
      suggestedTests: parsed.suggestedTests,
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to call LLM API";
    const errorPayload = apiErrorResponseSchema.parse({
      ok: false,
      error: "LLM request failed",
      details: [message],
    });

    return NextResponse.json(errorPayload, { status: 502 });
  }
}
