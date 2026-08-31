import path from "node:path";
import { describe, expect, it } from "vitest";
import { FILE_NAME, globalConfigPath, loadConfig, resolveConfig } from "../../src/app/config";
import { Failure } from "../../src/app/errors";
import { defaults, SCHEMA_URL } from "../../src/domain/config";
import { fakeEnvironment, FakeFiles } from "../helpers/fakes";

const home = path.normalize("/home/tester");
const root = path.normalize("/repo");

function deps(files: FakeFiles = new FakeFiles()) {
  return { files, environment: fakeEnvironment({ HOME: home }) };
}

describe("globalConfigPath", () => {
  it("uses AppData on Windows", () => {
    const env = fakeEnvironment({ AppData: "/appdata" }, "win32");
    expect(globalConfigPath(env)).toBe(path.join("/appdata", "commitron", "config.json"));
  });

  it("uses Library/Application Support on macOS", () => {
    const env = fakeEnvironment({ HOME: home }, "darwin");
    expect(globalConfigPath(env)).toBe(
      path.join(home, "Library", "Application Support", "commitron", "config.json"),
    );
  });

  it("prefers XDG_CONFIG_HOME elsewhere", () => {
    const env = fakeEnvironment({ XDG_CONFIG_HOME: "/xdg", HOME: home });
    expect(globalConfigPath(env)).toBe(path.join("/xdg", "commitron", "config.json"));
  });

  it("falls back to ~/.config", () => {
    expect(globalConfigPath(fakeEnvironment({ HOME: home }))).toBe(
      path.join(home, ".config", "commitron", "config.json"),
    );
  });

  it("rejects a relative XDG_CONFIG_HOME", () => {
    expect(() => globalConfigPath(fakeEnvironment({ XDG_CONFIG_HOME: "cfg", HOME: home }))).toThrow(
      /relative/,
    );
  });

  it("fails without a home", () => {
    expect(() => globalConfigPath(fakeEnvironment({}))).toThrow(/HOME/);
  });
});

describe("loadConfig", () => {
  const globalFile = path.join(home, ".config", "commitron", "config.json");

  it("returns the defaults when nothing exists", () => {
    const res = loadConfig(deps(), root, "");
    expect(res.sources).toEqual([]);
    expect(res.config).toEqual(defaults());
  });

  it("merges field by field", () => {
    const files = new FakeFiles({ [path.join(root, FILE_NAME)]: `{"model":"opus"}` });
    const res = loadConfig(deps(files), root, "");
    expect(res.config.model).toBe("opus");
    expect(res.config.subjectMaxLength).toBe(defaults().subjectMaxLength);
    expect(res.config.types).toEqual(defaults().types);
  });

  it("applies the documented precedence", () => {
    const explicit = path.normalize("/elsewhere/extra.json");
    const files = new FakeFiles({
      [globalFile]: `{"model":"from-global","language":"de","subjectMaxLength":50}`,
      [path.join(root, "package.json")]:
        `{"name":"x","commitron":{"model":"from-package","language":"fr"}}`,
      [path.join(root, FILE_NAME)]: `{"model":"from-repo"}`,
      [explicit]: `{"body":"never"}`,
    });
    const res = loadConfig(deps(files), root, explicit);
    expect(res.config.model).toBe("from-repo");
    expect(res.config.language).toBe("fr");
    expect(res.config.subjectMaxLength).toBe(50);
    expect(res.config.body).toBe("never");
    expect(res.sources).toEqual([
      globalFile,
      `${path.join(root, "package.json")} (commitron)`,
      path.join(root, FILE_NAME),
      explicit,
    ]);
  });

  it("skips the global file when the config directory is unknown", () => {
    const res = loadConfig({ files: new FakeFiles(), environment: fakeEnvironment({}) }, root, "");
    expect(res.sources).toEqual([]);
  });

  it("names an unknown key and the file it came from", () => {
    const files = new FakeFiles({ [path.join(root, FILE_NAME)]: `{"modelo":"opus"}` });
    expect(() => loadConfig(deps(files), root, "")).toThrow(/\.commitron\.json.*modelo/);
  });

  it("rejects a value of the wrong type", () => {
    const files = new FakeFiles({ [path.join(root, FILE_NAME)]: `{"timeoutSeconds":"120"}` });
    expect(() => loadConfig(deps(files), root, "")).toThrow(/timeoutSeconds/);
  });

  it("accepts the $schema key", () => {
    const files = new FakeFiles({
      [path.join(root, FILE_NAME)]: `{"$schema":"${SCHEMA_URL}","model":"opus"}`,
    });
    expect(() => loadConfig(deps(files), root, "")).not.toThrow();
  });

  it("ignores a package.json without our key", () => {
    const files = new FakeFiles({ [path.join(root, "package.json")]: `{"name":"x","scripts":{}}` });
    expect(loadConfig(deps(files), root, "").sources).toEqual([]);
  });

  it("survives someone else's broken package.json", () => {
    const files = new FakeFiles({ [path.join(root, "package.json")]: `{not json` });
    expect(() => loadConfig(deps(files), root, "")).not.toThrow();
  });

  it("reports a broken commitron section in package.json", () => {
    const files = new FakeFiles({
      [path.join(root, "package.json")]: `{"commitron":{"model":5}}`,
    });
    expect(() => loadConfig(deps(files), root, "")).toThrow(/package\.json.*model/);
  });

  it("fails when an explicit config file is missing", () => {
    expect(() => loadConfig(deps(), root, path.normalize("/nowhere/nope.json"))).toThrow(
      /nope\.json/,
    );
  });
});

describe("resolveConfig", () => {
  it("applies the command-line overrides on top", () => {
    const res = resolveConfig(deps(), root, { model: "haiku", color: "never", noVerify: true });
    expect(res.config.model).toBe("haiku");
    expect(res.config.color).toBe("never");
    expect(res.config.verify).toBe(false);
  });

  it("leaves the config alone without overrides", () => {
    expect(resolveConfig(deps(), root, {}).config).toEqual(defaults());
  });

  it("turns an invalid configuration into a failure", () => {
    const files = new FakeFiles({ [path.join(root, FILE_NAME)]: `{"timeoutSeconds":1}` });
    expect(() => resolveConfig(deps(files), root, {})).toThrow(Failure);
    expect(() => resolveConfig(deps(files), root, {})).toThrow(/invalid configuration/);
  });
});
