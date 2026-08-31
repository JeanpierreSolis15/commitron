package message

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

var (
	tagRe     = regexp.MustCompile(`(?s)<commit>(.*?)</commit>`)
	fenceRe   = regexp.MustCompile("(?s)^```[a-zA-Z]*\r?\n(.*?)\r?\n```$")
	subjectRe = regexp.MustCompile(`^([a-zA-Z]+)(?:\(([^()]+)\))?(!)?:[ \t]*(.+)$`)

	noiseRe = regexp.MustCompile(`(?i)^\s*(co-authored-by:|claude-session:|generated with \[?claude|🤖)`)
	urlRe   = regexp.MustCompile(`^\s*https://claude\.ai/`)
)

type Parsed struct {
	Type        string
	Scope       string
	Breaking    bool
	Description string
	Subject     string
	Body        string
}

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

func Parse(msg string) (Parsed, bool) {
	subject, body, _ := strings.Cut(msg, "\n")
	subject = strings.TrimSpace(subject)
	m := subjectRe.FindStringSubmatch(subject)
	if m == nil {
		return Parsed{}, false
	}
	return Parsed{
		Type:        strings.ToLower(m[1]),
		Scope:       m[2],
		Breaking:    m[3] == "!",
		Description: strings.TrimSpace(m[4]),
		Subject:     subject,
		Body:        strings.TrimSpace(body),
	}, true
}

func Validate(p Parsed, cfg config.Config) (warnings []string, err error) {
	if !cfg.AllowsType(p.Type) {
		return nil, fmt.Errorf("%q is not an allowed type (%s)", p.Type, strings.Join(cfg.Types, ", "))
	}

	subject := p.Canonical()
	if n := utf8.RuneCountInString(subject); n > cfg.SubjectMaxLength {
		warnings = append(warnings,
			fmt.Sprintf("subject is %d characters, %d over the limit", n, n-cfg.SubjectMaxLength))
	}

	if cfg.SubjectCase == config.CaseLower && violatesLowerCase(p.Description) {
		warnings = append(warnings, "description starts with a capital; commitlint expects lowercase")
	}

	if cfg.ScopeCase == config.CaseLower && hasUpper(p.Scope) {
		warnings = append(warnings, fmt.Sprintf("scope %q is not lowercase", p.Scope))
	}

	if cfg.BodyMaxLineLength > 0 {
		for _, line := range strings.Split(wrapBody(p.Body, cfg.BodyMaxLineLength), "\n") {
			if n := utf8.RuneCountInString(line); n > cfg.BodyMaxLineLength {
				warnings = append(warnings,
					fmt.Sprintf("a body line is %d characters and cannot be wrapped", n))
				break
			}
		}
	}

	if cfg.Body == config.BodyAlways && p.Body == "" {
		warnings = append(warnings, "body is required by config but the model returned none")
	}
	if cfg.Body == config.BodyNever && p.Body != "" {
		warnings = append(warnings, "config asks for no body but the model returned one")
	}
	return warnings, nil
}
