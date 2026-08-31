import path from "node:path";
import { describe, expect, it } from "vitest";
import { FILE_NAME, globalConfigPath } from "../../src/app/config";
import { NotARepoError, type Failure } from "../../src/app/errors";
import { initConfig, writeConfig } from "../../src/app/init";
import { starter } from "../../src/domain/config";
import { FakeFiles, world } from "../helpers/fakes";

describe("writeConfig", () => {
  const file = path.normalize("/repo/.commitron.json");

  it("writes the starter config", () => {
    const files = new FakeFiles();
    expect(writeConfig(files, file, false, false)).toBe(file);
    expect(files.read(file)).toBe(starter);
  });

  it("writes every key with --full, schema first", () => {
    const files = new FakeFiles();
    writeConfig(files, file, true, false);
    const content = files.read(file) ?? "";
    expect(content.startsWith('{\n  "$schema"')).toBe(true);
    expect(content).toContain('"instructionsMaxChars": 4000');
    expect(content.endsWith("}\n")).toBe(true);
  });

  it("refuses to overwrite without --force", () => {
    const files = new FakeFiles({ [file]: "{}" });
    expect(() => writeConfig(files, file, false, false)).toThrow(/already exists/);
    expect(files.read(file)).toBe("{}");
  });

  it("overwrites with --force", () => {
    const files = new FakeFiles({ [file]: "{}" });
    writeConfig(files, file, false, true);
    expect(files.read(file)).toBe(starter);
  });
});

describe("initConfig", () => {
  it("writes into the repository by default", () => {
    const w = world();
    const written = initConfig(w.deps, { global: false, full: false, force: false });
    expect(written).toBe(path.join(w.git.repoRoot(), FILE_NAME));
    expect(w.files.exists(written)).toBe(true);
  });

  it("writes the user-wide config with --global", () => {
    const w = world();
    const written = initConfig(w.deps, { global: true, full: false, force: false });
    expect(written).toBe(globalConfigPath(w.environment));
  });

  it("points at --global outside a repository", () => {
    const w = world();
    w.git.root = new NotARepoError();
    const attempt = () => initConfig(w.deps, { global: false, full: false, force: false });
    expect(attempt).toThrow(/not a git repository/);
    try {
      attempt();
    } catch (err) {
      expect((err as Failure).detail).toContain("init --global");
    }
  });
});
