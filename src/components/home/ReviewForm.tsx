import { type ChangeEvent } from "react";
import {
  GENERATE_LANGUAGES,
  type GenerateLanguage,
} from "@/lib/schemas";
import {
  defaultFilenameForReviewLanguage,
  GENERATE_LANGUAGE_LABEL,
} from "@/components/home/config";

export type ReviewFormProps = {
  reviewCode: string;
  reviewFilename: string;
  reviewLanguage: GenerateLanguage;
  isSubmitting: boolean;
  onReviewCodeChange: (value: string) => void;
  onReviewFilenameChange: (value: string) => void;
  onReviewLanguageChange: (language: GenerateLanguage) => void;
  onReviewFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
};

export function ReviewForm({
  reviewCode,
  reviewFilename,
  reviewLanguage,
  isSubmitting,
  onReviewCodeChange,
  onReviewFilenameChange,
  onReviewLanguageChange,
  onReviewFileChange,
  onSubmit,
}: ReviewFormProps) {
  return (
    <div className="mt-4">
      <label
        htmlFor="review-file"
        className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
      >
        <p className="font-medium text-slate-800">파일 업로드 (선택)</p>
        <p className="mt-1">
          `.ts`, `.tsx`, `.js`, `.py`, `.java`, `.kt` 파일을 올리세요.
        </p>
        <input
          id="review-file"
          name="review-file"
          type="file"
          accept=".ts,.tsx,.js,.jsx,.py,.java,.kt,.go,.rs,.cpp,.c,.cs"
          onChange={onReviewFileChange}
          className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
      </label>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="text"
          name="review-filename"
          value={reviewFilename}
          onChange={(event) => onReviewFilenameChange(event.target.value)}
          placeholder="파일명 (예: snippet.java)"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition placeholder:text-slate-400 focus:ring-4"
        />
        <select
          name="review-language"
          value={reviewLanguage}
          onChange={(event) =>
            onReviewLanguageChange(event.target.value as GenerateLanguage)
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition focus:ring-4"
        >
          {GENERATE_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {GENERATE_LANGUAGE_LABEL[language]}
            </option>
          ))}
        </select>
      </div>

      <label htmlFor="review-code" className="mt-4 block text-sm">
        <span className="font-medium text-slate-800">코드 직접 입력</span>
        <textarea
          id="review-code"
          name="review-code"
          rows={12}
          value={reviewCode}
          onChange={(event) => onReviewCodeChange(event.target.value)}
          placeholder="분석할 코드를 붙여넣으세요."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition placeholder:text-slate-400 focus:ring-4"
        />
      </label>

      <p className="mt-2 text-xs text-slate-500">
        현재 파일명:{" "}
        {reviewFilename || defaultFilenameForReviewLanguage(reviewLanguage)}
      </p>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        {isSubmitting ? "분석 중..." : "분석 시작"}
      </button>
    </div>
  );
}
