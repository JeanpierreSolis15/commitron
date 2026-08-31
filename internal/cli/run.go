package cli

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"time"

	"github.com/JeanpierreSolis15/commitron/internal/config"
	"github.com/JeanpierreSolis15/commitron/internal/gitx"
	"github.com/JeanpierreSolis15/commitron/internal/message"
	"github.com/JeanpierreSolis15/commitron/internal/prompt"
	"github.com/JeanpierreSolis15/commitron/internal/provider"
	"github.com/JeanpierreSolis15/commitron/internal/ui"
)

type commitFlags struct {
	model      string
	configPath string
	color      string
	edit       bool
	yes        bool
	dryRun     bool
	noVerify   bool
	noInit     bool
}

func parseCommitFlags(argv []string) (commitFlags, bool, error) {
	var f commitFlags
	var showHelp, showVersion bool

	fs := newFlagSet("commitron")
	fs.StringVar(&f.model, "model", "", "")
	fs.StringVar(&f.model, "m", "", "")
	fs.StringVar(&f.configPath, "config", "", "")
	fs.StringVar(&f.color, "color", "", "")
	fs.BoolVar(&f.edit, "edit", false, "")
	fs.BoolVar(&f.edit, "e", false, "")
	fs.BoolVar(&f.yes, "yes", false, "")
	fs.BoolVar(&f.yes, "y", false, "")
	fs.BoolVar(&f.dryRun, "dry-run", false, "")
	fs.BoolVar(&f.noVerify, "no-verify", false, "")
	fs.BoolVar(&f.noInit, "no-init", false, "")
	fs.BoolVar(&showHelp, "help", false, "")
	fs.BoolVar(&showHelp, "h", false, "")
	fs.BoolVar(&showVersion, "version", false, "")
	fs.BoolVar(&showVersion, "v", false, "")

	if err := fs.Parse(argv); err != nil {
		return f, true, fail(err.Error(), "run `commitron --help` to see the flags")
	}
	if showHelp {
		fmt.Print(usage)
		return f, true, nil
	}
	if showVersion {
		fmt.Println(Version)
		return f, true, nil
	}
	return f, false, nil
}

