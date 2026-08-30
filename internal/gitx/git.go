// Package gitx wraps the git commands commitron needs. Every call goes through
// exec.Command with an argument slice: no shell is ever involved.
package gitx

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

var (
	// ErrNotARepo is returned when the working directory is outside a git repository.
	ErrNotARepo = errors.New("not a git repository")
	// ErrGitMissing is returned when the git executable is not on PATH.
	ErrGitMissing = errors.New("git executable not found on PATH")
)

// Stats summarises what is currently staged.
type Stats struct {
	Files   int
	Added   int
	Removed int
}

func run(args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	var out, errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return "", ErrGitMissing
		}
		detail := strings.TrimSpace(errBuf.String())
		if detail == "" {
			detail = err.Error()
		}
		return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), detail)
	}
	return out.String(), nil
}

// RepoRoot returns the absolute path of the repository containing the working directory.
func RepoRoot() (string, error) {
	out, err := run("rev-parse", "--show-toplevel")
	if err != nil {
		if errors.Is(err, ErrGitMissing) {
			return "", err
		}
		return "", ErrNotARepo
	}
	return strings.TrimSpace(out), nil
}

// StagedStats counts staged files and line changes. Binary files count as files
// with no line delta, which is what git reports as "-".
func StagedStats() (Stats, error) {
	out, err := run("diff", "--cached", "--numstat")
	if err != nil {
		return Stats{}, err
	}
	var s Stats
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 3)
		if len(parts) < 3 {
			continue
		}
		s.Files++
		if n, err := strconv.Atoi(parts[0]); err == nil {
			s.Added += n
		}
		if n, err := strconv.Atoi(parts[1]); err == nil {
			s.Removed += n
		}
	}
	return s, nil
}

// excludeArgs turns config patterns into a git pathspec that drops them from the diff.
// Default pathspec magic is used on purpose: "*" crosses directory separators, so
// "*.lock" matches at any depth while "pnpm-lock.yaml" stays anchored at the root.
func excludeArgs(patterns []string) []string {
	args := []string{"--", "."}
	for _, p := range patterns {
		if p = strings.TrimSpace(p); p != "" {
			args = append(args, ":(exclude)"+p)
		}
	}
	if len(args) == 2 {
		return nil
	}
	return args
}

// StagedStat returns the --stat summary of everything staged, exclusions included:
// the model should know a file changed even when its diff is not sent.
func StagedStat() (string, error) {
	return run("diff", "--cached", "--stat", "--no-color")
}

// StagedDiff returns the staged patch with the configured patterns left out.
func StagedDiff(exclude []string) (string, error) {
	args := append([]string{"diff", "--cached", "--no-color"}, excludeArgs(exclude)...)
	return run(args...)
}

func stagedNames(exclude []string) ([]string, error) {
	args := append([]string{"diff", "--cached", "--name-only"}, excludeArgs(exclude)...)
	out, err := run(args...)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, line := range strings.Split(out, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			names = append(names, line)
		}
	}
	return names, nil
}

// ExcludedFiles lists the staged files the exclusions removed from the diff.
func ExcludedFiles(exclude []string) ([]string, error) {
	if len(exclude) == 0 {
		return nil, nil
	}
	all, err := stagedNames(nil)
	if err != nil {
		return nil, err
	}
	kept, err := stagedNames(exclude)
	if err != nil {
		return nil, err
	}
	keptSet := make(map[string]struct{}, len(kept))
	for _, name := range kept {
		keptSet[name] = struct{}{}
	}
	var dropped []string
	for _, name := range all {
		if _, ok := keptSet[name]; !ok {
			dropped = append(dropped, name)
		}
	}
	return dropped, nil
}

// CommitOptions mirrors the git flags commitron exposes.
type CommitOptions struct {
	Edit   bool
	Verify bool
}

// Commit writes the message to a temp file and hands it to git. The temp file
// (instead of stdin) keeps stdin free for the editor when Edit is set.
func Commit(message string, opts CommitOptions) (string, error) {
	f, err := os.CreateTemp("", "commitron-*.txt")
	if err != nil {
		return "", err
	}
	path := f.Name()
	defer os.Remove(path)

	if _, err := f.WriteString(message + "\n"); err != nil {
		f.Close()
		return "", err
	}
	if err := f.Close(); err != nil {
		return "", err
	}

	args := []string{"commit", "-F", path}
	if opts.Edit {
		args = append(args, "-e")
	}
	if !opts.Verify {
		args = append(args, "--no-verify")
	}

	cmd := exec.Command("git", args...)
	cmd.Stdin = os.Stdin
	// git's own summary goes to stderr so stdout stays clean for piping.
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git commit: %w", err)
	}

	out, err := run("rev-parse", "--short", "HEAD")
	return strings.TrimSpace(out), err
}
