import { clearLine, cursorHide, cursorShow, isTerminal, type Theme } from "./theme";

const frameEvery = 80;

export class Spinner {
  private readonly live: boolean;
  private label = "starting";
  private started = Date.now();
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly theme: Theme) {
    this.live = isTerminal(process.stderr);
  }

  start(): void {
    this.started = Date.now();
    if (!this.live) {
      return;
    }
    process.stderr.write(cursorHide);
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
    process.stderr.write(`${this.theme.glyph.dot} ${text}\n`);
  }

  private draw(): void {
    const elapsed = Date.now() - this.started;
    const frames = this.theme.frames;
    const frame = frames[Math.floor(elapsed / frameEvery) % frames.length]!;
    process.stderr.write(
      `${clearLine}${this.theme.clay(frame)} ${this.theme.dim(this.label)} ${this.theme.dim(
        `${(elapsed / 1000).toFixed(1)}s`,
      )}`,
    );
  }

  stop(): void {
    if (!this.live || this.timer === undefined) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
    process.stderr.write(clearLine + cursorShow);
  }
}
