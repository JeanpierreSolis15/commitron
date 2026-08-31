import { commitStaged } from "../app/commit";
import type { LoadResult } from "../app/config";
import { initConfig } from "../app/init";
import type { Dependencies } from "../app/ports";
import { showConfig } from "../app/show-config";
import { serialize } from "../domain/config";
import type { Terminal } from "../ui/terminal";
import { parseCommitFlags, parseConfigFlags, parseInitFlags } from "./flags";
import { report } from "./report";
import { usage } from "./usage";

export interface CliContext {
  deps: Dependencies;
  terminal: Terminal;
  version: string;
  signal: AbortSignal;
}

export async function main(args: string[], ctx: CliContext): Promise<number> {
  const [command, ...rest] = args;
  if (command !== undefined && !command.startsWith("-")) {
    switch (command) {
      case "init":
        return run(ctx, () => {
          const written = initConfig(ctx.deps, parseInitFlags(rest));
          ctx.terminal.out(`wrote ${written}\n`);
        });
      case "config":
        return run(ctx, () => printConfig(ctx, showConfig(ctx.deps, parseConfigFlags(rest))));
      case "version":
        ctx.terminal.out(`${ctx.version}\n`);
        return 0;
      case "help":
        ctx.terminal.out(usage);
        return 0;
      default:
        ctx.terminal.err(`commitron: unknown command "${command}"\n\n${usage}`);
        return 2;
    }
  }
  return run(ctx, async () => {
    const flags = parseCommitFlags(args);
    if (flags.help) {
      ctx.terminal.out(usage);
      return;
    }
    if (flags.version) {
      ctx.terminal.out(`${ctx.version}\n`);
      return;
    }
    await commitStaged(ctx.deps, flags, ctx.signal);
  });
}

async function run(ctx: CliContext, task: () => Promise<void> | void): Promise<number> {
  try {
    await task();
    return 0;
  } catch (err) {
    return report(err, ctx.terminal);
  }
}

function printConfig(ctx: CliContext, result: LoadResult): void {
  ctx.terminal.out(`${serialize(result.config)}\n`);
  if (result.sources.length === 0) {
    ctx.terminal.out("\n// built-in defaults only; run `commitron init` to create a config file\n");
    return;
  }
  ctx.terminal.out("\n// merged from, in order:\n");
  for (const source of result.sources) {
    ctx.terminal.out(`//   ${source}\n`);
  }
}
