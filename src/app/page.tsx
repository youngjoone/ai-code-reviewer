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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e2e8f0_0%,#f8fafc_40%,#eef2ff_100%)] text-slate-900">
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <Sidebar />

        <main className="flex-1 border-t border-slate-200/80 bg-white/75 px-4 py-5 md:border-t-0 md:border-l md:px-8 md:py-7">
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
