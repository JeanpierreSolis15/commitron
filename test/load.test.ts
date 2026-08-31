import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaults, SCHEMA_URL } from "../src/config";
import { FILE_NAME, globalPath, load } from "../src/load";

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "commitron-test-"));
}

function isolateGlobal(): string {
  const dir = tempDir();
  vi.stubEnv("AppData", dir);
  vi.stubEnv("XDG_CONFIG_HOME", dir);
  vi.stubEnv("HOME", dir);
  return globalPath();
}

function write(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("load", () => {
  it("returns the defaults when nothing exists", () => {
    isolateGlobal();
    const res = load(tempDir(), "");
    expect(res.sources).toEqual([]);
    expect(res.config.model).toBe(defaults().model);
  });

  it("merges field by field", () => {
    isolateGlobal();
    const root = tempDir();
    write(path.join(root, FILE_NAME), `{"model":"opus"}`);

    const res = load(root, "");
    expect(res.config.model).toBe("opus");
    expect(res.config.subjectMaxLength).toBe(defaults().subjectMaxLength);
    expect(res.config.types).toHaveLength(defaults().types.length);
  });

  it("applies the documented precedence", () => {
    const globalFile = isolateGlobal();
    const root = tempDir();

    write(globalFile, `{"model":"from-global","language":"de","subjectMaxLength":50}`);
    write(
      path.join(root, "package.json"),
      `{"name":"x","commitron":{"model":"from-package","language":"fr"}}`,
    );
    write(path.join(root, FILE_NAME), `{"model":"from-repo"}`);

    const explicit = path.join(tempDir(), "extra.json");
    write(explicit, `{"body":"never"}`);

    const res = load(root, explicit);
    expect(res.config.model).toBe("from-repo");
    expect(res.config.language).toBe("fr");
    expect(res.config.subjectMaxLength).toBe(50);
    expect(res.config.body).toBe("never");
    expect(res.sources).toHaveLength(4);
  });

  it("rejects unknown keys and names them", () => {
    isolateGlobal();
    const root = tempDir();
    write(path.join(root, FILE_NAME), `{"modelo":"opus"}`);

    expect(() => load(root, "")).toThrow(/modelo/);
  });

  it("rejects values of the wrong type", () => {
    isolateGlobal();
    const root = tempDir();
    write(path.join(root, FILE_NAME), `{"timeoutSeconds":"120"}`);

    expect(() => load(root, "")).toThrow(/timeoutSeconds/);
  });

  it("accepts the $schema key", () => {
    isolateGlobal();
    const root = tempDir();
    write(path.join(root, FILE_NAME), `{"$schema":"${SCHEMA_URL}","model":"opus"}`);

    expect(() => load(root, "")).not.toThrow();
  });

  it("treats null instructions as none", () => {
    isolateGlobal();
    const root = tempDir();
    write(path.join(root, FILE_NAME), `{"instructions":null}`);

    expect(load(root, "").config.instructions).toBeUndefined();
  });

  it("ignores a package.json without our key", () => {
    isolateGlobal();
    const root = tempDir();
    write(path.join(root, "package.json"), `{"name":"x","scripts":{}}`);

    expect(load(root, "").sources).toEqual([]);
  });

  it("survives someone else's broken package.json", () => {
    isolateGlobal();
    const root = tempDir();
    write(path.join(root, "package.json"), `{not json`);

    expect(() => load(root, "")).not.toThrow();
  });

  it("fails when an explicit config file is missing", () => {
    isolateGlobal();
    expect(() => load(tempDir(), path.join(tempDir(), "nope.json"))).toThrow();
  });
});
