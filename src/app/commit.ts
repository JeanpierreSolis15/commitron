import type { Config } from "../domain/config";
import { errorMessage } from "../utils/errors";
import { resolveConfig, type ConfigOverrides } from "./config";
import { Cancelled, fail, GitMissingError } from "./errors";
import { generateMessage, type Generated } from "./generate";
import { offerInit } from "./init";
import type { Dependencies, Presenter, Stats } from "./ports";

export interface CommitCommand extends ConfigOverrides {
  edit: boolean;
  yes: boolean;
  dryRun: boolean;
  noInit: boolean;
}

export async function commitStaged(
  deps: Dependencies,
  command: CommitCommand,
  signal: AbortSignal,
): Promise<void> {
  const root = requireRepoRoot(deps);
  const loaded = resolveConfig(deps, root, command);
  let config = loaded.config;
  const presenter = deps.presenter(config);

  if (shouldOfferInit(deps, loaded.sources.length, command)) {
    config = await offerInit(deps, presenter, root, config, command, signal);
  }

  const stats = readStats(deps);
  if (stats.files === 0) {
    throw fail("nothing is staged", "stage what you want to commit first: git add <path>");
  }

  presenter.header(config.model, stats);
  const progress = presenter.begin();
  let generated;
  try {
    generated = await generateMessage(deps, root, config, (text) => progress.status(text), signal);
  } finally {
    progress.end();
  }

  presenter.message(generated.text, generated.parsed, [
    ...generated.notices,
    ...generated.warnings,
  ]);
  if (command.dryRun) {
    presenter.dryRun();
    return;
  }
  await commit(deps, presenter, config, command, generated, signal);
}

function requireRepoRoot(deps: Dependencies): string {
  try {
    return deps.git.repoRoot();
  } catch (err) {
    if (err instanceof GitMissingError) {
      throw fail("git was not found on your PATH", "commitron drives git; install it first");
    }
    throw fail(
      "this is not a git repository",
      "run commitron from inside a repo, or `git init` first",
    );
  }
}

function shouldOfferInit(deps: Dependencies, sources: number, command: CommitCommand): boolean {
  return (
    sources === 0 &&
    !command.noInit &&
    !command.dryRun &&
    !deps.environment.variables.COMMITRON_NO_INIT
  );
}

function readStats(deps: Dependencies): Stats {
  try {
    return deps.git.stagedStats();
  } catch (err) {
    throw fail("could not read the staging area", errorMessage(err));
  }
}

async function commit(
  deps: Dependencies,
  presenter: Presenter,
  config: Config,
  command: CommitCommand,
  generated: Generated,
  signal: AbortSignal,
): Promise<void> {
  let edit = command.edit;
  const unattended = !config.confirm || command.yes;
  if (unattended && generated.warnings.length > 0) {
    throw fail(
      "the message still breaks your rules and nobody is confirming it",
      `${generated.warnings.join("\n")}\n\nreview it with --dry-run, or commit it after confirming it yourself`,
    );
  }
  if (!unattended) {
    switch (await presenter.confirm(signal)) {
      case "no":
        throw new Cancelled();
      case "edit":
        edit = true;
        break;
      case "unavailable":
        throw fail(
          "there is no terminal to confirm on",
          "pass --yes to commit without confirming, or --dry-run to only see the message",
        );
    }
  }

  let sha: string;
  try {
    sha = deps.git.commit(generated.text, { edit, verify: config.verify });
  } catch (err) {
    throw fail("git refused the commit", errorMessage(err));
  }
  presenter.committed(sha);
}
