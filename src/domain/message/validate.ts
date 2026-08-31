import { runeCount } from "../../utils/text";
import { allowsType, type Config } from "../config";
import type { Parsed } from "./message";
import { canonical, hasUpper, violatesLowerCase, wrapBody } from "./normalize";

export function validateMessage(p: Parsed, config: Config): string[] {
  if (!allowsType(config, p.type)) {
    throw new Error(`"${p.type}" is not an allowed type (${config.types.join(", ")})`);
  }

  const warnings: string[] = [];

  const subjectLength = runeCount(canonical(p));
  if (subjectLength > config.subjectMaxLength) {
    warnings.push(
      `subject is ${subjectLength} characters, ${subjectLength - config.subjectMaxLength} over the limit`,
    );
  }

  if (config.subjectCase === "lower" && violatesLowerCase(p.description)) {
    warnings.push("description starts with a capital; commitlint expects lowercase");
  }

  if (config.scopeCase === "lower" && hasUpper(p.scope)) {
    warnings.push(`scope "${p.scope}" is not lowercase`);
  }

  if (config.bodyMaxLineLength > 0) {
    for (const line of wrapBody(p.body, config.bodyMaxLineLength).split("\n")) {
      const n = runeCount(line);
      if (n > config.bodyMaxLineLength) {
        warnings.push(`a body line is ${n} characters and cannot be wrapped`);
        break;
      }
    }
  }

  if (config.body === "always" && p.body === "") {
    warnings.push("body is required by config but the model returned none");
  }
  if (config.body === "never" && p.body !== "") {
    warnings.push("config asks for no body but the model returned one");
  }
  return warnings;
}
