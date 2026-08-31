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
      isolated: true,
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

  it("feeds the recent commits to the model as examples", async () => {
    const w = world();
    w.git.history = ["fix(api): reject stale sessions", "docs: explain the flags"];
    await generateMessage(w.deps, root, defaults(), status, signal());
    const prompt = w.provider.requests[0]?.prompt ?? "";
    expect(prompt).toContain("<example>\nfix(api): reject stale sessions\n</example>");
    expect(prompt).toContain("docs: explain the flags");
  });

  it("leaves the history out when it is turned off", async () => {
    const w = world();
    w.git.history = ["fix(api): reject stale sessions"];
    await generateMessage(w.deps, root, { ...defaults(), history: 0 }, status, signal());
    expect(w.provider.requests[0]?.prompt).not.toContain("reject stale sessions");
  });

  it("carries on when git cannot list the history", async () => {
    const w = world();
    w.git.history = new Error("does not have any commits yet");
    await expect(
      generateMessage(w.deps, root, defaults(), status, signal()),
    ).resolves.toMatchObject({ text: "feat: add the thing" });
  });

  it("notes a missing instructions file but carries on", async () => {
    const w = world();
    const config = { ...defaults(), instructions: "missing.md" };
    const out = await generateMessage(w.deps, root, config, status, signal());
    expect(out.notices).toEqual([expect.stringContaining("not found")]);
    expect(out.warnings).toEqual([]);
  });

  it("asks the model to fix a reply that breaks a rule", async () => {
    const w = world();
    const long = `feat: ${"x".repeat(100)}`;
    w.provider.replies = [`<commit>${long}</commit>`, "<commit>feat: add the thing</commit>"];
    const out = await generateMessage(w.deps, root, defaults(), status, signal());
    expect(out.text).toBe("feat: add the thing");
    expect(out.warnings).toEqual([]);
    expect(w.provider.requests).toHaveLength(2);
    const revision = w.provider.requests[1]?.prompt ?? "";
    expect(revision).toContain("## Previous attempt");
    expect(revision).toContain(`<previous>\n${long}\n</previous>`);
    expect(revision).toContain("- subject is 106 characters, 34 over the limit");
  });

  it("keeps the better attempt when the retry does not help", async () => {
    const w = world();
    w.provider.replies = [
      "<commit>feat: Add the thing</commit>",
      `<commit>feat(Chip): Add ${"x".repeat(80)}</commit>`,
    ];
    const out = await generateMessage(w.deps, root, defaults(), status, signal());
    expect(out.text).toBe("feat: Add the thing");
    expect(out.warnings).toHaveLength(1);
  });

  it("does not retry when retries is 0", async () => {
    const w = world();
    w.provider.reply = "<commit>feat: Add the thing</commit>";
    const config = { ...defaults(), retries: 0 };
    const out = await generateMessage(w.deps, root, config, status, signal());
    expect(w.provider.requests).toHaveLength(1);
    expect(out.warnings).toHaveLength(1);
  });

  it("retries as many times as configured", async () => {
    const w = world();
    w.provider.reply = "<commit>feat: Add the thing</commit>";
    const steps: string[] = [];
    const config = { ...defaults(), retries: 3 };
    await generateMessage(w.deps, root, config, (text) => steps.push(text), signal());
    expect(w.provider.requests).toHaveLength(4);
    expect(steps.filter((step) => step === "revising with sonnet")).toHaveLength(3);
  });

  it("ignores a retry that comes back broken", async () => {
    const w = world();
    w.provider.replies = ["<commit>feat: Add the thing</commit>", "not a commit message"];
    const out = await generateMessage(w.deps, root, defaults(), status, signal());
    expect(out.text).toBe("feat: Add the thing");
  });

  it("still cancels during a retry", async () => {
    const w = world();
    w.provider.replies = ["<commit>feat: Add the thing</commit>", new GenerationAbortedError()];
    await expect(generateMessage(w.deps, root, defaults(), status, signal())).rejects.toThrow(
      Cancelled,
    );
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
