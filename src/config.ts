export const SCHEMA_URL =
  "https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/schema.json";

export const subjectCases = ["lower", "sentence", "any"] as const;
export const scopeCases = ["lower", "any"] as const;
export const bodyModes = ["auto", "always", "never"] as const;
export const modes = ["auto", "always", "never"] as const;

export type SubjectCase = (typeof subjectCases)[number];
export type ScopeCase = (typeof scopeCases)[number];
export type BodyMode = (typeof bodyModes)[number];
export type Mode = (typeof modes)[number];

export interface Config {
  $schema?: string;
  model: string;
  fallbackModel?: string;
  timeoutSeconds: number;
  strictMcpConfig: boolean;
  extraArgs?: string[];
  language: string;
  types: string[];
  subjectMaxLength: number;
  subjectCase: SubjectCase;
  scopeCase: ScopeCase;
  body: BodyMode;
  bodyMaxLineLength: number;
  maxDiffChars: number;
  exclude: string[];
  instructions?: string;
  instructionsMaxChars: number;
  confirm: boolean;
  verify: boolean;
  color: Mode;
  unicode: Mode;
}

export const keyOrder: (keyof Config)[] = [
  "$schema",
  "model",
  "fallbackModel",
  "timeoutSeconds",
  "strictMcpConfig",
  "extraArgs",
  "language",
  "types",
  "subjectMaxLength",
  "subjectCase",
  "scopeCase",
  "body",
  "bodyMaxLineLength",
  "maxDiffChars",
  "exclude",
  "instructions",
  "instructionsMaxChars",
  "confirm",
  "verify",
  "color",
  "unicode",
];

const omitWhenEmpty = new Set<keyof Config>([
  "$schema",
  "fallbackModel",
  "extraArgs",
  "instructions",
]);

export function defaults(): Config {
  return {
    model: "sonnet",
    timeoutSeconds: 120,
    strictMcpConfig: true,
    language: "en",
    types: [
      "feat",
      "fix",
      "refactor",
      "perf",
      "docs",
      "test",
      "build",
      "ci",
      "chore",
      "style",
      "revert",
    ],
    subjectMaxLength: 72,
    subjectCase: "lower",
    scopeCase: "lower",
    body: "auto",
    bodyMaxLineLength: 100,
    maxDiffChars: 30000,
    exclude: ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb", "*.lock", "*.snap"],
    instructionsMaxChars: 4000,
    confirm: true,
    verify: true,
    color: "auto",
    unicode: "auto",
  };
}

export function validate(c: Config): void {
  if (c.model === "") {
    throw new Error("model: cannot be empty");
  }
  if (c.timeoutSeconds < 5) {
    throw new Error(`timeoutSeconds: ${c.timeoutSeconds} is too low, use at least 5`);
  }
  if (c.language === "") {
    throw new Error("language: cannot be empty");
  }
  if (c.types.length === 0) {
    throw new Error("types: needs at least one commit type");
  }
  if (c.subjectMaxLength < 20) {
    throw new Error(`subjectMaxLength: ${c.subjectMaxLength} is too low, use at least 20`);
  }
  if (!isOneOf(subjectCases, c.subjectCase)) {
    throw notOneOf("subjectCase", c.subjectCase, subjectCases);
  }
  if (!isOneOf(scopeCases, c.scopeCase)) {
    throw notOneOf("scopeCase", c.scopeCase, scopeCases);
  }
  if (c.bodyMaxLineLength < 0) {
    throw new Error("bodyMaxLineLength: cannot be negative");
  }
  if (c.maxDiffChars < 500) {
    throw new Error(`maxDiffChars: ${c.maxDiffChars} is too low, use at least 500`);
  }
  if (c.instructionsMaxChars < 0) {
    throw new Error("instructionsMaxChars: cannot be negative");
  }
  if (!isOneOf(bodyModes, c.body)) {
    throw notOneOf("body", c.body, bodyModes);
  }
  if (!isOneOf(modes, c.color)) {
    throw notOneOf("color", c.color, modes);
  }
  if (!isOneOf(modes, c.unicode)) {
    throw notOneOf("unicode", c.unicode, modes);
  }
}

export function allowsType(c: Config, type: string): boolean {
  return c.types.includes(type);
}

export function serialize(c: Config): string {
  const out: Record<string, unknown> = {};
  for (const key of keyOrder) {
    const value = c[key];
    if (value === undefined) {
      continue;
    }
    if (omitWhenEmpty.has(key) && (value === "" || (Array.isArray(value) && value.length === 0))) {
      continue;
    }
    out[key] = value;
  }
  return JSON.stringify(out, null, 2);
}

function isOneOf(allowed: readonly string[], value: string): boolean {
  return allowed.includes(value);
}

function notOneOf(key: string, value: string, allowed: readonly string[]): Error {
  return new Error(`${key}: "${value}" is not one of ${allowed.join(", ")}`);
}
