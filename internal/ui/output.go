package ui

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/JeanpierreSolis15/commitron/internal/message"
)

// Answer is what the user picked at the confirmation prompt.
type Answer int

// The possible answers to Confirm.
const (
	AnswerYes Answer = iota
	AnswerNo
	AnswerEdit
)

// Header is the first line: the tool, the model and what is staged.
func (t *Theme) Header(model string, files, added, removed int) string {
	noun := "files"
	if files == 1 {
		noun = "file"
	}
	return fmt.Sprintf("%s %s %s %s %s %s %s",
		t.Clay(t.Glyph.Spark),
		t.Head("commitron"),
		t.Dim(t.Glyph.Dot),
		t.Dim(model),
		t.Dim(fmt.Sprintf("%d %s", files, noun)),
		t.OK(fmt.Sprintf("+%d", added)),
		t.Bad(fmt.Sprintf("%s%d", t.Glyph.Minus, removed)),
	)
}

// Message renders the commit message the way it will be committed, indented and
// with the type highlighted.
func (t *Theme) Message(p message.Parsed) string {
	scope := ""
	if p.Scope != "" {
		scope = t.Dim("(") + t.Accent(p.Scope) + t.Dim(")")
	}
	bang := ""
	if p.Breaking {
		bang = t.Bad("!")
	}
	out := "  " + t.Accent(p.Type) + scope + bang + t.Dim(":") + " " + t.Head(p.Description)

	if p.Body != "" {
		var b strings.Builder
		b.WriteString(out)
		b.WriteString("\n")
		for _, line := range strings.Split(p.Body, "\n") {
			if strings.TrimSpace(line) == "" {
				b.WriteString("\n")
				continue
			}
			b.WriteString(t.Dim("  "+line) + "\n")
		}
		return strings.TrimRight(b.String(), "\n")
	}
	return out
}

// Warn prints a non-blocking warning.
func (t *Theme) Warn(text string) {
	fmt.Fprintf(os.Stderr, "  %s %s\n", t.Bad(t.Glyph.Warn), t.Dim(text))
}

// Confirm asks whether to commit. Without a terminal on stdin there is nobody to
// ask, so the answer is yes: the user ran the command on purpose.
func (t *Theme) Confirm() Answer {
	if !IsTerminal(os.Stdin) {
		return AnswerYes
	}
	fmt.Fprintf(os.Stderr, "\n  %s %s ", t.Head("commit?"), t.Dim("[Y/n/e=edit]"))

	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		fmt.Fprintln(os.Stderr)
		return AnswerNo
	}
	switch strings.ToLower(strings.TrimSpace(line)) {
	case "", "y", "yes", "s", "si", "sí":
		return AnswerYes
	case "e", "edit", "editar":
		return AnswerEdit
	default:
		return AnswerNo
	}
}

// AskInit offers to create a config file on the first run in a repository.
// It returns "repo", "global" or "no".
func (t *Theme) AskInit() string {
	if !IsTerminal(os.Stdin) {
		return "no"
	}
	fmt.Fprintf(os.Stderr, "  %s %s\n", t.Dim(t.Glyph.Dot), t.Dim("no commitron config in this repository"))
	fmt.Fprintf(os.Stderr, "  %s %s ", t.Head("create .commitron.json?"), t.Dim("[Y/n/g=global]"))

	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		fmt.Fprintln(os.Stderr)
		return "no"
	}
	switch strings.ToLower(strings.TrimSpace(line)) {
	case "", "y", "yes", "s", "si", "sí":
		return "repo"
	case "g", "global":
		return "global"
	default:
		return "no"
	}
}
