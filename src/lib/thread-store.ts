import {
  type ApiResult,
  type SelectedReviewFile,
  type ThreadRun,
  type ThreadRunStatus,
  type ThreadSnapshot,
  type WorkspaceMode,
} from "@/components/home/types";
import {
  GENERATE_LANGUAGES,
  GENERATE_STYLES,
  RESPONSE_LANGUAGES,
  generateResponseSchema,
  reviewResponseSchema,
  type GenerateLanguage,
  type GenerateStyle,
  type ResponseLanguage,
} from "@/lib/schemas";
import { getSqliteDb } from "@/lib/sqlite";

type ThreadRow = {
  id: string;
  title: string;
  mode: string;
  pinned: number;
  response_language: string;
  review_code: string;
  review_language: string;
  review_filename: string;
  review_files_json: string;
  generate_prompt: string;
  generate_language: string;
  generate_style: string;
  active_run_id: string | null;
  created_at: number;
  updated_at: number;
};

type RunRow = {
  id: string;
  thread_id: string;
  mode: string;
  status: string;
  result_json: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
};

const RUN_STATUSES: ThreadRunStatus[] = [
  "running",
  "success",
  "failed",
  "cancelled",
];

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseMode(value: string): WorkspaceMode {
  return value === "generate" ? "generate" : "review";
}

function parseRunStatus(value: string): ThreadRunStatus {
  if (RUN_STATUSES.includes(value as ThreadRunStatus)) {
    return value as ThreadRunStatus;
  }
  return "failed";
}

function parseResponseLanguage(value: string): ResponseLanguage {
  if (RESPONSE_LANGUAGES.includes(value as ResponseLanguage)) {
    return value as ResponseLanguage;
  }
  return "ko";
}

function parseGenerateLanguage(value: string): GenerateLanguage {
  if (GENERATE_LANGUAGES.includes(value as GenerateLanguage)) {
    return value as GenerateLanguage;
  }
  return "typescript";
}

function parseGenerateStyle(value: string): GenerateStyle {
  if (GENERATE_STYLES.includes(value as GenerateStyle)) {
    return value as GenerateStyle;
  }
  return "clean";
}

function parseRunResult(value: string | null): ApiResult | null {
  if (!value) {
    return null;
  }

  const raw = parseJson<unknown>(value, null);
  const parsedReview = reviewResponseSchema.safeParse(raw);
  if (parsedReview.success) {
    return parsedReview.data;
  }

  const parsedGenerate = generateResponseSchema.safeParse(raw);
  if (parsedGenerate.success) {
    return parsedGenerate.data;
  }

  return null;
}

function parseSelectedReviewFiles(value: string): SelectedReviewFile[] {
  const raw = parseJson<unknown>(value, []);
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const file = item as Partial<SelectedReviewFile>;
      if (
        typeof file.filename !== "string" ||
        typeof file.code !== "string" ||
        typeof file.language !== "string"
      ) {
        return null;
      }

      const lineCount =
        typeof file.lineCount === "number" && Number.isFinite(file.lineCount)
          ? file.lineCount
          : file.code.replace(/\r\n/g, "\n").split("\n").length;

      return {
        id:
          typeof file.id === "string" && file.id.trim().length > 0
            ? file.id
            : `${file.filename}-${index}`,
        filename: file.filename,
        language: file.language,
        code: file.code,
        lineCount,
      } satisfies SelectedReviewFile;
    })
    .filter((file): file is SelectedReviewFile => file !== null);
}

function rowToRun(row: RunRow): ThreadRun {
  return {
    id: row.id,
    mode: parseMode(row.mode),
    status: parseRunStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    result: parseRunResult(row.result_json),
    errorMessage: row.error_message,
  };
}

