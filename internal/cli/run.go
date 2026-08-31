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

	res, err := resolveConfig(root, flags)
	if err != nil {
		return err
	}
	cfg := res.Config
	theme := ui.New(cfg.Color, cfg.Unicode)

	if shouldOfferInit(res, flags) {
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

	text, warnings, err := generate(ctx, root, cfg, spinner)
	if err != nil {
		return err
	}
	spinner.Stop()

	parsed, _ := message.Parse(text)
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, theme.Message(parsed))
	for _, w := range warnings {
		theme.Warn(w)
	}
	if !ui.IsTerminal(os.Stdout) {
		fmt.Fprintln(os.Stdout, text)
	}

	if flags.dryRun {
		fmt.Fprintf(os.Stderr, "\n  %s\n", theme.Dim("dry run "+theme.Glyph.Dot+" nothing committed"))
		return nil
	}
	return commit(theme, cfg, flags, text)
}

func resolveConfig(root string, flags commitFlags) (config.Result, error) {
	res, err := config.Load(root, flags.configPath)
	if err != nil {
		return res, fail("invalid configuration", err.Error())
	}
	res.Config = applyFlags(res.Config, flags)
	if err := res.Config.Validate(); err != nil {
		return res, fail("invalid configuration", err.Error())
	}
	return res, nil
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

func shouldOfferInit(res config.Result, flags commitFlags) bool {
	return len(res.Sources) == 0 && !flags.noInit && !flags.dryRun && os.Getenv("COMMITRON_NO_INIT") == ""
}

func generate(ctx context.Context, root string, cfg config.Config, spinner *ui.Spinner) (string, []string, error) {
	spinner.Status("reading staged changes")
	input, err := collectDiff(cfg)
	if err != nil {
		return "", nil, fail("could not read the staged diff", err.Error())
	}

	var warnings []string
	instructions, warning := loadInstructions(root, cfg)
	if warning != "" {
		warnings = append(warnings, warning)
	}
	promptText, err := prompt.Build(cfg, input, instructions)
	if err != nil {
		return "", nil, fail("could not build the prompt", err.Error())
	}

	spinner.Status("asking " + cfg.Model)
	raw, err := newProvider(cfg).Generate(ctx, promptText)
	if err != nil {
		return "", nil, generationError(err)
	}

	spinner.Status("validating")
	text := message.Sanitize(raw)
	if text == "" {
		return "", nil, fail("the model returned an empty message", "")
	}
	parsed, ok := message.Parse(text)
	if !ok {
		return "", nil, fail("the reply is not a Conventional Commits message", text)
	}
	more, err := message.Validate(parsed, cfg)
	if err != nil {
		return "", nil, fail("the message does not match your config", err.Error()+"\n\n"+text)
	}
	return parsed.Render(cfg), append(warnings, more...), nil
}

func newProvider(cfg config.Config) provider.Provider {
	return provider.Claude{
		Model:           cfg.Model,
		FallbackModel:   cfg.FallbackModel,
		StrictMCPConfig: cfg.StrictMCPConfig,
		ExtraArgs:       cfg.ExtraArgs,
		Timeout:         time.Duration(cfg.TimeoutSeconds) * time.Second,
	}
}

func generationError(err error) error {
	switch {
	case errors.Is(err, provider.ErrNotInstalled):
		return fail("the `claude` CLI was not found on your PATH",
			"commitron uses your Claude Code subscription.\ninstall it from https://claude.com/claude-code and try again")
	case errors.Is(err, context.Canceled):
		return errCancelled
	default:
		return fail("could not generate the message", err.Error())
	}
}

func commit(theme *ui.Theme, cfg config.Config, flags commitFlags, text string) error {
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

func collectDiff(cfg config.Config) (prompt.Input, error) {
	stat, err := gitx.StagedStat()
	if err != nil {
		return prompt.Input{}, err
	}
	diff, err := gitx.StagedDiff(cfg.Exclude)
	if err != nil {
		return prompt.Input{}, err
	}
	if strings.TrimSpace(diff) == "" {
		if diff, err = gitx.StagedDiff(nil); err != nil {
			return prompt.Input{}, err
		}
		return prompt.Input{Stat: stat, Diff: diff}, nil
	}
	excluded, _ := gitx.ExcludedFiles(cfg.Exclude)
	return prompt.Input{Stat: stat, Diff: diff, Excluded: excluded}, nil
}

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
