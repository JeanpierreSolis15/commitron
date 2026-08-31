import type { Mode } from "../domain/config";
import type { Capabilities } from "./terminal";

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

  constructor(colorMode: Mode, unicodeMode: Mode, supports: Capabilities) {
    this.color = resolve(colorMode, supports.color);
    const unicode = resolve(unicodeMode, supports.unicode);
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

function resolve(mode: Mode, auto: boolean): boolean {
  switch (mode) {
    case "always":
      return true;
    case "never":
      return false;
    default:
      return auto;
  }
}

function fg(hex: string): string {
  const n = Number.parseInt(hex.replace(/^#/, ""), 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
}
