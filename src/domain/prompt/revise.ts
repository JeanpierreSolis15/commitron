export function buildRevisionPrompt(base: string, previous: string, problems: string[]): string {
  return [
    base,
    "## Previous attempt",
    "Your previous reply was:",
    "",
    "<previous>",
    previous.trim(),
    "</previous>",
    "",
    "It breaks these rules:",
    ...problems.map((problem) => `- ${problem}`),
    "",
    "Reply again with a corrected message that keeps the meaning and fixes every point",
    "above, wrapped exactly in <commit> and </commit>.",
    "",
  ].join("\n");
}
