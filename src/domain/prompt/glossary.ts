export const typeDescriptions: Record<string, string> = {
  feat: "a new feature for the user",
  fix: "a bug fix",
  refactor: "a code change that neither fixes a bug nor adds a feature",
  perf: "a code change that improves performance",
  docs: "documentation only",
  test: "adding missing tests or correcting existing ones",
  build: "the build system, packaging or external dependencies",
  ci: "CI configuration files and scripts",
  chore: "other changes that touch neither source nor tests",
  style: "formatting only, no change in meaning",
  revert: "reverting a previous commit",
};

export const canonicalExamples = [
  "feat(lang): add Polish language",
  [
    "fix: prevent racing of requests",
    "",
    "- introduce a request id and a reference to the latest request",
    "- dismiss incoming responses other than from the latest request",
  ].join("\n"),
];
