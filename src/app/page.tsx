"use client";

import { useState, type ChangeEvent } from "react";
import { type ZodType } from "zod";
import {
  apiErrorResponseSchema,
  generateRequestSchema,
  generateResponseSchema,
  GENERATE_LANGUAGES,
  GENERATE_STYLES,
  reviewRequestSchema,
  reviewResponseSchema,
  type GenerateLanguage,
  type GenerateResponse,
  type GenerateStyle,
  type ReviewResponse,
} from "@/lib/schemas";

type ApiResult = ReviewResponse | GenerateResponse;
type ReviewSeverity = ReviewResponse["issues"][number]["severity"];

const GENERATE_LANGUAGE_LABEL: Record<GenerateLanguage, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
};

const GENERATE_STYLE_LABEL: Record<GenerateStyle, string> = {
  clean: "깔끔한 구현",
  fast: "성능 우선",
  explain: "설명 포함",
};

const REVIEW_SEVERITY_LABEL: Record<ReviewSeverity, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
};

const REVIEW_SEVERITY_STYLE: Record<ReviewSeverity, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-sky-200 bg-sky-50 text-sky-700",
};

export default function Home() {
  const [mode, setMode] = useState<"review" | "generate">("review");
  const [reviewCode, setReviewCode] = useState("");
  const [reviewFilename, setReviewFilename] = useState("snippet.ts");
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generateLanguage, setGenerateLanguage] =
    useState<GenerateLanguage>("typescript");
  const [generateStyle, setGenerateStyle] = useState<GenerateStyle>("clean");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  const categories = [
    { name: "코드 리뷰", count: 12 },
    { name: "리팩토링", count: 8 },
    { name: "문장 → 코드", count: 5 },
  ];

  const threads = [
    { title: "auth.service.ts 리뷰", time: "방금 전" },
    { title: "알고리즘 문제 풀이 생성", time: "10분 전" },
    { title: "API 성능 개선 제안", time: "어제" },
  ];

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
    responseSchema: ZodType<TResponse>
  ): Promise<TResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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

  async function handleReviewSubmit() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const parsedPayload = reviewRequestSchema.safeParse({
        code: reviewCode,
        filename: reviewFilename,
        language: "typescript",
      });

      if (!parsedPayload.success) {
        const message = parsedPayload.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.";
        throw new Error(message);
      }

      const data = await postJson(
        "/api/review",
        parsedPayload.data,
        reviewResponseSchema
      );
      setResult(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateSubmit() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const parsedPayload = generateRequestSchema.safeParse({
        prompt: generatePrompt,
        language: generateLanguage,
        style: generateStyle,
      });

      if (!parsedPayload.success) {
        const message = parsedPayload.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.";
        throw new Error(message);
      }

      const data = await postJson(
        "/api/generate",
        parsedPayload.data,
        generateResponseSchema
      );
      setResult(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReviewFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setReviewFilename(file.name);
    setReviewCode(text);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#f8fafc_45%,#eef2ff_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col md:flex-row">
        <aside className="w-full border-b border-slate-200/80 bg-white/80 p-4 backdrop-blur md:h-screen md:w-72 md:border-r md:border-b-0 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Portfolio
              </p>
              <h1 className="text-lg font-semibold tracking-tight">
                ReviewPilot
              </h1>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              v0
            </span>
          </div>

          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            + 새 스레드
          </button>

          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              카테고리
            </h2>
            <ul className="mt-3 space-y-2">
              {categories.map((category) => (
                <li key={category.name}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <span>{category.name}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {category.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              최근 스레드
            </h2>
            <ul className="mt-3 space-y-2">
              {threads.map((thread) => (
                <li key={thread.title}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-slate-200 hover:bg-white"
                  >
                    <p className="truncate text-sm font-medium text-slate-800">
                      {thread.title}
                    </p>
                    <p className="text-xs text-slate-500">{thread.time}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>

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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Workspace Mode
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                    {mode === "review" ? "코드 분석 / 리팩토링" : "문장 → 코드 변환"}
                  </h3>
                </div>

                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    aria-pressed={mode === "review"}
                    onClick={() => setMode("review")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      mode === "review"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    코드 분석
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === "generate"}
                    onClick={() => setMode("generate")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      mode === "generate"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    문장 → 코드
                  </button>
                </div>
              </div>

              {mode === "review" ? (
                <div className="mt-4">
                  <label
                    htmlFor="review-file"
                    className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
                  >
                    <p className="font-medium text-slate-800">파일 업로드 (선택)</p>
                    <p className="mt-1">`.ts`, `.tsx`, `.js`, `.py` 파일을 올리세요.</p>
                    <input
                      id="review-file"
                      name="review-file"
                      type="file"
                      accept=".ts,.tsx,.js,.jsx,.py,.java,.kt,.go,.rs,.cpp,.c,.cs"
                      onChange={handleReviewFileChange}
                      className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                    />
                  </label>

                  <label htmlFor="review-code" className="mt-4 block text-sm">
                    <span className="font-medium text-slate-800">코드 직접 입력</span>
                    <textarea
                      id="review-code"
                      name="review-code"
                      rows={12}
                      value={reviewCode}
                      onChange={(event) => setReviewCode(event.target.value)}
                      placeholder="분석할 코드를 붙여넣으세요."
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition placeholder:text-slate-400 focus:ring-4"
                    />
                  </label>

                  <p className="mt-2 text-xs text-slate-500">
                    현재 파일명: {reviewFilename}
                  </p>

                  <button
                    type="button"
                    onClick={handleReviewSubmit}
                    disabled={isSubmitting}
                    className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    {isSubmitting ? "분석 중..." : "분석 시작"}
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <label htmlFor="problem-text" className="block text-sm">
                    <span className="font-medium text-slate-800">
                      문제/요구사항 입력
                    </span>
                    <textarea
                      id="problem-text"
                      name="problem-text"
                      rows={16}
                      value={generatePrompt}
                      onChange={(event) => setGeneratePrompt(event.target.value)}
                      placeholder="예: 정수 배열이 주어질 때 중복을 제거하고 오름차순으로 반환하는 TypeScript 함수를 작성해줘."
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition placeholder:text-slate-400 focus:ring-4"
                    />
                  </label>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <select
                      name="language"
                      value={generateLanguage}
                      onChange={(event) =>
                        setGenerateLanguage(event.target.value as GenerateLanguage)
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition focus:ring-4"
                    >
                      {GENERATE_LANGUAGES.map((language) => (
                        <option key={language} value={language}>
                          {GENERATE_LANGUAGE_LABEL[language]}
                        </option>
                      ))}
                    </select>
                    <select
                      name="style"
                      value={generateStyle}
                      onChange={(event) =>
                        setGenerateStyle(event.target.value as GenerateStyle)
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition focus:ring-4"
                    >
                      {GENERATE_STYLES.map((style) => (
                        <option key={style} value={style}>
                          {GENERATE_STYLE_LABEL[style]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateSubmit}
                    disabled={isSubmitting}
                    className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
                  >
                    {isSubmitting ? "생성 중..." : "코드 생성"}
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-700">
              <div className="flex items-center justify-between">
                <p className="font-semibold uppercase tracking-[0.12em] text-slate-500">
                  API Response
                </p>
                {isSubmitting ? (
                  <span className="text-sky-600">요청 중...</span>
                ) : null}
              </div>

              {errorMessage ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              {result ? (
                <div className="mt-3 space-y-3">
                  <article className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Summary
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{result.summary}</p>
                  </article>

                  {result.mode === "review" ? (
                    <>
                      <article className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Input
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                            파일: {result.input.filename}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                            언어: {result.input.language}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                            라인: {result.input.lineCount}
                          </span>
                        </div>
                      </article>

                      <article className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Issues
                        </p>
                        {result.issues.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-500">이슈가 없습니다.</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {result.issues.map((issue) => (
                              <li
                                key={issue.id}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${REVIEW_SEVERITY_STYLE[issue.severity]}`}
                                  >
                                    {REVIEW_SEVERITY_LABEL[issue.severity]}
                                  </span>
                                  <p className="text-sm font-semibold text-slate-800">
                                    {issue.title}
                                  </p>
                                  <span className="text-xs text-slate-500">
                                    line {issue.line}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">
                                  {issue.message}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>

                      <article className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Refactored Code
                        </p>
                        <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                          {result.refactoredCode}
                        </pre>
                      </article>

                      <article className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Suggested Tests
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {result.suggestedTests.map((test) => (
                            <li key={test}>{test}</li>
                          ))}
                        </ul>
                      </article>
                    </>
                  ) : (
                    <>
                      <article className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Input
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                            언어: {result.input.language}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                            스타일: {result.input.style}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                            프롬프트 길이: {result.input.promptLength}
                          </span>
                        </div>
                      </article>

                      <article className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Generated Code
                        </p>
                        <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                          {result.code}
                        </pre>
                      </article>

                      <article className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Notes
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {result.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </article>
                    </>
                  )}

                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  아직 결과가 없습니다. 위에서 분석 또는 생성을 실행해보세요.
                </p>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
