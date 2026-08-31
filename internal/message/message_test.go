package message

import (
	"strings"
	"testing"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

func TestSanitize(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{
			name: "unwraps the commit tag",
			raw:  "Sure, here it is:\n<commit>feat: add thing</commit>\nHope that helps!",
			want: "feat: add thing",
		},
		{
			name: "unwraps a code fence",
			raw:  "```\nfix: repair thing\n```",
			want: "fix: repair thing",
		},
		{
			name: "unwraps a labelled code fence",
			raw:  "```text\nfix: repair thing\n```",
			want: "fix: repair thing",
		},
		{
			name: "drops attribution footers",
			raw:  "feat: add thing\n\nCo-Authored-By: Someone <a@b.c>\nClaude-Session: https://claude.ai/code/x",
			want: "feat: add thing",
		},
		{
			name: "drops the robot line",
			raw:  "feat: add thing\n\n🤖 Generated with Claude Code",
			want: "feat: add thing",
		},
		{
			name: "normalises CRLF",
			raw:  "feat: add thing\r\n\r\n- one\r\n- two",
			want: "feat: add thing\n\n- one\n- two",
		},
		{
			name: "keeps the body",
			raw:  "<commit>feat: add thing\n\n- one\n- two</commit>",
			want: "feat: add thing\n\n- one\n- two",
		},
		{
			name: "empty stays empty",
			raw:  "   \n  ",
			want: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Sanitize(tt.raw); got != tt.want {
				t.Errorf("Sanitize()\n got: %q\nwant: %q", got, tt.want)
			}
		})
	}
}

func TestParse(t *testing.T) {
	tests := []struct {
		name   string
		msg    string
		wantOK bool
		want   Parsed
	}{
		{
			name:   "type and description",
			msg:    "feat: add the thing",
			wantOK: true,
			want:   Parsed{Type: "feat", Description: "add the thing", Subject: "feat: add the thing"},
		},
		{
			name:   "with scope",
			msg:    "fix(orders): reject unlinked items",
			wantOK: true,
			want: Parsed{
				Type: "fix", Scope: "orders", Description: "reject unlinked items",
				Subject: "fix(orders): reject unlinked items",
			},
		},
		{
			name:   "breaking marker",
			msg:    "feat(api)!: rename the size tokens",
			wantOK: true,
			want: Parsed{
				Type: "feat", Scope: "api", Breaking: true, Description: "rename the size tokens",
				Subject: "feat(api)!: rename the size tokens",
			},
		},
		{
			name:   "scope with a path",
			msg:    "chore(ci/release): pin the action",
			wantOK: true,
			want: Parsed{
				Type: "chore", Scope: "ci/release", Description: "pin the action",
				Subject: "chore(ci/release): pin the action",
			},
		},
		{
			name:   "uppercase type is normalised",
			msg:    "Feat: add the thing",
			wantOK: true,
			want:   Parsed{Type: "feat", Description: "add the thing", Subject: "Feat: add the thing"},
		},
		{name: "no colon", msg: "add the thing", wantOK: false},
		{name: "empty description", msg: "feat:", wantOK: false},
		{name: "empty message", msg: "", wantOK: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := Parse(tt.msg)
			if ok != tt.wantOK {
				t.Fatalf("Parse() ok = %v, want %v", ok, tt.wantOK)
			}
			if !ok {
				return
			}
			if got.Type != tt.want.Type || got.Scope != tt.want.Scope ||
				got.Breaking != tt.want.Breaking || got.Description != tt.want.Description ||
				got.Subject != tt.want.Subject {
				t.Errorf("Parse()\n got: %+v\nwant: %+v", got, tt.want)
			}
		})
	}
}

func TestParseBody(t *testing.T) {
	got, ok := Parse("feat: add the thing\n\n- one\n- two")
	if !ok {
		t.Fatal("Parse() failed on a message with a body")
	}
	if got.Body != "- one\n- two" {
		t.Errorf("Body = %q", got.Body)
	}
}

func TestValidate(t *testing.T) {
	cfg := config.Defaults()

	t.Run("rejects a type outside the list", func(t *testing.T) {
		p, _ := Parse("banana: peel the thing")
		if _, err := Validate(p, cfg); err == nil {
			t.Fatal("expected an error for an unknown type")
		}
	})

	t.Run("accepts a configured type", func(t *testing.T) {
		p, _ := Parse("feat: add the thing")
		warnings, err := Validate(p, cfg)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(warnings) != 0 {
			t.Fatalf("unexpected warnings: %v", warnings)
		}
	})

	t.Run("warns but does not fail on a long subject", func(t *testing.T) {
		p, _ := Parse("feat: " + strings.Repeat("x", 100))
		warnings, err := Validate(p, cfg)
		if err != nil {
			t.Fatalf("a long subject must not be fatal, got %v", err)
		}
		if len(warnings) != 1 {
			t.Fatalf("want 1 warning, got %v", warnings)
		}
	})

	t.Run("counts runes, not bytes", func(t *testing.T) {
		short := cfg
		short.SubjectMaxLength = 20
		p, _ := Parse("feat: ñññññ")
		if warnings, _ := Validate(p, short); len(warnings) != 0 {
			t.Errorf("11 runes should fit in 20, got %v", warnings)
		}
	})

	t.Run("warns when the body contract is broken", func(t *testing.T) {
		always := cfg
		always.Body = "always"
		p, _ := Parse("feat: add the thing")
		if warnings, _ := Validate(p, always); len(warnings) != 1 {
			t.Errorf("want a warning about the missing body, got %v", warnings)
		}

		never := cfg
		never.Body = "never"
		p, _ = Parse("feat: add the thing\n\n- one")
		if warnings, _ := Validate(p, never); len(warnings) != 1 {
			t.Errorf("want a warning about the unwanted body, got %v", warnings)
		}
	})
}
