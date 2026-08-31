import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commit, excludedFiles, repoRoot, stagedDiff, stagedStat, stagedStats } from "../src/git";

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout;
}

function newRepo(): string {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "commitron-git-")));
  git(dir, "init", "--quiet");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "commit.gpgsign", "false");
  return repoRoot(dir);
}

function stage(dir: string, name: string, content: string): void {
  const file = path.join(dir, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  git(dir, "add", name);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("repoRoot", () => {
  it("fails outside a repository", () => {
    const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "commitron-norepo-")));
    vi.stubEnv("GIT_CEILING_DIRECTORIES", path.dirname(dir));
    expect(() => repoRoot(dir)).toThrow();
  });
});

describe("stagedStats", () => {
  it("counts files and lines", () => {
    const dir = newRepo();
    expect(stagedStats(dir)).toEqual({ files: 0, added: 0, removed: 0 });

    stage(dir, "a.txt", "one\ntwo\nthree\n");
    stage(dir, "b.txt", "four\n");
    expect(stagedStats(dir)).toEqual({ files: 2, added: 4, removed: 0 });
  });
});

describe("stagedDiff", () => {
  it("honours exclusions", () => {
    const dir = newRepo();
    stage(dir, "src.go", "package main\n");
    stage(dir, "pnpm-lock.yaml", "lockfileVersion: 9\nnoise: everywhere\n");

    expect(stagedDiff([], dir)).toContain("lockfileVersion");

    const filtered = stagedDiff(["pnpm-lock.yaml"], dir);
    expect(filtered).not.toContain("lockfileVersion");
    expect(filtered).toContain("package main");
  });

  it("matches globs at any depth", () => {
    const dir = newRepo();
    stage(dir, "src.go", "package main\n");
    stage(dir, "nested/deep/thing.lock", "generated\n");

    expect(stagedDiff(["*.lock"], dir)).not.toContain("generated");
  });
});

describe("excludedFiles", () => {
  it("lists what the patterns dropped", () => {
    const dir = newRepo();
    stage(dir, "src.go", "package main\n");
    stage(dir, "pnpm-lock.yaml", "lockfileVersion: 9\n");

    expect(excludedFiles(["pnpm-lock.yaml"], dir)).toEqual(["pnpm-lock.yaml"]);
    expect(excludedFiles([], dir)).toEqual([]);
  });
});

describe("stagedStat", () => {
  it("keeps excluded files in the list", () => {
    const dir = newRepo();
    stage(dir, "src.go", "package main\n");
    stage(dir, "pnpm-lock.yaml", "lockfileVersion: 9\n");

    expect(stagedStat(dir)).toContain("pnpm-lock.yaml");
  });
});

describe("commit", () => {
  it("writes the message and empties the index", () => {
    const dir = newRepo();
    stage(dir, "a.txt", "hello\n");

    const sha = commit(
      "feat: add a.txt\n\n- because tests need a subject",
      { edit: false, verify: true },
      dir,
    );
    expect(sha.length).toBeGreaterThanOrEqual(6);

    const body = git(dir, "log", "-1", "--pretty=%B");
    expect(body).toContain("feat: add a.txt");
    expect(body).toContain("because tests need a subject");
    expect(stagedStats(dir).files).toBe(0);
  });
});