function rowToThread(row: ThreadRow, runs: ThreadRun[]): ThreadSnapshot {
  const resolvedRuns = [...runs].sort((a, b) => b.createdAt - a.createdAt);
  return {
    id: row.id,
    title: row.title,
    mode: parseMode(row.mode),
    pinned: row.pinned === 1,
    updatedAt: row.updated_at,
    responseLanguage: parseResponseLanguage(row.response_language),
    reviewCode: row.review_code,
    reviewLanguage: parseGenerateLanguage(row.review_language),
    reviewFilename: row.review_filename,
    reviewFiles: parseSelectedReviewFiles(row.review_files_json),
    generatePrompt: row.generate_prompt,
    generateLanguage: parseGenerateLanguage(row.generate_language),
    generateStyle: parseGenerateStyle(row.generate_style),
    runs: resolvedRuns,
    activeRunId:
      row.active_run_id && resolvedRuns.some((run) => run.id === row.active_run_id)
        ? row.active_run_id
        : resolvedRuns[0]?.id ?? null,
  };
}

export function listStoredThreads(): ThreadSnapshot[] {
  const db = getSqliteDb();
  const threadRows = db
    .prepare(
      `SELECT * FROM threads ORDER BY pinned DESC, updated_at DESC, created_at DESC`
    )
    .all() as ThreadRow[];
  const runRows = db
    .prepare(`SELECT * FROM runs ORDER BY created_at DESC`)
    .all() as RunRow[];

  const runsByThreadId = new Map<string, ThreadRun[]>();
  for (const runRow of runRows) {
    const run = rowToRun(runRow);
    const existing = runsByThreadId.get(runRow.thread_id);
    if (existing) {
      existing.push(run);
    } else {
      runsByThreadId.set(runRow.thread_id, [run]);
    }
  }

  return threadRows.map((threadRow) =>
    rowToThread(threadRow, runsByThreadId.get(threadRow.id) ?? [])
  );
}

export function getStoredThreadById(threadId: string): ThreadSnapshot | null {
  const db = getSqliteDb();
  const threadRow = db
    .prepare(`SELECT * FROM threads WHERE id = ?1 LIMIT 1`)
    .get(threadId) as ThreadRow | undefined;

  if (!threadRow) {
    return null;
  }

  const runRows = db
    .prepare(
      `SELECT * FROM runs WHERE thread_id = ?1 ORDER BY created_at DESC, updated_at DESC`
    )
    .all(threadId) as RunRow[];

  return rowToThread(
    threadRow,
    runRows.map((runRow) => rowToRun(runRow))
  );
}

export function replaceStoredThreads(threads: ThreadSnapshot[]) {
  const db = getSqliteDb();
  const now = Date.now();

  db.exec("BEGIN");

  try {
    db.exec("DELETE FROM runs");
    db.exec("DELETE FROM threads");

    const insertThread = db.prepare(`
      INSERT INTO threads (
        id,
        title,
        mode,
        pinned,
        response_language,
        review_code,
        review_language,
        review_filename,
        review_files_json,
        generate_prompt,
        generate_language,
        generate_style,
        active_run_id,
        created_at,
        updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15
      )
    `);

    const insertRun = db.prepare(`
      INSERT INTO runs (
        id,
        thread_id,
        mode,
        status,
        result_json,
        error_message,
        created_at,
        updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      )
    `);

    for (const thread of threads) {
      const createdAt =
        thread.runs.length > 0
          ? thread.runs[thread.runs.length - 1].createdAt
          : thread.updatedAt || now;

      insertThread.run(
        thread.id,
        thread.title,
        thread.mode,
        thread.pinned ? 1 : 0,
        thread.responseLanguage,
        thread.reviewCode,
        thread.reviewLanguage,
        thread.reviewFilename,
        JSON.stringify(thread.reviewFiles),
        thread.generatePrompt,
        thread.generateLanguage,
        thread.generateStyle,
        thread.activeRunId,
        createdAt,
        thread.updatedAt || now
      );

      for (const run of thread.runs) {
        insertRun.run(
          run.id,
          thread.id,
          run.mode,
          run.status,
          run.result ? JSON.stringify(run.result) : null,
          run.errorMessage,
          run.createdAt,
          run.updatedAt
        );
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
