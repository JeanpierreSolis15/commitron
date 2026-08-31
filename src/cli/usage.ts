export const usage = `commitron — AI commit messages from your staged diff, via the Claude Code CLI.

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
`;
