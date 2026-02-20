import {
  SIDEBAR_CATEGORIES,
  SIDEBAR_THREADS,
} from "@/components/home/config";

export function Sidebar() {
  return (
    <aside className="w-full border-b border-slate-200 bg-white px-4 py-4 md:h-screen md:w-72 md:border-r md:border-b-0 md:px-5 md:py-5">
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
        className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        + 새 스레드
      </button>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          카테고리
        </h2>
        <ul className="mt-3 space-y-2">
          {SIDEBAR_CATEGORIES.map((category) => (
            <li key={category.name}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
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
          {SIDEBAR_THREADS.map((thread) => (
            <li key={thread.title}>
              <button
                type="button"
                className="w-full rounded-md border border-transparent px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50"
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
  );
}
