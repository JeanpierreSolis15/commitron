// Package message cleans up, parses and validates what the model replies.
package message

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

var (
	tagRe     = regexp.MustCompile(`(?s)<commit>(.*?)</commit>`)
	fenceRe   = regexp.MustCompile("(?s)^```[a-zA-Z]*\r?\n(.*?)\r?\n```$")
	subjectRe = regexp.MustCompile(`^([a-zA-Z]+)(?:\(([^()]+)\))?(!)?:[ \t]*(.+)$`)

	// Footers models like to append that have no business in a commit.
	noiseRe = regexp.MustCompile(`(?i)^\s*(co-authored-by:|claude-session:|generated with \[?claude|🤖)`)
	urlRe   = regexp.MustCompile(`^\s*https://claude\.ai/`)
)

// Parsed is a commit message broken into its Conventional Commits parts.
type Parsed struct {
	Type        string
	Scope       string
	Breaking    bool
	Description string
	Subject     string
	Body        string
}

// Sanitize pulls the message out of whatever wrapping the model used and drops
// trailing attribution lines.
func Sanitize(raw string) string {
	msg := strings.TrimSpace(strings.ReplaceAll(raw, "\r\n", "\n"))
	if m := tagRe.FindStringSubmatch(msg); m != nil {
		msg = strings.TrimSpace(m[1])
	}
	if m := fenceRe.FindStringSubmatch(msg); m != nil {
		msg = strings.TrimSpace(m[1])
	}

	var kept []string
	for _, line := range strings.Split(msg, "\n") {
		if noiseRe.MatchString(line) || urlRe.MatchString(line) {
			continue
		}
		kept = append(kept, line)
	}
	return strings.TrimSpace(strings.Join(kept, "\n"))
}

// Parse splits a sanitized message. ok is false when the subject line is not
// in Conventional Commits shape.
func Parse(msg string) (Parsed, bool) {
	lines := strings.Split(msg, "\n")
	if len(lines) == 0 {
		return Parsed{}, false
	}
	subject := strings.TrimSpace(lines[0])
	m := subjectRe.FindStringSubmatch(subject)
	if m == nil {
		return Parsed{}, false
	}
	body := strings.TrimSpace(strings.Join(lines[1:], "\n"))
	return Parsed{
		Type:        strings.ToLower(m[1]),
		Scope:       m[2],
		Breaking:    m[3] == "!",
		Description: strings.TrimSpace(m[4]),
		Subject:     subject,
		Body:        body,
	}, true
}

// Validate enforces the rules that are worth failing on and returns warnings
// for the ones that are not. A wrong type means the model ignored the contract;
// an overlong subject is only cosmetic, so it never blocks a commit.
func Validate(p Parsed, cfg config.Config) (warnings []string, err error) {
	if !cfg.AllowsType(p.Type) {
		return nil, fmt.Errorf("%q is not an allowed type (%s)", p.Type, strings.Join(cfg.Types, ", "))
	}
	if n := len([]rune(p.Subject)); n > cfg.SubjectMaxLength {
		warnings = append(warnings,
			fmt.Sprintf("subject is %d characters, %d over the limit", n, n-cfg.SubjectMaxLength))
	}
	if cfg.Body == "always" && p.Body == "" {
		warnings = append(warnings, "body is required by config but the model returned none")
	}
	if cfg.Body == "never" && p.Body != "" {
		warnings = append(warnings, "config asks for no body but the model returned one")
	}
	return warnings, nil
}
