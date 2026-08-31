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

  it("turns an unknown flag into a failure with a hint", () => {
    expect(() => parseCommitFlags(["--bogus"])).toThrow(Failure);
    try {
      parseCommitFlags(["--bogus"]);
    } catch (err) {
      expect((err as Failure).detail).toContain("--help");
    }
  });
});

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
