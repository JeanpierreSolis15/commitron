import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import type { Environment } from "../../src/app/ports";
import { NodeTerminal } from "../../src/infra/terminal/node-terminal";
import { fakeEnvironment } from "../helpers/fakes";

class Sink {
  text = "";
  isTTY = false;

  write(chunk: string): boolean {
    this.text += chunk;
    return true;
  }
}

function terminal(environment: Environment = fakeEnvironment()) {
  const stdin = new PassThrough();
  const stdout = new Sink();
  const stderr = new Sink();
  const t = new NodeTerminal(environment, { stdin, stdout, stderr });
  return { t, stdin, stdout, stderr };
}

const signal = () => new AbortController().signal;

describe("NodeTerminal.ask", () => {
  it("returns the line that was typed", async () => {
    const { t, stdin, stderr } = terminal();
    const answer = t.ask("commit? ", signal());
    stdin.write("y\r\n");
    expect(await answer).toBe("y");
    expect(stderr.text).toBe("commit? ");
  });

  it("asks again on the same input", async () => {
    const { t, stdin } = terminal();
    const first = t.ask("create? ", signal());
    stdin.write("y\n");
    expect(await first).toBe("y");
    const second = t.ask("commit? ", signal());
    stdin.write("n\n");
    expect(await second).toBe("n");
  });

  it("returns null at the end of the input", async () => {
    const { t, stdin, stderr } = terminal();
    const answer = t.ask("commit? ", signal());
    stdin.end();
    expect(await answer).toBeNull();
    expect(stderr.text).toBe("commit? \n");
  });

  it("returns null when aborted", async () => {
    const { t } = terminal();
    const controller = new AbortController();
    const answer = t.ask("commit? ", controller.signal);
    controller.abort();
    expect(await answer).toBeNull();
  });
});

describe("NodeTerminal streams", () => {
  it("writes to the given stdout and stderr", () => {
    const { t, stdout, stderr } = terminal();
    t.out("plain\n");
    t.err("pretty\n");
    expect(stdout.text).toBe("plain\n");
    expect(stderr.text).toBe("pretty\n");
  });

  it("treats a stream as a terminal only when it says so", () => {
    const { t } = terminal();
    expect(t.tty).toEqual({ stdin: false, stdout: false, stderr: false });

    const stdin = new PassThrough();
    const stdout = Object.assign(new Sink(), { isTTY: true });
    const stderr = Object.assign(new Sink(), { isTTY: true });
    const tty = new NodeTerminal(fakeEnvironment(), { stdin, stdout, stderr });
    expect(tty.tty).toEqual({ stdin: false, stdout: true, stderr: true });
    expect(tty.supports.color).toBe(true);
  });

  it("trusts mintty for stdin and stderr but never for stdout", () => {
    const { t } = terminal(fakeEnvironment({ TERM_PROGRAM: "mintty" }, "win32"));
    expect(t.tty).toEqual({ stdin: true, stdout: false, stderr: true });
  });

  it("turns colour off for NO_COLOR and dumb terminals", () => {
    const stdin = new PassThrough();
    const stderr = Object.assign(new Sink(), { isTTY: true });
    const noColor = new NodeTerminal(fakeEnvironment({ NO_COLOR: "1" }), {
      stdin,
      stdout: new Sink(),
      stderr,
    });
    const dumb = new NodeTerminal(fakeEnvironment({ TERM: "dumb" }), {
      stdin,
      stdout: new Sink(),
      stderr,
    });
    expect(noColor.supports.color).toBe(false);
    expect(dumb.supports.color).toBe(false);
  });

  it("detects unicode from the locale or the Windows terminal", () => {
    expect(terminal(fakeEnvironment({ LANG: "es_ES.UTF-8" })).t.supports.unicode).toBe(true);
    expect(terminal(fakeEnvironment({ LANG: "C" })).t.supports.unicode).toBe(false);
    expect(terminal(fakeEnvironment({ WT_SESSION: "x" }, "win32")).t.supports.unicode).toBe(true);
    expect(terminal(fakeEnvironment({}, "win32")).t.supports.unicode).toBe(false);
  });
});
