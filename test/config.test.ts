import { describe, expect, it } from "vitest";
import { allowsType, defaults, validate, type Config } from "../src/config";

describe("defaults", () => {
  it("always validate", () => {
    expect(() => validate(defaults())).not.toThrow();
  });
});

describe("validate", () => {
  it.each<[string, (c: Config) => void, boolean]>([
    ["defaults", () => {}, false],
    ["empty model", (c) => (c.model = ""), true],
    ["timeout too low", (c) => (c.timeoutSeconds = 1), true],
    ["empty language", (c) => (c.language = ""), true],
    ["no types", (c) => (c.types = []), true],
    ["subject too short", (c) => (c.subjectMaxLength = 5), true],
    ["diff budget too small", (c) => (c.maxDiffChars = 10), true],
    ["negative instructions budget", (c) => (c.instructionsMaxChars = -1), true],
    ["bad body mode", (c) => (c.body = "sometimes" as Config["body"]), true],
    ["bad color mode", (c) => (c.color = "yes" as Config["color"]), true],
    ["bad unicode mode", (c) => (c.unicode = "maybe" as Config["unicode"]), true],
    ["body never is fine", (c) => (c.body = "never"), false],
  ])("%s", (_, mutate, wantErr) => {
    const cfg = defaults();
    mutate(cfg);
    if (wantErr) {
      expect(() => validate(cfg)).toThrow();
    } else {
      expect(() => validate(cfg)).not.toThrow();
    }
  });
});

describe("allowsType", () => {
  it("accepts the defaults and rejects the rest", () => {
    const cfg = defaults();
    expect(allowsType(cfg, "feat")).toBe(true);
    expect(allowsType(cfg, "banana")).toBe(false);
  });
});
