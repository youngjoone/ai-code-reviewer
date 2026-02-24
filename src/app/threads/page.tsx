import Link from "next/link";
import { listStoredThreads } from "@/lib/thread-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function ThreadsPage() {
  const threads = listStoredThreads();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Thread History
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">대화 기록</h1>
          </div>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            메인으로 돌아가기
          </Link>
        </div>

        {threads.length === 0 ? (
          <p className="mt-8 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            저장된 스레드가 없습니다.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/threads/${thread.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {thread.title}
                    </p>
                    {thread.pinned ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                        고정
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      모드: {thread.mode === "review" ? "코드 분석" : "문장 → 코드"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      요청 {thread.runs.length}건
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      수정: {formatDate(thread.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
