import { spawn, type ChildProcess } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

export class NotInstalledError extends Error {
  constructor() {
    super("the `claude` CLI was not found on your PATH");
  }
}

export class AbortedError extends Error {
  constructor() {
    super("cancelled");
  }
}

export interface Provider {
  name(): string;
  generate(prompt: string, signal: AbortSignal): Promise<string>;
}

export interface ClaudeOptions {
  model: string;
  fallbackModel: string;
  strictMcpConfig: boolean;
  extraArgs: string[];
  timeoutSeconds: number;
}

interface Executable {
  file: string;
  shell: boolean;
}

export class Claude implements Provider {
  constructor(private readonly options: ClaudeOptions) {}

  name(): string {
    return this.options.model;
  }

  args(): string[] {
    const { model, fallbackModel, strictMcpConfig, extraArgs } = this.options;
    const args = ["-p", "--model", model];
    if (fallbackModel !== "") {
      args.push("--fallback-model", fallbackModel);
    }
    if (strictMcpConfig) {
      args.push("--strict-mcp-config");
    }
    return [...args, ...extraArgs];
  }

  generate(prompt: string, signal: AbortSignal): Promise<string> {
    const executable = lookPath("claude");
    if (!executable) {
      return Promise.reject(new NotInstalledError());
    }
    const { timeoutSeconds } = this.options;

    return new Promise((resolve, reject) => {
      const [file, args, shell] = command(executable, this.args());
      const child = spawn(file, args, { shell, windowsHide: true });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        kill(child);
      }, timeoutSeconds * 1000);
      const onAbort = () => kill(child);
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
        reject(err.code === "ENOENT" ? new NotInstalledError() : err);
      });
      child.on("close", (code) => {
        cleanup();
        if (timedOut) {
          reject(new Error(`no reply after ${timeoutSeconds}s`));
        } else if (signal.aborted) {
          reject(new AbortedError());
        } else if (code === 0) {
          resolve(stdout);
        } else {
          const detail = stderr.trim();
          reject(new Error(detail ? `claude: ${detail}` : `claude: exit status ${code}`));
        }
      });
      child.stdin.end(prompt);
    });
  }
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

function kill(child: ChildProcess): void {
  if (child.exitCode !== null || child.pid === undefined) {
    return;
  }
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGKILL");
}

function lookPath(name: string): Executable | null {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter((dir) => dir !== "");
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((ext) => ext !== "")
      : [""];
  for (const dir of dirs) {
    for (const ext of extensions) {
      const file = path.join(dir, name + ext);
      if (isExecutable(file)) {
        return { file, shell: /\.(cmd|bat)$/i.test(file) };
      }
    }
  }
  return null;
}

function isExecutable(file: string): boolean {
  try {
    if (!statSync(file).isFile()) {
      return false;
    }
    if (process.platform !== "win32") {
      accessSync(file, constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}
