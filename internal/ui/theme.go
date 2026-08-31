// Package ui draws everything commitron shows. All of it goes to stderr so
// stdout stays clean for piping.
package ui

import (
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
)

const (
	reset      = "\x1b[0m"
	cursorHide = "\x1b[?25l"
	cursorShow = "\x1b[?25h"
	clearLine  = "\r\x1b[2K"
)

// Glyphs are the symbols in the output, with an ASCII fallback for terminals
// that cannot render the nice ones.
type Glyphs struct {
	Spark string
	OK    string
	Fail  string
	Warn  string
	Dot   string
	Minus string
}

// Theme carries the resolved color and unicode decisions.
type Theme struct {
	color   bool
	Glyph   Glyphs
	spinner []string
}

// New resolves "auto", "always" and "never" for color and unicode.
func New(colorMode, unicodeMode string) *Theme {
	color := resolve(colorMode, autoColor)
	if color {
		enableANSI()
	}
	t := &Theme{color: color}
	if resolve(unicodeMode, autoUnicode) {
		t.Glyph = Glyphs{Spark: "✳", OK: "✓", Fail: "✗", Warn: "!", Dot: "·", Minus: "−"}
		t.spinner = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	} else {
		t.Glyph = Glyphs{Spark: "*", OK: "OK", Fail: "x", Warn: "!", Dot: "-", Minus: "-"}
		t.spinner = []string{"|", "/", "-", "\\"}
	}
	return t
}

func resolve(mode string, auto func() bool) bool {
	switch mode {
	case "always":
		return true
	case "never":
		return false
	default:
		return auto()
	}
}

func autoColor() bool {
	// NO_COLOR counts only when it has a value (https://no-color.org).
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	if os.Getenv("TERM") == "dumb" {
		return false
	}
	return IsTerminal(os.Stderr)
}

func autoUnicode() bool {
	if runtime.GOOS == "windows" {
		return os.Getenv("WT_SESSION") != "" ||
			os.Getenv("TERM_PROGRAM") != "" ||
			os.Getenv("MSYSTEM") != ""
	}
	for _, key := range []string{"LC_ALL", "LC_CTYPE", "LANG"} {
		v := strings.ToLower(os.Getenv(key))
		if strings.Contains(v, "utf-8") || strings.Contains(v, "utf8") {
			return true
		}
	}
	return false
}

// IsTerminal reports whether f is attached to a terminal.
func IsTerminal(f *os.File) bool { return isTerminal(f) }

func fg(hex string) string {
	n, err := strconv.ParseUint(strings.TrimPrefix(hex, "#"), 16, 32)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("\x1b[38;2;%d;%d;%dm", (n>>16)&255, (n>>8)&255, n&255)
}

var (
	clayCode   = fg("#D56C4E")
	okCode     = fg("#4FB286")
	badCode    = fg("#E06C5E")
	accentCode = fg("#D9A441")
	dimCode    = "\x1b[2m"
	headCode   = "\x1b[97m"
)

func (t *Theme) paint(code, s string) string {
	if !t.color || s == "" {
		return s
	}
	return code + s + reset
}

// Clay is the brand accent used for the spinner and the header mark.
func (t *Theme) Clay(s string) string { return t.paint(clayCode, s) }

// OK is green: additions and success.
func (t *Theme) OK(s string) string { return t.paint(okCode, s) }

// Bad is red: deletions and failures.
func (t *Theme) Bad(s string) string { return t.paint(badCode, s) }

// Accent is amber: the commit type.
func (t *Theme) Accent(s string) string { return t.paint(accentCode, s) }

// Dim is for secondary text.
func (t *Theme) Dim(s string) string { return t.paint(dimCode, s) }

// Head is bright white: the text that matters most.
func (t *Theme) Head(s string) string { return t.paint(headCode, s) }
