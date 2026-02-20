import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiErrorResponseSchema,
  reviewHealthResponseSchema,
  reviewRequestSchema,
  reviewResponseSchema,
} from "@/lib/schemas";

const MOCK_ISSUES = [
  {
    id: "issue-1",
    severity: "medium",
    title: "Extract repeated logic",
    message: "Consider extracting repeated blocks into a helper function.",
    line: 8,
  },
  {
    id: "issue-2",
    severity: "low",
    title: "Improve naming",
    message: "Use more explicit variable names for readability.",
    line: 3,
  },
] as const;

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
    message: "Review mock API is running",
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

  const responsePayload = reviewResponseSchema.parse({
    ok: true,
    mode: "review",
    input: {
      filename,
      language,
      lineCount,
    },
    summary:
      "Mock analysis completed. This response is a placeholder before OpenAI integration.",
    issues: MOCK_ISSUES,
    refactoredCode:
      "// mock refactored code\nfunction improveReadability(input: string) {\n  return input.trim();\n}",
    suggestedTests: [
      "returns expected output for a normal input",
      "handles empty input safely",
      "handles invalid input types if applicable",
    ],
  });

  return NextResponse.json(responsePayload);
}
