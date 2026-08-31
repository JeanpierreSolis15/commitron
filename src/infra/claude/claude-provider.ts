import { spawn, type ChildProcess } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";
import { GenerationAbortedError, ProviderMissingError } from "../../app/errors";
import type { Environment, GenerationRequest, Provider } from "../../app/ports";

interface Executable {
  file: string;
  shell: boolean;
}

export class ClaudeProvider implements Provider {
  constructor(private readonly environment: Environment) {}

  generate(request: GenerationRequest, signal: AbortSignal): Promise<string> {
    const executable = lookPath("claude", this.environment);
    if (!executable) {
      return Promise.reject(new ProviderMissingError());
    }
    const { platform } = this.environment;
    const { timeoutSeconds } = request;

    return new Promise((resolve, reject) => {
      const [file, args, shell] = command(executable, claudeArgs(request));
      const child = spawn(file, args, { shell, windowsHide: true });
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
        if (timedOut) {
          reject(new Error(`no reply after ${timeoutSeconds}s`));
        } else if (signal.aborted) {
          reject(new GenerationAbortedError());
        } else if (code === 0) {
          resolve(stdout);
        } else {
          const detail = stderr.trim();
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
  return [...args, ...request.extraArgs];
}

function command(executable: Executable, args: string[]): [string, string[], boolean] {
  if (!executable.shell) {
    return [executable.file, args, false];
  }
  return [quote(executable.file), args.map(quote), true];
}

function quote(arg: string): string {
  return /\s/.test(arg) ? `"${arg}"` : arg;
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
