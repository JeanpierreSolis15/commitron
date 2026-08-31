import { createInterface } from "node:readline";
import type { Environment } from "../../app/ports";
import type { Capabilities, Streams, Terminal } from "../../ui/terminal";

type Stream = NodeJS.ReadStream | NodeJS.WriteStream;

export class NodeTerminal implements Terminal {
  readonly tty: Streams;
  readonly supports: Capabilities;

  constructor(environment: Environment) {
    this.tty = {
      stdin: isTerminal(process.stdin, environment),
      stdout: isTerminal(process.stdout, environment),
      stderr: isTerminal(process.stderr, environment),
    };
    this.supports = {
      color: autoColor(environment, this.tty.stderr),
      unicode: autoUnicode(environment),
    };
  }

  out(text: string): void {
    process.stdout.write(text);
  }

  err(text: string): void {
    process.stderr.write(text);
  }

  ask(question: string, signal: AbortSignal): Promise<string | null> {
    process.stderr.write(question);
    const rl = createInterface({ input: process.stdin, terminal: false });
    return new Promise((resolve) => {
      const finish = (line: string | null) => {
        signal.removeEventListener("abort", onAbort);
        rl.close();
        if (line === null) {
          process.stderr.write("\n");
        }
        resolve(line);
      };
      const onAbort = () => finish(null);
      signal.addEventListener("abort", onAbort, { once: true });
      rl.once("line", (line) => finish(line));
      rl.once("close", () => finish(null));
    });
  }
}

function isTerminal(stream: Stream, { platform, variables }: Environment): boolean {
  if (stream.isTTY) {
    return true;
  }
  return platform === "win32" && variables.TERM_PROGRAM === "mintty" && stream !== process.stdout;
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
