// Package config holds commitron's settings and the rules for resolving them.
package config

import (
	"fmt"
	"slices"
)

// SchemaURL documents the config file so editors can autocomplete it.
const SchemaURL = "https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/schema.json"

// Config is the full set of knobs. Every field is also a key in .commitron.json.
type Config struct {
	Schema string `json:"$schema,omitempty"`

	// Model
	Model           string   `json:"model"`
	FallbackModel   string   `json:"fallbackModel,omitempty"`
	TimeoutSeconds  int      `json:"timeoutSeconds"`
	StrictMCPConfig bool     `json:"strictMcpConfig"`
	ExtraArgs       []string `json:"extraArgs,omitempty"`

	// Message shape
	Language         string   `json:"language"`
	Types            []string `json:"types"`
	SubjectMaxLength int      `json:"subjectMaxLength"`
	Body             string   `json:"body"` // auto | always | never

	// What the model gets to see
	MaxDiffChars         int      `json:"maxDiffChars"`
	Exclude              []string `json:"exclude"`
	Instructions         string   `json:"instructions,omitempty"`
	InstructionsMaxChars int      `json:"instructionsMaxChars"`

	// Behaviour
	Confirm bool   `json:"confirm"`
	Verify  bool   `json:"verify"`
	Color   string `json:"color"`   // auto | always | never
	Unicode string `json:"unicode"` // auto | always | never
}

// Defaults are what commitron does with no config file at all.
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
		SubjectMaxLength: 72,
		Body:             "auto",

		MaxDiffChars: 30000,
		Exclude: []string{
			"pnpm-lock.yaml", "package-lock.json", "yarn.lock",
			"bun.lockb", "*.lock", "*.snap",
		},
		InstructionsMaxChars: 4000,

		Confirm: true,
		Verify:  true,
		Color:   "auto",
		Unicode: "auto",
	}
}

var modes = []string{"auto", "always", "never"}

// Validate rejects a config that would misbehave later, naming the offending key.
func (c Config) Validate() error {
	switch {
	case c.Model == "":
		return fmt.Errorf("model: cannot be empty")
	case c.TimeoutSeconds < 5:
		return fmt.Errorf("timeoutSeconds: %d is too low, use at least 5", c.TimeoutSeconds)
	case c.Language == "":
		return fmt.Errorf("language: cannot be empty")
	case len(c.Types) == 0:
		return fmt.Errorf("types: needs at least one commit type")
	case c.SubjectMaxLength < 20:
		return fmt.Errorf("subjectMaxLength: %d is too low, use at least 20", c.SubjectMaxLength)
	case c.MaxDiffChars < 500:
		return fmt.Errorf("maxDiffChars: %d is too low, use at least 500", c.MaxDiffChars)
	case c.InstructionsMaxChars < 0:
		return fmt.Errorf("instructionsMaxChars: cannot be negative")
	case !slices.Contains([]string{"auto", "always", "never"}, c.Body):
		return fmt.Errorf("body: %q is not one of auto, always, never", c.Body)
	case !slices.Contains(modes, c.Color):
		return fmt.Errorf("color: %q is not one of auto, always, never", c.Color)
	case !slices.Contains(modes, c.Unicode):
		return fmt.Errorf("unicode: %q is not one of auto, always, never", c.Unicode)
	}
	return nil
}

// AllowsType reports whether the configured type list accepts t.
func (c Config) AllowsType(t string) bool { return slices.Contains(c.Types, t) }
