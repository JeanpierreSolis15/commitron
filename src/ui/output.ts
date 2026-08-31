import { createInterface } from "node:readline";
import type { Parsed } from "../message";
import { isTerminal, type Theme } from "./theme";

export type Answer = "yes" | "no" | "edit" | "unavailable";

export type InitAnswer = "no" | "repo" | "global";

const yesAnswers = ["", "y", "yes", "s", "si", "sí"];

export function header(
  t: Theme,
  model: string,
  files: number,
  added: number,
  removed: number,
): string {
  const noun = files === 1 ? "file" : "files";
  return [
    t.clay(t.glyph.spark),
    t.head("commitron"),
    t.dim(t.glyph.dot),
    t.dim(model),
    t.dim(`${files} ${noun}`),
    t.ok(`+${added}`),
    t.bad(`${t.glyph.minus}${removed}`),
  ].join(" ");
}

export function message(t: Theme, p: Parsed): string {
  const scope = p.scope === "" ? "" : t.dim("(") + t.accent(p.scope) + t.dim(")");
  const bang = p.breaking ? t.bad("!") : "";
  const subject = `  ${t.accent(p.type)}${scope}${bang}${t.dim(":")} ${t.head(p.description)}`;
  if (p.body === "") {
    return subject;
  }
  const body = p.body
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : t.dim(`  ${line}`)))
    .join("\n");
  return `${subject}\n${body}`;
}

export function warn(t: Theme, text: string): void {
  process.stderr.write(`  ${t.bad(t.glyph.warn)} ${t.dim(text)}\n`);
}

export async function confirm(t: Theme, signal: AbortSignal): Promise<Answer> {
  if (!isTerminal(process.stdin)) {
    return "unavailable";
  }
  process.stderr.write("\n");
  const answer = await ask(t.head("commit?"), t.dim("[Y/n/e=edit]"), signal);
  if (answer === null) {
    return "no";
  }
  if (yesAnswers.includes(answer)) {
    return "yes";
  }
  if (answer === "e" || answer === "edit" || answer === "editar") {
    return "edit";
  }
  return "no";
}

export async function askInit(t: Theme, signal: AbortSignal): Promise<InitAnswer> {
  if (!isTerminal(process.stdin)) {
    return "no";
  }
  process.stderr.write(
    `  ${t.dim(t.glyph.dot)} ${t.dim("no commitron config in this repository")}\n`,
  );
  const answer = await ask(t.head("create .commitron.json?"), t.dim("[Y/n/g=global]"), signal);
  if (answer === null) {
    return "no";
  }
  if (yesAnswers.includes(answer)) {
    return "repo";
  }
  if (answer === "g" || answer === "global") {
    return "global";
  }
  return "no";
}

function ask(question: string, hint: string, signal: AbortSignal): Promise<string | null> {
  process.stderr.write(`  ${question} ${hint} `);
  const rl = createInterface({ input: process.stdin, terminal: false });
  return new Promise((resolve) => {
    const finish = (line: string | null) => {
      signal.removeEventListener("abort", onAbort);
      rl.close();
      if (line === null) {
        process.stderr.write("\n");
      }
      resolve(line === null ? null : line.trim().toLowerCase());
    };
    const onAbort = () => finish(null);
    signal.addEventListener("abort", onAbort, { once: true });
    rl.once("line", (line) => finish(line));
    rl.once("close", () => finish(null));
  });
}
