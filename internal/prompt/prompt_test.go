package prompt

import (
	"strings"
	"testing"
	"unicode/utf8"

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

func TestBuildIncludesCaseAndWrapRules(t *testing.T) {
	out, err := Build(config.Defaults(), Input{Diff: "d"}, "")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"Start the description with a lowercase letter",
		"The scope, when there is one, is lowercase",
		"Wrap every body line at 100 characters",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("prompt is missing %q", want)
		}
	}
}

func TestBuildOmitsRelaxedRules(t *testing.T) {
	cfg := config.Defaults()
	cfg.SubjectCase = "any"
	cfg.ScopeCase = "any"
	cfg.BodyMaxLineLength = 0

	out, err := Build(cfg, Input{Diff: "d"}, "")
	if err != nil {
		t.Fatal(err)
	}
	for _, unwanted := range []string{
		"Start the description with a lowercase letter",
		"The scope, when there is one, is lowercase",
		"Wrap every body line",
	} {
		if strings.Contains(out, unwanted) {
			t.Errorf("a relaxed config should not produce %q", unwanted)
		}
	}
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		name string
		in   string
		max  int
		want string
		cut  bool
	}{
		{"fits exactly", "abc", 3, "abc", false},
		{"cuts ascii", "abcdef", 3, "abc", true},
		{"zero means no limit", "abcdef", 0, "abcdef", false},
		{"empty", "", 3, "", false},
		{"counts characters, not bytes", "ééééé", 3, "ééé", true},
		{"multi-byte that fits by characters but not by bytes", "ééé", 3, "ééé", false},
		{"never splits a character", "aé", 2, "aé", false},
		{"cuts before a multi-byte character", "aéb", 1, "a", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, cut := Truncate(tt.in, tt.max)
			if got != tt.want || cut != tt.cut {
				t.Errorf("Truncate(%q, %d) = %q, %v; want %q, %v", tt.in, tt.max, got, cut, tt.want, tt.cut)
			}
			if !utf8.ValidString(got) {
				t.Errorf("Truncate(%q, %d) produced invalid UTF-8", tt.in, tt.max)
			}
		})
	}
}

func TestBuildTruncatesTheDiffByCharacter(t *testing.T) {
	cfg := config.Defaults()
	cfg.MaxDiffChars = 1000
	long := strings.Repeat("ñ", 5000)

	out, err := Build(cfg, Input{Diff: long}, "")
	if err != nil {
		t.Fatal(err)
	}
	if !utf8.ValidString(out) {
		t.Fatal("the prompt contains a half-cut character")
	}
	if n := strings.Count(out, "ñ"); n != 1000 {
		t.Errorf("diff was not cut to 1000 characters, got %d", n)
	}
}
