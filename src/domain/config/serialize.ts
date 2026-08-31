import { SCHEMA_URL, type Config, type ConfigKey } from "./config";

export const keyOrder: ConfigKey[] = [
  "$schema",
  "model",
  "fallbackModel",
  "timeoutSeconds",
  "retries",
  "strictMcpConfig",
  "extraArgs",
  "language",
  "types",
  "scopes",
  "subjectMaxLength",
  "subjectCase",
  "scopeCase",
  "body",
  "bodyMaxLineLength",
  "maxDiffChars",
  "exclude",
  "guidelines",
  "examples",
  "history",
  "instructions",
  "instructionsMaxChars",
  "confirm",
  "verify",
  "color",
  "unicode",
];

const omitWhenEmpty = new Set<ConfigKey>(["$schema", "fallbackModel", "extraArgs", "instructions"]);

export function serialize(config: Config): string {
  const out: Record<string, unknown> = {};
  for (const key of keyOrder) {
    const value = config[key];
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

export const starter = `{
  "$schema": "${SCHEMA_URL}",

  "model": "sonnet",
  "language": "en",

  "subjectMaxLength": 72,
  "body": "auto",

  "exclude": ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "*.lock"],

  "guidelines": [],
  "examples": [],

  "confirm": true
}
`;
