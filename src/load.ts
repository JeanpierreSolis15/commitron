import { readFileSync } from "node:fs";
import path from "node:path";
import { defaults, type Config } from "./config";

export const FILE_NAME = ".commitron.json";

export const PACKAGE_JSON_KEY = "commitron";

export interface LoadResult {
  config: Config;
  sources: string[];
}

type Kind = "string" | "integer" | "boolean" | "strings";

const fields: Record<keyof Config, Kind> = {
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

export function globalPath(): string {
  return path.join(userConfigDir(), "commitron", "config.json");
}

function userConfigDir(): string {
  switch (process.platform) {
    case "win32":
      return required("AppData");
    case "darwin":
      return path.join(required("HOME"), "Library", "Application Support");
    default: {
      const xdg = process.env.XDG_CONFIG_HOME;
      if (xdg) {
        if (!path.isAbsolute(xdg)) {
          throw new Error("path in $XDG_CONFIG_HOME is relative");
        }
        return xdg;
      }
      return path.join(required("HOME"), ".config");
    }
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`%${name}% is not defined`);
  }
  return value;
}

export function load(repoRoot: string, explicitPath: string): LoadResult {
  const res: LoadResult = { config: defaults(), sources: [] };

  let global: string | undefined;
  try {
    global = globalPath();
  } catch {
    global = undefined;
  }
  if (global) {
    applyFile(res, global, false);
  }
  if (repoRoot) {
    applyPackageJSON(res, path.join(repoRoot, "package.json"));
    applyFile(res, path.join(repoRoot, FILE_NAME), false);
  }
  if (explicitPath) {
    applyFile(res, explicitPath, true);
  }
  return res;
}

function applyFile(res: LoadResult, file: string, requiredFile: boolean): void {
  let data: string;
  try {
    data = readFileSync(file, "utf8");
  } catch (err) {
    if (!requiredFile && isNotFound(err)) {
      return;
    }
    throw new Error(`reading ${file}: ${errorMessage(err)}`, { cause: err });
  }
  try {
    decodeInto(res.config, data);
  } catch (err) {
    throw new Error(`${file}: ${errorMessage(err)}`, { cause: err });
  }
  res.sources.push(file);
}

function applyPackageJSON(res: LoadResult, file: string): void {
  let wrapper: unknown;
  try {
    wrapper = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return;
  }
  if (!isObject(wrapper) || !Object.hasOwn(wrapper, PACKAGE_JSON_KEY)) {
    return;
  }
  try {
    decodeInto(res.config, wrapper[PACKAGE_JSON_KEY]);
  } catch (err) {
    throw new Error(`${file} ("${PACKAGE_JSON_KEY}"): ${errorMessage(err)}`, { cause: err });
  }
  res.sources.push(`${file} (${PACKAGE_JSON_KEY})`);
}

export function decodeInto(cfg: Config, source: string | unknown): void {
  const data: unknown = typeof source === "string" ? JSON.parse(source) : source;
  if (!isObject(data)) {
    throw new Error("expected a JSON object");
  }
  const target = cfg as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(data)) {
    if (!Object.hasOwn(fields, key)) {
      throw new Error(`unknown field "${key}"`);
    }
    const kind = fields[key as keyof Config];
    if (value === null) {
      if (kind === "strings") {
        target[key] = [];
      }
      continue;
    }
    target[key] = coerce(key, kind, value);
  }
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
