import { readFileSync } from "node:fs";
import path from "node:path";
import { Cancelled, fail, parseFlags, usage, version } from "./cli";
import { validate, type Config } from "./config";
import {
  commit as gitCommit,
  excludedFiles,
  GitMissingError,
  repoRoot,
  stagedDiff,
  stagedStat,
  stagedStats,
} from "./git";
import { globalConfigPath, writeConfig } from "./init";
import { errorMessage, FILE_NAME, load, type LoadResult } from "./load";
import { parse, sanitize, validate as validateMessage, type Parsed } from "./message";
import { render } from "./normalize";
import { build, truncate, type PromptInput } from "./prompt";
import { AbortedError, Claude, NotInstalledError, type Provider } from "./provider";
import { askInit, confirm, header, message, warn } from "./ui/output";
import type { Spinner } from "./ui/spinner";
import { Spinner as NewSpinner } from "./ui/spinner";
import { isTerminal, Theme } from "./ui/theme";

export interface CommitFlags {
  model: string;
  configPath: string;
  color: string;
  edit: boolean;
  yes: boolean;
  dryRun: boolean;
  noVerify: boolean;
  noInit: boolean;
}

interface Generated {
  text: string;
  warnings: string[];
}

function parseCommitFlags(argv: string[]): { flags: CommitFlags; done: boolean } {
  const values = parseFlags(argv, {
    model: { type: "string", short: "m", default: "" },
    config: { type: "string", default: "" },
    color: { type: "string", default: "" },
    edit: { type: "boolean", short: "e", default: false },
    yes: { type: "boolean", short: "y", default: false },
    "dry-run": { type: "boolean", default: false },
    "no-verify": { type: "boolean", default: false },
    "no-init": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
    version: { type: "boolean", short: "v", default: false },
  });
  const flags: CommitFlags = {
    model: values.model ?? "",
    configPath: values.config ?? "",
    color: values.color ?? "",
    edit: values.edit === true,
    yes: values.yes === true,
    dryRun: values["dry-run"] === true,
    noVerify: values["no-verify"] === true,
    noInit: values["no-init"] === true,
  };
  if (values.help) {
    process.stdout.write(usage);
    return { flags, done: true };
  }
  if (values.version) {
    process.stdout.write(`${version()}\n`);
    return { flags, done: true };
  }
  return { flags, done: false };
}

export async function runCommit(argv: string[]): Promise<void> {
  const { flags, done } = parseCommitFlags(argv);
  if (done) {
    return;
  }

  const root = findRoot();
  const res = resolveConfig(root, flags);
  let cfg = res.config;
  const theme = new Theme(cfg.color, cfg.unicode);

  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  process.on("SIGINT", onInterrupt);
  try {
    if (shouldOfferInit(res, flags)) {
      cfg = await offerInit(theme, root, cfg, flags, controller.signal);
    }

    let stats;
    try {
      stats = stagedStats();
    } catch (err) {
      throw fail("could not read the staging area", errorMessage(err));
    }
    if (stats.files === 0) {
      throw fail("nothing is staged", "stage what you want to commit first: git add <path>");
    }

    process.stderr.write(`${header(theme, cfg.model, stats.files, stats.added, stats.removed)}\n`);
    const spinner = new NewSpinner(theme);
    spinner.start();
    let generated: Generated;
    try {
      generated = await generate(root, cfg, spinner, controller.signal);
    } finally {
      spinner.stop();
    }

    const shown = parse(generated.text) as Parsed;
    process.stderr.write(`\n${message(theme, shown)}\n`);
    for (const warning of generated.warnings) {
      warn(theme, warning);
    }
    if (!isTerminal(process.stdout)) {
      process.stdout.write(`${generated.text}\n`);
    }

    if (flags.dryRun) {
      process.stderr.write(`\n  ${theme.dim(`dry run ${theme.glyph.dot} nothing committed`)}\n`);
      return;
    }
    await commit(theme, cfg, flags, generated.text, controller.signal);
  } finally {
    process.off("SIGINT", onInterrupt);
  }
}

