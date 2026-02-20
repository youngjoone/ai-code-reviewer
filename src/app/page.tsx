"use client";

import { useRef, useState, type ChangeEvent } from "react";
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
  apiErrorResponseSchema,
  generateRequestSchema,
  generateResponseSchema,
  reviewRequestSchema,
  reviewResponseSchema,
  type GenerateLanguage,
  type GenerateStyle,
  type ResponseLanguage,
} from "@/lib/schemas";

type SelectedReviewFile = {
  id: string;
  filename: string;
  language: string;
  code: string;
  lineCount: number;
};

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
  const [mode, setMode] = useState<WorkspaceMode>("review");
  const [reviewCode, setReviewCode] = useState("");
  const [reviewLanguage, setReviewLanguage] =
    useState<GenerateLanguage>("typescript");
  const [reviewFilename, setReviewFilename] = useState(
    defaultFilenameForReviewLanguage("typescript")
  );
  const [reviewFiles, setReviewFiles] = useState<SelectedReviewFile[]>([]);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generateLanguage, setGenerateLanguage] =
    useState<GenerateLanguage>("typescript");
  const [generateStyle, setGenerateStyle] = useState<GenerateStyle>("clean");
  const [responseLanguage, setResponseLanguage] =
    useState<ResponseLanguage>("ko");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const requestAbortControllerRef = useRef<AbortController | null>(null);

  function handleCancelRequest() {
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;
    setIsSubmitting(false);
    setErrorMessage("요청을 중지했습니다.");
  }

  async function handleReviewSubmit() {
    setIsSubmitting(true);
    setErrorMessage(null);
    requestAbortControllerRef.current?.abort();
    const controller = new AbortController();
    requestAbortControllerRef.current = controller;

    try {
      const hasInlineCode = reviewCode.trim().length > 0;
      const filename =
        reviewFilename.trim() || defaultFilenameForReviewLanguage(reviewLanguage);
      const parsedPayload = reviewRequestSchema.safeParse({
        code: hasInlineCode ? reviewCode : undefined,
        filename: hasInlineCode ? filename : undefined,
        language: hasInlineCode ? reviewLanguage : undefined,
        files:
          reviewFiles.length > 0
            ? reviewFiles.map((file) => ({
                filename: file.filename,
                language: file.language,
                code: file.code,
              }))
            : undefined,
        responseLanguage,
      });

      if (!parsedPayload.success) {
        const message =
          parsedPayload.error.issues[0]?.message ??
          "입력값이 올바르지 않습니다.";
        throw new Error(message);
      }

      const data = await postJson(
        "/api/review",
        parsedPayload.data,
        reviewResponseSchema,
        controller.signal
      );
      setResult(data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setErrorMessage("요청이 중지되었습니다.");
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
    setIsSubmitting(true);
    setErrorMessage(null);
    requestAbortControllerRef.current?.abort();
    const controller = new AbortController();
    requestAbortControllerRef.current = controller;

    try {
      const parsedPayload = generateRequestSchema.safeParse({
        prompt: generatePrompt,
        language: generateLanguage,
        style: generateStyle,
        responseLanguage,
      });

      if (!parsedPayload.success) {
        const message =
          parsedPayload.error.issues[0]?.message ??
          "입력값이 올바르지 않습니다.";
        throw new Error(message);
      }

      const data = await postJson(
        "/api/generate",
        parsedPayload.data,
        generateResponseSchema,
        controller.signal
      );
      setResult(data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setErrorMessage("요청이 중지되었습니다.");
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

    setReviewFiles((prevFiles) => {
      const byFilename = new Map(
        prevFiles.map((file) => [file.filename.toLowerCase(), file])
      );
      for (const file of loadedFiles) {
        byFilename.set(file.filename.toLowerCase(), file);
      }
      return Array.from(byFilename.values());
    });

    event.target.value = "";
  }

  function handleReviewFileRemove(fileId: string) {
    setReviewFiles((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
  }

  function handleReviewLanguageChange(nextLanguage: GenerateLanguage) {
    setReviewLanguage(nextLanguage);
    setReviewFilename((prevFilename) => {
      const normalized = prevFilename.trim().toLowerCase();
      const isDefaultSnippet = normalized.startsWith("snippet.");
      if (!normalized || isDefaultSnippet) {
        return defaultFilenameForReviewLanguage(nextLanguage);
      }
      return prevFilename;
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
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1500);
    } catch {
      setErrorMessage("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#e2e8f0_0%,#f8fafc_40%,#eef2ff_100%)] text-slate-900">
      <div className="flex h-full w-full flex-col md:flex-row">
        <Sidebar />

        <main className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200/80 bg-white/75 px-4 py-5 md:border-t-0 md:border-l md:px-8 md:py-7">
          <div className="mx-auto flex w-full max-w-6xl flex-col">
            <WorkspacePanel
              mode={mode}
              responseLanguage={responseLanguage}
              isSubmitting={isSubmitting}
              onModeChange={setMode}
              onResponseLanguageChange={setResponseLanguage}
              onCancelRequest={handleCancelRequest}
              reviewForm={{
                reviewCode,
                reviewFilename,
                reviewLanguage,
                reviewFiles: reviewFiles.map((file) => ({
                  id: file.id,
                  filename: file.filename,
                  language: file.language,
                  lineCount: file.lineCount,
                })),
                isSubmitting,
                onReviewCodeChange: setReviewCode,
                onReviewFilenameChange: setReviewFilename,
                onReviewLanguageChange: handleReviewLanguageChange,
                onReviewFilesChange: handleReviewFilesChange,
                onReviewFileRemove: handleReviewFileRemove,
                onSubmit: handleReviewSubmit,
              }}
              generateForm={{
                generatePrompt,
                generateLanguage,
                generateStyle,
                isSubmitting,
                onGeneratePromptChange: setGeneratePrompt,
                onGenerateLanguageChange: setGenerateLanguage,
                onGenerateStyleChange: setGenerateStyle,
                onSubmit: handleGenerateSubmit,
              }}
            />

            <ResponsePanel
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              result={result}
              copiedKey={copiedKey}
              onCopy={copyToClipboard}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
