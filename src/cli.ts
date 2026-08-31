import { readFileSync } from "node:fs";
import { parseArgs, type ParseArgsConfig } from "node:util";
import { runConfig, runInit } from "./init";
import { runCommit } from "./run";

export const usage = `commitron — AI commit messages from your staged diff, via the Claude Code CLI.

Usage:
  commitron [flags]          write a commit message for what is staged
  commitron init [flags]     create a config file
  commitron config           show the resolved config and where it came from
  commitron version

Flags:
  -m, --model <name>     model to use for this run (overrides the config)
  -e, --edit             open the message in your git editor before committing
  -y, --yes              do not ask for confirmation
      --dry-run          print the message and stop
      --config <path>    load this config file on top of the others
      --no-verify        skip git hooks
      --no-init          do not offer to create a config file
      --color <mode>     auto | always | never
  -v, --version
  -h, --help

Init flags:
      --global           write to the user-wide config instead of the repo
      --full             write every key, not just the common ones
      --force            overwrite an existing file

Config resolution, lowest precedence first:
  defaults -> user config -> package.json#commitron -> .commitron.json -> --config -> flags
`;

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

export function version(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command !== undefined && !command.startsWith("-")) {
    switch (command) {
      case "init":
        return report(() => runInit(rest));
      case "config":
        return report(() => runConfig(rest));
      case "version":
        process.stdout.write(`${version()}\n`);
        return 0;
      case "help":
        process.stdout.write(usage);
        return 0;
      default:
        process.stderr.write(`commitron: unknown command "${command}"\n\n${usage}`);
        return 2;
    }
  }
  return report(() => runCommit(args));
}

async function report(task: () => Promise<void> | void): Promise<number> {
  try {
    await task();
    return 0;
  } catch (err) {
    if (err instanceof Cancelled) {
      process.stderr.write("  cancelled\n");
      return 1;
    }
    if (err instanceof Failure) {
      process.stderr.write(`\ncommitron: ${err.message}\n`);
      if (err.detail !== "") {
        process.stderr.write(`${indent(err.detail)}\n`);
      }
      return 1;
    }
    process.stderr.write(`\ncommitron: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

function indent(text: string): string {
  return text
    .replace(/\n+$/, "")
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

export function parseFlags<T extends ParseArgsConfig["options"]>(
  argv: string[],
  options: T,
): ReturnType<typeof parseArgs<{ args: string[]; options: T; allowPositionals: true }>>["values"] {
  try {
    return parseArgs({ args: argv, options, allowPositionals: true, strict: true }).values;
  } catch (err) {
    throw fail(
      err instanceof Error ? err.message : String(err),
      "run `commitron --help` to see the flags",
    );
  }
}
