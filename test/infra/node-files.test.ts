import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NodeFiles } from "../../src/infra/files/node-files";

describe("NodeFiles", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "commitron-files-"));
  const files = new NodeFiles();

  it("reads nothing for a missing file", () => {
    expect(files.read(path.join(dir, "missing.json"))).toBeUndefined();
    expect(files.exists(path.join(dir, "missing.json"))).toBe(false);
  });

  it("writes through missing directories and reads back", () => {
    const file = path.join(dir, "nested", "deep", "config.json");
    files.write(file, "{}\n");
    expect(files.exists(file)).toBe(true);
    expect(files.read(file)).toBe("{}\n");
  });

  it("propagates errors other than a missing file", () => {
    expect(() => files.read(dir)).toThrow();
  });
});
