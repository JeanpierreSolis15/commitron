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
  retries: number;
  strictMcpConfig: boolean;
  isolated: boolean;
  extraArgs?: string[];
  language: string;
  types: string[];
  scopes: string[];
  subjectMaxLength: number;
  subjectCase: SubjectCase;
  scopeCase: ScopeCase;
  body: BodyMode;
  bodyMaxLineLength: number;
  maxDiffChars: number;
  exclude: string[];
  guidelines: string[];
  examples: string[];
  history: number;
  instructions?: string;
  instructionsMaxChars: number;
  confirm: boolean;
  verify: boolean;
  color: Mode;
  unicode: Mode;
}

export type ConfigKey = keyof Config;

export function defaults(): Config {
  return {
    model: "sonnet",
    timeoutSeconds: 120,
    retries: 1,
    strictMcpConfig: true,
    isolated: true,
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
    scopes: [],
    subjectMaxLength: 72,
    subjectCase: "lower",
    scopeCase: "lower",
    body: "auto",
    bodyMaxLineLength: 100,
    maxDiffChars: 30000,
    exclude: ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb", "*.lock", "*.snap"],
    guidelines: [],
    examples: [],
    history: 10,
    instructionsMaxChars: 4000,
    confirm: true,
    verify: true,
    color: "auto",
    unicode: "auto",
  };
}

export function allowsType(config: Config, type: string): boolean {
  return config.types.includes(type);
}

export function allowsScope(config: Config, scope: string): boolean {
  return scope === "" || config.scopes.length === 0 || config.scopes.includes(scope);
}
