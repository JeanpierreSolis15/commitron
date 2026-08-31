import { describe, expect, it } from "vitest";
import {
  allowsType,
  decodeConfig,
  defaults,
  SCHEMA_URL,
  serialize,
  validateConfig,
  type Config,
} from "../../src/domain/config";

describe("defaults", () => {
  it("always validate", () => {
    expect(() => validateConfig(defaults())).not.toThrow();
  });
});

describe("validateConfig", () => {
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
      expect(() => validateConfig(cfg)).toThrow();
    } else {
      expect(() => validateConfig(cfg)).not.toThrow();
    }
  });
});

describe("allowsType", () => {
  it("accepts the defaults and rejects the rest", () => {
    expect(allowsType(defaults(), "feat")).toBe(true);
    expect(allowsType(defaults(), "banana")).toBe(false);
  });
});

describe("decodeConfig", () => {
  it("overrides only the declared keys", () => {
    const cfg = decodeConfig(defaults(), `{"model":"opus"}`);
    expect(cfg.model).toBe("opus");
    expect(cfg.types).toEqual(defaults().types);
  });

  it("leaves the base untouched", () => {
    const base = defaults();
    decodeConfig(base, `{"model":"opus"}`);
    expect(base.model).toBe("sonnet");
  });

  it("names an unknown key", () => {
    expect(() => decodeConfig(defaults(), `{"modelo":"opus"}`)).toThrow(/modelo/);
  });

  it.each([
    ["a string where an integer goes", `{"timeoutSeconds":"120"}`],
    ["a float where an integer goes", `{"timeoutSeconds":1.5}`],
    ["a string where a boolean goes", `{"confirm":"yes"}`],
    ["a number in a string array", `{"types":["feat",1]}`],
    ["an array where an object goes", `[]`],
  ])("rejects %s", (_, source) => {
    expect(() => decodeConfig(defaults(), source)).toThrow();
  });

  it("treats null as absent, or as an empty list", () => {
    const cfg = decodeConfig(defaults(), `{"instructions":null,"exclude":null}`);
    expect(cfg.instructions).toBeUndefined();
    expect(cfg.exclude).toEqual([]);
  });

  it("accepts the $schema key", () => {
    expect(() => decodeConfig(defaults(), `{"$schema":"${SCHEMA_URL}"}`)).not.toThrow();
  });
});

describe("serialize", () => {
  it("writes the keys in their documented order and drops empty optionals", () => {
    const out = serialize({ ...defaults(), $schema: SCHEMA_URL, fallbackModel: "" });
    const keys = Object.keys(JSON.parse(out) as Record<string, unknown>);
    expect(keys[0]).toBe("$schema");
    expect(keys[1]).toBe("model");
    expect(keys).not.toContain("fallbackModel");
    expect(keys).not.toContain("instructions");
    expect(keys.at(-1)).toBe("unicode");
  });
});
