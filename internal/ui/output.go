package ui

import (
	"bufio"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/JeanpierreSolis15/commitron/internal/message"
)

type Answer int

const (
	AnswerYes Answer = iota
	AnswerNo
	AnswerEdit
	AnswerUnavailable
)

type InitAnswer int

const (
	InitNo InitAnswer = iota
	InitRepo
	InitGlobal
)

var yesAnswers = []string{"", "y", "yes", "s", "si", "sí"}

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
	if p.Body == "" {
		return out
	}

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

func (t *Theme) Warn(text string) {
	fmt.Fprintf(os.Stderr, "  %s %s\n", t.Bad(t.Glyph.Warn), t.Dim(text))
}

func (t *Theme) Confirm() Answer {
	if !IsTerminal(os.Stdin) {
		return AnswerUnavailable
	}
	fmt.Fprintln(os.Stderr)
	answer, ok := t.ask(t.Head("commit?"), t.Dim("[Y/n/e=edit]"))
	switch {
	case !ok:
		return AnswerNo
	case isYes(answer):
		return AnswerYes
	case answer == "e" || answer == "edit" || answer == "editar":
		return AnswerEdit
	default:
		return AnswerNo
	}
}

func (t *Theme) AskInit() InitAnswer {
	if !IsTerminal(os.Stdin) {
		return InitNo
	}
	fmt.Fprintf(os.Stderr, "  %s %s\n", t.Dim(t.Glyph.Dot), t.Dim("no commitron config in this repository"))
	answer, ok := t.ask(t.Head("create .commitron.json?"), t.Dim("[Y/n/g=global]"))
	switch {
	case !ok:
		return InitNo
	case isYes(answer):
		return InitRepo
	case answer == "g" || answer == "global":
		return InitGlobal
	default:
		return InitNo
	}
}

func (t *Theme) ask(question, hint string) (string, bool) {
	fmt.Fprintf(os.Stderr, "  %s %s ", question, hint)
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		fmt.Fprintln(os.Stderr)
		return "", false
	}
	return strings.ToLower(strings.TrimSpace(line)), true
}

func isYes(answer string) bool { return slices.Contains(yesAnswers, answer) }
