import { allowsType, type Config } from "./config";
import { canonical, hasUpper, runeCount, violatesLowerCase, wrapBody } from "./normalize";

const tagRe = /<commit>([\s\S]*?)<\/commit>/;
const fenceRe = /^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n```$/;
const subjectRe = /^([a-zA-Z]+)(?:\(([^()]+)\))?(!)?:[ \t]*(.+)$/;

const noiseRe = /^\s*(co-authored-by:|claude-session:|generated with \[?claude|🤖)/iu;
const urlRe = /^\s*https:\/\/claude\.ai\//;

export interface Parsed {
  type: string;
  scope: string;
  breaking: boolean;
  description: string;
  subject: string;
  body: string;
}

export function sanitize(raw: string): string {
  let msg = raw.replaceAll("\r\n", "\n").trim();
  const tagged = tagRe.exec(msg);
  if (tagged) {
    msg = tagged[1]!.trim();
  }
  const fenced = fenceRe.exec(msg);
  if (fenced) {
    msg = fenced[1]!.trim();
  }
  return msg
    .split("\n")
    .filter((line) => !noiseRe.test(line) && !urlRe.test(line))
    .join("\n")
    .trim();
}

export function parse(msg: string): Parsed | null {
  const newline = msg.indexOf("\n");
  const subject = (newline === -1 ? msg : msg.slice(0, newline)).trim();
  const body = newline === -1 ? "" : msg.slice(newline + 1);
  const m = subjectRe.exec(subject);
  if (!m) {
    return null;
  }
  return {
    type: m[1]!.toLowerCase(),
    scope: m[2] ?? "",
    breaking: m[3] === "!",
    description: m[4]!.trim(),
    subject,
    body: body.trim(),
  };
}

export function validate(p: Parsed, cfg: Config): string[] {
  if (!allowsType(cfg, p.type)) {
    throw new Error(`"${p.type}" is not an allowed type (${cfg.types.join(", ")})`);
  }

  const warnings: string[] = [];

  const subjectLength = runeCount(canonical(p));
  if (subjectLength > cfg.subjectMaxLength) {
    warnings.push(
      `subject is ${subjectLength} characters, ${subjectLength - cfg.subjectMaxLength} over the limit`,
    );
  }

  if (cfg.subjectCase === "lower" && violatesLowerCase(p.description)) {
    warnings.push("description starts with a capital; commitlint expects lowercase");
  }

  if (cfg.scopeCase === "lower" && hasUpper(p.scope)) {
    warnings.push(`scope "${p.scope}" is not lowercase`);
  }

  if (cfg.bodyMaxLineLength > 0) {
    for (const line of wrapBody(p.body, cfg.bodyMaxLineLength).split("\n")) {
      const n = runeCount(line);
      if (n > cfg.bodyMaxLineLength) {
        warnings.push(`a body line is ${n} characters and cannot be wrapped`);
        break;
      }
    }
  }

  if (cfg.body === "always" && p.body === "") {
    warnings.push("body is required by config but the model returned none");
  }
  if (cfg.body === "never" && p.body !== "") {
    warnings.push("config asks for no body but the model returned one");
  }
  return warnings;
}
