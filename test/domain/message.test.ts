import { describe, expect, it } from "vitest";
import { defaults } from "../../src/domain/config";
import { parse, sanitize, validateMessage } from "../../src/domain/message";

describe("sanitize", () => {
  it.each([
    [
      "unwraps the commit tag",
      "Sure, here it is:\n<commit>feat: add thing</commit>\nHope that helps!",
      "feat: add thing",
    ],
    ["unwraps a code fence", "```\nfix: repair thing\n```", "fix: repair thing"],
    ["unwraps a labelled code fence", "```text\nfix: repair thing\n```", "fix: repair thing"],
    [
      "drops attribution footers",
      "feat: add thing\n\nCo-Authored-By: Someone <a@b.c>\nClaude-Session: https://claude.ai/code/x",
      "feat: add thing",
    ],
    ["drops the robot line", "feat: add thing\n\n🤖 Generated with Claude Code", "feat: add thing"],
    ["normalises CRLF", "feat: add thing\r\n\r\n- one\r\n- two", "feat: add thing\n\n- one\n- two"],
    [
      "keeps the body",
      "<commit>feat: add thing\n\n- one\n- two</commit>",
      "feat: add thing\n\n- one\n- two",
    ],
    ["empty stays empty", "   \n  ", ""],
  ])("%s", (_, raw, want) => {
    expect(sanitize(raw)).toBe(want);
  });
});

describe("parse", () => {
  it.each([
    [
      "type and description",
      "feat: add the thing",
      { type: "feat", scope: "", breaking: false, description: "add the thing" },
    ],
    [
      "with scope",
      "fix(orders): reject unlinked items",
      { type: "fix", scope: "orders", breaking: false, description: "reject unlinked items" },
    ],
    [
      "breaking marker",
      "feat(api)!: rename the size tokens",
      { type: "feat", scope: "api", breaking: true, description: "rename the size tokens" },
    ],
    [
      "scope with a path",
      "chore(ci/release): pin the action",
      { type: "chore", scope: "ci/release", breaking: false, description: "pin the action" },
    ],
    [
      "uppercase type is normalised",
      "Feat: add the thing",
      { type: "feat", scope: "", breaking: false, description: "add the thing" },
    ],
  ])("%s", (_, msg, want) => {
    expect(parse(msg)).toMatchObject({ ...want, subject: msg });
  });

  it.each([
    ["no colon", "add the thing"],
    ["empty description", "feat:"],
    ["empty message", ""],
  ])("rejects %s", (_, msg) => {
    expect(parse(msg)).toBeNull();
  });

  it("keeps the body", () => {
    expect(parse("feat: add the thing\n\n- one\n- two")?.body).toBe("- one\n- two");
  });
});

describe("validateMessage", () => {
  const cfg = defaults();

  it("rejects a type outside the list", () => {
    expect(() => validateMessage(parse("banana: peel the thing")!, cfg)).toThrow();
  });

  it("accepts a configured type", () => {
    expect(validateMessage(parse("feat: add the thing")!, cfg)).toEqual([]);
  });

  it("enforces the scope list once it is configured", () => {
    const scoped = { ...cfg, scopes: ["api", "web"] };
    expect(() => validateMessage(parse("feat(db): add the thing")!, scoped)).toThrow(
      /not an allowed scope/,
    );
    expect(validateMessage(parse("feat(api): add the thing")!, scoped)).toEqual([]);
    expect(validateMessage(parse("feat: add the thing")!, scoped)).toEqual([]);
    expect(validateMessage(parse("feat(db): add the thing")!, cfg)).toEqual([]);
  });

  it("warns but does not fail on a long subject", () => {
    expect(validateMessage(parse(`feat: ${"x".repeat(100)}`)!, cfg)).toHaveLength(1);
  });

  it("counts characters, not bytes", () => {
    expect(validateMessage(parse("feat: ñññññ")!, { ...cfg, subjectMaxLength: 20 })).toEqual([]);
  });

  it("warns when the body contract is broken", () => {
    expect(validateMessage(parse("feat: add the thing")!, { ...cfg, body: "always" })).toHaveLength(
      1,
    );
    expect(
      validateMessage(parse("feat: add the thing\n\n- one")!, { ...cfg, body: "never" }),
    ).toHaveLength(1);
  });
});
