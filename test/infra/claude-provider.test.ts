import { describe, expect, it } from "vitest";
import { claudeArgs, quoteForShell, withoutFlag } from "../../src/infra/claude/claude-provider";

const base = { model: "sonnet", fallbackModel: "", strictMcpConfig: true, extraArgs: [] };

describe("claudeArgs", () => {
  it("isolates the call by default: no tools, no settings, no session on disk", () => {
    expect(claudeArgs({ ...base, isolated: true })).toEqual([
      "-p",
      "--model",
      "sonnet",
      "--strict-mcp-config",
      "--tools",
      "",
      "--setting-sources",
      "",
      "--no-session-persistence",
    ]);
  });

  it("builds the plain command line when isolation is off", () => {
    expect(claudeArgs({ ...base, isolated: false })).toEqual([
      "-p",
      "--model",
      "sonnet",
      "--strict-mcp-config",
    ]);
  });

  it("adds the fallback model and extra arguments last", () => {
    expect(
      claudeArgs({
        model: "opus",
        fallbackModel: "haiku",
        strictMcpConfig: false,
        isolated: false,
        extraArgs: ["--verbose"],
      }),
    ).toEqual(["-p", "--model", "opus", "--fallback-model", "haiku", "--verbose"]);
  });
});

describe("withoutFlag", () => {
  const args = claudeArgs({ ...base, isolated: true });

  it("drops a flag together with its value", () => {
    expect(withoutFlag(args, "--tools")).toEqual([
      "-p",
      "--model",
      "sonnet",
      "--strict-mcp-config",
      "--setting-sources",
      "",
      "--no-session-persistence",
    ]);
  });

  it("drops a bare flag", () => {
    expect(withoutFlag(args, "--no-session-persistence")).toEqual(args.slice(0, -1));
  });

  it("leaves the arguments alone when the flag is not there", () => {
    expect(withoutFlag(args, "--bare")).toEqual(args);
  });
});

describe("quoteForShell", () => {
  it("quotes empty arguments and arguments with spaces", () => {
    expect(quoteForShell("")).toBe('""');
    expect(quoteForShell("C:\\Program Files\\claude.cmd")).toBe('"C:\\Program Files\\claude.cmd"');
    expect(quoteForShell("--model")).toBe("--model");
  });
});
