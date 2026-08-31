package prompt

import (
	"strings"
	"testing"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

func TestLanguageName(t *testing.T) {
	tests := map[string]string{
		"en":                   "English",
		"ES":                   "Spanish",
		" pt ":                 "Portuguese",
		"Brazilian Portuguese": "Brazilian Portuguese",
	}
	for in, want := range tests {
		if got := LanguageName(in); got != want {
			t.Errorf("LanguageName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestBuildIncludesTheContract(t *testing.T) {
	cfg := config.Defaults()
	cfg.Language = "es"
	cfg.SubjectMaxLength = 60

	out, err := Build(cfg, Input{Stat: "a.go | 2 +-", Diff: "diff --git a/a.go"}, "")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Spanish", "60 characters", "feat, fix", "a.go | 2 +-", "diff --git a/a.go", "<commit>"} {
		if !strings.Contains(out, want) {
			t.Errorf("prompt is missing %q", want)
		}
	}
}

func TestBuildTruncatesTheDiff(t *testing.T) {
	cfg := config.Defaults()
	cfg.MaxDiffChars = 1000
	// A letter the template itself never uses, so the count is only the diff.
	long := strings.Repeat("Z", 5000)

	out, err := Build(cfg, Input{Diff: long}, "")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "truncated to 1000 characters") {
		t.Error("a truncated diff must say so")
	}
	if n := strings.Count(out, "Z"); n != 1000 {
		t.Errorf("diff was not cut to the budget, got %d characters", n)
	}
}

func TestBuildOmitsTruncationNoteWhenItFits(t *testing.T) {
	out, err := Build(config.Defaults(), Input{Diff: "small"}, "")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "truncated") {
		t.Error("a diff that fits must not be labelled truncated")
	}
}

func TestBuildBodyModes(t *testing.T) {
	cases := map[string]string{
		"never":  "Do not write one. Subject line only.",
		"always": "Always write one.",
		"auto":   "only when the change has several distinct parts",
	}
	for mode, want := range cases {
		cfg := config.Defaults()
		cfg.Body = mode
		out, err := Build(cfg, Input{}, "")
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(out, want) {
			t.Errorf("body=%q should produce %q", mode, want)
		}
	}
}

func TestBuildIncludesInstructionsAndExclusions(t *testing.T) {
	out, err := Build(
		config.Defaults(),
		Input{Diff: "d", Excluded: []string{"pnpm-lock.yaml", "a.snap"}},
		"Commit messages must mention the ticket.",
	)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "Project conventions") ||
		!strings.Contains(out, "must mention the ticket") {
		t.Error("the instructions section is missing")
	}
	if !strings.Contains(out, "pnpm-lock.yaml, a.snap") {
		t.Error("excluded files should still be named")
	}
}

func TestBuildWithoutInstructionsHasNoEmptySection(t *testing.T) {
	out, err := Build(config.Defaults(), Input{Diff: "d"}, "")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "Project conventions") {
		t.Error("no instructions means no section header")
	}
}
