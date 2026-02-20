import { z } from "zod";

export const GENERATE_LANGUAGES = ["typescript", "javascript", "python"] as const;
export const GENERATE_STYLES = ["clean", "fast", "explain"] as const;

export const generateLanguageSchema = z.enum(GENERATE_LANGUAGES);
export const generateStyleSchema = z.enum(GENERATE_STYLES);

export const apiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  details: z.array(z.string()).optional(),
});

export const reviewIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  title: z.string(),
  message: z.string(),
  line: z.number().int().positive(),
});

export const reviewRequestSchema = z.object({
  code: z.string().trim().min(1, "`code` is required"),
  filename: z.string().trim().min(1, "`filename` must not be empty").optional(),
  language: z.string().trim().min(1, "`language` must not be empty").optional(),
});

export const reviewResponseSchema = z.object({
  ok: z.literal(true),
  mode: z.literal("review"),
  input: z.object({
    filename: z.string(),
    language: z.string(),
    lineCount: z.number().int().nonnegative(),
  }),
  summary: z.string(),
  issues: z.array(reviewIssueSchema),
  refactoredCode: z.string(),
  suggestedTests: z.array(z.string()),
});

export const reviewLlmOutputSchema = z.object({
  summary: z.string(),
  issues: z.array(reviewIssueSchema),
  refactoredCode: z.string(),
  suggestedTests: z.array(z.string()),
});

export const reviewHealthResponseSchema = z.object({
  ok: z.literal(true),
  endpoint: z.literal("/api/review"),
  message: z.string(),
  method: z.literal("POST"),
});

export const generateRequestSchema = z.object({
  prompt: z.string().trim().min(1, "`prompt` is required"),
  language: generateLanguageSchema.optional(),
  style: generateStyleSchema.optional(),
});

export const generateResponseSchema = z.object({
  ok: z.literal(true),
  mode: z.literal("generate"),
  input: z.object({
    language: generateLanguageSchema,
    style: generateStyleSchema,
    promptLength: z.number().int().nonnegative(),
  }),
  summary: z.string(),
  code: z.string(),
  notes: z.array(z.string()),
});

export const generateLlmOutputSchema = z.object({
  summary: z.string(),
  code: z.string(),
  notes: z.array(z.string()),
});

export const generateHealthResponseSchema = z.object({
  ok: z.literal(true),
  endpoint: z.literal("/api/generate"),
  message: z.string(),
  method: z.literal("POST"),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type GenerateLanguage = z.infer<typeof generateLanguageSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateResponse = z.infer<typeof generateResponseSchema>;
export type GenerateStyle = z.infer<typeof generateStyleSchema>;
export type GenerateLlmOutput = z.infer<typeof generateLlmOutputSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type ReviewLlmOutput = z.infer<typeof reviewLlmOutputSchema>;
