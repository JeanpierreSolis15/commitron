export interface Capabilities {
  color: boolean;
  unicode: boolean;
}

export interface Streams {
  stdin: boolean;
  stdout: boolean;
  stderr: boolean;
}

export interface Terminal {
  readonly tty: Streams;
  readonly supports: Capabilities;
  out(text: string): void;
  err(text: string): void;
  ask(question: string, signal: AbortSignal): Promise<string | null>;
}
