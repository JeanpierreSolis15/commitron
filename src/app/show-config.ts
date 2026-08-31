import { errorMessage } from "../utils/errors";
import { loadConfig, type ConfigOverrides, type LoadResult } from "./config";
import { fail } from "./errors";
import type { Dependencies, GitClient } from "./ports";

type ShowConfigDependencies = Pick<Dependencies, "git" | "files" | "environment">;

export function showConfig(deps: ShowConfigDependencies, overrides: ConfigOverrides): LoadResult {
  const root = optionalRepoRoot(deps.git);
  try {
    return loadConfig(deps, root, overrides.configPath ?? "");
  } catch (err) {
    throw fail("invalid configuration", errorMessage(err));
  }
}

function optionalRepoRoot(git: GitClient): string {
  try {
    return git.repoRoot();
  } catch {
    return "";
  }
}
