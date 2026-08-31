import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GitMissingError, NotARepoError } from "../../app/errors";
import type { CommitOptions, GitClient, Stats } from "../../app/ports";

const maxBuffer = 256 * 1024 * 1024;

export class SpawnGit implements GitClient {
  constructor(private readonly cwd?: string) {}

  repoRoot(): string {
    try {
      return this.run(["rev-parse", "--show-toplevel"]).trim();
    } catch (err) {
      if (err instanceof GitMissingError) {
        throw err;
      }
      throw new NotARepoError();
    }
  }

  stagedStats(): Stats {
    return parseNumstat(this.run(["diff", "--cached", "--numstat"]));
  }

  stagedStat(): string {
    return this.run(["diff", "--cached", "--stat", "--no-color"]);
  }

  stagedDiff(exclude: string[]): string {
    return this.run(["diff", "--cached", "--no-color", ...excludeArgs(exclude)]);
  }

  excludedFiles(exclude: string[]): string[] {
    if (exclude.length === 0) {
      return [];
    }
    const kept = new Set(this.stagedNames(exclude));
    return this.stagedNames([]).filter((name) => !kept.has(name));
  }

  recentMessages(count: number): string[] {
    return this.run(["log", "--no-merges", `--max-count=${count}`, "--format=%B%x1e"])
      .split("\x1e")
      .map((message) => message.trim())
      .filter((message) => message !== "");
  }

  commit(message: string, options: CommitOptions): string {
    const dir = mkdtempSync(path.join(tmpdir(), "commitron-"));
    try {
      const file = path.join(dir, "message.txt");
      writeFileSync(file, `${message}\n`);

      const args = ["commit", "-F", file];
      if (options.edit) {
        args.push("-e");
      }
      if (!options.verify) {
        args.push("--no-verify");
      }

      const result = spawnSync("git", args, { cwd: this.cwd, stdio: [0, 2, 2], windowsHide: true });
      if (result.error) {
        throw new Error(`git commit: ${result.error.message}`);
      }
      if (result.status !== 0) {
        throw new Error(`git commit: ${describeExit(result.status, result.signal)}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    return this.run(["rev-parse", "--short", "HEAD"]).trim();
  }

  private stagedNames(exclude: string[]): string[] {
    return this.run(["diff", "--cached", "--name-only", ...excludeArgs(exclude)])
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }

  private run(args: string[]): string {
    const result = spawnSync("git", args, {
      cwd: this.cwd,
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
}

export function parseNumstat(output: string): Stats {
  const stats: Stats = { files: 0, added: 0, removed: 0 };
  for (const raw of output.split("\n")) {
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

function describeExit(status: number | null, signal: NodeJS.Signals | null): string {
  return signal ? `killed by ${signal}` : `exit status ${status}`;
}
