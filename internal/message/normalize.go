package message

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

func (p Parsed) Canonical() string {
	var b strings.Builder
	b.WriteString(strings.ToLower(p.Type))
	if p.Scope != "" {
		b.WriteString("(" + p.Scope + ")")
	}
	if p.Breaking {
		b.WriteString("!")
	}
	b.WriteString(": ")
	b.WriteString(strings.TrimRight(strings.TrimSpace(p.Description), "."))
	return b.String()
}

func (p Parsed) Render(cfg config.Config) string {
	subject := p.Canonical()
	if p.Body == "" {
		return subject
	}
	return subject + "\n\n" + wrapBody(p.Body, cfg.BodyMaxLineLength)
}

func wrapBody(body string, max int) string {
	if max <= 0 {
		return body
	}
	var out []string
	for _, line := range strings.Split(body, "\n") {
		out = append(out, wrapLine(line, max)...)
	}
	return strings.Join(out, "\n")
}

func wrapLine(line string, max int) []string {
	if utf8.RuneCountInString(line) <= max || strings.TrimSpace(line) == "" {
		return []string{line}
	}

	trimmed := strings.TrimLeft(line, " \t")
	indent := line[:len(line)-len(trimmed)]
	continuation := indent
	if strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ") {
		continuation = indent + "  "
	}

	words := strings.Fields(trimmed)
	if len(words) == 0 {
		return []string{line}
	}

	var lines []string
	current := indent + words[0]
	for _, word := range words[1:] {
		if utf8.RuneCountInString(current)+1+utf8.RuneCountInString(word) <= max {
			current += " " + word
			continue
		}
		lines = append(lines, current)
		current = continuation + word
	}
	return append(lines, current)
}

func violatesLowerCase(description string) bool {
	if description == "" {
		return false
	}
	runes := []rune(description)
	if !unicode.IsUpper(runes[0]) {
		return false
	}
	word := description
	if i := strings.IndexAny(description, " \t"); i > 0 {
		word = description[:i]
	}
	for _, r := range []rune(word)[1:] {
		if unicode.IsUpper(r) {
			return false
		}
	}
	return true
}

func hasUpper(s string) bool {
	for _, r := range s {
		if unicode.IsUpper(r) {
			return true
		}
	}
	return false
}
