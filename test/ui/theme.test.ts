import { describe, expect, it } from "vitest";
import { parse } from "../../src/domain/message";
import { TerminalPresenter } from "../../src/ui/presenter";
import { Theme } from "../../src/ui/theme";
import { headerView, messageView } from "../../src/ui/views";
import { FakeTerminal } from "../helpers/fakes";

const plain = new Theme("never", "never", { color: true, unicode: true });

describe("Theme", () => {
  it("paints only when colour is on", () => {
    expect(plain.ok("x")).toBe("x");
    const painted = new Theme("always", "never", { color: false, unicode: false }).ok("x");
    expect(painted.startsWith("\x1b[")).toBe(true);
    expect(painted.endsWith("x\x1b[0m")).toBe(true);
  });

  it("follows the terminal on auto", () => {
    expect(new Theme("auto", "auto", { color: true, unicode: true }).color).toBe(true);
    expect(new Theme("auto", "auto", { color: false, unicode: false }).color).toBe(false);
  });

  it("falls back to ascii glyphs", () => {
    expect(plain.glyph.ok).toBe("OK");
    expect(new Theme("never", "always", { color: false, unicode: false }).glyph.ok).toBe("✓");
  });
});

describe("views", () => {
  it("renders the header", () => {
    expect(headerView(plain, "sonnet", { files: 1, added: 3, removed: 1 })).toBe(
      "* commitron - sonnet 1 file +3 -1",
    );
  });

  it("renders the message with its body indented", () => {
    const parsed = parse("feat(api)!: add the thing\n\n- one\n\n- two")!;
    expect(messageView(plain, parsed)).toBe("  feat(api)!: add the thing\n  - one\n\n  - two");
  });
});

describe("TerminalPresenter", () => {
  it("prints the plain message to stdout only when it is not a terminal", () => {
    const terminal = new FakeTerminal();
    const presenter = new TerminalPresenter(terminal, plain);
    const parsed = parse("feat: add the thing")!;

    presenter.message("feat: add the thing", parsed, ["a warning"]);
    expect(terminal.stdout).toBe("");
    expect(terminal.stderr).toContain("  feat: add the thing");
    expect(terminal.stderr).toContain("  ! a warning");

    terminal.tty.stdout = false;
    presenter.message("feat: add the thing", parsed, []);
    expect(terminal.stdout).toBe("feat: add the thing\n");
  });

  it("answers the prompts from the terminal", async () => {
    const terminal = new FakeTerminal();
    const presenter = new TerminalPresenter(terminal, plain);
    const signal = new AbortController().signal;

    terminal.answers = ["", "E", "nope", null];
    expect(await presenter.confirm(signal)).toBe("yes");
    expect(await presenter.confirm(signal)).toBe("edit");
    expect(await presenter.confirm(signal)).toBe("no");
    expect(await presenter.confirm(signal)).toBe("no");

    terminal.answers = ["y", "g"];
    expect(await presenter.askInit(signal)).toBe("repo");
    expect(await presenter.askInit(signal)).toBe("global");

    terminal.tty.stdin = false;
    expect(await presenter.confirm(signal)).toBe("unavailable");
    expect(await presenter.askInit(signal)).toBe("no");
  });
});
