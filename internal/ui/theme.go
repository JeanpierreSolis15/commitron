package ui

import (
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"

	"github.com/JeanpierreSolis15/commitron/internal/config"
)

const (
	reset      = "\x1b[0m"
	cursorHide = "\x1b[?25l"
	cursorShow = "\x1b[?25h"
	clearLine  = "\r\x1b[2K"
)

type Glyphs struct {
	Spark string
	OK    string
	Fail  string
	Warn  string
	Dot   string
	Minus string
}

type Theme struct {
	color   bool
	Glyph   Glyphs
	spinner []string
}

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
	case config.ModeAlways:
		return true
	case config.ModeNever:
		return false
	default:
		return auto()
	}
}

func autoColor() bool {
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

func (t *Theme) Clay(s string) string { return t.paint(clayCode, s) }

func (t *Theme) OK(s string) string { return t.paint(okCode, s) }

func (t *Theme) Bad(s string) string { return t.paint(badCode, s) }

func (t *Theme) Accent(s string) string { return t.paint(accentCode, s) }

func (t *Theme) Dim(s string) string { return t.paint(dimCode, s) }

func (t *Theme) Head(s string) string { return t.paint(headCode, s) }
