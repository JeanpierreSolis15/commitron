//go:build !windows

package ui

// enableANSI is a no-op outside Windows.
func enableANSI() {}
