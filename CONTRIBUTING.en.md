# Contributing to commitron

[Español](CONTRIBUTING.md) · English

Thank you for taking the time. This guide covers how the repository is laid out,
how to run everything locally, how changes flow through the branches and how a
release is cut.

## Repository layout

```
main.go                     entry point
internal/cli                flags, subcommands, exit codes
internal/config             settings, defaults, layered loading, validation
internal/gitx               the git commands commitron needs
internal/message            sanitising, parsing and validating the reply
internal/prompt             the prompt template and its rendering
internal/provider           the Claude Code CLI backend
internal/ui                 colours, glyphs, spinner, prompts
npm/                        the npm package: a launcher that downloads the binary
schema.json                 JSON Schema for .commitron.json
install.sh, install.ps1     one-line installers for the release binaries
.goreleaser.yaml            release build matrix and archives
```

Go code has no third-party dependencies and is written without comments; names
and small functions carry the meaning. Keep it that way.

## Running things locally

You need Go 1.23 or newer and git. The Claude Code CLI is only needed to run
commitron end to end; the test suite does not call it.

```sh
go build ./...
go vet ./...
gofmt -l .
go test ./... -count=1
```

To try a change for real, build and run it against this repository:

```sh
go build -o commitron .
git add -p
./commitron --dry-run
```

### The npm package

`npm/` holds a small Node launcher. `install.js` runs on `npm install`, downloads
the release binary for the current platform from GitHub and checks it against
`checksums.txt`; `bin/commitron.js` then runs it. To exercise the launcher
without a release, put a local build where the installer would:

```sh
mkdir -p npm/vendor
go build -o npm/vendor/commitron .        # commitron.exe on Windows
node npm/bin/commitron.js version         # prints: dev
```

`npm/package.json` keeps the version `0.0.0-dev`; the release workflow sets the
real one from the tag. Do not bump it by hand.

## Branches

| branch | role |
|---|---|
| `main` | production. Every commit is releasable. Releases are tags on this branch. |
| `develop` | integration. Feature branches start here and merge back here. |

1. Branch from `develop`: `git switch -c feat/short-name develop`.
2. Commit with Conventional Commits. Use commitron itself.
3. Open a pull request against `develop`. CI must be green: tests on Linux,
   macOS and Windows, `gofmt`, `goreleaser check` and the npm package check.
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
`chore`, `style`, `revert`. The scope is the package touched (`cli`, `config`,
`gitx`, `message`, `prompt`, `provider`, `ui`, `npm`) or `ci`, `docs`,
`release`. `feat` and `fix` commits are what end up in the release notes.

## Releases

A release is a tag on `main`:

```sh
git switch main
git pull
git tag -a v1.2.3 -m "v1.2.3"
git push origin v1.2.3
```

The Release workflow then:

1. builds the binaries for Linux, macOS and Windows on amd64 and arm64;
2. uploads the archives, the bare binaries and `checksums.txt` to a GitHub
   release with a changelog grouped by type;
3. publishes `commitron@1.2.3` to npm with provenance. A pre-release tag such as
   `v1.3.0-rc.1` is published under the npm dist-tag `next` instead of `latest`.

### One-time setup for maintainers

- **`NPM_TOKEN` secret.** Create an npm automation token (npmjs.com → Access
  Tokens → Granular, with publish rights and "bypass 2FA") and add it as a
  repository secret named `NPM_TOKEN`. Without it the npm step is skipped with a
  warning; the GitHub release itself is unaffected.
- **Package name.** It is the `name` in `npm/package.json`. If the registry
  refuses the unscoped name, switch to a scoped one such as
  `@jeanpierresolis15/commitron`; nothing else needs to change.
- **Homebrew and Scoop** are optional and documented in `.goreleaser.yaml`.
- **Badges.** The release and npm badges only render once something is published,
  so they are not in the READMEs yet. After the first release, add these two under
  the CI badge in `README.md` and `README.en.md`:

  ```markdown
  [![Release](https://img.shields.io/github/v/release/JeanpierreSolis15/commitron?sort=semver)](https://github.com/JeanpierreSolis15/commitron/releases)
  [![npm](https://img.shields.io/npm/v/commitron)](https://www.npmjs.com/package/commitron)
  ```

## Reporting problems

Open an issue with the commitron version (`commitron version`), your OS, the
command you ran and what you expected. `commitron --dry-run` output and your
`.commitron.json` help a lot. Never paste a diff you cannot share.
