import { z } from "zod";

export const GENERATE_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "java",
  "kotlin",
] as const;
export const GENERATE_STYLES = ["clean", "fast", "explain"] as const;
export const RESPONSE_LANGUAGES = ["ko", "en"] as const;

export const generateLanguageSchema = z.enum(GENERATE_LANGUAGES);
export const generateStyleSchema = z.enum(GENERATE_STYLES);
export const responseLanguageSchema = z.enum(RESPONSE_LANGUAGES);

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

export const reviewInputFileSchema = z.object({
  filename: z.string().trim().min(1, "`files[].filename` must not be empty"),
  code: z.string().trim().min(1, "`files[].code` must not be empty"),
  language: z.string().trim().min(1, "`files[].language` must not be empty").optional(),
});

export const reviewRequestSchema = z.object({
  code: z.string().trim().min(1, "`code` is required").optional(),
  filename: z.string().trim().min(1, "`filename` must not be empty").optional(),
  language: z.string().trim().min(1, "`language` must not be empty").optional(),
  files: z.array(reviewInputFileSchema).min(1, "`files` must have at least one item").optional(),
  responseLanguage: responseLanguageSchema.optional(),
}).superRefine((value, ctx) => {
  const hasInlineCode = typeof value.code === "string" && value.code.length > 0;
  const hasFiles = Array.isArray(value.files) && value.files.length > 0;
  if (!hasInlineCode && !hasFiles) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "`code` or `files` is required",
      path: ["code"],
    });
  }
});

export const reviewResponseSchema = z.object({
  ok: z.literal(true),
  mode: z.literal("review"),
  input: z.object({
    filename: z.string(),
    language: z.string(),
    responseLanguage: responseLanguageSchema,
    lineCount: z.number().int().nonnegative(),
    fileCount: z.number().int().positive(),
    totalLineCount: z.number().int().nonnegative(),
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
  responseLanguage: responseLanguageSchema.optional(),
});

export const generateResponseSchema = z.object({
  ok: z.literal(true),
  mode: z.literal("generate"),
  input: z.object({
    language: generateLanguageSchema,
    style: generateStyleSchema,
    responseLanguage: responseLanguageSchema,
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
export type ResponseLanguage = z.infer<typeof responseLanguageSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type ReviewLlmOutput = z.infer<typeof reviewLlmOutputSchema>;
