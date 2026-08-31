import type { Answer, InitAnswer, Presenter, Progress, Stats } from "../app/ports";
import type { Parsed } from "../domain/message";
import { askInit, confirm } from "./prompts";
import { Spinner } from "./spinner";
import type { Terminal } from "./terminal";
import type { Theme } from "./theme";
import {
  committedView,
  dryRunView,
  headerView,
  messageView,
  warningView,
  wroteView,
} from "./views";

export class TerminalPresenter implements Presenter {
  constructor(
    private readonly terminal: Terminal,
    private readonly theme: Theme,
  ) {}

  header(model: string, stats: Stats): void {
    this.terminal.err(`${headerView(this.theme, model, stats)}\n`);
  }

  begin(): Progress {
    const spinner = new Spinner(this.terminal, this.theme);
    spinner.start();
    return { status: (text) => spinner.status(text), end: () => spinner.stop() };
  }

  message(text: string, parsed: Parsed, warnings: string[]): void {
    this.terminal.err(`\n${messageView(this.theme, parsed)}\n`);
    for (const warning of warnings) {
      this.terminal.err(`${warningView(this.theme, warning)}\n`);
    }
    if (!this.terminal.tty.stdout) {
      this.terminal.out(`${text}\n`);
    }
  }

  dryRun(): void {
    this.terminal.err(`${dryRunView(this.theme)}\n`);
  }

  committed(sha: string): void {
    this.terminal.err(`${committedView(this.theme, sha)}\n`);
  }

  wrote(file: string): void {
    this.terminal.err(`${wroteView(this.theme, file)}\n`);
  }

  askInit(signal: AbortSignal): Promise<InitAnswer> {
    return askInit(this.terminal, this.theme, signal);
  }

  confirm(signal: AbortSignal): Promise<Answer> {
    return confirm(this.terminal, this.theme, signal);
  }
}
