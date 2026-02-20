import {
  RESPONSE_LANGUAGES,
  type ResponseLanguage,
} from "@/lib/schemas";
import { RESPONSE_LANGUAGE_LABEL } from "@/components/home/config";
import {
  type GenerateFormProps,
  GenerateForm,
} from "@/components/home/GenerateForm";
import {
  type ReviewFormProps,
  ReviewForm,
} from "@/components/home/ReviewForm";
import { type WorkspaceMode } from "@/components/home/types";

type WorkspacePanelProps = {
  mode: WorkspaceMode;
  responseLanguage: ResponseLanguage;
  onModeChange: (mode: WorkspaceMode) => void;
  onResponseLanguageChange: (language: ResponseLanguage) => void;
  reviewForm: ReviewFormProps;
  generateForm: GenerateFormProps;
};

export function WorkspacePanel({
  mode,
  responseLanguage,
  onModeChange,
  onResponseLanguageChange,
  reviewForm,
  generateForm,
}: WorkspacePanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            Workspace Mode
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {mode === "review" ? "코드 분석 / 리팩토링" : "문장 → 코드 변환"}
          </h3>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              aria-pressed={mode === "review"}
              onClick={() => onModeChange("review")}
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
              onClick={() => onModeChange("generate")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "generate"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              문장 → 코드
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span>응답 언어</span>
            <select
              name="response-language"
              value={responseLanguage}
              onChange={(event) =>
                onResponseLanguageChange(event.target.value as ResponseLanguage)
              }
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none ring-slate-900/10 transition focus:ring-4"
            >
              {RESPONSE_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {RESPONSE_LANGUAGE_LABEL[language]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {mode === "review" ? <ReviewForm {...reviewForm} /> : <GenerateForm {...generateForm} />}
    </section>
  );
}
