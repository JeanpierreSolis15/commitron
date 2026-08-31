# Contributing to commitron

[Español](CONTRIBUTING.md) · English

Thank you for taking the time. This guide covers how the repository is laid out,
how to run everything locally, how changes flow through the branches and how a
release is cut.

## Repository layout

```
src/main.ts                 entry point: wires the adapters and runs the CLI
src/cli/                    flags, command dispatch, exit codes, error reporting
src/app/                    use cases (commit, generate, init, config) and their ports
src/domain/config/          the Config type, defaults, validation, decoding
src/domain/message/         sanitising, parsing, validating and normalising the message
src/domain/prompt/          the prompt and its rendering
src/infra/                  adapters: spawned git, the Claude CLI, files, terminal
src/ui/                     theme, views, spinner and prompts on top of the terminal
src/utils/                  text, errors, guards
test/                       mirrors src/; the fakes live in test/helpers/fakes.ts
schema.json                 JSON Schema for .commitron.json
tsup.config.ts              bundles src/ into dist/cli.js
```

Layers depend inwards. `domain/` is pure logic and imports nothing from Node;
`app/` only talks to the outside world through the interfaces in
`app/ports.ts` (`GitClient`, `Provider`, `Files`, `Environment`, `Presenter`);
`infra/` and `ui/` implement them; `main.ts` wires them together. That is what
lets the use cases be tested end to end with fakes, without git, `claude` or a
terminal.

The code has no runtime dependencies and is written without comments; names and
small functions carry the meaning. Keep it that way.

## Running things locally

You need Node 20 or newer and git. The Claude Code CLI is only needed to run
commitron end to end; the test suite does not call it.

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

`npm run format` applies Prettier; CI fails on anything left unformatted.

To try a change for real, build and run it against this repository:

```sh
npm run build
git add -p
node dist/cli.js --dry-run
```

`npm link` makes this checkout's `commitron` command available system-wide;
`npm unlink -g @deadgun15/commitron` removes it again.

### The package

`npm pack --dry-run` shows exactly what gets published: `dist/cli.js`,
`schema.json`, the READMEs and the license. `package.json` keeps the version
`0.0.0-dev`; the release workflow sets the real one from the tag. Do not bump it
by hand.

## Branches

| branch | role |
|---|---|
| `main` | production. Every commit is releasable. Releases are tags on this branch. |
| `develop` | integration. Feature branches start here and merge back here. |

1. Branch from `develop`: `git switch -c feat/short-name develop`.
2. Commit with Conventional Commits. Use commitron itself.
3. Open a pull request against `develop`. CI must be green: tests on Linux,
   macOS and Windows, lint and the npm package check.
4. When `develop` is ready to ship, a maintainer opens a pull request from
   `develop` to `main`, merges it and tags the release.

Both branches should be protected on GitHub (Settings → Branches → Add rule):
require a pull request, require the CI status checks to pass, and forbid force
pushes. `main` additionally should only receive merges from `develop`.

## Commit messages

Conventional Commits, as commitron produces them:

```
type(scope): description

- optional bullet body
```

Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`,
`chore`, `style`, `revert`. The scope is the layer or module touched (`cli`,
`app`, `config`, `message`, `prompt`, `git`, `claude`, `terminal`, `ui`) or
`ci`, `docs`, `release`, `deps`. `feat` and `fix` commits are what end up in the release notes.

## Releases

A release is a tag on `main`:

```sh
git switch main
git pull
git tag -a v1.2.3 -m "v1.2.3"
git push origin v1.2.3
```

The Release workflow then:

1. installs the dependencies, runs the suite and builds `dist/cli.js`;
2. sets the tag's version in `package.json` and publishes
   `@deadgun15/commitron@1.2.3` to npm with provenance. A pre-release tag such
   as `v1.3.0-rc.1` is published under the npm dist-tag `next` instead of
   `latest`;
3. creates the GitHub release with notes generated from the pull requests and
   attaches the package `.tgz`.

### One-time setup for maintainers

- **npm trusted publisher.** The workflow publishes without any token: npm
  accepts the OIDC token GitHub issues to `release.yml`. Configure it on
  npmjs.com → package → Settings → Trusted Publisher → GitHub Actions, with the
  user `JeanpierreSolis15`, the repository `commitron` and the workflow
  `release.yml`, allowing the `npm publish` action. Under "Publishing access",
  pick "Require two-factor authentication and disallow bypass-2FA tokens": it
  does not affect OIDC and leaves your own 2FA as the only other way to publish.
- **Package name.** It is `@deadgun15/commitron`: the scope is the maintainer's
  npm username, because the unscoped name `commitron` belongs to another
  account. The installed command is still `commitron` (`bin` in
  `package.json`).

## Reporting problems

Open an issue with the commitron version (`commitron version`), your Node
version (`node --version`), your OS, the command you ran and what you expected.
`commitron --dry-run` output and your `.commitron.json` help a lot. Never paste
a diff you cannot share.
