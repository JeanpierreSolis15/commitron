import path from "node:path";
import { describe, expect, it } from "vitest";
import { commitStaged } from "../../src/app/commit";
import { FILE_NAME } from "../../src/app/config";
import { Cancelled, GitMissingError, NotARepoError } from "../../src/app/errors";
import { starter } from "../../src/domain/config";
import { command, signal, world, type World } from "../helpers/fakes";

function configured(variables: Record<string, string | undefined> = {}): World {
  const w = world(variables);
  w.files.write(path.join(w.git.repoRoot(), FILE_NAME), `{"model":"opus"}`);
  return w;
}

describe("commitStaged", () => {
  it("commits the normalised message after a yes", async () => {
    const w = configured();
    w.provider.reply = "<commit>Feat: Add the thing.\n\n- one</commit>";

    await commitStaged(w.deps, command(), signal());

    expect(w.provider.requests[0]?.model).toBe("opus");
    expect(w.presenter.statuses).toEqual(["reading staged changes", "asking opus", "validating"]);
    expect(w.presenter.shown?.text).toBe("feat: Add the thing\n\n- one");
    expect(w.presenter.shown?.warnings).toEqual([expect.stringContaining("capital")]);
    expect(w.git.commits).toEqual([
      { message: "feat: Add the thing\n\n- one", options: { edit: false, verify: true } },
    ]);
    expect(w.presenter.events).toEqual([
      "header opus 1",
      "begin",
      "end",
      "message",
      "confirm",
      "committed abc1234",
    ]);
  });

  it("shows the message and commits nothing on a dry run", async () => {
    const w = configured();
    await commitStaged(w.deps, command({ dryRun: true }), signal());
    expect(w.git.commits).toEqual([]);
    expect(w.presenter.events).toContain("dry-run");
    expect(w.presenter.events).not.toContain("confirm");
  });

  it("skips the confirmation with --yes", async () => {
    const w = configured();
    await commitStaged(w.deps, command({ yes: true }), signal());
    expect(w.presenter.events).not.toContain("confirm");
    expect(w.git.commits).toHaveLength(1);
  });

  it("skips the confirmation when the config says so", async () => {
    const w = world();
    w.files.write(path.join(w.git.repoRoot(), FILE_NAME), `{"confirm":false}`);
    await commitStaged(w.deps, command(), signal());
    expect(w.presenter.events).not.toContain("confirm");
    expect(w.git.commits).toHaveLength(1);
  });

  it("cancels when the answer is no", async () => {
    const w = configured();
    w.presenter.confirmAnswer = "no";
    await expect(commitStaged(w.deps, command(), signal())).rejects.toThrow(Cancelled);
    expect(w.git.commits).toEqual([]);
  });

  it("opens the editor when the answer is edit", async () => {
    const w = configured();
    w.presenter.confirmAnswer = "edit";
    await commitStaged(w.deps, command(), signal());
    expect(w.git.commits[0]?.options).toEqual({ edit: true, verify: true });
  });

  it("honours --edit and --no-verify", async () => {
    const w = configured();
    await commitStaged(w.deps, command({ edit: true, noVerify: true, yes: true }), signal());
    expect(w.git.commits[0]?.options).toEqual({ edit: true, verify: false });
  });

  it("fails when there is no terminal to confirm on", async () => {
    const w = configured();
    w.presenter.confirmAnswer = "unavailable";
    await expect(commitStaged(w.deps, command(), signal())).rejects.toThrow(/no terminal/);
    expect(w.git.commits).toEqual([]);
  });

  it("refuses an empty index", async () => {
    const w = configured();
    w.git.stats = { files: 0, added: 0, removed: 0 };
    await expect(commitStaged(w.deps, command(), signal())).rejects.toThrow(/nothing is staged/);
    expect(w.provider.requests).toEqual([]);
  });

  it("explains a missing git", async () => {
    const w = configured();
    w.git.root = new GitMissingError();
    await expect(commitStaged(w.deps, command(), signal())).rejects.toThrow(/git was not found/);
  });

  it("explains a missing repository", async () => {
    const w = configured();
    w.git.root = new NotARepoError();
    await expect(commitStaged(w.deps, command(), signal())).rejects.toThrow(/not a git repository/);
  });

  it("offers to create a config when none exists", async () => {
    const w = world();
    w.presenter.initAnswer = "repo";
    const file = path.join(w.git.repoRoot(), FILE_NAME);

    await commitStaged(w.deps, command({ yes: true }), signal());

    expect(w.files.read(file)).toBe(starter);
    expect(w.presenter.events.slice(0, 2)).toEqual(["ask-init", `wrote ${file}`]);
    expect(w.git.commits).toHaveLength(1);
  });

  it("carries on without a config when the offer is declined", async () => {
    const w = world();
    await commitStaged(w.deps, command({ yes: true }), signal());
    expect(w.presenter.events[0]).toBe("ask-init");
    expect(w.files.exists(path.join(w.git.repoRoot(), FILE_NAME))).toBe(false);
    expect(w.git.commits).toHaveLength(1);
  });

  it.each([
    ["--no-init", world(), command({ yes: true, noInit: true })],
    ["a dry run", world(), command({ dryRun: true })],
    ["COMMITRON_NO_INIT", world({ COMMITRON_NO_INIT: "1" }), command({ yes: true })],
  ])("does not offer a config with %s", async (_, w, cmd) => {
    await commitStaged(w.deps, cmd, signal());
    expect(w.presenter.events).not.toContain("ask-init");
  });

  it("does not offer a config when one already applies", async () => {
    const w = configured();
    await commitStaged(w.deps, command({ yes: true }), signal());
    expect(w.presenter.events).not.toContain("ask-init");
  });

  it("passes exclusions and project conventions into the prompt", async () => {
    const w = world();
    const root = w.git.repoRoot();
    w.files.write(path.join(root, FILE_NAME), `{"instructions":"CONVENTIONS.md"}`);
    w.files.write(path.join(root, "CONVENTIONS.md"), "Mention the ticket.");
    w.git.excluded = ["pnpm-lock.yaml"];

    await commitStaged(w.deps, command({ dryRun: true }), signal());

    const prompt = w.provider.requests[0]?.prompt ?? "";
    expect(prompt).toContain("Mention the ticket.");
    expect(prompt).toContain("excluded by configuration): pnpm-lock.yaml");
  });

  it("surfaces a git refusal as a failure", async () => {
    const w = configured();
    w.git.commit = () => {
      throw new Error("hook said no");
    };
    await expect(commitStaged(w.deps, command({ yes: true }), signal())).rejects.toThrow(
      /git refused the commit/,
    );
  });
});
