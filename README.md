# commitron

AI commit messages from your staged diff, written by the **Claude Code CLI** you
already have. No API key, no account to create: if `claude` works on your
machine, so does this.

```
✳ commitron · sonnet · 4 files +127 −43
⠙ asking sonnet 2.4s

  fix(orders): reject items outside the supplier catalogue

  - validate against the linked product list before pricing
  - apply the rule on create and update, not only in the UI

  commit? [Y/n/e=edit]
```

A single static binary with **no dependencies**. It works in any repository, in
any language — not just JavaScript ones.

## Install

**macOS / Linux**

```sh
curl -fsSL https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/install.sh | sh
```

**Windows**

```powershell
irm https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/install.ps1 | iex
```

**With Go**

```sh
go install github.com/JeanpierreSolis15/commitron@latest
```

Or grab a binary from the [releases](https://github.com/JeanpierreSolis15/commitron/releases).

The only requirement is the [Claude Code CLI](https://claude.com/claude-code) on
your PATH — commitron uses the subscription you already pay for.

## Use

```bash
git add .
commitron
```

| flag | |
|---|---|
| `-m, --model <name>` | model for this run |
| `-e, --edit` | open the message in your git editor first |
| `-y, --yes` | skip the confirmation |
| `--dry-run` | print the message and stop |
| `--config <path>` | load an extra config file on top |
| `--no-verify` | skip git hooks |
| `--color <mode>` | `auto` \| `always` \| `never` |

Piping works the way you would expect: the pretty output goes to stderr, so
`commitron --dry-run > msg.txt` gives you the plain message.

## Configure

The first run in a repository offers to create `.commitron.json`. You can also
write it yourself:

```bash
commitron init           # the common keys
commitron init --full    # every key
commitron init --global  # your defaults for every repo
commitron config         # what is in effect, and where it came from
```

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
rather than a silent no-op.

### Keys worth knowing

- **`language`** — the description's language (`en`, `es`, or a full name like
  `"Brazilian Portuguese"`). The Conventional Commits type stays in English.
- **`instructions`** — a Markdown file with your project's own conventions. Its
  content outranks the generic rules, which is what makes commitron usable in a
  repo whose rules it knows nothing about.
- **`exclude`** — git pathspecs kept out of the diff. Lockfiles are excluded by
  default: a `pnpm-lock.yaml` can be 10,000 lines and would otherwise crowd your
  real change out of the model's budget. The files still appear in the file list,
  so the message can mention them.
- **`types`** — the types the model may use. A reply with anything else is
  rejected instead of committed.

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
2. renders a prompt from a template with your config and conventions
3. pipes it to `claude -p --model <model> --strict-mcp-config`
4. unwraps, parses and validates the reply
5. shows it and commits with `git commit -F`

No shell is ever spawned, so a timeout kills the real process, and there is
nothing to quote or escape.

## Development

```sh
go build ./...
go test ./...
gofmt -l .
```

CI runs the suite on Linux, macOS and Windows. A push of a `v*` tag builds the
release with GoReleaser.

## License

MIT
