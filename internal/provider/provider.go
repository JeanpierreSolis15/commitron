// Package provider talks to whatever generates the commit message. Today that
// is the Claude Code CLI; the interface is here so another backend can be added
// without touching the rest of the program.
package provider

import "context"

// Provider turns a prompt into raw model output.
type Provider interface {
	Name() string
	Generate(ctx context.Context, prompt string) (string, error)
}
