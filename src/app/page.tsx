"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { type ZodType } from "zod";
import { ResponsePanel } from "@/components/home/ResponsePanel";
import { Sidebar, type SidebarFilter } from "@/components/home/Sidebar";
import { WorkspacePanel } from "@/components/home/WorkspacePanel";
import {
  defaultFilenameForReviewLanguage,
  inferReviewLanguageFromFilename,
} from "@/components/home/config";
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
  apiErrorResponseSchema,
  generateRequestSchema,
  generateResponseSchema,
  reviewRequestSchema,
  reviewResponseSchema,
  type GenerateLanguage,
  type GenerateStyle,
  type ResponseLanguage,
} from "@/lib/schemas";

const INITIAL_THREAD_ID = "thread-initial";

type RunningRequestContext = {
  controller: AbortController;
  threadId: string;
  runId: string;
};

function createThreadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createThreadRun(mode: WorkspaceMode): ThreadRun {
  const now = Date.now();
  return {
    id: createRunId(),
    mode,
    status: "running",
    createdAt: now,
    updatedAt: now,
    result: null,
    errorMessage: null,
  };
}

function createDefaultThread(id: string): ThreadSnapshot {
  return {
    id,
    title: "새 스레드",
    mode: "review",
    pinned: false,
    updatedAt: Date.now(),
    responseLanguage: "ko",
    reviewCode: "",
    reviewLanguage: "typescript",
    reviewFilename: defaultFilenameForReviewLanguage("typescript"),
    reviewFiles: [],
    generatePrompt: "",
    generateLanguage: "typescript",
    generateStyle: "clean",
    runs: [],
    activeRunId: null,
  };
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

function safeLineCount(code: string): number {
  const normalized = code.replace(/\r\n/g, "\n");
  return normalized ? normalized.split("\n").length : 0;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) {
    return "방금 전";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}

function buildThreadTitle(thread: ThreadSnapshot, result: ApiResult): string {
  if (result.mode === "review") {
    if (result.input.fileCount > 1) {
      return `${result.input.filename} 외 ${result.input.fileCount - 1}개`;
    }
    return result.input.filename;
  }

  const prompt = thread.generatePrompt.trim();
  if (!prompt) {
    return "새 생성 스레드";
  }

  if (prompt.length > 28) {
    return `${prompt.slice(0, 28)}...`;
  }

  return prompt;
}

function normalizeStoredReviewFile(value: unknown): SelectedReviewFile | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const file = value as Partial<SelectedReviewFile>;
  if (
    typeof file.id !== "string" ||
    typeof file.filename !== "string" ||
    typeof file.language !== "string" ||
    typeof file.code !== "string"
  ) {
    return null;
  }

  return {
    id: file.id,
    filename: file.filename,
    language: file.language,
    code: file.code,
    lineCount:
      typeof file.lineCount === "number" && Number.isFinite(file.lineCount)
        ? file.lineCount
        : safeLineCount(file.code),
  };
}

function normalizeStoredResult(value: unknown): ApiResult | null {
  const parsedReview = reviewResponseSchema.safeParse(value);
  if (parsedReview.success) {
    return parsedReview.data;
  }

  const parsedGenerate = generateResponseSchema.safeParse(value);
  if (parsedGenerate.success) {
    return parsedGenerate.data;
  }

  return null;
}

function normalizeStoredRun(value: unknown): ThreadRun | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<ThreadRun>;
  if (typeof raw.id !== "string" || !raw.id) {
    return null;
  }

  const mode: WorkspaceMode = raw.mode === "generate" ? "generate" : "review";
  const statusList: ThreadRunStatus[] = [
    "running",
    "success",
    "failed",
    "cancelled",
  ];
  const status = statusList.includes(raw.status as ThreadRunStatus)
    ? (raw.status as ThreadRunStatus)
    : "failed";

  return {
    id: raw.id,
    mode,
    status,
    createdAt:
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Date.now(),
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : Date.now(),
    result: normalizeStoredResult(raw.result),
    errorMessage:
      typeof raw.errorMessage === "string" && raw.errorMessage.trim()
        ? raw.errorMessage
        : null,
  };
}

