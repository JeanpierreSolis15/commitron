import path from "node:path";
import type { CommitCommand } from "../../src/app/commit";
import type {
  Answer,
  CommitOptions,
  Dependencies,
  Environment,
  Files,
  GenerationRequest,
  GitClient,
  InitAnswer,
  Presenter,
  Progress,
  Provider,
  Stats,
} from "../../src/app/ports";
import type { Parsed } from "../../src/domain/message";
import type { Terminal } from "../../src/ui/terminal";

export class FakeFiles implements Files {
  private readonly entries = new Map<string, string>();

  constructor(entries: Record<string, string> = {}) {
    for (const [file, content] of Object.entries(entries)) {
      this.write(file, content);
    }
  }

  read(file: string): string | undefined {
    return this.entries.get(path.normalize(file));
  }

  exists(file: string): boolean {
    return this.entries.has(path.normalize(file));
  }

  write(file: string, content: string): void {
    this.entries.set(path.normalize(file), content);
  }
}

export class FakeGit implements GitClient {
  root: string | Error = path.normalize("/repo");
  stats: Stats = { files: 1, added: 3, removed: 1 };
  stat = " a.ts | 4 ++-\n 1 file changed, 3 insertions(+), 1 deletion(-)\n";
  diff = "diff --git a/a.ts b/a.ts\n+hello\n";
  excluded: string[] = [];
  history: string[] | Error = [];
  readonly commits: { message: string; options: CommitOptions }[] = [];

  repoRoot(): string {
    if (this.root instanceof Error) {
      throw this.root;
    }
    return this.root;
  }

  stagedStats(): Stats {
    return this.stats;
  }

  stagedStat(): string {
    return this.stat;
  }

  stagedDiff(): string {
    return this.diff;
  }

  excludedFiles(exclude: string[]): string[] {
    return exclude.length === 0 ? [] : this.excluded;
  }

  recentMessages(count: number): string[] {
    if (this.history instanceof Error) {
      throw this.history;
    }
    return this.history.slice(0, count);
  }

  commit(message: string, options: CommitOptions): string {
    this.commits.push({ message, options });
    return "abc1234";
  }
}

export class FakeProvider implements Provider {
  readonly requests: GenerationRequest[] = [];
  reply: string | Error = "<commit>feat: add the thing</commit>";
  replies: (string | Error)[] = [];

  async generate(request: GenerationRequest): Promise<string> {
    this.requests.push(request);
    const next = this.replies.length > 0 ? this.replies.shift()! : this.reply;
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }
}

export class FakePresenter implements Presenter {
  readonly events: string[] = [];
  readonly statuses: string[] = [];
  shown: { text: string; parsed: Parsed; warnings: string[] } | undefined;
  initAnswer: InitAnswer = "no";
  confirmAnswer: Answer = "yes";

  header(model: string, stats: Stats): void {
    this.events.push(`header ${model} ${stats.files}`);
  }

  begin(): Progress {
    this.events.push("begin");
    return {
      status: (text) => this.statuses.push(text),
      end: () => this.events.push("end"),
    };
  }

  message(text: string, parsed: Parsed, warnings: string[]): void {
    this.shown = { text, parsed, warnings };
    this.events.push("message");
  }

  dryRun(): void {
    this.events.push("dry-run");
  }

  committed(sha: string): void {
    this.events.push(`committed ${sha}`);
  }

  wrote(file: string): void {
    this.events.push(`wrote ${file}`);
  }

  async askInit(): Promise<InitAnswer> {
    this.events.push("ask-init");
    return this.initAnswer;
  }

  async confirm(): Promise<Answer> {
    this.events.push("confirm");
    return this.confirmAnswer;
  }
}

export class FakeTerminal implements Terminal {
  stdout = "";
  stderr = "";
  answers: (string | null)[] = [];
  tty = { stdin: true, stdout: true, stderr: false };
  supports = { color: false, unicode: false };

  out(text: string): void {
    this.stdout += text;
  }

  err(text: string): void {
    this.stderr += text;
  }

  async ask(question: string): Promise<string | null> {
    this.stderr += question;
    return this.answers.shift() ?? null;
  }
}

export function fakeEnvironment(
  variables: Record<string, string | undefined> = {},
  platform = "linux",
): Environment {
  return { platform, variables };
}

export interface World {
  git: FakeGit;
  provider: FakeProvider;
  files: FakeFiles;
  presenter: FakePresenter;
  environment: Environment;
  deps: Dependencies;
}

export function world(variables: Record<string, string | undefined> = {}): World {
  const git = new FakeGit();
  const provider = new FakeProvider();
  const files = new FakeFiles();
  const presenter = new FakePresenter();
  const environment = fakeEnvironment({ HOME: path.normalize("/home/tester"), ...variables });
  return {
    git,
    provider,
    files,
    presenter,
    environment,
    deps: { git, provider, files, environment, presenter: () => presenter },
  };
}

export function command(overrides: Partial<CommitCommand> = {}): CommitCommand {
  return { edit: false, yes: false, dryRun: false, noInit: false, ...overrides };
}

export function signal(): AbortSignal {
  return new AbortController().signal;
}
