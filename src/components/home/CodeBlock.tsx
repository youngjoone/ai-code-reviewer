import { highlightCodeToHtml } from "@/components/home/highlight";

type CodeBlockProps = {
  title: string;
  code: string;
  language: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
};

export function CodeBlock({
  title,
  code,
  language,
  copyKey,
  copiedKey,
  onCopy,
}: CodeBlockProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          {title}
        </p>
        <button
          type="button"
          onClick={() => onCopy(code, copyKey)}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {copiedKey === copyKey ? "복사됨" : "복사"}
        </button>
      </div>
      <pre className="rp-code mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
        <code
          dangerouslySetInnerHTML={{
            __html: highlightCodeToHtml(code, language),
          }}
        />
      </pre>
    </article>
  );
}
