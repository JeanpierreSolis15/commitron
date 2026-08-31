import path from "node:path";
import { describe, expect, it } from "vitest";
import { FILE_NAME } from "../../src/app/config";
import { NotARepoError } from "../../src/app/errors";
import { main, type CliContext } from "../../src/cli/cli";
import { FakeTerminal, signal, world, type World } from "../helpers/fakes";

function context(w: World = world()): { ctx: CliContext; terminal: FakeTerminal; w: World } {
  const terminal = new FakeTerminal();
  return { ctx: { deps: w.deps, terminal, version: "1.2.3", signal: signal() }, terminal, w };
}

describe("main", () => {
  it.each([["version"], ["--version"], ["-v"]])("prints the version with %s", async (arg) => {
    const { ctx, terminal } = context();
    expect(await main([arg], ctx)).toBe(0);
    expect(terminal.stdout).toBe("1.2.3\n");
  });

  it.each([["help"], ["--help"], ["-h"]])("prints the usage with %s", async (arg) => {
    const { ctx, terminal } = context();
    expect(await main([arg], ctx)).toBe(0);
    expect(terminal.stdout).toContain("Usage:");
  });

  it("rejects an unknown command with exit code 2", async () => {
    const { ctx, terminal } = context();
    expect(await main(["frobnicate"], ctx)).toBe(2);
    expect(terminal.stderr).toContain('unknown command "frobnicate"');
  });

  it("reports a bad flag with exit code 1", async () => {
    const { ctx, terminal } = context();
    expect(await main(["--bogus"], ctx)).toBe(1);
    expect(terminal.stderr).toContain('commitron: unknown flag --bogus for "commitron"');
    expect(terminal.stderr).toContain("--help");
  });

  it("tells a main-command flag apart from a subcommand's", async () => {
    const { ctx, terminal } = context();
    expect(await main(["config", "--color", "never"], ctx)).toBe(1);
    expect(terminal.stderr).toContain('unknown flag --color for "commitron config"');
    expect(terminal.stderr).toContain("commitron config accepts: --config <value>");
  });

  it("lists the flags of every command in the usage", async () => {
    const { ctx, terminal } = context();
    await main(["help"], ctx);
    expect(terminal.stdout).toContain("Flags of commitron:");
    expect(terminal.stdout).toContain("Flags of commitron init:");
    expect(terminal.stdout).toContain("Flags of commitron config:");
  });

  it("shows the resolved config and where it came from", async () => {
    const { ctx, terminal, w } = context();
    const file = path.join(w.git.repoRoot(), FILE_NAME);
    w.files.write(file, `{"model":"opus"}`);
    expect(await main(["config"], ctx)).toBe(0);
    expect(terminal.stdout).toContain('"model": "opus"');
    expect(terminal.stdout).toContain(`//   ${file}`);
  });

  it("says when only the defaults apply", async () => {
    const { ctx, terminal } = context();
    expect(await main(["config"], ctx)).toBe(0);
    expect(terminal.stdout).toContain("built-in defaults only");
  });

  it("creates a config with init", async () => {
    const { ctx, terminal, w } = context();
    const file = path.join(w.git.repoRoot(), FILE_NAME);
    expect(await main(["init"], ctx)).toBe(0);
    expect(terminal.stdout).toBe(`wrote ${file}\n`);
    expect(w.files.exists(file)).toBe(true);
  });

  it("runs the commit flow", async () => {
    const { ctx, w } = context();
    expect(await main(["--yes", "--no-init"], ctx)).toBe(0);
    expect(w.git.commits).toHaveLength(1);
  });

  it("reports a failure with exit code 1", async () => {
    const { ctx, terminal, w } = context();
    w.git.root = new NotARepoError();
    expect(await main(["--dry-run"], ctx)).toBe(1);
    expect(terminal.stderr).toContain("commitron: this is not a git repository");
    expect(terminal.stderr).toContain("  run commitron from inside a repo");
  });

  it("reports a cancellation", async () => {
    const { ctx, terminal, w } = context();
    w.presenter.confirmAnswer = "no";
    expect(await main(["--no-init"], ctx)).toBe(1);
    expect(terminal.stderr).toBe("  cancelled\n");
  });
});
