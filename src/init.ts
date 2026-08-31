import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, parseFlags } from "./cli";
import { defaults, SCHEMA_URL, serialize } from "./config";
import { repoRoot } from "./git";
import { errorMessage, FILE_NAME, globalPath, load } from "./load";

export const starter = `{
  "$schema": "${SCHEMA_URL}",

  "model": "sonnet",
  "language": "en",

  "subjectMaxLength": 72,
  "body": "auto",

  "exclude": ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "*.lock"],
  "instructions": null,

  "confirm": true
}
`;

export function runInit(argv: string[]): void {
  const flags = parseFlags(argv, {
    global: { type: "boolean", default: false },
    full: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  });

  const target = targetPath(flags.global === true);
  const written = writeConfig(target, flags.full === true, flags.force === true);
  process.stdout.write(`wrote ${written}\n`);
}

function targetPath(global: boolean): string {
  if (global) {
    return globalConfigPath();
  }
  let root: string;
  try {
    root = repoRoot();
  } catch {
    throw fail(
      "this is not a git repository",
      "use `commitron init --global` to write your user-wide config",
    );
  }
  return path.join(root, FILE_NAME);
}

export function globalConfigPath(): string {
  try {
    return globalPath();
  } catch (err) {
    throw fail("could not find your config directory", errorMessage(err));
  }
}

export function writeConfig(file: string, full: boolean, force: boolean): string {
  if (existsSync(file) && !force) {
    throw fail(`${file} already exists`, "pass --force to overwrite it");
  }
  const dir = path.dirname(file);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw fail(`could not create ${dir}`, errorMessage(err));
  }

  let content = starter;
  if (full) {
    const cfg = defaults();
    cfg.$schema = SCHEMA_URL;
    content = `${serialize(cfg)}\n`;
  }
  try {
    writeFileSync(file, content);
  } catch (err) {
    throw fail(`could not write ${file}`, errorMessage(err));
  }
  return file;
}

export function runConfig(argv: string[]): void {
  const flags = parseFlags(argv, { config: { type: "string", default: "" } });

  let root: string;
  try {
    root = repoRoot();
  } catch {
    root = "";
  }
  let res;
  try {
    res = load(root, flags.config ?? "");
  } catch (err) {
    throw fail("invalid configuration", errorMessage(err));
  }
  process.stdout.write(`${serialize(res.config)}\n`);

  if (res.sources.length === 0) {
    process.stdout.write(
      "\n// built-in defaults only; run `commitron init` to create a config file\n",
    );
    return;
  }
  process.stdout.write("\n// merged from, in order:\n");
  for (const source of res.sources) {
    process.stdout.write(`//   ${source}\n`);
  }
}
