# commitron

[![CI](https://github.com/JeanpierreSolis15/commitron/actions/workflows/ci.yml/badge.svg)](https://github.com/JeanpierreSolis15/commitron/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/JeanpierreSolis15/commitron?sort=semver)](https://github.com/JeanpierreSolis15/commitron/releases)
[![npm](https://img.shields.io/npm/v/%40deadgun15%2Fcommitron)](https://www.npmjs.com/package/@deadgun15/commitron)
[![Node](https://img.shields.io/node/v/%40deadgun15%2Fcommitron)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Español](README.md) · English

AI commit messages from your staged diff, written by the **Claude Code CLI** you
already have. No API key, no account to create, nothing to pay for twice: if
`claude` works on your machine, so does this.

<p align="center">
  <img src="https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/docs/demo.svg" alt="commitron in a terminal: it reads the staged diff, asks the model, shows a Conventional Commits message and waits for confirmation before committing" width="680">
</p>

- **Conventional Commits out of the box.** The defaults mirror
  `@commitlint/config-conventional`, so the message passes your commitlint hook
  as it is.
- **Knows your project.** Point it at a `CONTRIBUTING.md` and its rules outrank
  the generic ones.
- **Any language, any repository.** All it needs is Node, and it pulls in no
  dependencies. It reads `git`, not `package.json`.
- **Your words, your call.** It shows the message, you confirm, edit or cancel.
  Nothing is committed behind your back.

## Requirements

- [Node.js](https://nodejs.org) 20 or newer
- [git](https://git-scm.com)
- the [Claude Code CLI](https://claude.com/claude-code) on your PATH and logged
  in. commitron runs `claude -p` under the hood, so it uses the subscription you
  already have.

## Install

Works on macOS, Linux and Windows. It is plain JavaScript: no binary downloads
and no install scripts, so it works the same with `--ignore-scripts` and on
Windows with Smart App Control turned on.

```sh
npm install -g @deadgun15/commitron
```

Or without installing anything:

```sh
npx @deadgun15/commitron
```

Or per project, next to the rest of your tooling:

```sh
npm install --save-dev @deadgun15/commitron
```

The installed command is called `commitron` in all three cases.

```json
{
  "scripts": {
    "commit": "commitron"
  }
}
```

### Coming from 0.1.x

Up to 0.1.3 commitron was a compiled Go binary. If you installed it with
`install.sh`, `install.ps1` or `go install`, that binary is still on your PATH
and will not update itself: delete it (`~/.local/bin/commitron`,
`/usr/local/bin/commitron` or `%LOCALAPPDATA%\Programs\commitron`) and install
with npm. Your `.commitron.json` works unchanged.

## Use

```sh
git add .
commitron
```

commitron reads what is staged, asks the model for a message, shows it and waits
for you:

- `Y` or Enter commits
- `e` opens the message in your git editor first
- `n` cancels

| flag | |
|---|---|
| `-m, --model <name>` | model for this run (`sonnet`, `opus`, `haiku` or a full model id) |
| `-e, --edit` | open the message in your git editor before committing |
| `-y, --yes` | skip the confirmation |
| `--dry-run` | print the message and stop |
| `--config <path>` | load an extra config file on top |
| `--no-verify` | skip git hooks |
| `--color <mode>` | `auto` \| `always` \| `never` |

Piping works the way you would expect: the pretty output goes to stderr, so
`commitron --dry-run > msg.txt` gives you the plain message.

A git alias keeps it close at hand:

```sh
git config --global alias.ai '!commitron'
git ai
```

Other commands:

```sh
commitron init           # create .commitron.json with the common keys
commitron init --full    # every key
commitron init --global  # your defaults for every repository
commitron config         # what is in effect, and where each value came from
commitron version
```

## Configure

The first run in a repository offers to create `.commitron.json`. You can also
write it yourself:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/schema.json",
  "model": "sonnet",
  "language": "es",
  "subjectMaxLength": 72,
  "exclude": ["pnpm-lock.yaml"],
  "instructions": "CONTRIBUTING.md"
}
```

That `$schema` line is worth keeping: editors use it for autocomplete, inline
docs and validation of every key, so you never have to look them up.

Settings are merged lowest precedence first:

```
defaults → user config → package.json#commitron → .commitron.json → --config → flags
```

Each layer only overrides the keys it declares, and an unknown key is an error
rather than a silent no-op. A JavaScript project can keep everything in
`package.json` under a `"commitron"` key instead of a separate file.

### Keys worth knowing

- **`language`** — the description's language (`en`, `es`, or a full name like
  `"Brazilian Portuguese"`). The Conventional Commits type stays in English.
- **`instructions`** — a Markdown file with your project's own conventions. Its
  content outranks the generic rules, which is what makes commitron usable in a
  repository whose rules it knows nothing about.
- **`exclude`** — git pathspecs kept out of the diff. Lockfiles are excluded by
  default: a `pnpm-lock.yaml` can be 10,000 lines and would otherwise crowd your
  real change out of the model's budget. The files still appear in the file list,
  so the message can mention them.
- **`types`** — the types the model may use. A reply with anything else is
  rejected instead of committed.
- **`model`** and **`timeoutSeconds`** — which model answers and how long to wait.

Run `commitron init --full` to see every key with its default.

## commitlint

The defaults mirror `@commitlint/config-conventional`, so what commitron writes
passes a commitlint hook as it is. Some rules are met by rewriting the message,
the rest by telling you:

| commitlint rule | commitron |
|---|---|
| `type-enum` | **rejected** — the reply must use one of your configured `types` |
| `subject-empty`, `type-empty`, `header-trim` | **rejected** — such a reply would not parse |
| `type-case` (lower-case) | fixed on the way out |
| `subject-full-stop` | fixed on the way out |
| `body-leading-blank` | fixed on the way out |
| `body-max-line-length` | body wrapped to `bodyMaxLineLength` (100) |
| `header-max-length` | warned past `subjectMaxLength` (72 here; commitlint's own default is 100) |
| `subject-case` | warned, unless the first word is a name or acronym such as OAuth or API |
| `scope-case` | warned; use `"scopeCase": "any"` for `feat(Chip)`-style scopes |

The split is deliberate: a fix that is purely mechanical is applied without
asking, and anything that needs judgement is left to you. Lowercasing `Feat:` is
safe; lowercasing `OAuth` is not.

commitron does not replace commitlint. With `verify: true` (the default) your own
`commit-msg` hook still runs and has the last word — the point is that it should
have nothing left to complain about.

## How it works

1. reads `git diff --cached`, minus the excluded paths
2. renders a prompt with your config and conventions
3. pipes it to `claude -p --model <model> --strict-mcp-config`
4. unwraps, parses and validates the reply
5. shows it and commits with `git commit -F`

`claude` runs as a direct child process, so a timeout kills the real thing. The
diff never leaves your machine by any path other than the Claude Code CLI you
already trust with it.

## Contributing

Issues and pull requests are welcome. The short version:

- `main` is production and only moves by release; `develop` is where work lands.
  Branch from `develop`, open your pull request against `develop`.
- Commit messages follow Conventional Commits. commitron writes its own, so
  `commitron` in this repository is the expected workflow.
- CI runs the suite on Linux, macOS and Windows; `npm test`, `npm run lint` and
  `npm run format:check` must be clean before a merge.

[CONTRIBUTING.en.md](CONTRIBUTING.en.md) has the full guide: repository layout,
how to run everything locally, the branch model and how a release is cut.

## License

[MIT](LICENSE). You can use commitron for anything, including commercial work,
and copy, modify and redistribute it, as long as the license notice stays with
it. It comes with no warranty.
