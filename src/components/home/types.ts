import {
  type GenerateResponse,
  type ReviewResponse,
} from "@/lib/schemas";

export type ApiResult = ReviewResponse | GenerateResponse;
export type WorkspaceMode = "review" | "generate";
