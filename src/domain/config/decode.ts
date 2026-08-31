import { isRecord } from "../../utils/guards";
import type { Config, ConfigKey } from "./config";

type Kind = "string" | "integer" | "boolean" | "strings";

const fields: Record<ConfigKey, Kind> = {
  $schema: "string",
  model: "string",
  fallbackModel: "string",
  timeoutSeconds: "integer",
  strictMcpConfig: "boolean",
  extraArgs: "strings",
  language: "string",
  types: "strings",
  subjectMaxLength: "integer",
  subjectCase: "string",
  scopeCase: "string",
  body: "string",
  bodyMaxLineLength: "integer",
  maxDiffChars: "integer",
  exclude: "strings",
  instructions: "string",
  instructionsMaxChars: "integer",
  confirm: "boolean",
  verify: "boolean",
  color: "string",
  unicode: "string",
};

export function decodeConfig(base: Config, source: string | unknown): Config {
  const data: unknown = typeof source === "string" ? JSON.parse(source) : source;
  if (!isRecord(data)) {
    throw new Error("expected a JSON object");
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(data)) {
    if (!Object.hasOwn(fields, key)) {
      throw new Error(`unknown field "${key}"`);
    }
    const kind = fields[key as ConfigKey];
    if (value === null) {
      if (kind === "strings") {
        out[key] = [];
      }
      continue;
    }
    out[key] = coerce(key, kind, value);
  }
  return out as unknown as Config;
}

function coerce(key: string, kind: Kind, value: unknown): unknown {
  switch (kind) {
    case "string":
      if (typeof value !== "string") {
        throw new Error(`${key}: expected a string`);
      }
      return value;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new Error(`${key}: expected an integer`);
      }
      return value;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`${key}: expected true or false`);
      }
      return value;
    case "strings":
      if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
        throw new Error(`${key}: expected an array of strings`);
      }
      return [...value];
  }
}
