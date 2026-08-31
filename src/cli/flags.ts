import { parseArgs, type ParseArgsConfig } from "node:util";
import type { CommitCommand } from "../app/commit";
import { fail, type Failure } from "../app/errors";
import type { InitCommand } from "../app/init";
import { errorMessage } from "../utils/errors";

export interface CommitFlags extends CommitCommand {
  help: boolean;
  version: boolean;
}

type Options = NonNullable<ParseArgsConfig["options"]>;

export function parseCommitFlags(argv: string[]): CommitFlags {
  const values = parseFlags(argv, "commitron", {
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
  const values = parseFlags(argv, "commitron init", {
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
  const values = parseFlags(argv, "commitron config", { config: { type: "string" } });
  return { configPath: values.config ?? "" };
}

function parseFlags<T extends Options>(
  argv: string[],
  command: string,
  options: T,
): ReturnType<typeof parseArgs<{ args: string[]; options: T; allowPositionals: true }>>["values"] {
  try {
    return parseArgs({ args: argv, options, allowPositionals: true, strict: true }).values;
  } catch (err) {
    throw flagFailure(err, command, options);
  }
}

function flagFailure(err: unknown, command: string, options: Options): Failure {
  const hint = `${command} accepts: ${describe(options)}\nrun \`commitron --help\` to see every command's flags`;
  const message = errorMessage(err);
  if ((err as NodeJS.ErrnoException).code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
    const flag = /Unknown option '([^']+)'/.exec(message)?.[1] ?? "flag";
    return fail(`unknown flag ${flag} for "${command}"`, hint);
  }
  return fail(message.replace(/\.\s*To specify[\s\S]*$/, ""), hint);
}

function describe(options: Options): string {
  return Object.entries(options)
    .map(([name, option]) => {
      const short = option.short ? `-${option.short}, ` : "";
      const value = option.type === "string" ? " <value>" : "";
      return `${short}--${name}${value}`;
    })
    .join(", ");
}
