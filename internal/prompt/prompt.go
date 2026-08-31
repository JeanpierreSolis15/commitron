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

var languages = map[string]string{
	"en": "English", "es": "Spanish", "pt": "Portuguese", "fr": "French",
	"de": "German", "it": "Italian", "nl": "Dutch", "ja": "Japanese",
	"ko": "Korean", "zh": "Chinese", "ru": "Russian",
}

func LanguageName(code string) string {
	if name, ok := languages[strings.ToLower(strings.TrimSpace(code))]; ok {
		return name
	}
	return code
}

func Truncate(s string, max int) (string, bool) {
	if max <= 0 || len(s) <= max {
		return s, false
	}
	n := 0
	for i := range s {
		if n == max {
			return s[:i], true
		}
		n++
	}
	return s, false
}

func Build(cfg config.Config, in Input, instructions string) (string, error) {
	diff, truncated := Truncate(in.Diff, cfg.MaxDiffChars)

	v := view{
		Types:             strings.Join(cfg.Types, ", "),
		Language:          LanguageName(cfg.Language),
		SubjectMaxLength:  cfg.SubjectMaxLength,
		SubjectLower:      cfg.SubjectCase == config.CaseLower,
		ScopeLower:        cfg.ScopeCase == config.CaseLower,
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
