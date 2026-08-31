import { bodyModes, modes, scopeCases, subjectCases, type Config } from "./config";

export function validateConfig(c: Config): void {
  if (c.model === "") {
    throw new Error("model: cannot be empty");
  }
  if (c.timeoutSeconds < 5) {
    throw new Error(`timeoutSeconds: ${c.timeoutSeconds} is too low, use at least 5`);
  }
  if (c.language === "") {
    throw new Error("language: cannot be empty");
  }
  if (c.types.length === 0) {
    throw new Error("types: needs at least one commit type");
  }
  if (c.subjectMaxLength < 20) {
    throw new Error(`subjectMaxLength: ${c.subjectMaxLength} is too low, use at least 20`);
  }
  if (!isOneOf(subjectCases, c.subjectCase)) {
    throw notOneOf("subjectCase", c.subjectCase, subjectCases);
  }
  if (!isOneOf(scopeCases, c.scopeCase)) {
    throw notOneOf("scopeCase", c.scopeCase, scopeCases);
  }
  if (c.bodyMaxLineLength < 0) {
    throw new Error("bodyMaxLineLength: cannot be negative");
  }
  if (c.maxDiffChars < 500) {
    throw new Error(`maxDiffChars: ${c.maxDiffChars} is too low, use at least 500`);
  }
  if (c.history < 0) {
    throw new Error("history: cannot be negative");
  }
  if (c.instructionsMaxChars < 0) {
    throw new Error("instructionsMaxChars: cannot be negative");
  }
  if (!isOneOf(bodyModes, c.body)) {
    throw notOneOf("body", c.body, bodyModes);
  }
  if (!isOneOf(modes, c.color)) {
    throw notOneOf("color", c.color, modes);
  }
  if (!isOneOf(modes, c.unicode)) {
    throw notOneOf("unicode", c.unicode, modes);
  }
}

function isOneOf(allowed: readonly string[], value: string): boolean {
  return allowed.includes(value);
}

function notOneOf(key: string, value: string, allowed: readonly string[]): Error {
  return new Error(`${key}: "${value}" is not one of ${allowed.join(", ")}`);
}
