//go:build windows

package ui

import (
	"os"
	"strings"
	"syscall"
	"unsafe"
)

const fileNameInfo = 2

var (
	kernel32                         = syscall.NewLazyDLL("kernel32.dll")
	procSetConsoleMode               = kernel32.NewProc("SetConsoleMode")
	procGetFileInformationByHandleEx = kernel32.NewProc("GetFileInformationByHandleEx")
)

// isTerminal has to handle two kinds of console on Windows: the real one, which
// answers GetConsoleMode, and the mintty pty that Git Bash and MSYS2 hand out,
// which is a named pipe and would otherwise look like a redirect.
func isTerminal(f *os.File) bool {
	var mode uint32
	if err := syscall.GetConsoleMode(syscall.Handle(f.Fd()), &mode); err == nil {
		return true
	}
	return isMinttyPty(f)
}

// isMinttyPty recognises pipe names like \msys-1888ae32e00d56aa-pty0-to-master.
func isMinttyPty(f *os.File) bool {
	var buf [syscall.MAX_PATH*2 + 4]byte
	ret, _, _ := procGetFileInformationByHandleEx.Call(
		f.Fd(),
		uintptr(fileNameInfo),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(len(buf)),
	)
	if ret == 0 {
		return false
	}
	length := *(*uint32)(unsafe.Pointer(&buf[0]))
	if length == 0 || int(length)+4 > len(buf) {
		return false
	}
	name := syscall.UTF16ToString(unsafe.Slice((*uint16)(unsafe.Pointer(&buf[4])), length/2))
	if !strings.Contains(name, "-pty") {
		return false
	}
	return strings.HasPrefix(name, `\msys-`) || strings.HasPrefix(name, `\cygwin-`) ||
		strings.HasPrefix(name, `msys-`) || strings.HasPrefix(name, `cygwin-`)
}

const enableVirtualTerminalProcessing = 0x0004

// enableANSI switches on VT processing so escape sequences work in conhost and
// PowerShell, not only in Windows Terminal.
func enableANSI() {
	handle := syscall.Handle(os.Stderr.Fd())
	var mode uint32
	if err := syscall.GetConsoleMode(handle, &mode); err != nil {
		return // mintty already speaks ANSI
	}
	if mode&enableVirtualTerminalProcessing == 0 {
		procSetConsoleMode.Call(uintptr(handle), uintptr(mode|enableVirtualTerminalProcessing))
	}
}
