import { describe, expect, it } from "vitest";
import { Failure } from "../../src/app/errors";
import { parseCommitFlags, parseConfigFlags, parseInitFlags } from "../../src/cli/flags";

describe("parseCommitFlags", () => {
  it("maps every flag", () => {
    expect(
      parseCommitFlags([
        "-m",
        "opus",
        "--config",
        "extra.json",
        "--color",
        "never",
        "-e",
        "-y",
        "--dry-run",
        "--no-verify",
        "--no-init",
      ]),
    ).toEqual({
      model: "opus",
      configPath: "extra.json",
      color: "never",
      edit: true,
      yes: true,
      dryRun: true,
      noVerify: true,
      noInit: true,
      help: false,
      version: false,
    });
  });

  it("defaults everything off", () => {
    expect(parseCommitFlags([])).toMatchObject({
      model: "",
      configPath: "",
      edit: false,
      dryRun: false,
      help: false,
    });
  });

  it("accepts the long forms", () => {
    expect(parseCommitFlags(["--model", "haiku", "--edit", "--yes"])).toMatchObject({
      model: "haiku",
      edit: true,
      yes: true,
    });
  });

  it.each([["--help"], ["-h"]])("recognises %s", (flag) => {
    expect(parseCommitFlags([flag]).help).toBe(true);
  });

  it.each([["--version"], ["-v"]])("recognises %s", (flag) => {
    expect(parseCommitFlags([flag]).version).toBe(true);
  });

  it("names an unknown flag, the command and the flags it does accept", () => {
    const failure = capture(() => parseCommitFlags(["--bogus"]));
    expect(failure.message).toBe('unknown flag --bogus for "commitron"');
    expect(failure.detail).toContain("commitron accepts: -m, --model <value>, --config <value>");
    expect(failure.detail).toContain("--help");
  });

  it("keeps the parser's message for a missing value", () => {
    const failure = capture(() => parseCommitFlags(["--model"]));
    expect(failure.message).toContain("--model");
    expect(failure.message).not.toContain("To specify");
    expect(failure.detail).toContain("commitron accepts:");
  });
});

describe("flags are per command", () => {
  it("rejects a main-command flag on init", () => {
    const failure = capture(() => parseInitFlags(["--color", "never"]));
    expect(failure.message).toBe('unknown flag --color for "commitron init"');
    expect(failure.detail).toContain("commitron init accepts: --global, --full, --force");
  });

  it("rejects a main-command flag on config", () => {
    const failure = capture(() => parseConfigFlags(["--color", "never"]));
    expect(failure.message).toBe('unknown flag --color for "commitron config"');
    expect(failure.detail).toContain("commitron config accepts: --config <value>");
  });
});

function capture(run: () => unknown): Failure {
  try {
    run();
  } catch (err) {
    if (err instanceof Failure) {
      return err;
    }
    throw err;
  }
  throw new Error("expected a failure");
}

describe("parseInitFlags", () => {
  it("maps the init flags", () => {
    expect(parseInitFlags(["--global", "--force"])).toEqual({
      global: true,
      full: false,
      force: true,
    });
    expect(parseInitFlags(["--full"])).toEqual({ global: false, full: true, force: false });
  });
});

describe("parseConfigFlags", () => {
  it("maps --config", () => {
    expect(parseConfigFlags(["--config", "c.json"])).toEqual({ configPath: "c.json" });
    expect(parseConfigFlags([])).toEqual({ configPath: "" });
  });
});
