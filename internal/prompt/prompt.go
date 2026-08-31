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

// Build renders the prompt, truncating the diff to the configured budget.
func Build(cfg config.Config, in Input, instructions string) (string, error) {
	diff := in.Diff
	truncated := len(diff) > cfg.MaxDiffChars
	if truncated {
		diff = diff[:cfg.MaxDiffChars]
	}

	v := view{
		Types:            strings.Join(cfg.Types, ", "),
		Language:         LanguageName(cfg.Language),
		SubjectMaxLength: cfg.SubjectMaxLength,
		Body:             cfg.Body,
		Instructions:     instructions,
		Stat:             strings.TrimRight(in.Stat, "\n"),
		Diff:             diff,
		Excluded:         strings.Join(in.Excluded, ", "),
		Truncated:        truncated,
		MaxDiffChars:     cfg.MaxDiffChars,
	}

	var sb strings.Builder
	if err := tmpl.Execute(&sb, v); err != nil {
		return "", err
	}
	return sb.String(), nil
}
