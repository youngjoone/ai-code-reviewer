import { CodeBlock } from "@/components/home/CodeBlock";
import {
  RESPONSE_LANGUAGE_LABEL,
  REVIEW_SEVERITY_LABEL,
  REVIEW_SEVERITY_STYLE,
} from "@/components/home/config";
import { type ApiResult, type ThreadRun } from "@/components/home/types";

const RUN_STATUS_LABEL = {
  running: "진행 중",
  success: "완료",
  failed: "실패",
  cancelled: "중지됨",
} as const;

const RUN_STATUS_STYLE = {
  running: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
} as const;

function formatRunTime(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function runPreviewText(run: ThreadRun): string {
  if (run.status === "running") {
    return "요청 처리 중...";
  }

  if (run.status === "failed" || run.status === "cancelled") {
    return run.errorMessage ?? "요청 처리에 실패했습니다.";
  }

  return run.result?.summary ?? "응답 요약 없음";
}

type ResponsePanelProps = {
  isSubmitting: boolean;
  errorMessage: string | null;
  runs: ThreadRun[];
  activeRunId: string | null;
  onSelectRun: (runId: string) => void;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
};

export function ResponsePanel({
  isSubmitting,
  errorMessage,
  runs,
  activeRunId,
  onSelectRun,
  copiedKey,
  onCopy,
}: ResponsePanelProps) {
  const activeRun = runs.find((run) => run.id === activeRunId) ?? runs[0] ?? null;
  const result: ApiResult | null =
    activeRun?.status === "success" ? activeRun.result : null;

  return (
    <section className="pt-6 text-sm leading-6 text-slate-700">
      <div className="flex items-center justify-between">
        <p className="font-semibold uppercase tracking-[0.12em] text-slate-500">
          API Response
        </p>
        {isSubmitting ? <span className="text-sky-600">요청 중...</span> : null}
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {runs.length > 0 ? (
        <article className="mt-3 rounded-lg border border-slate-200/90 bg-slate-50/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
            요청 기록
          </p>
          <ul className="mt-2 space-y-2">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => onSelectRun(run.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
                    activeRun?.id === run.id
                      ? "border-slate-300 bg-white"
                      : "border-transparent hover:border-slate-200 hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">
                      {run.mode === "review" ? "코드 분석" : "문장 → 코드"}
                    </p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${RUN_STATUS_STYLE[run.status]}`}
                    >
                      {RUN_STATUS_LABEL[run.status]}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">
                    {runPreviewText(run)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatRunTime(run.createdAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {activeRun ? (
        <div className="mt-3 space-y-3">
          {activeRun.status === "running" ? (
            <article className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
              요청 처리 중입니다. 응답이 오면 자동으로 기록됩니다.
            </article>
          ) : null}

          {(activeRun.status === "failed" || activeRun.status === "cancelled") &&
          activeRun.errorMessage ? (
            <article className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {activeRun.errorMessage}
            </article>
          ) : null}

          {result ? (
            <>
              <article className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Summary
                </p>
                <p className="mt-1 text-sm text-slate-700">{result.summary}</p>
              </article>

              {result.mode === "review" ? (
                <>
                  <article className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-3">
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
                        응답: {RESPONSE_LANGUAGE_LABEL[result.input.responseLanguage]}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                        파일 수: {result.input.fileCount}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                        총 라인: {result.input.totalLineCount}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                        대표 라인: {result.input.lineCount}
                      </span>
                    </div>
                  </article>

                  <article className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-3">
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
                            className="rounded-md border border-slate-200 bg-white/70 p-3"
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

                  <CodeBlock
                    title="Refactored Code"
                    code={result.refactoredCode}
                    language={result.input.language}
                    copyKey={`review-refactor-${activeRun.id}`}
                    copiedKey={copiedKey}
                    onCopy={onCopy}
                  />

                  <article className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-3">
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
                  <article className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-3">
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
                        응답: {RESPONSE_LANGUAGE_LABEL[result.input.responseLanguage]}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                        프롬프트 길이: {result.input.promptLength}
                      </span>
                    </div>
                  </article>

                  <CodeBlock
                    title="Generated Code"
                    code={result.code}
                    language={result.input.language}
                    copyKey={`generate-code-${activeRun.id}`}
                    copiedKey={copiedKey}
                    onCopy={onCopy}
                  />

                  <article className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-3">
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
            </>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          아직 결과가 없습니다. 위에서 분석 또는 생성을 실행해보세요.
        </p>
      )}
    </section>
  );
}
