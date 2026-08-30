//go:build !windows

package ui

// enableANSI is a no-op everywhere but Windows.
func enableANSI() {}
