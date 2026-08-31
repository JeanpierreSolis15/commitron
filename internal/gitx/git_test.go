package gitx

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// newRepo creates a throwaway repository and makes it the working directory for
// the duration of the test. gitx talks to whatever repo the process is in.
func newRepo(t *testing.T) string {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}

	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "--quiet"},
		{"config", "user.email", "test@example.com"},
		{"config", "user.name", "Test"},
		{"config", "commit.gpgsign", "false"},
	} {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
		}
	}

	previous, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Chdir(previous) })

	// TempDir can be a symlinked path (/var vs /private/var on macOS); ask git.
	root, err := RepoRoot()
	if err != nil {
		t.Fatal(err)
	}
	return root
}

func stage(t *testing.T, name, content string) {
	t.Helper()
	path := filepath.Join(".", name)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("git", "add", name)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git add %s: %v\n%s", name, err, out)
	}
}

func TestRepoRootFailsOutsideARepo(t *testing.T) {
	previous, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	// TMPDIR can itself live inside a repository (a GOTMPDIR pointed at the
	// working copy, for one). The ceiling stops git from walking up past it.
	t.Setenv("GIT_CEILING_DIRECTORIES", filepath.Dir(dir))
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(previous)

	if root, err := RepoRoot(); err == nil {
		t.Fatalf("expected an error outside a repository, got root=%s", root)
	}
}

func TestStagedStats(t *testing.T) {
	newRepo(t)

	got, err := StagedStats()
	if err != nil {
		t.Fatal(err)
	}
	if got.Files != 0 {
		t.Fatalf("an empty index should report 0 files, got %+v", got)
	}

	stage(t, "a.txt", "one\ntwo\nthree\n")
	stage(t, "b.txt", "four\n")

	got, err = StagedStats()
	if err != nil {
		t.Fatal(err)
	}
	want := Stats{Files: 2, Added: 4, Removed: 0}
	if got != want {
		t.Errorf("StagedStats() = %+v, want %+v", got, want)
	}
}

func TestStagedDiffHonoursExclusions(t *testing.T) {
	newRepo(t)
	stage(t, "src.go", "package main\n")
	stage(t, "pnpm-lock.yaml", "lockfileVersion: 9\nnoise: everywhere\n")

	full, err := StagedDiff(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(full, "lockfileVersion") {
		t.Fatal("the unfiltered diff should contain the lockfile")
	}

	filtered, err := StagedDiff([]string{"pnpm-lock.yaml"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(filtered, "lockfileVersion") {
		t.Error("the lockfile should have been excluded")
	}
	if !strings.Contains(filtered, "package main") {
		t.Error("the real change should survive the exclusion")
	}
}

func TestStagedDiffGlobExcludesAtAnyDepth(t *testing.T) {
	newRepo(t)
	stage(t, "src.go", "package main\n")
	stage(t, "nested/deep/thing.lock", "generated\n")

	filtered, err := StagedDiff([]string{"*.lock"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(filtered, "generated") {
		t.Error("*.lock should match at any depth")
	}
}

func TestExcludedFiles(t *testing.T) {
	newRepo(t)
	stage(t, "src.go", "package main\n")
	stage(t, "pnpm-lock.yaml", "lockfileVersion: 9\n")

	got, err := ExcludedFiles([]string{"pnpm-lock.yaml"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0] != "pnpm-lock.yaml" {
		t.Errorf("ExcludedFiles() = %v, want [pnpm-lock.yaml]", got)
	}

	none, err := ExcludedFiles(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(none) != 0 {
		t.Errorf("no patterns means nothing excluded, got %v", none)
	}
}

func TestStagedStatKeepsExcludedFiles(t *testing.T) {
	newRepo(t)
	stage(t, "src.go", "package main\n")
	stage(t, "pnpm-lock.yaml", "lockfileVersion: 9\n")

	stat, err := StagedStat()
	if err != nil {
		t.Fatal(err)
	}
	// The model should know the lockfile changed even though its diff is not sent.
	if !strings.Contains(stat, "pnpm-lock.yaml") {
		t.Error("the file list must still mention excluded files")
	}
}

func TestCommit(t *testing.T) {
	newRepo(t)
	stage(t, "a.txt", "hello\n")

	sha, err := Commit("feat: add a.txt\n\n- because tests need a subject", CommitOptions{Verify: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(sha) < 6 {
		t.Errorf("Commit() returned %q, want a short sha", sha)
	}

	out, err := exec.Command("git", "log", "-1", "--pretty=%B").Output()
	if err != nil {
		t.Fatal(err)
	}
	body := string(out)
	if !strings.Contains(body, "feat: add a.txt") || !strings.Contains(body, "because tests need a subject") {
		t.Errorf("the message did not survive the commit:\n%s", body)
	}

	after, err := StagedStats()
	if err != nil {
		t.Fatal(err)
	}
	if after.Files != 0 {
		t.Errorf("the index should be empty after committing, got %+v", after)
	}
}
