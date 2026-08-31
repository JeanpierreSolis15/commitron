import type { Config } from "./config";
import type { Parsed } from "./message";

const upperRe = /\p{Lu}/u;

export function runeCount(s: string): number {
  return Array.from(s).length;
}

export function canonical(p: Parsed): string {
  let subject = p.type.toLowerCase();
  if (p.scope !== "") {
    subject += `(${p.scope})`;
  }
  if (p.breaking) {
    subject += "!";
  }
  return `${subject}: ${p.description.trim().replace(/\.+$/, "")}`;
}

export function render(p: Parsed, cfg: Config): string {
  const subject = canonical(p);
  if (p.body === "") {
    return subject;
  }
  return `${subject}\n\n${wrapBody(p.body, cfg.bodyMaxLineLength)}`;
}

export function wrapBody(body: string, max: number): string {
  if (max <= 0) {
    return body;
  }
  return body
    .split("\n")
    .flatMap((line) => wrapLine(line, max))
    .join("\n");
}

function wrapLine(line: string, max: number): string[] {
  if (runeCount(line) <= max || line.trim() === "") {
    return [line];
  }

  const trimmed = line.replace(/^[ \t]+/, "");
  const indent = line.slice(0, line.length - trimmed.length);
  const continuation =
    trimmed.startsWith("- ") || trimmed.startsWith("* ") ? `${indent}  ` : indent;

  const words = trimmed.split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) {
    return [line];
  }

  const lines: string[] = [];
  let current = indent + words[0];
  for (const word of words.slice(1)) {
    if (runeCount(current) + 1 + runeCount(word) <= max) {
      current += ` ${word}`;
      continue;
    }
    lines.push(current);
    current = continuation + word;
  }
  lines.push(current);
  return lines;
}

export function violatesLowerCase(description: string): boolean {
  if (description === "") {
    return false;
  }
  const chars = Array.from(description);
  if (!upperRe.test(chars[0]!)) {
    return false;
  }
  const space = description.search(/[ \t]/);
  const word = space > 0 ? description.slice(0, space) : description;
  return !Array.from(word)
    .slice(1)
    .some((ch) => upperRe.test(ch));
}

export function hasUpper(s: string): boolean {
  return Array.from(s).some((ch) => upperRe.test(ch));
}