func runCommit(argv []string) error {
	flags, done, err := parseCommitFlags(argv)
	if done || err != nil {
		return err
	}

	root, err := gitx.RepoRoot()
	if err != nil {
		if errors.Is(err, gitx.ErrGitMissing) {
			return fail("git was not found on your PATH", "commitron drives git; install it first")
		}
		return fail("this is not a git repository", "run commitron from inside a repo, or `git init` first")
	}

	res, err := config.Load(root, flags.configPath)
	if err != nil {
		return fail("invalid configuration", err.Error())
	}
	cfg := applyFlags(res.Config, flags)
	if err := cfg.Validate(); err != nil {
		return fail("invalid configuration", err.Error())
	}

	theme := ui.New(cfg.Color, cfg.Unicode)

	if len(res.Sources) == 0 && !flags.noInit && !flags.dryRun && os.Getenv("COMMITRON_NO_INIT") == "" {
		if cfg, err = offerInit(theme, root, cfg, flags); err != nil {
			return err
		}
	}

	stats, err := gitx.StagedStats()
	if err != nil {
		return fail("could not read the staging area", err.Error())
	}
	if stats.Files == 0 {
		return fail("nothing is staged", "stage what you want to commit first: git add <path>")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	fmt.Fprintln(os.Stderr, theme.Header(cfg.Model, stats.Files, stats.Added, stats.Removed))
	spinner := theme.NewSpinner()
	spinner.Start()
	defer spinner.Stop()

	spinner.Status("reading staged changes")
	stat, diff, excluded, err := collectDiff(cfg)
	if err != nil {
		return fail("could not read the staged diff", err.Error())
	}

	instructions, warning := loadInstructions(root, cfg)
	promptText, err := prompt.Build(cfg, prompt.Input{Stat: stat, Diff: diff, Excluded: excluded}, instructions)
	if err != nil {
		return fail("could not build the prompt", err.Error())
	}

	spinner.Status("asking " + cfg.Model)
	claude := provider.Claude{
		Model:           cfg.Model,
		FallbackModel:   cfg.FallbackModel,
		StrictMCPConfig: cfg.StrictMCPConfig,
		ExtraArgs:       cfg.ExtraArgs,
		Timeout:         time.Duration(cfg.TimeoutSeconds) * time.Second,
	}
	raw, err := claude.Generate(ctx, promptText)
	if err != nil {
		spinner.Stop()
		switch {
		case errors.Is(err, provider.ErrNotInstalled):
			return fail("the `claude` CLI was not found on your PATH",
				"commitron uses your Claude Code subscription.\ninstall it from https://claude.com/claude-code and try again")
		case errors.Is(err, context.Canceled):
			return errCancelled
		}
		return fail("could not generate the message", err.Error())
	}

	spinner.Status("validating")
	text := message.Sanitize(raw)
	if text == "" {
		return fail("the model returned an empty message", "")
	}
	parsed, ok := message.Parse(text)
	if !ok {
		return fail("the reply is not a Conventional Commits message", text)
	}
	warnings, err := message.Validate(parsed, cfg)
	if err != nil {
		return fail("the message does not match your config", err.Error()+"\n\n"+text)
	}
	spinner.Stop()

	// What gets committed is the canonical form: lowercase type, no trailing
	// full stop, a blank line before the body and its lines wrapped.
	text = parsed.Render(cfg)
	parsed, _ = message.Parse(text)

	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, theme.Message(parsed))
	if warning != "" {
		theme.Warn(warning)
	}
	for _, w := range warnings {
		theme.Warn(w)
	}
	// A piped stdout gets the plain message, so `commitron --dry-run > msg.txt` works.
	if !ui.IsTerminal(os.Stdout) {
		fmt.Fprintln(os.Stdout, text)
	}

	if flags.dryRun {
		fmt.Fprintf(os.Stderr, "\n  %s\n", theme.Dim("dry run "+theme.Glyph.Dot+" nothing committed"))
		return nil
	}

	edit := flags.edit
	if cfg.Confirm && !flags.yes {
		switch theme.Confirm() {
		case ui.AnswerNo:
			return errCancelled
		case ui.AnswerEdit:
			edit = true
		case ui.AnswerUnavailable:
			return fail("there is no terminal to confirm on",
				"pass --yes to commit without confirming, or --dry-run to only see the message")
		}
	}

	sha, err := gitx.Commit(text, gitx.CommitOptions{Edit: edit, Verify: cfg.Verify})
	if err != nil {
		return fail("git refused the commit", err.Error())
	}
	fmt.Fprintf(os.Stderr, "\n  %s %s %s\n",
		theme.OK(theme.Glyph.OK), theme.Head(sha), theme.Dim("committed"))
	return nil
}

func applyFlags(cfg config.Config, f commitFlags) config.Config {
	if f.model != "" {
		cfg.Model = f.model
	}
	if f.color != "" {
		cfg.Color = f.color
	}
	if f.noVerify {
		cfg.Verify = false
	}
	return cfg
}

// collectDiff reads the staged patch minus the excluded paths. When the
// exclusions leave nothing at all, the full diff is used instead: an empty
// prompt is worse than an oversized one.
func collectDiff(cfg config.Config) (stat, diff string, excluded []string, err error) {
	if stat, err = gitx.StagedStat(); err != nil {
		return "", "", nil, err
	}
	if diff, err = gitx.StagedDiff(cfg.Exclude); err != nil {
		return "", "", nil, err
	}
	if strings.TrimSpace(diff) == "" {
		if diff, err = gitx.StagedDiff(nil); err != nil {
			return "", "", nil, err
		}
		return stat, diff, nil, nil
	}
	excluded, err = gitx.ExcludedFiles(cfg.Exclude)
	if err != nil {
		return stat, diff, nil, nil
	}
	return stat, diff, excluded, nil
}

// loadInstructions reads the project conventions file, if one is configured.
// A missing file is a warning, not a failure: the commit is still worth making.
func loadInstructions(root string, cfg config.Config) (text, warning string) {
	if cfg.Instructions == "" {
		return "", ""
	}
	path := cfg.Instructions
	if !filepath.IsAbs(path) {
		path = filepath.Join(root, path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Sprintf("instructions file not found: %s", cfg.Instructions)
	}
	text, truncated := prompt.Truncate(strings.TrimSpace(string(data)), cfg.InstructionsMaxChars)
	if truncated {
		warning = fmt.Sprintf("instructions truncated to %d characters", cfg.InstructionsMaxChars)
	}
	return text, warning
}
