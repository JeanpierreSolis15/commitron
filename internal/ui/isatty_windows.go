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

func isTerminal(f *os.File) bool {
	var mode uint32
	if err := syscall.GetConsoleMode(syscall.Handle(f.Fd()), &mode); err == nil {
		return true
	}
	return isMinttyPty(f)
}

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

func enableANSI() {
	handle := syscall.Handle(os.Stderr.Fd())
	var mode uint32
	if err := syscall.GetConsoleMode(handle, &mode); err != nil {
		return
	}
	if mode&enableVirtualTerminalProcessing == 0 {
		procSetConsoleMode.Call(uintptr(handle), uintptr(mode|enableVirtualTerminalProcessing))
	}
}
