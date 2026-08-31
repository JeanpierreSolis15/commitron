package cli

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

var Version = "dev"

const usage = `commitron — AI commit messages from your staged diff, via the Claude Code CLI.

Usage:
  commitron [flags]          write a commit message for what is staged
  commitron init [flags]     create a config file
  commitron config           show the resolved config and where it came from
  commitron version

Flags:
  -m, --model <name>     model to use for this run (overrides the config)
  -e, --edit             open the message in your git editor before committing
  -y, --yes              do not ask for confirmation
      --dry-run          print the message and stop
      --config <path>    load this config file on top of the others
      --no-verify        skip git hooks
      --no-init          do not offer to create a config file
      --color <mode>     auto | always | never
  -v, --version
  -h, --help

Init flags:
      --global           write to the user-wide config instead of the repo
      --full             write every key, not just the common ones
      --force            overwrite an existing file

Config resolution, lowest precedence first:
  defaults -> user config -> package.json#commitron -> .commitron.json -> --config -> flags
`

type failure struct {
	msg    string
	detail string
}

func (f *failure) Error() string { return f.msg }

func fail(msg, detail string) error { return &failure{msg: msg, detail: detail} }

var errCancelled = fail("cancelled", "")

func Main(args []string) int {
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		switch args[0] {
		case "init":
			return report(runInit(args[1:]))
		case "config":
			return report(runConfig(args[1:]))
		case "version":
			fmt.Println(Version)
			return 0
		case "help":
			fmt.Print(usage)
			return 0
		default:
			fmt.Fprintf(os.Stderr, "commitron: unknown command %q\n\n%s", args[0], usage)
			return 2
		}
	}
	return report(runCommit(args))
}

func report(err error) int {
	if err == nil {
		return 0
	}
	if errors.Is(err, errCancelled) {
		fmt.Fprintln(os.Stderr, "  cancelled")
		return 1
	}
	var f *failure
	if errors.As(err, &f) {
		fmt.Fprintf(os.Stderr, "\ncommitron: %s\n", f.msg)
		if f.detail != "" {
			fmt.Fprintf(os.Stderr, "%s\n", indent(f.detail))
		}
		return 1
	}
	fmt.Fprintf(os.Stderr, "\ncommitron: %v\n", err)
	return 1
}

func indent(text string) string {
	lines := strings.Split(strings.TrimRight(text, "\n"), "\n")
	for i, line := range lines {
		lines[i] = "  " + line
	}
	return strings.Join(lines, "\n")
}

func newFlagSet(name string) *flag.FlagSet {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	return fs
}
