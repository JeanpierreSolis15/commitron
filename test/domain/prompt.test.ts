import { describe, expect, it } from "vitest";
import { defaults } from "../../src/domain/config";
import {
  buildPrompt,
  buildRevisionPrompt,
  languageName,
  type PromptInput,
} from "../../src/domain/prompt";
import { truncate } from "../../src/utils/text";

const empty: PromptInput = { stat: "", diff: "", excluded: [], instructions: "", history: [] };

describe("languageName", () => {
  it.each([
    ["en", "English"],
    ["ES", "Spanish"],
    [" pt ", "Portuguese"],
    ["Brazilian Portuguese", "Brazilian Portuguese"],
  ])("%j", (input, want) => {
    expect(languageName(input)).toBe(want);
  });
});

describe("buildPrompt", () => {
  it("includes the contract", () => {
    const out = buildPrompt(
      { ...defaults(), language: "es", subjectMaxLength: 60 },
      { ...empty, stat: "a.go | 2 +-", diff: "diff --git a/a.go" },
    );
    for (const want of [
      "Spanish",
      "60 characters",
      "feat, fix",
      "a.go | 2 +-",
      "diff --git a/a.go",
      "<commit>",
    ]) {
      expect(out).toContain(want);
    }
  });

  it("explains what each type means", () => {
    const out = buildPrompt(defaults(), empty);
    expect(out).toContain("  feat: a new feature");
    expect(out).toContain("  refactor: a code change that neither fixes a bug nor adds a feature");
  });

  it("lists a custom type without a description", () => {
    const out = buildPrompt({ ...defaults(), types: ["feat", "wip"] }, empty);
    expect(out.split("\n")).toContain("  wip");
    expect(out).not.toContain("  fix:");
  });

  it("lists the allowed scopes only when they are configured", () => {
    expect(buildPrompt(defaults(), empty)).not.toContain("Allowed scopes");
    expect(buildPrompt({ ...defaults(), scopes: ["api", "web"] }, empty)).toContain(
      "Allowed scopes: api, web",
    );
  });

  it("truncates the diff and says so", () => {
    const out = buildPrompt(
      { ...defaults(), maxDiffChars: 1000 },
      { ...empty, diff: "Z".repeat(5000) },
    );
    expect(out).toContain("truncated to 1000 characters");
    expect(out.split("Z").length - 1).toBe(1000);
  });

  it("omits the truncation note when the diff fits", () => {
    expect(buildPrompt(defaults(), { ...empty, diff: "small" })).not.toContain("truncated");
  });

  it.each([
    ["never", "Do not write one. Subject line only."],
    ["always", "Always write one."],
    ["auto", "only when the change has several distinct parts"],
  ] as const)("body=%s", (mode, want) => {
    expect(buildPrompt({ ...defaults(), body: mode }, empty)).toContain(want);
  });

  it("puts the guidelines in the conventions section", () => {
    const out = buildPrompt({ ...defaults(), guidelines: ["Mention the ticket."] }, empty);
    expect(out).toContain("## Project conventions");
    expect(out).toContain("- Mention the ticket.");
  });

  it("includes the instructions file and the exclusions", () => {
    const out = buildPrompt(defaults(), {
      ...empty,
      diff: "d",
      excluded: ["pnpm-lock.yaml", "a.snap"],
      instructions: "Commit messages must mention the ticket.",
    });
    expect(out).toContain("Project conventions");
    expect(out).toContain("must mention the ticket");
    expect(out).toContain("pnpm-lock.yaml, a.snap");
  });

  it("combines guidelines with the instructions file", () => {
    const out = buildPrompt(
      { ...defaults(), guidelines: ["One rule."] },
      { ...empty, instructions: "Long conventions." },
    );
    expect(out).toContain("- One rule.\n\nLong conventions.");
  });

  it("has no empty conventions section", () => {
    expect(buildPrompt(defaults(), { ...empty, diff: "d" })).not.toContain("Project conventions");
  });

  it("shows the project examples and the recent history", () => {
    const out = buildPrompt(
      { ...defaults(), examples: ["feat(api): add the refund endpoint"] },
      { ...empty, history: ["fix(web): keep the modal open\n\n- one"] },
    );
    expect(out).toContain("<example>\nfeat(api): add the refund endpoint\n</example>");
    expect(out).toContain("<example>\nfix(web): keep the modal open\n\n- one\n</example>");
    expect(out).not.toContain("add Polish language");
  });

  it("keeps the configured language above the examples' language", () => {
    const out = buildPrompt(
      { ...defaults(), language: "en" },
      { ...empty, history: ["fix: corrige el cálculo del total"] },
    );
    expect(out).toContain("write the\ndescription in English even if they use another language");
    expect(out.trimEnd().endsWith("wrapped exactly in <commit> and </commit>.")).toBe(true);
    expect(out).toContain("## Reminder\n- The description is written in English");
  });

  it("falls back to canonical examples", () => {
    const out = buildPrompt(defaults(), empty);
    expect(out).toContain("## Examples");
    expect(out).toContain("<example>\nfeat(lang): add Polish language\n</example>");
  });

  it("includes the case and wrap rules", () => {
    const out = buildPrompt(defaults(), { ...empty, diff: "d" });
    for (const want of [
      "Start the description with a lowercase letter",
      "The scope, when there is one, is lowercase",
      "Wrap every body line at 100 characters",
    ]) {
      expect(out).toContain(want);
    }
  });

  it("omits relaxed rules", () => {
    const out = buildPrompt(
      { ...defaults(), subjectCase: "any", scopeCase: "any", bodyMaxLineLength: 0 },
      { ...empty, diff: "d" },
    );
    for (const unwanted of [
      "Start the description with a lowercase letter",
      "The scope, when there is one, is lowercase",
      "Wrap every body line",
    ]) {
      expect(out).not.toContain(unwanted);
    }
  });

  it("truncates the diff by character", () => {
    const out = buildPrompt(
      { ...defaults(), maxDiffChars: 1000 },
      { ...empty, diff: "ñ".repeat(5000) },
    );
    expect(out.split("ñ").length - 1).toBe(1000);
  });
});

describe("buildRevisionPrompt", () => {
  it("appends the previous reply and its problems to the original prompt", () => {
    const base = buildPrompt(defaults(), { ...empty, diff: "d" });
    const out = buildRevisionPrompt(base, "feat: Add the thing\n", [
      "description starts with a capital; commitlint expects lowercase",
    ]);
    expect(out.startsWith(base)).toBe(true);
    expect(out).toContain("## Previous attempt");
    expect(out).toContain("<previous>\nfeat: Add the thing\n</previous>");
    expect(out).toContain("- description starts with a capital; commitlint expects lowercase");
    expect(out).toContain("wrapped exactly in <commit> and </commit>");
  });
});

describe("truncate", () => {
  it.each<[string, string, number, string, boolean]>([
    ["fits exactly", "abc", 3, "abc", false],
    ["cuts ascii", "abcdef", 3, "abc", true],
    ["zero means no limit", "abcdef", 0, "abcdef", false],
    ["empty", "", 3, "", false],
    ["counts characters, not bytes", "ééééé", 3, "ééé", true],
    ["multi-byte that fits by characters but not by bytes", "ééé", 3, "ééé", false],
    ["never splits a character", "aé", 2, "aé", false],
    ["cuts before a multi-byte character", "aéb", 1, "a", true],
    ["never splits a surrogate pair", "a🤖b", 2, "a🤖", true],
  ])("%s", (_, input, max, want, cut) => {
    expect(truncate(input, max)).toEqual([want, cut]);
  });
});