function findRoot(): string {
  try {
    return repoRoot();
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

export function resolveConfig(root: string, flags: CommitFlags): LoadResult {
  let res: LoadResult;
  try {
    res = load(root, flags.configPath);
  } catch (err) {
    throw fail("invalid configuration", errorMessage(err));
  }
  res.config = applyFlags(res.config, flags);
  try {
    validate(res.config);
  } catch (err) {
    throw fail("invalid configuration", errorMessage(err));
  }
  return res;
}

function applyFlags(cfg: Config, f: CommitFlags): Config {
  const out = { ...cfg };
  if (f.model !== "") {
    out.model = f.model;
  }
  if (f.color !== "") {
    out.color = f.color as Config["color"];
  }
  if (f.noVerify) {
    out.verify = false;
  }
  return out;
}

function shouldOfferInit(res: LoadResult, flags: CommitFlags): boolean {
  return (
    res.sources.length === 0 && !flags.noInit && !flags.dryRun && !process.env.COMMITRON_NO_INIT
  );
}

async function offerInit(
  theme: Theme,
  root: string,
  cfg: Config,
  flags: CommitFlags,
  signal: AbortSignal,
): Promise<Config> {
  let file: string;
  switch (await askInit(theme, signal)) {
    case "repo":
      file = path.join(root, FILE_NAME);
      break;
    case "global":
      file = globalConfigPath();
      break;
    default:
      return cfg;
  }

  const written = writeConfig(file, false, false);
  process.stderr.write(`  ${theme.ok(theme.glyph.ok)} ${theme.dim(`wrote ${written}`)}\n\n`);

  return resolveConfig(root, flags).config;
}

async function generate(
  root: string,
  cfg: Config,
  spinner: Spinner,
  signal: AbortSignal,
): Promise<Generated> {
  spinner.status("reading staged changes");
  let input: PromptInput;
  try {
    input = collectDiff(cfg);
  } catch (err) {
    throw fail("could not read the staged diff", errorMessage(err));
  }

  const warnings: string[] = [];
  const [instructions, warning] = loadInstructions(root, cfg);
  if (warning !== "") {
    warnings.push(warning);
  }
  const promptText = build(cfg, input, instructions);

  spinner.status(`asking ${cfg.model}`);
  let raw: string;
  try {
    raw = await newProvider(cfg).generate(promptText, signal);
  } catch (err) {
    throw generationError(err);
  }

  spinner.status("validating");
  const text = sanitize(raw);
  if (text === "") {
    throw fail("the model returned an empty message");
  }
  const parsed = parse(text);
  if (!parsed) {
    throw fail("the reply is not a Conventional Commits message", text);
  }
  let more: string[];
  try {
    more = validateMessage(parsed, cfg);
  } catch (err) {
    throw fail("the message does not match your config", `${errorMessage(err)}\n\n${text}`);
  }
  return { text: render(parsed, cfg), warnings: [...warnings, ...more] };
}

function newProvider(cfg: Config): Provider {
  return new Claude({
    model: cfg.model,
    fallbackModel: cfg.fallbackModel ?? "",
    strictMcpConfig: cfg.strictMcpConfig,
    extraArgs: cfg.extraArgs ?? [],
    timeoutSeconds: cfg.timeoutSeconds,
  });
}

function generationError(err: unknown): Error {
  if (err instanceof NotInstalledError) {
    return fail(
      "the `claude` CLI was not found on your PATH",
      "commitron uses your Claude Code subscription.\ninstall it from https://claude.com/claude-code and try again",
    );
  }
  if (err instanceof AbortedError) {
    return new Cancelled();
  }
  return fail("could not generate the message", errorMessage(err));
}

async function commit(
  theme: Theme,
  cfg: Config,
  flags: CommitFlags,
  text: string,
  signal: AbortSignal,
): Promise<void> {
  let edit = flags.edit;
  if (cfg.confirm && !flags.yes) {
    switch (await confirm(theme, signal)) {
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
    sha = gitCommit(text, { edit, verify: cfg.verify });
  } catch (err) {
    throw fail("git refused the commit", errorMessage(err));
  }
  process.stderr.write(
    `\n  ${theme.ok(theme.glyph.ok)} ${theme.head(sha)} ${theme.dim("committed")}\n`,
  );
}

function collectDiff(cfg: Config): PromptInput {
  const stat = stagedStat();
  const diff = stagedDiff(cfg.exclude);
  if (diff.trim() === "") {
    return { stat, diff: stagedDiff([]), excluded: [] };
  }
  let excluded: string[];
  try {
    excluded = excludedFiles(cfg.exclude);
  } catch {
    excluded = [];
  }
  return { stat, diff, excluded };
}

export function loadInstructions(root: string, cfg: Config): [string, string] {
  if (!cfg.instructions) {
    return ["", ""];
  }
  const file = path.isAbsolute(cfg.instructions)
    ? cfg.instructions
    : path.join(root, cfg.instructions);
  let data: string;
  try {
    data = readFileSync(file, "utf8");
  } catch {
    return ["", `instructions file not found: ${cfg.instructions}`];
  }
  const [text, truncated] = truncate(data.trim(), cfg.instructionsMaxChars);
  const warning = truncated
    ? `instructions truncated to ${cfg.instructionsMaxChars} characters`
    : "";
  return [text, warning];
}
