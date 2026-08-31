import path from "node:path";
import { decodeConfig, defaults, validateConfig, type Config, type Mode } from "../domain/config";
import { errorMessage } from "../utils/errors";
import { isRecord } from "../utils/guards";
import { fail } from "./errors";
import type { Dependencies, Environment, Files } from "./ports";

export const FILE_NAME = ".commitron.json";

export const PACKAGE_JSON_KEY = "commitron";

export interface LoadResult {
  config: Config;
  sources: string[];
}

export interface ConfigOverrides {
  configPath?: string;
  model?: string;
  color?: string;
  noVerify?: boolean;
}

type ConfigDependencies = Pick<Dependencies, "files" | "environment">;

export function globalConfigPath(environment: Environment): string {
  return path.join(userConfigDir(environment), "commitron", "config.json");
}

function userConfigDir({ platform, variables }: Environment): string {
  const required = (name: string): string => {
    const value = variables[name];
    if (!value) {
      throw new Error(`%${name}% is not defined`);
    }
    return value;
  };
  switch (platform) {
    case "win32":
      return required("AppData");
    case "darwin":
      return path.join(required("HOME"), "Library", "Application Support");
    default: {
      const xdg = variables.XDG_CONFIG_HOME;
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

export function loadConfig(
  deps: ConfigDependencies,
  repoRoot: string,
  explicitPath: string,
): LoadResult {
  const result: LoadResult = { config: defaults(), sources: [] };

  const global = optionalGlobalPath(deps.environment);
  if (global) {
    applyFile(deps.files, result, global, false);
  }
  if (repoRoot) {
    applyPackageJson(deps.files, result, path.join(repoRoot, "package.json"));
    applyFile(deps.files, result, path.join(repoRoot, FILE_NAME), false);
  }
  if (explicitPath) {
    applyFile(deps.files, result, explicitPath, true);
  }
  return result;
}

function optionalGlobalPath(environment: Environment): string | undefined {
  try {
    return globalConfigPath(environment);
  } catch {
    return undefined;
  }
}

function applyFile(files: Files, result: LoadResult, file: string, required: boolean): void {
  let data: string | undefined;
  try {
    data = files.read(file);
  } catch (err) {
    throw new Error(`reading ${file}: ${errorMessage(err)}`, { cause: err });
  }
  if (data === undefined) {
    if (required) {
      throw new Error(`reading ${file}: no such file`);
    }
    return;
  }
  try {
    result.config = decodeConfig(result.config, data);
  } catch (err) {
    throw new Error(`${file}: ${errorMessage(err)}`, { cause: err });
  }
  result.sources.push(file);
}

function applyPackageJson(files: Files, result: LoadResult, file: string): void {
  let wrapper: unknown;
  try {
    const data = files.read(file);
    if (data === undefined) {
      return;
    }
    wrapper = JSON.parse(data);
  } catch {
    return;
  }
  if (!isRecord(wrapper) || !Object.hasOwn(wrapper, PACKAGE_JSON_KEY)) {
    return;
  }
  try {
    result.config = decodeConfig(result.config, wrapper[PACKAGE_JSON_KEY]);
  } catch (err) {
    throw new Error(`${file} ("${PACKAGE_JSON_KEY}"): ${errorMessage(err)}`, { cause: err });
  }
  result.sources.push(`${file} (${PACKAGE_JSON_KEY})`);
}

export function resolveConfig(
  deps: ConfigDependencies,
  repoRoot: string,
  overrides: ConfigOverrides,
): LoadResult {
  let result: LoadResult;
  try {
    result = loadConfig(deps, repoRoot, overrides.configPath ?? "");
  } catch (err) {
    throw fail("invalid configuration", errorMessage(err));
  }
  result.config = applyOverrides(result.config, overrides);
  try {
    validateConfig(result.config);
  } catch (err) {
    throw fail("invalid configuration", errorMessage(err));
  }
  return result;
}

function applyOverrides(config: Config, overrides: ConfigOverrides): Config {
  const out = { ...config };
  if (overrides.model) {
    out.model = overrides.model;
  }
  if (overrides.color) {
    out.color = overrides.color as Mode;
  }
  if (overrides.noVerify) {
    out.verify = false;
  }
  return out;
}
