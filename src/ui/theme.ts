import type { Mode } from "../config";

export const reset = "\x1b[0m";
export const cursorHide = "\x1b[?25l";
export const cursorShow = "\x1b[?25h";
export const clearLine = "\r\x1b[2K";

export interface Glyphs {
  spark: string;
  ok: string;
  fail: string;
  warn: string;
  dot: string;
  minus: string;
}

const unicodeGlyphs: Glyphs = { spark: "✳", ok: "✓", fail: "✗", warn: "!", dot: "·", minus: "−" };
const asciiGlyphs: Glyphs = { spark: "*", ok: "OK", fail: "x", warn: "!", dot: "-", minus: "-" };

const unicodeFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const asciiFrames = ["|", "/", "-", "\\"];

const clayCode = fg("#D56C4E");
const okCode = fg("#4FB286");
const badCode = fg("#E06C5E");
const accentCode = fg("#D9A441");
const dimCode = "\x1b[2m";
const headCode = "\x1b[97m";

export class Theme {
  readonly color: boolean;
  readonly glyph: Glyphs;
  readonly frames: string[];

  constructor(colorMode: Mode, unicodeMode: Mode) {
    this.color = resolve(colorMode, autoColor);
    const unicode = resolve(unicodeMode, autoUnicode);
    this.glyph = unicode ? unicodeGlyphs : asciiGlyphs;
    this.frames = unicode ? unicodeFrames : asciiFrames;
  }

  private paint(code: string, s: string): string {
    if (!this.color || s === "") {
      return s;
    }
    return code + s + reset;
  }

  clay(s: string): string {
    return this.paint(clayCode, s);
  }

  ok(s: string): string {
    return this.paint(okCode, s);
  }

  bad(s: string): string {
    return this.paint(badCode, s);
  }

  accent(s: string): string {
    return this.paint(accentCode, s);
  }

  dim(s: string): string {
    return this.paint(dimCode, s);
  }

  head(s: string): string {
    return this.paint(headCode, s);
  }
}

function resolve(mode: Mode, auto: () => boolean): boolean {
  switch (mode) {
    case "always":
      return true;
    case "never":
      return false;
    default:
      return auto();
  }
}

function autoColor(): boolean {
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.TERM === "dumb") {
    return false;
  }
  return isTerminal(process.stderr);
}

function autoUnicode(): boolean {
  if (process.platform === "win32") {
    return Boolean(process.env.WT_SESSION || process.env.TERM_PROGRAM || process.env.MSYSTEM);
  }
  for (const key of ["LC_ALL", "LC_CTYPE", "LANG"]) {
    const value = (process.env[key] ?? "").toLowerCase();
    if (value.includes("utf-8") || value.includes("utf8")) {
      return true;
    }
  }
  return false;
}

export function isTerminal(stream: NodeJS.ReadStream | NodeJS.WriteStream): boolean {
  if (stream.isTTY) {
    return true;
  }
  return (
    process.platform === "win32" &&
    process.env.TERM_PROGRAM === "mintty" &&
    stream !== process.stdout
  );
}

function fg(hex: string): string {
  const n = Number.parseInt(hex.replace(/^#/, ""), 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
}
