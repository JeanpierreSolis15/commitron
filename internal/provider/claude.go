package provider

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

var ErrNotInstalled = errors.New("the `claude` CLI was not found on your PATH")

type Claude struct {
	Model           string
	FallbackModel   string
	StrictMCPConfig bool
	ExtraArgs       []string
	Timeout         time.Duration
}

var _ Provider = Claude{}

func (c Claude) Name() string { return c.Model }

func (c Claude) args() []string {
	args := []string{"-p", "--model", c.Model}
	if c.FallbackModel != "" {
		args = append(args, "--fallback-model", c.FallbackModel)
	}
	if c.StrictMCPConfig {
		args = append(args, "--strict-mcp-config")
	}
	return append(args, c.ExtraArgs...)
}

func (c Claude) Generate(ctx context.Context, prompt string) (string, error) {
	if _, err := exec.LookPath("claude"); err != nil {
		return "", ErrNotInstalled
	}

	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "claude", c.args()...)
	cmd.Stdin = strings.NewReader(prompt)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err == nil {
		return stdout.String(), nil
	}

	switch {
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return "", fmt.Errorf("no reply after %s", c.Timeout)
	case errors.Is(ctx.Err(), context.Canceled):
		return "", context.Canceled
	case errors.Is(err, exec.ErrNotFound):
		return "", ErrNotInstalled
	}

	if detail := strings.TrimSpace(stderr.String()); detail != "" {
		return "", fmt.Errorf("claude: %s", detail)
	}
	return "", fmt.Errorf("claude: %w", err)
}
