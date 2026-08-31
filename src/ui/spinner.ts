import type { Terminal } from "./terminal";
import { clearLine, cursorHide, cursorShow, type Theme } from "./theme";

const frameEvery = 80;

export class Spinner {
  private readonly live: boolean;
  private label = "starting";
  private started = Date.now();
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly terminal: Terminal,
    private readonly theme: Theme,
  ) {
    this.live = terminal.tty.stderr;
  }

  start(): void {
    this.started = Date.now();
    if (!this.live) {
      return;
    }
    this.terminal.err(cursorHide);
    this.timer = setInterval(() => this.draw(), frameEvery);
    this.timer.unref();
    this.draw();
  }

  status(text: string): void {
    this.label = text;
    if (this.live) {
      this.draw();
      return;
    }
    this.terminal.err(`${this.theme.glyph.dot} ${text}\n`);
  }

  private draw(): void {
    const elapsed = Date.now() - this.started;
    const frames = this.theme.frames;
    const frame = frames[Math.floor(elapsed / frameEvery) % frames.length]!;
    const seconds = this.theme.dim(`${(elapsed / 1000).toFixed(1)}s`);
    this.terminal.err(
      `${clearLine}${this.theme.clay(frame)} ${this.theme.dim(this.label)} ${seconds}`,
    );
  }

  stop(): void {
    if (!this.live || this.timer === undefined) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
    this.terminal.err(clearLine + cursorShow);
  }
}
