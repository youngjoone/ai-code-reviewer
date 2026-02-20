import { NextResponse } from "next/server";

type ReviewRequest = {
  code?: string;
  filename?: string;
  language?: string;
};

type ReviewIssue = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
  line: number;
};

const MOCK_ISSUES: ReviewIssue[] = [
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
];

function safeLineCount(code: string): number {
  const normalized = code.replace(/\r\n/g, "\n");
  return normalized ? normalized.split("\n").length : 0;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/review",
    message: "Review mock API is running",
    method: "POST",
  });
}

export async function POST(request: Request) {
  let body: ReviewRequest;

  try {
    body = (await request.json()) as ReviewRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body",
      },
      { status: 400 }
    );
  }

  const code = body.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json(
      {
        ok: false,
        error: "`code` is required",
      },
      { status: 400 }
    );
  }

  const language = body.language ?? "typescript";
  const filename = body.filename ?? "snippet.ts";
  const lineCount = safeLineCount(code);

  return NextResponse.json({
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
}
