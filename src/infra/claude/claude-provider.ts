import { spawn, type ChildProcess } from "node:child_process";
import { accessSync, constants, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GenerationAbortedError, ProviderMissingError } from "../../app/errors";
import type { Environment, GenerationRequest, Provider } from "../../app/ports";

interface Executable {
  file: string;
  shell: boolean;
}

const isolationArgs = ["--tools", "", "--setting-sources", "", "--no-session-persistence"];

const flagsWithValue = new Set(["--model", "--fallback-model", "--tools", "--setting-sources"]);

const unknownOptionRe = /unknown option '([^']+)'/i;

class UnsupportedFlagError extends Error {
  constructor(readonly flag: string) {
    super(`claude does not support ${flag}`);
  }
}

export class ClaudeProvider implements Provider {
  constructor(private readonly environment: Environment) {}

  async generate(request: GenerationRequest, signal: AbortSignal): Promise<string> {
    const executable = lookPath("claude", this.environment);
    if (!executable) {
      throw new ProviderMissingError();
    }
    const cwd = request.isolated ? neutralDirectory() : undefined;
    let args = claudeArgs(request);
    for (;;) {
      try {
        return await this.run(executable, args, cwd, request, signal);
      } catch (err) {
        if (!(err instanceof UnsupportedFlagError) || !args.includes(err.flag)) {
          throw err;
        }
        args = withoutFlag(args, err.flag);
      }
    }
  }

  private run(
    executable: Executable,
    args: string[],
    cwd: string | undefined,
    request: GenerationRequest,
    signal: AbortSignal,
  ): Promise<string> {
    const { platform } = this.environment;
    const { timeoutSeconds } = request;

    return new Promise((resolve, reject) => {
      const [file, argv, shell] = command(executable, args);
      const child = spawn(file, argv, { cwd, shell, windowsHide: true });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        kill(child, platform);
      }, timeoutSeconds * 1000);
      const onAbort = () => kill(child, platform);
      signal.addEventListener("abort", onAbort, { once: true });
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
      };

      child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
      child.stdin.on("error", () => {});
      child.on("error", (err: NodeJS.ErrnoException) => {
        cleanup();
        reject(err.code === "ENOENT" ? new ProviderMissingError() : err);
      });
      child.on("close", (code) => {
        cleanup();
        const detail = stderr.trim();
        const unsupported = unknownOptionRe.exec(detail)?.[1];
        if (timedOut) {
          reject(new Error(`no reply after ${timeoutSeconds}s`));
        } else if (signal.aborted) {
          reject(new GenerationAbortedError());
        } else if (code === 0) {
          resolve(stdout);
        } else if (unsupported) {
          reject(new UnsupportedFlagError(unsupported));
        } else {
          reject(new Error(detail ? `claude: ${detail}` : `claude: exit status ${code}`));
        }
      });
      child.stdin.end(request.prompt);
    });
  }
}

export function claudeArgs(
  request: Omit<GenerationRequest, "prompt" | "timeoutSeconds">,
): string[] {
  const args = ["-p", "--model", request.model];
  if (request.fallbackModel !== "") {
    args.push("--fallback-model", request.fallbackModel);
  }
  if (request.strictMcpConfig) {
    args.push("--strict-mcp-config");
  }
  if (request.isolated) {
    args.push(...isolationArgs);
  }
  return [...args, ...request.extraArgs];
}

export function withoutFlag(args: string[], flag: string): string[] {
  const index = args.indexOf(flag);
  if (index === -1) {
    return args;
  }
  const width = flagsWithValue.has(flag) ? 2 : 1;
  return [...args.slice(0, index), ...args.slice(index + width)];
}

export function quoteForShell(arg: string): string {
  return arg === "" || /\s/.test(arg) ? `"${arg}"` : arg;
}

function neutralDirectory(): string {
  const dir = path.join(tmpdir(), "commitron-claude");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function command(executable: Executable, args: string[]): [string, string[], boolean] {
  if (!executable.shell) {
    return [executable.file, args, false];
  }
  return [quoteForShell(executable.file), args.map(quoteForShell), true];
}

function kill(child: ChildProcess, platform: string): void {
  if (child.exitCode !== null || child.pid === undefined) {
    return;
  }
  if (platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGKILL");
}

function lookPath(name: string, { platform, variables }: Environment): Executable | null {
  const dirs = (variables.PATH ?? "").split(path.delimiter).filter((dir) => dir !== "");
  const extensions =
    platform === "win32"
      ? (variables.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((ext) => ext !== "")
      : [""];
  for (const dir of dirs) {
    for (const ext of extensions) {
      const file = path.join(dir, name + ext);
      if (isExecutable(file, platform)) {
        return { file, shell: /\.(cmd|bat)$/i.test(file) };
      }
    }
  }
  return null;
}

function isExecutable(file: string, platform: string): boolean {
  try {
    if (!statSync(file).isFile()) {
      return false;
    }
    if (platform !== "win32") {
      accessSync(file, constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}
