import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiErrorResponseSchema,
  generateHealthResponseSchema,
  generateLanguageSchema,
  generateRequestSchema,
  generateResponseSchema,
  generateStyleSchema,
} from "@/lib/schemas";
import { getLlmProvider } from "@/lib/llm";

function zodIssuesToStrings(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    return `${path}: ${issue.message}`;
  });
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
    const errorPayload = apiErrorResponseSchema.parse({
      ok: false,
      error: "Invalid JSON body",
    });

    return NextResponse.json(errorPayload, { status: 400 });
  }

  const parsedBody = generateRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    const errorPayload = apiErrorResponseSchema.parse({
      ok: false,
      error: "Invalid request body",
      details: zodIssuesToStrings(parsedBody.error),
    });

    return NextResponse.json(errorPayload, { status: 400 });
  }

  const prompt = parsedBody.data.prompt;
  const language = parsedBody.data.language ?? generateLanguageSchema.enum.typescript;
  const style = parsedBody.data.style ?? generateStyleSchema.enum.clean;

  try {
    const provider = getLlmProvider();
    const parsed = await provider.generate({ prompt, language, style });

    const responsePayload = generateResponseSchema.parse({
      ok: true,
      mode: "generate",
      input: {
        language,
        style,
        promptLength: prompt.length,
      },
      summary: parsed.summary,
      code: parsed.code,
      notes: parsed.notes,
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
