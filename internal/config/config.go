package config

import (
	"errors"
	"fmt"
	"slices"
	"strings"
)

const SchemaURL = "https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/schema.json"

const (
	CaseLower    = "lower"
	CaseSentence = "sentence"
	CaseAny      = "any"
)

const (
	BodyAuto   = "auto"
	BodyAlways = "always"
	BodyNever  = "never"
)

const (
	ModeAuto   = "auto"
	ModeAlways = "always"
	ModeNever  = "never"
)

var (
	subjectCases = []string{CaseLower, CaseSentence, CaseAny}
	scopeCases   = []string{CaseLower, CaseAny}
	bodyModes    = []string{BodyAuto, BodyAlways, BodyNever}
	modes        = []string{ModeAuto, ModeAlways, ModeNever}
)

type Config struct {
	Schema string `json:"$schema,omitempty"`

	Model           string   `json:"model"`
	FallbackModel   string   `json:"fallbackModel,omitempty"`
	TimeoutSeconds  int      `json:"timeoutSeconds"`
	StrictMCPConfig bool     `json:"strictMcpConfig"`
	ExtraArgs       []string `json:"extraArgs,omitempty"`

	Language          string   `json:"language"`
	Types             []string `json:"types"`
	SubjectMaxLength  int      `json:"subjectMaxLength"`
	SubjectCase       string   `json:"subjectCase"`
	ScopeCase         string   `json:"scopeCase"`
	Body              string   `json:"body"`
	BodyMaxLineLength int      `json:"bodyMaxLineLength"`

	MaxDiffChars         int      `json:"maxDiffChars"`
	Exclude              []string `json:"exclude"`
	Instructions         string   `json:"instructions,omitempty"`
	InstructionsMaxChars int      `json:"instructionsMaxChars"`

	Confirm bool   `json:"confirm"`
	Verify  bool   `json:"verify"`
	Color   string `json:"color"`
	Unicode string `json:"unicode"`
}

func Defaults() Config {
	return Config{
		Model:           "sonnet",
		TimeoutSeconds:  120,
		StrictMCPConfig: true,

		Language: "en",
		Types: []string{
			"feat", "fix", "refactor", "perf", "docs",
			"test", "build", "ci", "chore", "style", "revert",
		},
		SubjectMaxLength:  72,
		SubjectCase:       CaseLower,
		ScopeCase:         CaseLower,
		Body:              BodyAuto,
		BodyMaxLineLength: 100,

		MaxDiffChars: 30000,
		Exclude: []string{
			"pnpm-lock.yaml", "package-lock.json", "yarn.lock",
			"bun.lockb", "*.lock", "*.snap",
		},
		InstructionsMaxChars: 4000,

		Confirm: true,
		Verify:  true,
		Color:   ModeAuto,
		Unicode: ModeAuto,
	}
}

func (c Config) Validate() error {
	switch {
	case c.Model == "":
		return errors.New("model: cannot be empty")
	case c.TimeoutSeconds < 5:
		return fmt.Errorf("timeoutSeconds: %d is too low, use at least 5", c.TimeoutSeconds)
	case c.Language == "":
		return errors.New("language: cannot be empty")
	case len(c.Types) == 0:
		return errors.New("types: needs at least one commit type")
	case c.SubjectMaxLength < 20:
		return fmt.Errorf("subjectMaxLength: %d is too low, use at least 20", c.SubjectMaxLength)
	case !slices.Contains(subjectCases, c.SubjectCase):
		return notOneOf("subjectCase", c.SubjectCase, subjectCases)
	case !slices.Contains(scopeCases, c.ScopeCase):
		return notOneOf("scopeCase", c.ScopeCase, scopeCases)
	case c.BodyMaxLineLength < 0:
		return errors.New("bodyMaxLineLength: cannot be negative")
	case c.MaxDiffChars < 500:
		return fmt.Errorf("maxDiffChars: %d is too low, use at least 500", c.MaxDiffChars)
	case c.InstructionsMaxChars < 0:
		return errors.New("instructionsMaxChars: cannot be negative")
	case !slices.Contains(bodyModes, c.Body):
		return notOneOf("body", c.Body, bodyModes)
	case !slices.Contains(modes, c.Color):
		return notOneOf("color", c.Color, modes)
	case !slices.Contains(modes, c.Unicode):
		return notOneOf("unicode", c.Unicode, modes)
	}
	return nil
}

func (c Config) AllowsType(t string) bool { return slices.Contains(c.Types, t) }

func notOneOf(key, value string, allowed []string) error {
	return fmt.Errorf("%s: %q is not one of %s", key, value, strings.Join(allowed, ", "))
}
