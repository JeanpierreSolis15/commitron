import { describe, expect, it } from "vitest";
import { defaults } from "../src/config";
import { build, languageName, truncate, type PromptInput } from "../src/prompt";

const empty: PromptInput = { stat: "", diff: "", excluded: [] };

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

describe("build", () => {
  it("includes the contract", () => {
    const out = build(
      { ...defaults(), language: "es", subjectMaxLength: 60 },
      { stat: "a.go | 2 +-", diff: "diff --git a/a.go", excluded: [] },
      "",
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

  it("truncates the diff and says so", () => {
    const out = build(
      { ...defaults(), maxDiffChars: 1000 },
      { ...empty, diff: "Z".repeat(5000) },
      "",
    );
    expect(out).toContain("truncated to 1000 characters");
    expect(out.split("Z").length - 1).toBe(1000);
  });

  it("omits the truncation note when the diff fits", () => {
    expect(build(defaults(), { ...empty, diff: "small" }, "")).not.toContain("truncated");
  });

  it.each([
    ["never", "Do not write one. Subject line only."],
    ["always", "Always write one."],
    ["auto", "only when the change has several distinct parts"],
  ] as const)("body=%s", (mode, want) => {
    expect(build({ ...defaults(), body: mode }, empty, "")).toContain(want);
  });

  it("includes instructions and exclusions", () => {
    const out = build(
      defaults(),
      { ...empty, diff: "d", excluded: ["pnpm-lock.yaml", "a.snap"] },
      "Commit messages must mention the ticket.",
    );
    expect(out).toContain("Project conventions");
    expect(out).toContain("must mention the ticket");
    expect(out).toContain("pnpm-lock.yaml, a.snap");
  });

  it("has no empty conventions section", () => {
    expect(build(defaults(), { ...empty, diff: "d" }, "")).not.toContain("Project conventions");
  });

  it("includes the case and wrap rules", () => {
    const out = build(defaults(), { ...empty, diff: "d" }, "");
    for (const want of [
      "Start the description with a lowercase letter",
      "The scope, when there is one, is lowercase",
      "Wrap every body line at 100 characters",
    ]) {
      expect(out).toContain(want);
    }
  });

  it("omits relaxed rules", () => {
    const out = build(
      { ...defaults(), subjectCase: "any", scopeCase: "any", bodyMaxLineLength: 0 },
      { ...empty, diff: "d" },
      "",
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
    const out = build(
      { ...defaults(), maxDiffChars: 1000 },
      { ...empty, diff: "ñ".repeat(5000) },
      "",
    );
    expect(out.split("ñ").length - 1).toBe(1000);
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
