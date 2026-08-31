import type { Answer, InitAnswer } from "../app/ports";
import type { Terminal } from "./terminal";
import type { Theme } from "./theme";
import { noConfigView, questionView } from "./views";

const yesAnswers = ["", "y", "yes", "s", "si", "sí"];

export async function confirm(
  terminal: Terminal,
  theme: Theme,
  signal: AbortSignal,
): Promise<Answer> {
  if (!terminal.tty.stdin) {
    return "unavailable";
  }
  terminal.err("\n");
  const answer = await ask(terminal, questionView(theme, "commit?", "[Y/n/e=edit]"), signal);
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

export async function askInit(
  terminal: Terminal,
  theme: Theme,
  signal: AbortSignal,
): Promise<InitAnswer> {
  if (!terminal.tty.stdin) {
    return "no";
  }
  terminal.err(`${noConfigView(theme)}\n`);
  const answer = await ask(
    terminal,
    questionView(theme, "create .commitron.json?", "[Y/n/g=global]"),
    signal,
  );
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

async function ask(
  terminal: Terminal,
  question: string,
  signal: AbortSignal,
): Promise<string | null> {
  const line = await terminal.ask(question, signal);
  return line === null ? null : line.trim().toLowerCase();
}
