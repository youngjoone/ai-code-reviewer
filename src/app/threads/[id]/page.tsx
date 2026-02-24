import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoredThreadById } from "@/lib/thread-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ThreadDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const RUN_STATUS_LABEL = {
  running: "진행 중",
  success: "완료",
  failed: "실패",
  cancelled: "중지됨",
} as const;

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default async function ThreadDetailPage({ params }: ThreadDetailPageProps) {
  const { id } = await params;
  const thread = getStoredThreadById(id);

  if (!thread) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Thread Detail
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{thread.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/threads"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              목록으로
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              워크스페이스
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-2 py-1">
            모드: {thread.mode === "review" ? "코드 분석" : "문장 → 코드"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1">
            요청 {thread.runs.length}건
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1">
            마지막 수정: {formatDate(thread.updatedAt)}
          </span>
        </div>

        {thread.runs.length === 0 ? (
          <p className="mt-8 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            이 스레드에는 아직 실행 기록이 없습니다.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {thread.runs.map((run) => (
              <li key={run.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {run.mode === "review" ? "코드 분석" : "문장 → 코드"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {RUN_STATUS_LABEL[run.status]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {formatDate(run.createdAt)}
                    </span>
                  </div>
                </div>

                {run.errorMessage ? (
                  <p className="mt-2 text-sm text-red-700">{run.errorMessage}</p>
                ) : null}

                {run.result ? (
                  <>
                    <p className="mt-3 text-sm text-slate-700">{run.result.summary}</p>
                    {run.result.mode === "review" ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                        <code>{run.result.refactoredCode}</code>
                      </pre>
                    ) : (
                      <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                        <code>{run.result.code}</code>
                      </pre>
                    )}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
