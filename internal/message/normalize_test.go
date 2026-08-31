package message

import (
	"strings"
	"testing"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

func TestCanonical(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"already canonical", "feat: add the thing", "feat: add the thing"},
		{"lowercases the type", "Feat: add the thing", "feat: add the thing"},
		{"drops the full stop", "fix: repair the thing.", "fix: repair the thing"},
		{"keeps the scope", "fix(orders): repair it", "fix(orders): repair it"},
		{"keeps the breaking marker", "feat(api)!: rename tokens", "feat(api)!: rename tokens"},
		{"normalises spacing", "feat:    add the thing", "feat: add the thing"},
		{"both fixes at once", "Fix(db): drop the column.", "fix(db): drop the column"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, ok := Parse(tt.in)
			if !ok {
				t.Fatalf("Parse(%q) failed", tt.in)
			}
			if got := p.Canonical(); got != tt.want {
				t.Errorf("Canonical() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRenderSeparatesTheBody(t *testing.T) {
	cfg := config.Defaults()

	// commitlint's body-leading-blank: exactly one empty line, however the
	// model formatted it.
	p, _ := Parse("feat: add the thing\n- one\n- two")
	want := "feat: add the thing\n\n- one\n- two"
	if got := p.Render(cfg); got != want {
		t.Errorf("Render()\n got: %q\nwant: %q", got, want)
	}

	p, _ = Parse("feat: add the thing")
	if got := p.Render(cfg); got != "feat: add the thing" {
		t.Errorf("a subject with no body should stay one line, got %q", got)
	}
}

func TestRenderWrapsTheBody(t *testing.T) {
	cfg := config.Defaults()
	cfg.BodyMaxLineLength = 40

	long := "- " + strings.Repeat("word ", 30)
	p, _ := Parse("feat: add the thing\n\n" + long)
	out := p.Render(cfg)

	for _, line := range strings.Split(out, "\n") {
		if len(line) > 40 {
			t.Fatalf("line longer than the limit: %q", line)
		}
	}
	body := strings.SplitN(out, "\n\n", 2)[1]
	lines := strings.Split(body, "\n")
	if !strings.HasPrefix(lines[0], "- word") {
		t.Errorf("the bullet marker should stay on the first line, got %q", lines[0])
	}
	if !strings.HasPrefix(lines[1], "  word") {
		t.Errorf("continuations should be indented under the text, got %q", lines[1])
	}
}

func TestRenderLeavesUnwrappableWords(t *testing.T) {
	cfg := config.Defaults()
	cfg.BodyMaxLineLength = 20
	url := strings.Repeat("x", 60)

	p, _ := Parse("fix: update the link\n\nsee " + url)
	out := p.Render(cfg)
	if !strings.Contains(out, url) {
		t.Error("a word longer than the limit must survive intact")
	}
}

func TestRenderWrappingOff(t *testing.T) {
	cfg := config.Defaults()
	cfg.BodyMaxLineLength = 0
	long := strings.Repeat("word ", 50)

	p, _ := Parse("feat: add the thing\n\n" + long)
	if strings.Count(p.Render(cfg), "\n") != 2 {
		t.Error("bodyMaxLineLength 0 must leave the body untouched")
	}
}

func TestViolatesLowerCase(t *testing.T) {
	tests := map[string]bool{
		"add the thing":         false,
		"Add the thing":         true,
		"OAuth login flow":      false, // acronym-ish, commitlint tolerates it
		"API returns 404":       false,
		"PostgreSQL 17 upgrade": false,
		"":                      false,
		"Repair":                true,
	}
	for in, want := range tests {
		if got := violatesLowerCase(in); got != want {
			t.Errorf("violatesLowerCase(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestValidateCommitlintRules(t *testing.T) {
	base := config.Defaults()

	hasWarning := func(t *testing.T, cfg config.Config, msg, fragment string) bool {
		t.Helper()
		p, ok := Parse(msg)
		if !ok {
			t.Fatalf("Parse(%q) failed", msg)
		}
		warnings, err := Validate(p, cfg)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, w := range warnings {
			if strings.Contains(w, fragment) {
				return true
			}
		}
		return false
	}

	t.Run("warns on a sentence-cased description", func(t *testing.T) {
		if !hasWarning(t, base, "feat: Add the thing", "capital") {
			t.Error("expected a subject-case warning")
		}
		if hasWarning(t, base, "feat: add the thing", "capital") {
			t.Error("a lowercase description must not warn")
		}
		if hasWarning(t, base, "feat: OAuth login", "capital") {
			t.Error("an acronym must not warn")
		}
	})

	t.Run("subjectCase any disables the check", func(t *testing.T) {
		cfg := base
		cfg.SubjectCase = "any"
		if hasWarning(t, cfg, "feat: Add the thing", "capital") {
			t.Error("subjectCase any should stay quiet")
		}
	})

	t.Run("warns on an uppercase scope", func(t *testing.T) {
		if !hasWarning(t, base, "feat(Chip): add the prop", "not lowercase") {
			t.Error("expected a scope-case warning")
		}
		cfg := base
		cfg.ScopeCase = "any"
		if hasWarning(t, cfg, "feat(Chip): add the prop", "not lowercase") {
			t.Error("scopeCase any should stay quiet")
		}
	})

	t.Run("warns on a body line that cannot be wrapped", func(t *testing.T) {
		cfg := base
		cfg.BodyMaxLineLength = 20
		if !hasWarning(t, cfg, "fix: link\n\n"+strings.Repeat("x", 40), "cannot be wrapped") {
			t.Error("expected a body-max-line-length warning")
		}
	})

	t.Run("length is measured on what gets committed", func(t *testing.T) {
		cfg := base
		cfg.SubjectMaxLength = 25
		// 26 characters raw, 25 once the full stop goes.
		if hasWarning(t, cfg, "feat: 12345678901234567.", "over the limit") {
			t.Error("the trailing full stop is removed before measuring")
		}
	})
}
