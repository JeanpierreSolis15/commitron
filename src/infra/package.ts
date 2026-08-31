import { readFileSync } from "node:fs";

export function readPackageVersion(packageJson: URL): string {
  const pkg = JSON.parse(readFileSync(packageJson, "utf8")) as { version: string };
  return pkg.version;
}
