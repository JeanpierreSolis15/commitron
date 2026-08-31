import { describe, expect, it } from "vitest";
import { claudeArgs } from "../../src/infra/claude/claude-provider";

describe("claudeArgs", () => {
  it("builds the default command line", () => {
    expect(
      claudeArgs({ model: "sonnet", fallbackModel: "", strictMcpConfig: true, extraArgs: [] }),
    ).toEqual(["-p", "--model", "sonnet", "--strict-mcp-config"]);
  });

  it("adds the fallback model and extra arguments", () => {
    expect(
      claudeArgs({
        model: "opus",
        fallbackModel: "haiku",
        strictMcpConfig: false,
        extraArgs: ["--verbose"],
      }),
    ).toEqual(["-p", "--model", "opus", "--fallback-model", "haiku", "--verbose"]);
  });
});
