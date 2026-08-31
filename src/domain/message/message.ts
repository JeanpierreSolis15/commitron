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
