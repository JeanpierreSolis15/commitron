import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Files } from "../../app/ports";

export class NodeFiles implements Files {
  read(file: string): string | undefined {
    try {
      return readFileSync(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw err;
    }
  }

  exists(file: string): boolean {
    return existsSync(file);
  }

  write(file: string, content: string): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}
