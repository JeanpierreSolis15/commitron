import { main } from "./cli/cli";
import { ClaudeProvider } from "./infra/claude/claude-provider";
import { nodeEnvironment } from "./infra/environment";
import { NodeFiles } from "./infra/files/node-files";
import { SpawnGit } from "./infra/git/spawn-git";
import { readPackageVersion } from "./infra/package";
import { NodeTerminal } from "./infra/terminal/node-terminal";
import { TerminalPresenter } from "./ui/presenter";
import { Theme } from "./ui/theme";

const environment = nodeEnvironment();
const terminal = new NodeTerminal(environment);
const controller = new AbortController();
const interrupt = () => controller.abort();
process.on("SIGINT", interrupt);

process.exitCode = await main(process.argv.slice(2), {
  deps: {
    git: new SpawnGit(),
    provider: new ClaudeProvider(environment),
    files: new NodeFiles(),
    environment,
    presenter: (config) =>
      new TerminalPresenter(terminal, new Theme(config.color, config.unicode, terminal.supports)),
  },
  terminal,
  version: readPackageVersion(new URL("../package.json", import.meta.url)),
  signal: controller.signal,
});

process.off("SIGINT", interrupt);
