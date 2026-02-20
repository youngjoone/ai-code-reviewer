import { NextResponse } from "next/server";

type GenerateRequest = {
  prompt?: string;
  language?: "typescript" | "javascript" | "python";
  style?: "clean" | "fast" | "explain";
};

function buildMockCode(
  language: "typescript" | "javascript" | "python",
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

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/generate",
    message: "Generate mock API is running",
    method: "POST",
  });
}

export async function POST(request: Request) {
  let body: GenerateRequest;

  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body",
      },
      { status: 400 }
    );
  }

  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) {
    return NextResponse.json(
      {
        ok: false,
        error: "`prompt` is required",
      },
      { status: 400 }
    );
  }

  const language = body.language ?? "typescript";
  const style = body.style ?? "clean";

  return NextResponse.json({
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
}
