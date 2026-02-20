type CodeLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "java"
  | "kotlin"
  | "plain";

const CODE_KEYWORDS: Record<CodeLanguage, string[]> = {
  typescript: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "throw",
    "class",
    "extends",
    "implements",
    "interface",
    "type",
    "enum",
    "import",
    "export",
    "from",
    "new",
    "async",
    "await",
    "public",
    "private",
    "protected",
    "readonly",
  ],
  javascript: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "throw",
    "class",
    "extends",
    "import",
    "export",
    "from",
    "new",
    "async",
    "await",
  ],
  python: [
    "def",
    "return",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "try",
    "except",
    "finally",
    "raise",
    "class",
    "import",
    "from",
    "as",
    "with",
    "pass",
    "break",
    "continue",
    "lambda",
  ],
  java: [
    "public",
    "private",
    "protected",
    "class",
    "interface",
    "enum",
    "extends",
    "implements",
    "static",
    "final",
    "void",
    "new",
    "return",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "throw",
    "throws",
    "import",
    "package",
  ],
  kotlin: [
    "fun",
    "val",
    "var",
    "class",
    "interface",
    "object",
    "data",
    "sealed",
    "enum",
    "open",
    "override",
    "private",
    "public",
    "internal",
    "return",
    "if",
    "else",
    "when",
    "for",
    "while",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "throw",
    "import",
  ],
  plain: [],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeCodeLanguage(language: string): CodeLanguage {
  const normalized = language.trim().toLowerCase();
  if (normalized === "typescript" || normalized === "ts" || normalized === "tsx") {
    return "typescript";
  }
  if (normalized === "javascript" || normalized === "js" || normalized === "jsx") {
    return "javascript";
  }
  if (normalized === "python" || normalized === "py") {
    return "python";
  }
  if (normalized === "java") {
    return "java";
  }
  if (normalized === "kotlin" || normalized === "kt") {
    return "kotlin";
  }
  return "plain";
}

function protectToken(
  source: string,
  pattern: RegExp,
  tokenType: "comment" | "string",
  store: string[]
): string {
  return source.replace(pattern, (match) => {
    const index = store.push(
      `<span data-rp-token="${tokenType}">${match}</span>`
    );
    return `@@RP_TOKEN_${index - 1}@@`;
  });
}

export function highlightCodeToHtml(code: string, language: string): string {
  const codeLanguage = normalizeCodeLanguage(language);
  let highlighted = escapeHtml(code);
  const keywords = CODE_KEYWORDS[codeLanguage];
  const keywordPattern =
    keywords.length > 0
      ? new RegExp(`\\b(${keywords.map(escapeRegExp).join("|")})\\b`, "g")
      : null;
  const protectedTokens: string[] = [];

  highlighted = protectToken(
    highlighted,
    /(\/\/[^\n]*|#[^\n]*)/g,
    "comment",
    protectedTokens
  );
  highlighted = protectToken(
    highlighted,
    /(&quot;[^"\n]*&quot;|'[^'\n]*')/g,
    "string",
    protectedTokens
  );
  if (keywordPattern) {
    highlighted = highlighted.replace(
      keywordPattern,
      '<span data-rp-token="keyword">$1</span>'
    );
  }
  highlighted = highlighted.replace(
    /\b(\d+(?:\.\d+)?)\b/g,
    '<span data-rp-token="number">$1</span>'
  );
  highlighted = highlighted.replace(/@@RP_TOKEN_(\d+)@@/g, (_, index) => {
    return protectedTokens[Number(index)] ?? "";
  });

  return highlighted;
}
