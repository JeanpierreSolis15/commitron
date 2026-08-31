import { describe, expect, it } from "vitest";
import { defaults, type Config } from "../src/config";
import { parse, validate } from "../src/message";
import { canonical, render, violatesLowerCase } from "../src/normalize";

describe("canonical", () => {
  it.each([
    ["already canonical", "feat: add the thing", "feat: add the thing"],
    ["lowercases the type", "Feat: add the thing", "feat: add the thing"],
    ["drops the full stop", "fix: repair the thing.", "fix: repair the thing"],
    ["keeps the scope", "fix(orders): repair it", "fix(orders): repair it"],
    ["keeps the breaking marker", "feat(api)!: rename tokens", "feat(api)!: rename tokens"],
    ["normalises spacing", "feat:    add the thing", "feat: add the thing"],
    ["both fixes at once", "Fix(db): drop the column.", "fix(db): drop the column"],
  ])("%s", (_, input, want) => {
    expect(canonical(parse(input)!)).toBe(want);
  });
});

describe("render", () => {
  const cfg = defaults();

  it("separates the body with a blank line", () => {
    expect(render(parse("feat: add the thing\n- one\n- two")!, cfg)).toBe(
      "feat: add the thing\n\n- one\n- two",
    );
    expect(render(parse("feat: add the thing")!, cfg)).toBe("feat: add the thing");
  });

  it("wraps the body", () => {
    const out = render(parse(`feat: add the thing\n\n- ${"word ".repeat(30)}`)!, {
      ...cfg,
      bodyMaxLineLength: 40,
    });
    for (const line of out.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
    const lines = out.split("\n\n")[1]!.split("\n");
    expect(lines[0]).toMatch(/^- word/);
    expect(lines[1]).toMatch(/^ {2}word/);
  });

  it("leaves unwrappable words intact", () => {
    const url = "x".repeat(60);
    const out = render(parse(`fix: update the link\n\nsee ${url}`)!, {
      ...cfg,
      bodyMaxLineLength: 20,
    });
    expect(out).toContain(url);
  });

  it("leaves the body alone when wrapping is off", () => {
    const out = render(parse(`feat: add the thing\n\n${"word ".repeat(50)}`)!, {
      ...cfg,
      bodyMaxLineLength: 0,
    });
    expect(out.split("\n")).toHaveLength(3);
  });
});

describe("violatesLowerCase", () => {
  it.each([
    ["add the thing", false],
    ["Add the thing", true],
    ["OAuth login flow", false],
    ["API returns 404", false],
    ["PostgreSQL 17 upgrade", false],
    ["", false],
    ["Repair", true],
  ])("%j", (input, want) => {
    expect(violatesLowerCase(input)).toBe(want);
  });
});

describe("validate against commitlint rules", () => {
  const base = defaults();

  function hasWarning(cfg: Config, msg: string, fragment: string): boolean {
    return validate(parse(msg)!, cfg).some((w) => w.includes(fragment));
  }

  it("warns on a sentence-cased description", () => {
    expect(hasWarning(base, "feat: Add the thing", "capital")).toBe(true);
    expect(hasWarning(base, "feat: add the thing", "capital")).toBe(false);
    expect(hasWarning(base, "feat: OAuth login", "capital")).toBe(false);
  });

  it("stays quiet with subjectCase any", () => {
    expect(hasWarning({ ...base, subjectCase: "any" }, "feat: Add the thing", "capital")).toBe(
      false,
    );
  });

  it("warns on an uppercase scope", () => {
    expect(hasWarning(base, "feat(Chip): add the prop", "not lowercase")).toBe(true);
    expect(
      hasWarning({ ...base, scopeCase: "any" }, "feat(Chip): add the prop", "not lowercase"),
    ).toBe(false);
  });

  it("warns on a body line that cannot be wrapped", () => {
    expect(
      hasWarning(
        { ...base, bodyMaxLineLength: 20 },
        `fix: link\n\n${"x".repeat(40)}`,
        "cannot be wrapped",
      ),
    ).toBe(true);
  });

  it("measures the length on what gets committed", () => {
    expect(
      hasWarning({ ...base, subjectMaxLength: 25 }, "feat: 12345678901234567.", "over the limit"),
    ).toBe(false);
  });
});
