import { Cancelled, Failure } from "../app/errors";
import type { Terminal } from "../ui/terminal";
import { errorMessage } from "../utils/errors";
import { indent } from "../utils/text";

export function report(err: unknown, terminal: Terminal): number {
  if (err instanceof Cancelled) {
    terminal.err("  cancelled\n");
    return 1;
  }
  if (err instanceof Failure) {
    terminal.err(`\ncommitron: ${err.message}\n`);
    if (err.detail !== "") {
      terminal.err(`${indent(err.detail)}\n`);
    }
    return 1;
  }
  terminal.err(`\ncommitron: ${errorMessage(err)}\n`);
  return 1;
}
