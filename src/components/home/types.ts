import {
  type GenerateLanguage,
  type GenerateResponse,
  type GenerateStyle,
  type ResponseLanguage,
  type ReviewResponse,
} from "@/lib/schemas";

export type ApiResult = ReviewResponse | GenerateResponse;
export type WorkspaceMode = "review" | "generate";
export type ThreadRunStatus = "running" | "success" | "failed" | "cancelled";

export type ThreadRun = {
  id: string;
  mode: WorkspaceMode;
  status: ThreadRunStatus;
  createdAt: number;
  updatedAt: number;
  result: ApiResult | null;
  errorMessage: string | null;
};

export type SelectedReviewFile = {
  id: string;
  filename: string;
  language: string;
  code: string;
  lineCount: number;
};

export type ThreadSnapshot = {
  id: string;
  title: string;
  mode: WorkspaceMode;
  pinned: boolean;
  updatedAt: number;
  responseLanguage: ResponseLanguage;
  reviewCode: string;
  reviewLanguage: GenerateLanguage;
  reviewFilename: string;
  reviewFiles: SelectedReviewFile[];
  generatePrompt: string;
  generateLanguage: GenerateLanguage;
  generateStyle: GenerateStyle;
  runs: ThreadRun[];
  activeRunId: string | null;
};
