import path from "node:path";
import type { Config } from "../domain/config";
import { parse, render, sanitize, validateMessage, type Parsed } from "../domain/message";
import { buildPrompt, buildRevisionPrompt, type PromptInput } from "../domain/prompt";
import { errorMessage } from "../utils/errors";
import { truncate } from "../utils/text";
import { Cancelled, fail, GenerationAbortedError, ProviderMissingError } from "./errors";
import type { Dependencies, Files, GenerationRequest, GitClient } from "./ports";

export interface Generated {
  text: string;
  parsed: Parsed;
  warnings: string[];
  notices: string[];
}

type Attempt = Pick<Generated, "text" | "parsed" | "warnings">;

type Changes = Pick<PromptInput, "stat" | "diff" | "excluded">;

type GenerateDependencies = Pick<Dependencies, "git" | "provider" | "files">;

const historyMessageMaxChars = 500;

export async function generateMessage(
  deps: GenerateDependencies,
  root: string,
  config: Config,
  status: (text: string) => void,
  signal: AbortSignal,
): Promise<Generated> {
  status("reading staged changes");
  let changes: Changes;
  try {
    changes = collectDiff(deps.git, config);
  } catch (err) {
    throw fail("could not read the staged diff", errorMessage(err));
  }

  const notices: string[] = [];
  const [instructions, notice] = loadInstructions(deps.files, root, config);
  if (notice !== "") {
    notices.push(notice);
  }
  const history = collectHistory(deps.git, config.history);
  const prompt = buildPrompt(config, { ...changes, instructions, history });

  status(`asking ${config.model}`);
  let best = await attempt(deps, config, prompt, signal, status);
  for (let retry = 0; retry < config.retries && best.warnings.length > 0; retry++) {
    status(`revising with ${config.model}`);
    const revision = buildRevisionPrompt(prompt, best.text, best.warnings);
    const revised = await attemptQuietly(deps, config, revision, signal, status);
    if (revised && revised.warnings.length < best.warnings.length) {
      best = revised;
    }
  }
  return { ...best, notices };
}

async function attempt(
  deps: GenerateDependencies,
  config: Config,
  prompt: string,
  signal: AbortSignal,
  status: (text: string) => void,
): Promise<Attempt> {
  let raw: string;
  try {
    raw = await deps.provider.generate(generationRequest(config, prompt), signal);
  } catch (err) {
    throw generationError(err);
  }

  status("validating");
  const text = sanitize(raw);
  if (text === "") {
    throw fail("the model returned an empty message");
  }
  const parsed = parse(text);
  if (!parsed) {
    throw fail("the reply is not a Conventional Commits message", text);
  }
  let warnings: string[];
  try {
    warnings = validateMessage(parsed, config);
  } catch (err) {
    throw fail("the message does not match your config", `${errorMessage(err)}\n\n${text}`);
  }
  const rendered = render(parsed, config);
  return { text: rendered, parsed: parse(rendered) ?? parsed, warnings };
}

async function attemptQuietly(
  deps: GenerateDependencies,
  config: Config,
  prompt: string,
  signal: AbortSignal,
  status: (text: string) => void,
): Promise<Attempt | null> {
  try {
    return await attempt(deps, config, prompt, signal, status);
  } catch (err) {
    if (err instanceof Cancelled) {
      throw err;
    }
    return null;
  }
}

function generationRequest(config: Config, prompt: string): GenerationRequest {
  return {
    prompt,
    model: config.model,
    fallbackModel: config.fallbackModel ?? "",
    strictMcpConfig: config.strictMcpConfig,
    isolated: config.isolated,
    extraArgs: config.extraArgs ?? [],
    timeoutSeconds: config.timeoutSeconds,
  };
}

function generationError(err: unknown): Error {
  if (err instanceof ProviderMissingError) {
    return fail(
      "the `claude` CLI was not found on your PATH",
      "commitron uses your Claude Code subscription.\ninstall it from https://claude.com/claude-code and try again",
    );
  }
  if (err instanceof GenerationAbortedError) {
    return new Cancelled();
  }
  return fail("could not generate the message", errorMessage(err));
}

function collectDiff(git: GitClient, config: Config): Changes {
  const stat = git.stagedStat();
  const diff = git.stagedDiff(config.exclude);
  if (diff.trim() === "") {
    return { stat, diff: git.stagedDiff([]), excluded: [] };
  }
  let excluded: string[];
  try {
    excluded = git.excludedFiles(config.exclude);
  } catch {
    excluded = [];
  }
  return { stat, diff, excluded };
}

function collectHistory(git: GitClient, count: number): string[] {
  if (count <= 0) {
    return [];
  }
  try {
    return git
      .recentMessages(count)
      .map((message) => truncate(message.trim(), historyMessageMaxChars)[0])
      .filter((message) => message !== "");
  } catch {
    return [];
  }
}

export function loadInstructions(files: Files, root: string, config: Config): [string, string] {
  if (!config.instructions) {
    return ["", ""];
  }
  const file = path.isAbsolute(config.instructions)
    ? config.instructions
    : path.join(root, config.instructions);
  let data: string | undefined;
  try {
    data = files.read(file);
  } catch {
    data = undefined;
  }
  if (data === undefined) {
    return ["", `instructions file not found: ${config.instructions}`];
  }
  const [text, truncated] = truncate(data.trim(), config.instructionsMaxChars);
  const warning = truncated
    ? `instructions truncated to ${config.instructionsMaxChars} characters`
    : "";
  return [text, warning];
}
