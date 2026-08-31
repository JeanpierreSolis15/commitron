import { parseArgs, type ParseArgsConfig } from "node:util";
import type { CommitCommand } from "../app/commit";
import { fail } from "../app/errors";
import type { InitCommand } from "../app/init";
import { errorMessage } from "../utils/errors";

export interface CommitFlags extends CommitCommand {
  help: boolean;
  version: boolean;
}

export function parseCommitFlags(argv: string[]): CommitFlags {
  const values = parseFlags(argv, {
    model: { type: "string", short: "m" },
    config: { type: "string" },
    color: { type: "string" },
    edit: { type: "boolean", short: "e" },
    yes: { type: "boolean", short: "y" },
    "dry-run": { type: "boolean" },
    "no-verify": { type: "boolean" },
    "no-init": { type: "boolean" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
  });
  return {
    configPath: values.config ?? "",
    model: values.model ?? "",
    color: values.color ?? "",
    noVerify: values["no-verify"] === true,
    edit: values.edit === true,
    yes: values.yes === true,
    dryRun: values["dry-run"] === true,
    noInit: values["no-init"] === true,
    help: values.help === true,
    version: values.version === true,
  };
}

export function parseInitFlags(argv: string[]): InitCommand {
  const values = parseFlags(argv, {
    global: { type: "boolean" },
    full: { type: "boolean" },
    force: { type: "boolean" },
  });
  return {
    global: values.global === true,
    full: values.full === true,
    force: values.force === true,
  };
}

export function parseConfigFlags(argv: string[]): { configPath: string } {
  const values = parseFlags(argv, { config: { type: "string" } });
  return { configPath: values.config ?? "" };
}

function parseFlags<T extends ParseArgsConfig["options"]>(
  argv: string[],
  options: T,
): ReturnType<typeof parseArgs<{ args: string[]; options: T; allowPositionals: true }>>["values"] {
  try {
    return parseArgs({ args: argv, options, allowPositionals: true, strict: true }).values;
  } catch (err) {
    throw fail(errorMessage(err), "run `commitron --help` to see the flags");
  }
}
