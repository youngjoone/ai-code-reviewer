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
      const filename =
        reviewFilename.trim() || defaultFilenameForReviewLanguage(reviewLanguage);
      const parsedPayload = reviewRequestSchema.safeParse({
        code: reviewCode,
        filename,
        language: reviewLanguage,
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

  async function handleReviewFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setReviewFilename(file.name);
    const inferredLanguage = inferReviewLanguageFromFilename(file.name);
    if (inferredLanguage) {
      setReviewLanguage(inferredLanguage);
    }
    setReviewCode(text);
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#f8fafc_45%,#eef2ff_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col md:flex-row">
        <Sidebar />

        <main className="flex-1 px-4 py-5 md:px-10 md:py-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
            <section className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-[0_8px_28px_rgba(15,23,42,0.06)] md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Main Workspace
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                코드 리뷰와 문장 기반 코드 생성을 한 화면에서 시작하세요.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                지금은 UI 뼈대 단계입니다. 아래 영역에서 파일 업로드/코드 입력 중심
                흐름을 먼저 고정하고, 다음 단계에서 API 연결을 진행하면 됩니다.
              </p>
            </section>

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
                isSubmitting,
                onReviewCodeChange: setReviewCode,
                onReviewFilenameChange: setReviewFilename,
                onReviewLanguageChange: handleReviewLanguageChange,
                onReviewFileChange: handleReviewFileChange,
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
