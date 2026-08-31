import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  Cancelled,
  Failure,
  GenerationAbortedError,
  ProviderMissingError,
} from "../../src/app/errors";
import { generateMessage, loadInstructions } from "../../src/app/generate";
import { defaults } from "../../src/domain/config";
import { FakeFiles, signal, world } from "../helpers/fakes";

const root = path.normalize("/repo");

describe("loadInstructions", () => {
  const content = "ñ".repeat(50);
  const files = new FakeFiles({ [path.join(root, "CONVENTIONS.md")]: `  ${content}\n` });
  const base = { ...defaults(), instructions: "CONVENTIONS.md" };

  it("returns nothing when nothing is configured", () => {
    expect(loadInstructions(files, root, defaults())).toEqual(["", ""]);
  });

  it("reads and trims the file", () => {
    expect(loadInstructions(files, root, base)).toEqual([content, ""]);
  });

  it("truncates by character and warns", () => {
    const [text, warning] = loadInstructions(files, root, { ...base, instructionsMaxChars: 20 });
    expect(Array.from(text)).toHaveLength(20);
    expect(warning).toContain("truncated to 20 characters");
  });

  it("treats zero as no limit", () => {
    expect(loadInstructions(files, root, { ...base, instructionsMaxChars: 0 })[0]).toBe(content);
  });

  it("warns on a missing file", () => {
    const [text, warning] = loadInstructions(files, root, { ...base, instructions: "missing.md" });
    expect(text).toBe("");
    expect(warning).toContain("not found");
  });

  it("accepts an absolute path", () => {
    const absolute = path.join(root, "CONVENTIONS.md");
    expect(loadInstructions(files, "/elsewhere", { ...base, instructions: absolute })[0]).toBe(
      content,
    );
  });
});

describe("generateMessage", () => {
  const status = () => {};

  it("turns the reply into a rendered, validated message", async () => {
    const w = world();
    w.provider.reply = "<commit>Fix(db): Drop the column.\n\n- one</commit>";
    const out = await generateMessage(w.deps, root, defaults(), status, signal());
    expect(out.text).toBe("fix(db): Drop the column\n\n- one");
    expect(out.parsed.description).toBe("Drop the column");
    expect(out.warnings).toEqual([expect.stringContaining("capital")]);
  });

  it("sends the model settings with the prompt", async () => {
    const w = world();
    const config = { ...defaults(), model: "opus", fallbackModel: "haiku", timeoutSeconds: 30 };
    await generateMessage(w.deps, root, config, status, signal());
    expect(w.provider.requests[0]).toMatchObject({
      model: "opus",
      fallbackModel: "haiku",
      strictMcpConfig: true,
      timeoutSeconds: 30,
    });
    expect(w.provider.requests[0]?.prompt).toContain(w.git.diff.trim());
  });

  it("reports the steps in order", async () => {
    const w = world();
    const steps: string[] = [];
    await generateMessage(w.deps, root, defaults(), (text) => steps.push(text), signal());
    expect(steps).toEqual(["reading staged changes", "asking sonnet", "validating"]);
  });

  it("warns about missing instructions but carries on", async () => {
    const w = world();
    const config = { ...defaults(), instructions: "missing.md" };
    const out = await generateMessage(w.deps, root, config, status, signal());
    expect(out.warnings).toEqual([expect.stringContaining("not found")]);
  });

  it.each([
    ["an empty reply", "<commit></commit>", /empty message/],
    ["a reply that is not a commit message", "hello there", /not a Conventional Commits/],
    ["a type outside the list", "<commit>banana: peel it</commit>", /does not match your config/],
  ])("rejects %s", async (_, reply, want) => {
    const w = world();
    w.provider.reply = reply;
    await expect(generateMessage(w.deps, root, defaults(), status, signal())).rejects.toThrow(want);
  });

  it("wraps provider failures", async () => {
    const w = world();
    w.provider.reply = new Error("boom");
    const failure = await generateMessage(w.deps, root, defaults(), status, signal()).catch(
      (err: unknown) => err,
    );
    expect(failure).toBeInstanceOf(Failure);
    expect((failure as Failure).message).toBe("could not generate the message");
    expect((failure as Failure).detail).toBe("boom");
  });

  it("explains a missing claude CLI", async () => {
    const w = world();
    w.provider.reply = new ProviderMissingError();
    await expect(generateMessage(w.deps, root, defaults(), status, signal())).rejects.toThrow(
      /not found on your PATH/,
    );
  });

  it("turns an abort into a cancellation", async () => {
    const w = world();
    w.provider.reply = new GenerationAbortedError();
    await expect(generateMessage(w.deps, root, defaults(), status, signal())).rejects.toThrow(
      Cancelled,
    );
  });
});
