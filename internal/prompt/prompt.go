// Package prompt renders the instructions sent to the model. The text lives in
// a template so language, types and project conventions stay data, not code.
package prompt

import (
	"embed"
	"strings"
	"text/template"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

//go:embed templates/commit.tmpl
var files embed.FS

var tmpl = template.Must(template.ParseFS(files, "templates/commit.tmpl"))

// Input is everything the template needs that does not come from config.
type Input struct {
	Stat     string
	Diff     string
	Excluded []string
}

type view struct {
	Types             string
	Language          string
	SubjectMaxLength  int
	SubjectLower      bool
	ScopeLower        bool
	Body              string
	BodyMaxLineLength int
	Instructions      string
	Stat              string
	Diff              string
	Excluded          string
	Truncated         bool
	MaxDiffChars      int
}

// languages maps the common codes to a name the model understands. Anything
// else is passed through, so "Brazilian Portuguese" works too.
var languages = map[string]string{
	"en": "English", "es": "Spanish", "pt": "Portuguese", "fr": "French",
	"de": "German", "it": "Italian", "nl": "Dutch", "ja": "Japanese",
	"ko": "Korean", "zh": "Chinese", "ru": "Russian",
}

// LanguageName resolves a config language value to a name for the prompt.
func LanguageName(code string) string {
	if name, ok := languages[strings.ToLower(strings.TrimSpace(code))]; ok {
		return name
	}
	return code
}

// Truncate cuts s to at most max characters. It counts characters rather than
// bytes, so a diff full of accents gets the budget the config promises and a
// multi-byte character is never left half-cut. A max of zero or less means no
// limit. The second result reports whether anything was removed.
func Truncate(s string, max int) (string, bool) {
	// A string of max bytes has at most max characters, so this fast path is exact.
	if max <= 0 || len(s) <= max {
		return s, false
	}
	n := 0
	for i := range s { // i is the byte offset where each character starts
		if n == max {
			return s[:i], true
		}
		n++
	}
	return s, false
}

// Build renders the prompt, truncating the diff to the configured budget.
func Build(cfg config.Config, in Input, instructions string) (string, error) {
	diff, truncated := Truncate(in.Diff, cfg.MaxDiffChars)

	v := view{
		Types:             strings.Join(cfg.Types, ", "),
		Language:          LanguageName(cfg.Language),
		SubjectMaxLength:  cfg.SubjectMaxLength,
		SubjectLower:      cfg.SubjectCase == "lower",
		ScopeLower:        cfg.ScopeCase == "lower",
		Body:              cfg.Body,
		BodyMaxLineLength: cfg.BodyMaxLineLength,
		Instructions:      instructions,
		Stat:              strings.TrimRight(in.Stat, "\n"),
		Diff:              diff,
		Excluded:          strings.Join(in.Excluded, ", "),
		Truncated:         truncated,
		MaxDiffChars:      cfg.MaxDiffChars,
	}

	var sb strings.Builder
	if err := tmpl.Execute(&sb, v); err != nil {
		return "", err
	}
	return sb.String(), nil
}
