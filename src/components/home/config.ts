import {
  type GenerateLanguage,
  type GenerateStyle,
  type ResponseLanguage,
  type ReviewResponse,
} from "@/lib/schemas";

export type ReviewSeverity = ReviewResponse["issues"][number]["severity"];

export const GENERATE_LANGUAGE_LABEL: Record<GenerateLanguage, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  kotlin: "Kotlin",
};

export const GENERATE_STYLE_LABEL: Record<GenerateStyle, string> = {
  clean: "깔끔한 구현",
  fast: "성능 우선",
  explain: "설명 포함",
};

export const RESPONSE_LANGUAGE_LABEL: Record<ResponseLanguage, string> = {
  ko: "한국어",
  en: "English",
};

export const REVIEW_SEVERITY_LABEL: Record<ReviewSeverity, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
};

export const REVIEW_SEVERITY_STYLE: Record<ReviewSeverity, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-sky-200 bg-sky-50 text-sky-700",
};

const REVIEW_LANGUAGE_EXTENSION: Record<GenerateLanguage, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  java: "java",
  kotlin: "kt",
};

export const SIDEBAR_CATEGORIES = [
  { name: "코드 리뷰", count: 12 },
  { name: "리팩토링", count: 8 },
  { name: "문장 → 코드", count: 5 },
];

export const SIDEBAR_THREADS = [
  { title: "auth.service.ts 리뷰", time: "방금 전" },
  { title: "알고리즘 문제 풀이 생성", time: "10분 전" },
  { title: "API 성능 개선 제안", time: "어제" },
];

export function defaultFilenameForReviewLanguage(
  language: GenerateLanguage
): string {
  return `snippet.${REVIEW_LANGUAGE_EXTENSION[language]}`;
}

export function inferReviewLanguageFromFilename(
  filename: string
): GenerateLanguage | null {
  const normalized = filename.trim().toLowerCase();
  if (normalized.endsWith(".ts") || normalized.endsWith(".tsx")) {
    return "typescript";
  }
  if (normalized.endsWith(".js") || normalized.endsWith(".jsx")) {
    return "javascript";
  }
  if (normalized.endsWith(".py")) {
    return "python";
  }
  if (normalized.endsWith(".java")) {
    return "java";
  }
  if (normalized.endsWith(".kt")) {
    return "kotlin";
  }
  return null;
}
