import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export class GitMissingError extends Error {
  constructor() {
    super("git executable not found on PATH");
  }
}

export class NotARepoError extends Error {
  constructor() {
    super("not a git repository");
  }
}

export interface Stats {
  files: number;
  added: number;
  removed: number;
}

export interface CommitOptions {
  edit: boolean;
  verify: boolean;
}

const maxBuffer = 256 * 1024 * 1024;

function run(args: string[], cwd?: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new GitMissingError();
    }
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || describeExit(result.status, result.signal);
    throw new Error(`git ${args.join(" ")}: ${detail}`);
  }
  return result.stdout;
}

function describeExit(status: number | null, signal: NodeJS.Signals | null): string {
  return signal ? `killed by ${signal}` : `exit status ${status}`;
}

export function repoRoot(cwd?: string): string {
  try {
    return run(["rev-parse", "--show-toplevel"], cwd).trim();
  } catch (err) {
    if (err instanceof GitMissingError) {
      throw err;
    }
    throw new NotARepoError();
  }
}

export function stagedStats(cwd?: string): Stats {
  const stats: Stats = { files: 0, added: 0, removed: 0 };
  for (const raw of run(["diff", "--cached", "--numstat"], cwd).split("\n")) {
    const line = raw.trim();
    if (line === "") {
      continue;
    }
    const parts = line.split("\t");
    if (parts.length < 3) {
      continue;
    }
    stats.files++;
    stats.added += count(parts[0]);
    stats.removed += count(parts[1]);
  }
  return stats;
}

function count(field: string | undefined): number {
  const n = Number.parseInt(field ?? "", 10);
  return Number.isNaN(n) ? 0 : n;
}

function excludeArgs(patterns: string[]): string[] {
  const args = ["--", "."];
  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (trimmed !== "") {
      args.push(`:(exclude)${trimmed}`);
    }
  }
  return args.length === 2 ? [] : args;
}

export function stagedStat(cwd?: string): string {
  return run(["diff", "--cached", "--stat", "--no-color"], cwd);
}

export function stagedDiff(exclude: string[], cwd?: string): string {
  return run(["diff", "--cached", "--no-color", ...excludeArgs(exclude)], cwd);
}

function stagedNames(exclude: string[], cwd?: string): string[] {
  return run(["diff", "--cached", "--name-only", ...excludeArgs(exclude)], cwd)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function excludedFiles(exclude: string[], cwd?: string): string[] {
  if (exclude.length === 0) {
    return [];
  }
  const kept = new Set(stagedNames(exclude, cwd));
  return stagedNames([], cwd).filter((name) => !kept.has(name));
}

export function commit(message: string, opts: CommitOptions, cwd?: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "commitron-"));
  try {
    const file = path.join(dir, "message.txt");
    writeFileSync(file, message + "\n");

    const args = ["commit", "-F", file];
    if (opts.edit) {
      args.push("-e");
    }
    if (!opts.verify) {
      args.push("--no-verify");
    }

    const result = spawnSync("git", args, { cwd, stdio: [0, 2, 2], windowsHide: true });
    if (result.error) {
      throw new Error(`git commit: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(`git commit: ${describeExit(result.status, result.signal)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return run(["rev-parse", "--short", "HEAD"], cwd).trim();
}