function normalizeStoredThread(value: unknown): ThreadSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<ThreadSnapshot> & { result?: unknown };
  if (typeof raw.id !== "string" || !raw.id) {
    return null;
  }

  const mode: WorkspaceMode = raw.mode === "generate" ? "generate" : "review";
  const reviewLanguage = GENERATE_LANGUAGES.includes(
    raw.reviewLanguage as GenerateLanguage
  )
    ? (raw.reviewLanguage as GenerateLanguage)
    : "typescript";
  const generateLanguage = GENERATE_LANGUAGES.includes(
    raw.generateLanguage as GenerateLanguage
  )
    ? (raw.generateLanguage as GenerateLanguage)
    : "typescript";
  const generateStyle = GENERATE_STYLES.includes(raw.generateStyle as GenerateStyle)
    ? (raw.generateStyle as GenerateStyle)
    : "clean";
  const responseLanguage = RESPONSE_LANGUAGES.includes(
    raw.responseLanguage as ResponseLanguage
  )
    ? (raw.responseLanguage as ResponseLanguage)
    : "ko";
  const legacyResult = normalizeStoredResult(raw.result);
  const normalizedRuns = Array.isArray(raw.runs)
    ? raw.runs
        .map((run) => normalizeStoredRun(run))
        .filter((run): run is ThreadRun => run !== null)
    : [];
  const legacyRuns: ThreadRun[] = legacyResult
    ? [
        {
          id: createRunId(),
          mode: legacyResult.mode,
          status: "success",
          createdAt:
            typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
              ? raw.updatedAt
              : Date.now(),
          updatedAt:
            typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
              ? raw.updatedAt
              : Date.now(),
          result: legacyResult,
          errorMessage: null,
        },
      ]
    : [];
  const runs: ThreadRun[] =
    normalizedRuns.length > 0 ? normalizedRuns : legacyRuns;

  return {
    id: raw.id,
    title:
      typeof raw.title === "string" && raw.title.trim().length > 0
        ? raw.title
        : "새 스레드",
    mode,
    pinned: raw.pinned === true,
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : Date.now(),
    responseLanguage,
    reviewCode: typeof raw.reviewCode === "string" ? raw.reviewCode : "",
    reviewLanguage,
    reviewFilename:
      typeof raw.reviewFilename === "string" && raw.reviewFilename.trim()
        ? raw.reviewFilename
        : defaultFilenameForReviewLanguage(reviewLanguage),
    reviewFiles: Array.isArray(raw.reviewFiles)
      ? raw.reviewFiles
          .map((file) => normalizeStoredReviewFile(file))
          .filter((file): file is SelectedReviewFile => file !== null)
      : [],
    generatePrompt:
      typeof raw.generatePrompt === "string" ? raw.generatePrompt : "",
    generateLanguage,
    generateStyle,
    runs,
    activeRunId:
      typeof raw.activeRunId === "string" &&
      runs.some((run) => run.id === raw.activeRunId)
        ? raw.activeRunId
        : runs[0]?.id ?? null,
  };
}

async function postJson<TResponse>(
  url: string,
  payload: unknown,
  responseSchema: ZodType<TResponse>,
  signal?: AbortSignal
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }

  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid API response");
  }

  return parsed.data;
}

