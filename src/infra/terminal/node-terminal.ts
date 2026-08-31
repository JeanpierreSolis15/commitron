import { createInterface } from "node:readline";
import type { Environment } from "../../app/ports";
import type { Capabilities, Streams, Terminal } from "../../ui/terminal";

interface Input extends NodeJS.ReadableStream {
  isTTY?: boolean;
}

interface Output {
  isTTY?: boolean;
  write(text: string): unknown;
}

export interface StandardStreams {
  stdin: Input;
  stdout: Output;
  stderr: Output;
}

export class NodeTerminal implements Terminal {
  readonly tty: Streams;
  readonly supports: Capabilities;

  constructor(
    environment: Environment,
    private readonly streams: StandardStreams = process,
  ) {
    const interactive = (stream: Input | Output) => isTerminal(stream, environment, streams);
    this.tty = {
      stdin: interactive(streams.stdin),
      stdout: interactive(streams.stdout),
      stderr: interactive(streams.stderr),
    };
    this.supports = {
      color: autoColor(environment, this.tty.stderr),
      unicode: autoUnicode(environment),
    };
  }

  out(text: string): void {
    this.streams.stdout.write(text);
  }

  err(text: string): void {
    this.streams.stderr.write(text);
  }

  ask(question: string, signal: AbortSignal): Promise<string | null> {
    this.streams.stderr.write(question);
    const rl = createInterface({ input: this.streams.stdin, terminal: false });
    return new Promise((resolve) => {
      let settled = false;
      const finish = (line: string | null) => {
        if (settled) {
          return;
        }
        settled = true;
        signal.removeEventListener("abort", onAbort);
        rl.off("close", onClose);
        rl.close();
        if (line === null) {
          this.streams.stderr.write("\n");
        }
        resolve(line);
      };
      const onAbort = () => finish(null);
      const onClose = () => finish(null);
      signal.addEventListener("abort", onAbort, { once: true });
      rl.once("line", finish);
      rl.once("close", onClose);
    });
  }
}

function isTerminal(
  stream: Input | Output,
  { platform, variables }: Environment,
  streams: StandardStreams,
): boolean {
  if (stream.isTTY === true) {
    return true;
  }
  return platform === "win32" && variables.TERM_PROGRAM === "mintty" && stream !== streams.stdout;
}

function autoColor({ variables }: Environment, stderrIsTerminal: boolean): boolean {
  if (variables.NO_COLOR) {
    return false;
  }
  if (variables.TERM === "dumb") {
    return false;
  }
  return stderrIsTerminal;
}

function autoUnicode({ platform, variables }: Environment): boolean {
  if (platform === "win32") {
    return Boolean(variables.WT_SESSION || variables.TERM_PROGRAM || variables.MSYSTEM);
  }
  for (const key of ["LC_ALL", "LC_CTYPE", "LANG"]) {
    const value = (variables[key] ?? "").toLowerCase();
    if (value.includes("utf-8") || value.includes("utf8")) {
      return true;
    }
  }
  return false;
}
