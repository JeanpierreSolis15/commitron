//go:build windows

package ui

import (
	"syscall"
	"unsafe"
)

const enableVirtualTerminalProcessing = 0x0004

// enableANSI switches on VT processing so escape sequences work in conhost and
// PowerShell, not just in Windows Terminal. Done with syscall to keep the
// binary dependency-free.
func enableANSI() {
	handle, err := syscall.GetStdHandle(syscall.STD_ERROR_HANDLE)
	if err != nil {
		return
	}
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getConsoleMode := kernel32.NewProc("GetConsoleMode")
	setConsoleMode := kernel32.NewProc("SetConsoleMode")

	var mode uint32
	if ret, _, _ := getConsoleMode.Call(uintptr(handle), uintptr(unsafe.Pointer(&mode))); ret == 0 {
		return
	}
	if mode&enableVirtualTerminalProcessing != 0 {
		return
	}
	setConsoleMode.Call(uintptr(handle), uintptr(mode|enableVirtualTerminalProcessing))
}
