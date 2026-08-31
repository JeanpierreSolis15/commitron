import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotARepoError } from "../../src/app/errors";
import { parseNumstat, SpawnGit } from "../../src/infra/git/spawn-git";

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout;
}

function newRepo(): { dir: string; client: SpawnGit } {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "commitron-git-")));
  git(dir, "init", "--quiet");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "commit.gpgsign", "false");
  const client = new SpawnGit(dir);
  return { dir: client.repoRoot(), client };
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

describe("parseNumstat", () => {
  it("adds up files and lines", () => {
    expect(parseNumstat("3\t0\ta.txt\n1\t2\tb.txt\n")).toEqual({ files: 2, added: 4, removed: 2 });
  });

  it("counts binary files without line numbers", () => {
    expect(parseNumstat("-\t-\timage.png\n")).toEqual({ files: 1, added: 0, removed: 0 });
  });

  it("ignores blank and malformed lines", () => {
    expect(parseNumstat("\n\nnot a stat line\n")).toEqual({ files: 0, added: 0, removed: 0 });
  });
});

describe("repoRoot", () => {
  it("fails outside a repository", () => {
    const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "commitron-norepo-")));
    vi.stubEnv("GIT_CEILING_DIRECTORIES", path.dirname(dir));
    expect(() => new SpawnGit(dir).repoRoot()).toThrow(NotARepoError);
  });
});

describe("stagedStats", () => {
  it("counts files and lines", () => {
    const { dir, client } = newRepo();
    expect(client.stagedStats()).toEqual({ files: 0, added: 0, removed: 0 });

    stage(dir, "a.txt", "one\ntwo\nthree\n");
    stage(dir, "b.txt", "four\n");
    expect(client.stagedStats()).toEqual({ files: 2, added: 4, removed: 0 });
  });
});

describe("stagedDiff", () => {
  it("honours exclusions", () => {
    const { dir, client } = newRepo();
    stage(dir, "src.go", "package main\n");
    stage(dir, "pnpm-lock.yaml", "lockfileVersion: 9\nnoise: everywhere\n");

    expect(client.stagedDiff([])).toContain("lockfileVersion");

    const filtered = client.stagedDiff(["pnpm-lock.yaml"]);
    expect(filtered).not.toContain("lockfileVersion");
    expect(filtered).toContain("package main");
  });

  it("matches globs at any depth", () => {
    const { dir, client } = newRepo();
    stage(dir, "src.go", "package main\n");
    stage(dir, "nested/deep/thing.lock", "generated\n");

    expect(client.stagedDiff(["*.lock"])).not.toContain("generated");
  });
});

describe("excludedFiles", () => {
  it("lists what the patterns dropped", () => {
    const { dir, client } = newRepo();
    stage(dir, "src.go", "package main\n");
    stage(dir, "pnpm-lock.yaml", "lockfileVersion: 9\n");

    expect(client.excludedFiles(["pnpm-lock.yaml"])).toEqual(["pnpm-lock.yaml"]);
    expect(client.excludedFiles([])).toEqual([]);
  });
});

describe("stagedStat", () => {
  it("keeps excluded files in the list", () => {
    const { dir, client } = newRepo();
    stage(dir, "src.go", "package main\n");
    stage(dir, "pnpm-lock.yaml", "lockfileVersion: 9\n");

    expect(client.stagedStat()).toContain("pnpm-lock.yaml");
  });
});

describe("commit", () => {
  it("writes the message and empties the index", () => {
    const { dir, client } = newRepo();
    stage(dir, "a.txt", "hello\n");

    const sha = client.commit("feat: add a.txt\n\n- because tests need a subject", {
      edit: false,
      verify: true,
    });
    expect(sha.length).toBeGreaterThanOrEqual(6);

    const body = git(dir, "log", "-1", "--pretty=%B");
    expect(body).toContain("feat: add a.txt");
    expect(body).toContain("because tests need a subject");
    expect(client.stagedStats().files).toBe(0);
  });
});
