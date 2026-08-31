package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

func TestLoadInstructions(t *testing.T) {
	root := t.TempDir()
	content := strings.Repeat("ñ", 50)
	if err := os.WriteFile(filepath.Join(root, "CONVENTIONS.md"), []byte("  "+content+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	base := config.Defaults()
	base.Instructions = "CONVENTIONS.md"

	t.Run("nothing configured", func(t *testing.T) {
		text, warning := loadInstructions(root, config.Defaults())
		if text != "" || warning != "" {
			t.Errorf("got %q, %q; want nothing", text, warning)
		}
	})

	t.Run("reads and trims the file", func(t *testing.T) {
		text, warning := loadInstructions(root, base)
		if text != content {
			t.Errorf("got %q, want the trimmed file", text)
		}
		if warning != "" {
			t.Errorf("unexpected warning %q", warning)
		}
	})

	t.Run("truncates by character and warns", func(t *testing.T) {
		cfg := base
		cfg.InstructionsMaxChars = 20
		text, warning := loadInstructions(root, cfg)
		if n := utf8.RuneCountInString(text); n != 20 || !utf8.ValidString(text) {
			t.Errorf("got %d characters (valid UTF-8: %v), want 20", n, utf8.ValidString(text))
		}
		if !strings.Contains(warning, "truncated to 20 characters") {
			t.Errorf("got warning %q", warning)
		}
	})

	t.Run("zero means no limit", func(t *testing.T) {
		cfg := base
		cfg.InstructionsMaxChars = 0
		if text, _ := loadInstructions(root, cfg); text != content {
			t.Errorf("got %q, want the whole file", text)
		}
	})

	t.Run("missing file is a warning", func(t *testing.T) {
		cfg := base
		cfg.Instructions = "missing.md"
		text, warning := loadInstructions(root, cfg)
		if text != "" || !strings.Contains(warning, "not found") {
			t.Errorf("got %q, %q; want an empty text and a not-found warning", text, warning)
		}
	})
}
