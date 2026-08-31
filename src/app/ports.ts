import type { Config } from "../domain/config";
import type { Parsed } from "../domain/message";

export interface Stats {
  files: number;
  added: number;
  removed: number;
}

export interface CommitOptions {
  edit: boolean;
  verify: boolean;
}

export interface GitClient {
  repoRoot(): string;
  stagedStats(): Stats;
  stagedStat(): string;
  stagedDiff(exclude: string[]): string;
  excludedFiles(exclude: string[]): string[];
  recentMessages(count: number): string[];
  commit(message: string, options: CommitOptions): string;
}

export interface GenerationRequest {
  prompt: string;
  model: string;
  fallbackModel: string;
  strictMcpConfig: boolean;
  extraArgs: string[];
  timeoutSeconds: number;
}

export interface Provider {
  generate(request: GenerationRequest, signal: AbortSignal): Promise<string>;
}

export interface Files {
  read(file: string): string | undefined;
  exists(file: string): boolean;
  write(file: string, content: string): void;
}

export interface Environment {
  readonly platform: string;
  readonly variables: Readonly<Record<string, string | undefined>>;
}

export type Answer = "yes" | "no" | "edit" | "unavailable";

export type InitAnswer = "no" | "repo" | "global";

export interface Progress {
  status(text: string): void;
  end(): void;
}

export interface Presenter {
  header(model: string, stats: Stats): void;
  begin(): Progress;
  message(text: string, parsed: Parsed, warnings: string[]): void;
  dryRun(): void;
  committed(sha: string): void;
  wrote(file: string): void;
  askInit(signal: AbortSignal): Promise<InitAnswer>;
  confirm(signal: AbortSignal): Promise<Answer>;
}

export interface Dependencies {
  git: GitClient;
  provider: Provider;
  files: Files;
  environment: Environment;
  presenter: (config: Config) => Presenter;
}
