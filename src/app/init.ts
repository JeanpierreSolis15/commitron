import path from "node:path";
import { defaults, SCHEMA_URL, serialize, starter, type Config } from "../domain/config";
import { errorMessage } from "../utils/errors";
import { FILE_NAME, globalConfigPath, resolveConfig, type ConfigOverrides } from "./config";
import { fail } from "./errors";
import type { Dependencies, Environment, Files, GitClient, Presenter } from "./ports";

export interface InitCommand {
  global: boolean;
  full: boolean;
  force: boolean;
}

type InitDependencies = Pick<Dependencies, "git" | "files" | "environment">;

export function initConfig(deps: InitDependencies, command: InitCommand): string {
  const target = command.global
    ? requireGlobalPath(deps.environment)
    : path.join(requireRepoRoot(deps.git), FILE_NAME);
  return writeConfig(deps.files, target, command.full, command.force);
}

function requireRepoRoot(git: GitClient): string {
  try {
    return git.repoRoot();
  } catch {
    throw fail(
      "this is not a git repository",
      "use `commitron init --global` to write your user-wide config",
    );
  }
}

export function requireGlobalPath(environment: Environment): string {
  try {
    return globalConfigPath(environment);
  } catch (err) {
    throw fail("could not find your config directory", errorMessage(err));
  }
}

export function writeConfig(files: Files, file: string, full: boolean, force: boolean): string {
  if (files.exists(file) && !force) {
    throw fail(`${file} already exists`, "pass --force to overwrite it");
  }
  const content = full ? `${serialize({ ...defaults(), $schema: SCHEMA_URL })}\n` : starter;
  try {
    files.write(file, content);
  } catch (err) {
    throw fail(`could not write ${file}`, errorMessage(err));
  }
  return file;
}

export async function offerInit(
  deps: InitDependencies,
  presenter: Presenter,
  root: string,
  config: Config,
  overrides: ConfigOverrides,
  signal: AbortSignal,
): Promise<Config> {
  let file: string;
  switch (await presenter.askInit(signal)) {
    case "repo":
      file = path.join(root, FILE_NAME);
      break;
    case "global":
      file = requireGlobalPath(deps.environment);
      break;
    default:
      return config;
  }
  presenter.wrote(writeConfig(deps.files, file, false, false));
  return resolveConfig(deps, root, overrides).config;
}
