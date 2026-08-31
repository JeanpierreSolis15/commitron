import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaults } from "../src/config";
import { loadInstructions } from "../src/run";

describe("loadInstructions", () => {
  const root = mkdtempSync(path.join(tmpdir(), "commitron-run-"));
  const content = "ñ".repeat(50);
  writeFileSync(path.join(root, "CONVENTIONS.md"), `  ${content}\n`);
  const base = { ...defaults(), instructions: "CONVENTIONS.md" };

  it("returns nothing when nothing is configured", () => {
    expect(loadInstructions(root, defaults())).toEqual(["", ""]);
  });

  it("reads and trims the file", () => {
    expect(loadInstructions(root, base)).toEqual([content, ""]);
  });

  it("truncates by character and warns", () => {
    const [text, warning] = loadInstructions(root, { ...base, instructionsMaxChars: 20 });
    expect(Array.from(text)).toHaveLength(20);
    expect(warning).toContain("truncated to 20 characters");
  });

  it("treats zero as no limit", () => {
    expect(loadInstructions(root, { ...base, instructionsMaxChars: 0 })[0]).toBe(content);
  });

  it("warns on a missing file", () => {
    const [text, warning] = loadInstructions(root, { ...base, instructions: "missing.md" });
    expect(text).toBe("");
    expect(warning).toContain("not found");
  });
});
