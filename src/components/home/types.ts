import {
  type GenerateResponse,
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
