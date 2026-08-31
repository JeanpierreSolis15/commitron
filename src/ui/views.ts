import type { Stats } from "../app/ports";
import type { Parsed } from "../domain/message";
import type { Theme } from "./theme";

export function headerView(t: Theme, model: string, stats: Stats): string {
  const noun = stats.files === 1 ? "file" : "files";
  return [
    t.clay(t.glyph.spark),
    t.head("commitron"),
    t.dim(t.glyph.dot),
    t.dim(model),
    t.dim(`${stats.files} ${noun}`),
    t.ok(`+${stats.added}`),
    t.bad(`${t.glyph.minus}${stats.removed}`),
  ].join(" ");
}

export function messageView(t: Theme, p: Parsed): string {
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

export function warningView(t: Theme, text: string): string {
  return `  ${t.bad(t.glyph.warn)} ${t.dim(text)}`;
}

export function dryRunView(t: Theme): string {
  return `\n  ${t.dim(`dry run ${t.glyph.dot} nothing committed`)}`;
}

export function committedView(t: Theme, sha: string): string {
  return `\n  ${t.ok(t.glyph.ok)} ${t.head(sha)} ${t.dim("committed")}`;
}

export function wroteView(t: Theme, file: string): string {
  return `  ${t.ok(t.glyph.ok)} ${t.dim(`wrote ${file}`)}\n`;
}

export function noConfigView(t: Theme): string {
  return `  ${t.dim(t.glyph.dot)} ${t.dim("no commitron config in this repository")}`;
}

export function questionView(t: Theme, question: string, hint: string): string {
  return `  ${t.head(question)} ${t.dim(hint)} `;
}
