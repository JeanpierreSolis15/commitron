export function runeCount(s: string): number {
  return Array.from(s).length;
}

export function truncate(s: string, max: number): [string, boolean] {
  if (max <= 0) {
    return [s, false];
  }
  const chars = Array.from(s);
  if (chars.length <= max) {
    return [s, false];
  }
  return [chars.slice(0, max).join(""), true];
}

export function indent(text: string, prefix = "  "): string {
  return text
    .replace(/\n+$/, "")
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}
