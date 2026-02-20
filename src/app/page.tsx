"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { type ZodType } from "zod";
import { ResponsePanel } from "@/components/home/ResponsePanel";
import { Sidebar } from "@/components/home/Sidebar";
import { WorkspacePanel } from "@/components/home/WorkspacePanel";
import {
  defaultFilenameForReviewLanguage,
  inferReviewLanguageFromFilename,
} from "@/components/home/config";
import { type ApiResult, type WorkspaceMode } from "@/components/home/types";
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

const THREAD_STORAGE_KEY = "reviewpilot_threads_v1";
const ACTIVE_THREAD_STORAGE_KEY = "reviewpilot_active_thread_v1";
const INITIAL_THREAD_ID = "thread-initial";

type SelectedReviewFile = {
  id: string;
  filename: string;
  language: string;
  code: string;
  lineCount: number;
};

type ThreadSnapshot = {
  id: string;
  title: string;
  mode: WorkspaceMode;
  updatedAt: number;
  responseLanguage: ResponseLanguage;
  reviewCode: string;
  reviewLanguage: GenerateLanguage;
  reviewFilename: string;
  reviewFiles: SelectedReviewFile[];
  generatePrompt: string;
  generateLanguage: GenerateLanguage;
  generateStyle: GenerateStyle;
  result: ApiResult | null;
};

function createThreadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultThread(id: string): ThreadSnapshot {
  return {
    id,
    title: "새 스레드",
    mode: "review",
    updatedAt: Date.now(),
    responseLanguage: "ko",
    reviewCode: "",
    reviewLanguage: "typescript",
    reviewFilename: defaultFilenameForReviewLanguage("typescript"),
    reviewFiles: [],
    generatePrompt: "",
    generateLanguage: "typescript",
    generateStyle: "clean",
    result: null,
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

function normalizeStoredThread(value: unknown): ThreadSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<ThreadSnapshot>;
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

  return {
    id: raw.id,
    title:
      typeof raw.title === "string" && raw.title.trim().length > 0
        ? raw.title
        : "새 스레드",
    mode,
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
    result:
      raw.result && typeof raw.result === "object"
        ? (raw.result as ApiResult)
        : null,
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
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const storageReadyRef = useRef(false);

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null;

  useEffect(() => {
    try {
      const storedThreadsRaw = localStorage.getItem(THREAD_STORAGE_KEY);
      const storedActiveThreadId = localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
      if (!storedThreadsRaw) {
        storageReadyRef.current = true;
        return;
      }

      const parsed = JSON.parse(storedThreadsRaw) as unknown;
      if (!Array.isArray(parsed)) {
        storageReadyRef.current = true;
        return;
      }

      const normalizedThreads = parsed
        .map((thread) => normalizeStoredThread(thread))
        .filter((thread): thread is ThreadSnapshot => thread !== null);

      if (normalizedThreads.length === 0) {
        storageReadyRef.current = true;
        return;
      }

      setThreads(normalizedThreads);
      if (
        storedActiveThreadId &&
        normalizedThreads.some((thread) => thread.id === storedActiveThreadId)
      ) {
        setActiveThreadId(storedActiveThreadId);
      } else {
        setActiveThreadId(normalizedThreads[0].id);
      }
    } catch {
      // Ignore storage parse errors and use defaults
    } finally {
      storageReadyRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!storageReadyRef.current) {
      return;
    }

    if (threads.length === 0) {
      const fallbackThread = createDefaultThread(createThreadId());
      setThreads([fallbackThread]);
      setActiveThreadId(fallbackThread.id);
      return;
    }

    try {
      localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threads));
      localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, activeThreadId);
    } catch {
      // Ignore localStorage write errors
    }
  }, [threads, activeThreadId]);

  function abortRunningRequest(showMessage: boolean) {
    if (requestAbortControllerRef.current) {
      requestAbortControllerRef.current.abort();
      requestAbortControllerRef.current = null;
    }
    setIsSubmitting(false);
    if (showMessage) {
      setErrorMessage("요청을 중지했습니다.");
    }
  }

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

  function updateActiveThread(updater: (thread: ThreadSnapshot) => ThreadSnapshot) {
    if (!activeThread) {
      return;
    }
    updateThreadById(activeThread.id, updater);
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

  async function handleReviewSubmit() {
    if (!activeThread) {
      return;
    }

    abortRunningRequest(false);
    setIsSubmitting(true);
    setErrorMessage(null);

    const controller = new AbortController();
    requestAbortControllerRef.current = controller;
    const currentThreadId = activeThread.id;

    try {
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
        throw new Error(message);
      }

      const data = await postJson(
        "/api/review",
        parsedPayload.data,
        reviewResponseSchema,
        controller.signal
      );

      updateThreadById(currentThreadId, (thread) => ({
        ...thread,
        mode: "review",
        result: data,
        title: buildThreadTitle(thread, data),
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      if (requestAbortControllerRef.current === controller) {
        requestAbortControllerRef.current = null;
        setIsSubmitting(false);
      }
    }
  }

  async function handleGenerateSubmit() {
    if (!activeThread) {
      return;
    }

    abortRunningRequest(false);
    setIsSubmitting(true);
    setErrorMessage(null);

    const controller = new AbortController();
    requestAbortControllerRef.current = controller;
    const currentThreadId = activeThread.id;

    try {
      const parsedPayload = generateRequestSchema.safeParse({
        prompt: activeThread.generatePrompt,
        language: activeThread.generateLanguage,
        style: activeThread.generateStyle,
        responseLanguage: activeThread.responseLanguage,
      });

      if (!parsedPayload.success) {
        const message =
          parsedPayload.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.";
        throw new Error(message);
      }

      const data = await postJson(
        "/api/generate",
        parsedPayload.data,
        generateResponseSchema,
        controller.signal
      );

      updateThreadById(currentThreadId, (thread) => ({
        ...thread,
        mode: "generate",
        result: data,
        title: buildThreadTitle(thread, data),
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      if (requestAbortControllerRef.current === controller) {
        requestAbortControllerRef.current = null;
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

  const sidebarCategories = [
    {
      name: "코드 리뷰",
      count: threads.filter((thread) => thread.mode === "review").length,
    },
    {
      name: "문장 → 코드",
      count: threads.filter((thread) => thread.mode === "generate").length,
    },
    {
      name: "전체",
      count: threads.length,
    },
  ];

  const sidebarThreads = [...threads]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((thread) => ({
      id: thread.id,
      title: thread.title,
      mode: thread.mode,
      timeLabel: formatRelativeTime(thread.updatedAt),
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
          activeThreadId={activeThread.id}
          onNewThread={handleNewThread}
          onSelectThread={handleSelectThread}
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
              result={activeThread.result}
              copiedKey={copiedKey}
              onCopy={copyToClipboard}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
