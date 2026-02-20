import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiErrorResponseSchema,
  generateHealthResponseSchema,
  generateLanguageSchema,
  generateRequestSchema,
  generateResponseSchema,
  generateStyleSchema,
  type GenerateLanguage,
} from "@/lib/schemas";

function buildMockCode(
  language: GenerateLanguage,
  prompt: string
): string {
  if (language === "python") {
    return [
      "# mock generated code",
      "# prompt:",
      `# ${prompt}`,
      "",
      "def solve(values):",
      "    return sorted(set(values))",
      "",
      "if __name__ == '__main__':",
      "    print(solve([3, 1, 2, 2]))",
    ].join("\n");
  }

  if (language === "javascript") {
    return [
      "// mock generated code",
      `// prompt: ${prompt}`,
      "",
      "function solve(values) {",
      "  return [...new Set(values)].sort((a, b) => a - b);",
      "}",
      "",
      "console.log(solve([3, 1, 2, 2]));",
    ].join("\n");
  }

  return [
    "// mock generated code",
    `// prompt: ${prompt}`,
    "",
    "export function solve(values: number[]): number[] {",
    "  return [...new Set(values)].sort((a, b) => a - b);",
    "}",
    "",
    "console.log(solve([3, 1, 2, 2]));",
  ].join("\n");
}

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
    message: "Generate mock API is running",
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

  const responsePayload = generateResponseSchema.parse({
    ok: true,
    mode: "generate",
    input: {
      language,
      style,
      promptLength: prompt.length,
    },
    summary:
      "Mock generation completed. This response is a placeholder before OpenAI integration.",
    code: buildMockCode(language, prompt),
    notes: [
      "This is deterministic mock output for frontend integration.",
      "Replace this with OpenAI API call in the next step.",
    ],
  });

  return NextResponse.json(responsePayload);
}
