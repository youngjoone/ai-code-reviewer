import {
  GENERATE_LANGUAGES,
  GENERATE_STYLES,
  type GenerateLanguage,
  type GenerateStyle,
} from "@/lib/schemas";
import {
  GENERATE_LANGUAGE_LABEL,
  GENERATE_STYLE_LABEL,
} from "@/components/home/config";

export type GenerateFormProps = {
  generatePrompt: string;
  generateLanguage: GenerateLanguage;
  generateStyle: GenerateStyle;
  isSubmitting: boolean;
  onGeneratePromptChange: (value: string) => void;
  onGenerateLanguageChange: (language: GenerateLanguage) => void;
  onGenerateStyleChange: (style: GenerateStyle) => void;
  onSubmit: () => void;
};

export function GenerateForm({
  generatePrompt,
  generateLanguage,
  generateStyle,
  isSubmitting,
  onGeneratePromptChange,
  onGenerateLanguageChange,
  onGenerateStyleChange,
  onSubmit,
}: GenerateFormProps) {
  return (
    <div className="mt-4">
      <label htmlFor="problem-text" className="block text-sm">
        <span className="font-medium text-slate-800">문제/요구사항 입력</span>
        <textarea
          id="problem-text"
          name="problem-text"
          rows={16}
          value={generatePrompt}
          onChange={(event) => onGeneratePromptChange(event.target.value)}
          placeholder="예: 정수 배열이 주어질 때 중복을 제거하고 오름차순으로 반환하는 TypeScript 함수를 작성해줘."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 transition placeholder:text-slate-400 focus:ring-4"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <select
          name="language"
          value={generateLanguage}
          onChange={(event) =>
            onGenerateLanguageChange(event.target.value as GenerateLanguage)
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
            onGenerateStyleChange(event.target.value as GenerateStyle)
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
        onClick={onSubmit}
        disabled={isSubmitting}
        className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
      >
        {isSubmitting ? "생성 중..." : "코드 생성"}
      </button>
    </div>
  );
}
