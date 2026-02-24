import { NextResponse } from "next/server";
import { z } from "zod";
import { type ZodType } from "zod";
import {
  apiErrorResponseSchema,
  generateResponseSchema,
  reviewResponseSchema,
} from "@/lib/schemas";
import { listStoredThreads, replaceStoredThreads } from "@/lib/thread-store";

export const runtime = "nodejs";

const workspaceModeSchema = z.enum(["review", "generate"]);
const threadRunStatusSchema = z.enum([
  "running",
  "success",
  "failed",
  "cancelled",
]);

const reviewFileSchema = z.object({
  id: z.string().trim().min(1),
  filename: z.string().trim().min(1),
  language: z.string().trim().min(1),
  code: z.string(),
  lineCount: z.number().int().nonnegative(),
});

const runResultSchema = z.union([reviewResponseSchema, generateResponseSchema]);

const threadRunSchema = z.object({
  id: z.string().trim().min(1),
  mode: workspaceModeSchema,
  status: threadRunStatusSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  result: runResultSchema.nullable(),
  errorMessage: z.string().nullable(),
});

const threadSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  mode: workspaceModeSchema,
  pinned: z.boolean(),
  updatedAt: z.number().int().nonnegative(),
  responseLanguage: z.enum(["ko", "en"]),
  reviewCode: z.string(),
  reviewLanguage: z.enum([
    "typescript",
    "javascript",
    "python",
    "java",
    "kotlin",
  ]),
  reviewFilename: z.string().trim().min(1),
  reviewFiles: z.array(reviewFileSchema),
  generatePrompt: z.string(),
  generateLanguage: z.enum([
    "typescript",
    "javascript",
    "python",
    "java",
    "kotlin",
  ]),
  generateStyle: z.enum(["clean", "fast", "explain"]),
  runs: z.array(threadRunSchema),
  activeRunId: z.string().nullable(),
});

const threadListResponseSchema = z.object({
  ok: z.literal(true),
  threads: z.array(threadSchema),
});

const threadSyncRequestSchema = z.object({
  threads: z.array(threadSchema),
});

function createErrorResponse(error: string, status: number, details?: string[]) {
  const payload = apiErrorResponseSchema.parse({
    ok: false,
    error,
    details,
  });
  return NextResponse.json(payload, { status });
}

function extractErrorMessage(data: unknown): string {
  const parsedError = apiErrorResponseSchema.safeParse(data);
  if (!parsedError.success) {
    return "요청 처리에 실패했습니다.";
  }

  if (!parsedError.data.details || parsedError.data.details.length === 0) {
    return parsedError.data.error;
  }

  return `${parsedError.data.error}: ${parsedError.data.details.join(", ")}`;
}

function zodIssuesToStrings(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    return `${path}: ${issue.message}`;
  });
}

function parseSuccessResponse<T>(value: unknown, schema: ZodType<T>): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(extractErrorMessage(value));
  }
  return parsed.data;
}

export async function GET() {
  try {
    const payload = parseSuccessResponse(
      {
        ok: true,
        threads: listStoredThreads(),
      },
      threadListResponseSchema
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load threads";
    return createErrorResponse("Thread fetch failed", 500, [message]);
  }
}

export async function PUT(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", 400);
  }

  const parsedBody = threadSyncRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return createErrorResponse(
      "Invalid request body",
      400,
      zodIssuesToStrings(parsedBody.error)
    );
  }

  try {
    replaceStoredThreads(parsedBody.data.threads);
    const payload = parseSuccessResponse(
      {
        ok: true,
        threads: listStoredThreads(),
      },
      threadListResponseSchema
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save threads";
    return createErrorResponse("Thread sync failed", 500, [message]);
  }
}