export default function Home() {
  const [threads, setThreads] = useState<ThreadSnapshot[]>([
    createDefaultThread(INITIAL_THREAD_ID),
  ]);
  const [activeThreadId, setActiveThreadId] = useState<string>(INITIAL_THREAD_ID);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("all");
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const runningRequestRef = useRef<RunningRequestContext | null>(null);
  const dbSyncReadyRef = useRef(false);

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null;
  const activeRun = activeThread
    ? activeThread.runs.find((run) => run.id === activeThread.activeRunId) ??
      activeThread.runs[0] ??
      null
    : null;

  useEffect(() => {
    let ignore = false;

    async function loadThreads() {
      try {
        const response = await fetch("/api/threads", { cache: "no-store" });
        const data: unknown = await response.json();
        if (!response.ok) {
          throw new Error(extractErrorMessage(data));
        }

        const rawThreads =
          data &&
          typeof data === "object" &&
          Array.isArray((data as { threads?: unknown }).threads)
            ? (data as { threads: unknown[] }).threads
            : [];

        const normalizedThreads = rawThreads
          .map((thread) => normalizeStoredThread(thread))
          .filter((thread): thread is ThreadSnapshot => thread !== null);

        if (!ignore && normalizedThreads.length > 0) {
          setThreads(normalizedThreads);
          setActiveThreadId(normalizedThreads[0].id);
        }
      } catch {
        // Keep in-memory defaults when DB load fails
      } finally {
        if (!ignore) {
          dbSyncReadyRef.current = true;
        }
      }
    }

    void loadThreads();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!dbSyncReadyRef.current) {
      return;
    }

    if (threads.length === 0) {
      const fallbackThread = createDefaultThread(createThreadId());
      setThreads([fallbackThread]);
      setActiveThreadId(fallbackThread.id);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await fetch("/api/threads", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ threads }),
          });
        } catch {
          // Ignore background sync errors
        }
      })();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [threads]);

  function updateThreadById(
    threadId: string,
    updater: (thread: ThreadSnapshot) => ThreadSnapshot
  ) {
    setThreads((previousThreads) =>
      previousThreads.map((thread) =>
        thread.id === threadId
          ? {
              ...updater(thread),
              updatedAt: Date.now(),
            }
          : thread
      )
    );
  }

  function updateThreadRun(
    threadId: string,
    runId: string,
    updater: (run: ThreadRun) => ThreadRun
  ) {
    updateThreadById(threadId, (thread) => ({
      ...thread,
      runs: thread.runs.map((run) => (run.id === runId ? updater(run) : run)),
      activeRunId: runId,
    }));
  }

  function updateActiveThread(updater: (thread: ThreadSnapshot) => ThreadSnapshot) {
    if (!activeThread) {
      return;
    }
    updateThreadById(activeThread.id, updater);
  }

  function abortRunningRequest(showMessage: boolean) {
    const running = runningRequestRef.current;
    if (running) {
      running.controller.abort();
      runningRequestRef.current = null;

      updateThreadRun(running.threadId, running.runId, (run) =>
        run.status === "running"
          ? {
              ...run,
              status: "cancelled",
              updatedAt: Date.now(),
              errorMessage: "요청이 사용자에 의해 중지되었습니다.",
            }
          : run
      );
    }

    setIsSubmitting(false);
    if (showMessage) {
      setErrorMessage("요청을 중지했습니다.");
    }
  }

  function handleCancelRequest() {
    abortRunningRequest(true);
  }

  function handleNewThread() {
    abortRunningRequest(false);
    const newThread = createDefaultThread(createThreadId());
    setThreads((previousThreads) => [newThread, ...previousThreads]);
    setActiveThreadId(newThread.id);
    setErrorMessage(null);
    setCopiedKey(null);
  }

  function handleSelectThread(threadId: string) {
    if (threadId === activeThreadId) {
      return;
    }

    abortRunningRequest(false);
    setActiveThreadId(threadId);
    setErrorMessage(null);
    setCopiedKey(null);
  }

  function handleRenameThread(threadId: string) {
    const target = threads.find((thread) => thread.id === threadId);
    if (!target) {
      return;
    }

    const input = window.prompt("스레드 이름을 입력하세요.", target.title);
    const nextTitle = input?.trim();
    if (!nextTitle) {
      return;
    }

    updateThreadById(threadId, (thread) => ({
      ...thread,
      title: nextTitle,
    }));
  }

  function handleTogglePinThread(threadId: string) {
    updateThreadById(threadId, (thread) => ({
      ...thread,
      pinned: !thread.pinned,
    }));
  }

  function handleDeleteThread(threadId: string) {
    const target = threads.find((thread) => thread.id === threadId);
    if (!target) {
      return;
    }

    const confirmDelete = window.confirm(
      `스레드 "${target.title}"를 삭제할까요?\n삭제하면 실행 기록도 함께 사라집니다.`
    );
    if (!confirmDelete) {
      return;
    }

    if (activeThreadId === threadId) {
      abortRunningRequest(false);
    }

    const remainingThreads = threads.filter((thread) => thread.id !== threadId);
    if (remainingThreads.length === 0) {
      const fallbackThread = createDefaultThread(createThreadId());
      setThreads([fallbackThread]);
      setActiveThreadId(fallbackThread.id);
      setErrorMessage(null);
      setCopiedKey(null);
      return;
    }

    setThreads(remainingThreads);
    if (activeThreadId === threadId) {
      setActiveThreadId(remainingThreads[0].id);
      setErrorMessage(null);
      setCopiedKey(null);
    }
  }

  function handleSelectRun(runId: string) {
    updateActiveThread((thread) => {
      if (!thread.runs.some((run) => run.id === runId)) {
        return thread;
      }
      return {
        ...thread,
        activeRunId: runId,
      };
    });
  }

  async function handleReviewSubmit() {
    if (!activeThread) {
      return;
    }

    const hasInlineCode = activeThread.reviewCode.trim().length > 0;
    const filename =
      activeThread.reviewFilename.trim() ||
      defaultFilenameForReviewLanguage(activeThread.reviewLanguage);
    const parsedPayload = reviewRequestSchema.safeParse({
      code: hasInlineCode ? activeThread.reviewCode : undefined,
      filename: hasInlineCode ? filename : undefined,
      language: hasInlineCode ? activeThread.reviewLanguage : undefined,
      files:
        activeThread.reviewFiles.length > 0
          ? activeThread.reviewFiles.map((file) => ({
              filename: file.filename,
              language: file.language,
              code: file.code,
            }))
          : undefined,
      responseLanguage: activeThread.responseLanguage,
    });

    if (!parsedPayload.success) {
      const message =
        parsedPayload.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.";
      setErrorMessage(message);
      return;
    }

    abortRunningRequest(false);
    setIsSubmitting(true);
    setErrorMessage(null);

    const currentThreadId = activeThread.id;
    const run = createThreadRun("review");

    updateThreadById(currentThreadId, (thread) => ({
      ...thread,
      mode: "review",
      runs: [run, ...thread.runs],
      activeRunId: run.id,
    }));

    const controller = new AbortController();
    runningRequestRef.current = {
      controller,
      threadId: currentThreadId,
      runId: run.id,
    };

    try {
      const data = await postJson(
        "/api/review",
        parsedPayload.data,
        reviewResponseSchema,
        controller.signal
      );

      updateThreadById(currentThreadId, (thread) => ({
        ...thread,
        mode: "review",
        title: buildThreadTitle(thread, data),
        runs: thread.runs.map((entry) =>
          entry.id === run.id
            ? {
                ...entry,
                status: "success",
                updatedAt: Date.now(),
                result: data,
                errorMessage: null,
              }
            : entry
        ),
        activeRunId: run.id,
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      updateThreadRun(currentThreadId, run.id, (entry) => ({
        ...entry,
        status: "failed",
        updatedAt: Date.now(),
        errorMessage: message,
      }));
      setErrorMessage(message);
    } finally {
      if (
        runningRequestRef.current?.controller === controller &&
        runningRequestRef.current?.runId === run.id
      ) {
        runningRequestRef.current = null;
        setIsSubmitting(false);
      }
    }
  }

  async function handleGenerateSubmit() {
    if (!activeThread) {
      return;
    }

    const parsedPayload = generateRequestSchema.safeParse({
      prompt: activeThread.generatePrompt,
      language: activeThread.generateLanguage,
      style: activeThread.generateStyle,
      responseLanguage: activeThread.responseLanguage,
    });

    if (!parsedPayload.success) {
      const message =
        parsedPayload.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.";
      setErrorMessage(message);
      return;
    }

    abortRunningRequest(false);
    setIsSubmitting(true);
    setErrorMessage(null);

    const currentThreadId = activeThread.id;
    const run = createThreadRun("generate");

    updateThreadById(currentThreadId, (thread) => ({
      ...thread,
      mode: "generate",
      runs: [run, ...thread.runs],
      activeRunId: run.id,
    }));

    const controller = new AbortController();
    runningRequestRef.current = {
      controller,
      threadId: currentThreadId,
      runId: run.id,
    };

    try {
      const data = await postJson(
        "/api/generate",
        parsedPayload.data,
        generateResponseSchema,
        controller.signal
      );

      updateThreadById(currentThreadId, (thread) => ({
        ...thread,
        mode: "generate",
        title: buildThreadTitle(thread, data),
        runs: thread.runs.map((entry) =>
          entry.id === run.id
            ? {
                ...entry,
                status: "success",
                updatedAt: Date.now(),
                result: data,
                errorMessage: null,
              }
            : entry
        ),
        activeRunId: run.id,
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      updateThreadRun(currentThreadId, run.id, (entry) => ({
        ...entry,
        status: "failed",
        updatedAt: Date.now(),
        errorMessage: message,
      }));
      setErrorMessage(message);
    } finally {
      if (
        runningRequestRef.current?.controller === controller &&
        runningRequestRef.current?.runId === run.id
      ) {
        runningRequestRef.current = null;
        setIsSubmitting(false);
      }
    }
  }

  async function handleReviewFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    const loadedFiles = await Promise.all(
      files.map(async (file, index) => {
        const code = await file.text();
        const inferredLanguage = inferReviewLanguageFromFilename(file.name);
        return {
          id: `${file.name}-${file.lastModified}-${file.size}-${index}`,
          filename: file.name,
          language: inferredLanguage ?? "plaintext",
          code,
          lineCount: safeLineCount(code),
        };
      })
    );

    updateActiveThread((thread) => {
      const byFilename = new Map(
        thread.reviewFiles.map((file) => [file.filename.toLowerCase(), file])
      );
      for (const file of loadedFiles) {
        byFilename.set(file.filename.toLowerCase(), file);
      }

      return {
        ...thread,
        reviewFiles: Array.from(byFilename.values()),
      };
    });

    event.target.value = "";
  }

  function handleReviewFileRemove(fileId: string) {
    updateActiveThread((thread) => ({
      ...thread,
      reviewFiles: thread.reviewFiles.filter((file) => file.id !== fileId),
    }));
  }

  function handleReviewLanguageChange(nextLanguage: GenerateLanguage) {
    updateActiveThread((thread) => {
      const normalized = thread.reviewFilename.trim().toLowerCase();
      const isDefaultSnippet = normalized.startsWith("snippet.");
      return {
        ...thread,
        reviewLanguage: nextLanguage,
        reviewFilename:
          !normalized || isDefaultSnippet
            ? defaultFilenameForReviewLanguage(nextLanguage)
            : thread.reviewFilename,
      };
    });
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error("copy failed");
        }
      }

      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((previous) => (previous === key ? null : previous));
      }, 1500);
    } catch {
      setErrorMessage("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  }

  const normalizedSearchQuery = threadSearchQuery.trim().toLowerCase();
  const sidebarCategories = [
    {
      id: "all" as const,
      name: "전체",
      count: threads.length,
    },
    {
      id: "review" as const,
      name: "코드 리뷰",
      count: threads.filter((thread) => thread.mode === "review").length,
    },
    {
      id: "generate" as const,
      name: "문장 → 코드",
      count: threads.filter((thread) => thread.mode === "generate").length,
    },
    {
      id: "pinned" as const,
      name: "고정",
      count: threads.filter((thread) => thread.pinned).length,
    },
  ];

  const sidebarThreads = [...threads]
    .filter((thread) => {
      if (sidebarFilter === "review") {
        return thread.mode === "review";
      }
      if (sidebarFilter === "generate") {
        return thread.mode === "generate";
      }
      if (sidebarFilter === "pinned") {
        return thread.pinned;
      }
      return true;
    })
    .filter((thread) => {
      if (!normalizedSearchQuery) {
        return true;
      }
      return thread.title.toLowerCase().includes(normalizedSearchQuery);
    })
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt
    )
    .map((thread) => ({
      id: thread.id,
      title: thread.title,
      mode: thread.mode,
      pinned: thread.pinned,
      timeLabel: formatRelativeTime(thread.updatedAt),
      requestCount: thread.runs.length,
    }));

  if (!activeThread) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#e2e8f0_0%,#f8fafc_40%,#eef2ff_100%)] text-slate-900">
      <div className="flex h-full w-full flex-col md:flex-row">
        <Sidebar
          categories={sidebarCategories}
          threads={sidebarThreads}
          activeFilter={sidebarFilter}
          activeThreadId={activeThread.id}
          searchQuery={threadSearchQuery}
          onNewThread={handleNewThread}
          onFilterChange={setSidebarFilter}
          onSearchQueryChange={setThreadSearchQuery}
          onSelectThread={handleSelectThread}
          onRenameThread={handleRenameThread}
          onTogglePinThread={handleTogglePinThread}
          onDeleteThread={handleDeleteThread}
        />

        <main className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200/80 bg-white/75 px-4 py-5 md:border-t-0 md:border-l md:px-8 md:py-7">
          <div className="mx-auto flex w-full max-w-6xl flex-col">
            <WorkspacePanel
              mode={activeThread.mode}
              responseLanguage={activeThread.responseLanguage}
              isSubmitting={isSubmitting}
              onModeChange={(mode) =>
                updateActiveThread((thread) => ({
                  ...thread,
                  mode,
                }))
              }
              onResponseLanguageChange={(responseLanguage) =>
                updateActiveThread((thread) => ({
                  ...thread,
                  responseLanguage,
                }))
              }
              onCancelRequest={handleCancelRequest}
              reviewForm={{
                reviewCode: activeThread.reviewCode,
                reviewFilename: activeThread.reviewFilename,
                reviewLanguage: activeThread.reviewLanguage,
                reviewFiles: activeThread.reviewFiles.map((file) => ({
                  id: file.id,
                  filename: file.filename,
                  language: file.language,
                  lineCount: file.lineCount,
                })),
                isSubmitting,
                onReviewCodeChange: (reviewCode) =>
                  updateActiveThread((thread) => ({
                    ...thread,
                    reviewCode,
                  })),
                onReviewFilenameChange: (reviewFilename) =>
                  updateActiveThread((thread) => ({
                    ...thread,
                    reviewFilename,
                  })),
                onReviewLanguageChange: handleReviewLanguageChange,
                onReviewFilesChange: handleReviewFilesChange,
                onReviewFileRemove: handleReviewFileRemove,
                onSubmit: handleReviewSubmit,
              }}
              generateForm={{
                generatePrompt: activeThread.generatePrompt,
                generateLanguage: activeThread.generateLanguage,
                generateStyle: activeThread.generateStyle,
                isSubmitting,
                onGeneratePromptChange: (generatePrompt) =>
                  updateActiveThread((thread) => ({
                    ...thread,
                    generatePrompt,
                  })),
                onGenerateLanguageChange: (generateLanguage) =>
                  updateActiveThread((thread) => ({
                    ...thread,
                    generateLanguage,
                  })),
                onGenerateStyleChange: (generateStyle) =>
                  updateActiveThread((thread) => ({
                    ...thread,
                    generateStyle,
                  })),
                onSubmit: handleGenerateSubmit,
              }}
            />

            <ResponsePanel
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              runs={activeThread.runs}
              activeRunId={activeRun?.id ?? null}
              onSelectRun={handleSelectRun}
              copiedKey={copiedKey}
              onCopy={copyToClipboard}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
