import { truncate } from "../../utils/text";
import type { Config } from "../config";
import { canonicalExamples, typeDescriptions } from "./glossary";
import { languageName } from "./languages";

export interface PromptInput {
  stat: string;
  diff: string;
  excluded: string[];
  instructions: string;
  history: string[];
}

export function buildPrompt(config: Config, input: PromptInput): string {
  const [diff, truncated] = truncate(input.diff, config.maxDiffChars);
  const lines: string[] = [];
  const add = (...text: string[]) => lines.push(...text);

  add(
    "You are writing a git commit message for the staged changes shown below.",
    "",
    "The message must pass commitlint with @commitlint/config-conventional, so:",
    "",
    "Subject line",
    '- Shape: "type(scope): description". The scope is optional; never write empty',
    '  parentheses, "type(): ..." or a placeholder scope.',
    `- Allowed types: ${config.types.join(", ")}. Pick exactly one, in lowercase, by what`,
    "  the change does:",
    ...config.types.map(describeType),
  );
  if (config.scopeCase === "lower") {
    add("- The scope, when there is one, is lowercase and names an area of the codebase.");
  }
  if (config.scopes.length > 0) {
    add(
      `- Allowed scopes: ${config.scopes.join(", ")}. Use one of them or none; never invent`,
      "  another.",
    );
  }
  add(
    `- Write the description in ${languageName(config.language)}, imperative mood: "add", never "added",`,
    '  "adds" or "adding".',
  );
  if (config.subjectCase === "lower") {
    add(
      "- Start the description with a lowercase letter. The only exception is a name or",
      "  an acronym that is always capitalised, such as OAuth, API or PostgreSQL.",
    );
  }
  add(
    "- No full stop at the end.",
    `- The whole line, type and scope included, is at most ${config.subjectMaxLength} characters.`,
    '- Say what the change does and why, not which files were touched. "fix(auth):',
    '  reject expired tokens", not "fix: update auth.go".',
    "",
    "Body",
  );
  if (config.body === "never") {
    add("- Do not write one. Subject line only.");
  } else {
    if (config.body === "always") {
      add("- Always write one.");
    } else {
      add(
        "- Write one only when the change has several distinct parts, or when the reason",
        "  is not obvious from the subject. A small, single-purpose change needs none.",
      );
    }
    add(
      "- Leave exactly one blank line between the subject and the body.",
      '- Use short "- " bullets, one per distinct change.',
    );
    if (config.bodyMaxLineLength) {
      add(`- Wrap every body line at ${config.bodyMaxLineLength} characters.`);
    }
  }
  add(
    "",
    "Breaking changes",
    '- Put "!" before the colon: "feat(api)!: rename the size tokens".',
    '- Add a footer after a blank line: "BREAKING CHANGE: what breaks and how to adapt".',
    "- Only when the change really breaks a consumer. Do not invent one.",
    "",
    "Output",
    "- One message only. No alternatives, no explanations, no notes, no character",
    '  counts, no co-authors, no "Generated with" lines, no other footers.',
    "- Reply with ONLY the final message, wrapped exactly in <commit> and </commit>.",
  );
  addConventions(add, config, input);
  addExamples(add, config, input);
  add("", "## Files changed", input.stat.replace(/\n+$/, ""));
  if (input.excluded.length > 0) {
    add(`Changed but not shown below (excluded by configuration): ${input.excluded.join(", ")}`);
  }
  add(
    "",
    `## Diff${truncated ? ` (truncated to ${config.maxDiffChars} characters)` : ""}`,
    diff,
    "",
    "## Reminder",
    `- The description is written in ${languageName(config.language)}, whatever language the`,
    "  examples or the diff use.",
    "- One message only, wrapped exactly in <commit> and </commit>.",
    "",
  );
  return lines.join("\n");
}

type Add = (...text: string[]) => void;

function describeType(type: string): string {
  const description = typeDescriptions[type];
  return description ? `  ${type}: ${description}` : `  ${type}`;
}

function addConventions(add: Add, config: Config, input: PromptInput): void {
  if (config.guidelines.length === 0 && !input.instructions) {
    return;
  }
  add(
    "",
    "## Project conventions",
    "These come from the repository and take precedence over the generic rules above.",
    "",
  );
  if (config.guidelines.length > 0) {
    add(...config.guidelines.map((guideline) => `- ${guideline}`));
  }
  if (input.instructions) {
    if (config.guidelines.length > 0) {
      add("");
    }
    add(input.instructions);
  }
}

function addExamples(add: Add, config: Config, input: PromptInput): void {
  const examples = [...config.examples, ...input.history];
  add("", "## Examples");
  if (examples.length > 0) {
    add(
      "Match the shape and tone of these messages from this repository when they follow",
      "the rules above; where they disagree, the rules win. In particular, write the",
      `description in ${languageName(config.language)} even if they use another language.`,
    );
  } else {
    add("Two messages with the expected shape:");
  }
  for (const example of examples.length > 0 ? examples : canonicalExamples) {
    add("", "<example>", example.trim(), "</example>");
  }
}
