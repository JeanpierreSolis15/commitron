export class Failure extends Error {
  constructor(
    message: string,
    readonly detail = "",
  ) {
    super(message);
  }
}

export class Cancelled extends Failure {
  constructor() {
    super("cancelled");
  }
}

export function fail(message: string, detail = ""): Failure {
  return new Failure(message, detail);
}

export class GitMissingError extends Error {
  constructor() {
    super("git executable not found on PATH");
  }
}

export class NotARepoError extends Error {
  constructor() {
    super("not a git repository");
  }
}

export class ProviderMissingError extends Error {
  constructor() {
    super("the `claude` CLI was not found on your PATH");
  }
}

export class GenerationAbortedError extends Error {
  constructor() {
    super("cancelled");
  }
}
