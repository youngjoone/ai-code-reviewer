import Link from "next/link";
import { type WorkspaceMode } from "@/components/home/types";

export type SidebarFilter = "all" | "review" | "generate" | "pinned";

type SidebarCategory = {
  id: SidebarFilter;
  name: string;
  count: number;
};

type SidebarThread = {
  id: string;
  title: string;
  timeLabel: string;
  mode: WorkspaceMode;
  pinned: boolean;
  requestCount: number;
};

type SidebarProps = {
  categories: SidebarCategory[];
  threads: SidebarThread[];
  activeFilter: SidebarFilter;
  activeThreadId: string | null;
  searchQuery: string;
  onNewThread: () => void;
  onFilterChange: (filter: SidebarFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectThread: (threadId: string) => void;
  onRenameThread: (threadId: string) => void;
  onTogglePinThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
};

export function Sidebar({
  categories,
  threads,
  activeFilter,
  activeThreadId,
  searchQuery,
  onNewThread,
  onFilterChange,
  onSearchQueryChange,
  onSelectThread,
  onRenameThread,
  onTogglePinThread,
  onDeleteThread,
}: SidebarProps) {
  return (
    <aside className="w-full overflow-y-auto border-b border-slate-200 bg-white px-4 py-4 md:h-full md:w-72 md:border-r md:border-b-0 md:px-5 md:py-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Portfolio
          </p>
          <h1 className="text-lg font-semibold tracking-tight">ReviewPilot</h1>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          v0
        </span>
      </div>

      <button
        type="button"
        onClick={onNewThread}
        className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        + 새 스레드
      </button>

      <Link
        href="/threads"
        className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
      >
        기록 페이지
      </Link>

      <label className="mt-4 block text-xs text-slate-600">
        스레드 검색
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="이름으로 검색"
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition placeholder:text-slate-400 focus:ring-4"
        />
      </label>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          필터
        </h2>
        <ul className="mt-3 space-y-2">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onFilterChange(category.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                  activeFilter === category.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{category.name}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${
                    activeFilter === category.id
                      ? "bg-slate-700 text-slate-100"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
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
            <li
              key={thread.id}
              className={`rounded-md border p-2 transition ${
                activeThreadId === thread.id
                  ? "border-slate-300 bg-slate-100"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectThread(thread.id)}
                className={`w-full rounded-md border px-3 py-2 text-left transition ${
                  activeThreadId === thread.id
                    ? "border-transparent"
                    : "border-transparent"
                }`}
              >
                <p className="truncate text-sm font-medium text-slate-800">
                  {thread.title}
                </p>
                <p className="text-xs text-slate-500">
                  {thread.mode === "review" ? "코드 분석" : "문장 → 코드"}
                  {thread.pinned ? " · 고정" : ""} · 요청 {thread.requestCount}건 ·{" "}
                  {thread.timeLabel}
                </p>
              </button>
              <div className="mt-1 flex items-center gap-1 px-3 pb-1">
                <button
                  type="button"
                  onClick={() => onRenameThread(thread.id)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-100"
                >
                  이름
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePinThread(thread.id)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-100"
                >
                  {thread.pinned ? "고정해제" : "고정"}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteThread(thread.id)}
                  className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 transition hover:bg-red-100"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
